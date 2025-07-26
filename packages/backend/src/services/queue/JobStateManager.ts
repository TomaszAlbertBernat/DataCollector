import { Pool } from 'pg';
import winston from 'winston';
import { Server as SocketIOServer } from 'socket.io';

import { Job, JobDatabaseRow, JobApiData } from '../../models/Job';
import { JobData, JobStatus, JobType, isValidStateTransition, JobProgressUpdate } from '../../types/job';
import { JobStatusUpdateMessage, WebSocketMessageType, JobProgressUpdateMessage } from '../../types/api';

export interface JobStateManagerConfig {
  enableWebSocket: boolean;
  progressUpdateInterval: number; // milliseconds
  jobTimeoutDuration: number; // milliseconds
}

export interface JobCreateRequest {
  id: string;
  type: JobType;
  query: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface JobUpdateData {
  status?: JobStatus;
  progress?: number;
  message?: string;
  results?: Record<string, any>;
  errorMessage?: string;
}

export class JobStateManager {
  private pgPool: Pool;
  private logger: winston.Logger;
  private io?: SocketIOServer;
  private config: JobStateManagerConfig;

  constructor(
    pgPool: Pool, 
    logger: winston.Logger, 
    config: JobStateManagerConfig,
    io?: SocketIOServer
  ) {
    this.pgPool = pgPool;
    this.logger = logger;
    this.config = config;
    if (io) {
      this.io = io;
    }
  }

  /**
   * Create a new job in the database
   */
  async createJob(request: JobCreateRequest): Promise<Job> {
    const client = await this.pgPool.connect();
    
    try {
      await client.query('BEGIN');

      const jobData = {
        id: request.id,
        type: request.type,
        query: request.query,
        status: JobStatus.PENDING,
        metadata: request.metadata || {}
      };

      if (request.userId) {
        (jobData as any).userId = request.userId;
      }

      const job = new Job(jobData);

      const dbRow = job.toDatabaseRow();
      
      const insertQuery = `
        INSERT INTO jobs (
          id, type, status, query, progress, user_id, 
          created_at, metadata, results
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        dbRow.id,
        dbRow.type,
        dbRow.status,
        dbRow.query,
        dbRow.progress,
        dbRow.user_id,
        dbRow.created_at,
        JSON.stringify(dbRow.metadata),
        JSON.stringify(dbRow.results)
      ];

      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');

      const createdJob = Job.fromDatabaseRow({
        ...result.rows[0],
        metadata: result.rows[0].metadata,
        results: result.rows[0].results
      });

      this.logger.info('Job created in database', {
        jobId: createdJob.id,
        type: createdJob.type,
        status: createdJob.status
      });

      // Broadcast job creation
      await this.broadcastJobStatusUpdate(createdJob, 'Job created and queued');

      return createdJob;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create job', {
        jobId: request.id,
        error: (error as Error).message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update job status with validation
   */
  async updateJobStatus(
    jobId: string, 
    newStatus: JobStatus, 
    updates: Partial<JobUpdateData> = {}
  ): Promise<Job> {
    const client = await this.pgPool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current job state
      const currentJob = await this.getJobById(jobId);
      if (!currentJob) {
        throw new Error(`Job with ID ${jobId} not found`);
      }

      // Validate state transition
      if (!isValidStateTransition(currentJob.status, newStatus)) {
        throw new Error(
          `Invalid state transition from ${currentJob.status} to ${newStatus}`
        );
      }

      // Update job model
      currentJob.updateStatus(newStatus);
      
      if (updates.progress !== undefined) {
        currentJob.updateProgress(updates.progress);
      }
      
      if (updates.errorMessage) {
        currentJob.setError(updates.errorMessage);
      }

      if (updates.results) {
        currentJob.results = { ...currentJob.results, ...updates.results };
      }

      // Update database
      const updateQuery = `
        UPDATE jobs 
        SET status = $2, progress = $3, started_at = $4, completed_at = $5, 
            error_message = $6, results = $7, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const dbRow = currentJob.toDatabaseRow();
      const values = [
        dbRow.id,
        dbRow.status,
        dbRow.progress,
        dbRow.started_at,
        dbRow.completed_at,
        dbRow.error_message,
        JSON.stringify(dbRow.results)
      ];

      const result = await client.query(updateQuery, values);
      await client.query('COMMIT');

      const updatedJob = Job.fromDatabaseRow({
        ...result.rows[0],
        metadata: result.rows[0].metadata,
        results: result.rows[0].results
      });

      this.logger.info('Job status updated', {
        jobId: updatedJob.id,
        oldStatus: currentJob.status,
        newStatus: updatedJob.status,
        progress: updatedJob.progress
      });

      // Broadcast status update
      await this.broadcastJobStatusUpdate(updatedJob, updates.message);

      return updatedJob;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update job status', {
        jobId,
        newStatus,
        error: (error as Error).message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update job progress
   */
  async updateJobProgress(
    jobId: string, 
    progress: number, 
    message?: string,
    stage?: string
  ): Promise<void> {
    try {
      const updateQuery = `
        UPDATE jobs 
        SET progress = $2, updated_at = NOW()
        WHERE id = $1
      `;

      await this.pgPool.query(updateQuery, [jobId, progress]);

      this.logger.debug('Job progress updated', {
        jobId,
        progress,
        message,
        stage
      });

      // Broadcast progress update
      if (this.config.enableWebSocket && this.io) {
        const progressMessage: JobProgressUpdateMessage = {
          type: WebSocketMessageType.JOB_PROGRESS_UPDATE,
          timestamp: new Date().toISOString(),
          data: {
            jobId,
            progress,
            message: message || `Progress: ${progress}%`,
            stage: stage || 'Processing'
          }
        };

        this.io.to(`job_${jobId}`).emit('job_progress', progressMessage);
      }

    } catch (error) {
      this.logger.error('Failed to update job progress', {
        jobId,
        progress,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId: string): Promise<Job | null> {
    try {
      const query = 'SELECT * FROM jobs WHERE id = $1';
      const result = await this.pgPool.query(query, [jobId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return Job.fromDatabaseRow({
        ...row,
        metadata: row.metadata || {},
        results: row.results || {}
      });

    } catch (error) {
      this.logger.error('Failed to get job by ID', {
        jobId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get jobs by user ID with pagination
   */
  async getJobsByUserId(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ jobs: Job[]; total: number }> {
    try {
      const countQuery = 'SELECT COUNT(*) FROM jobs WHERE user_id = $1';
      const countResult = await this.pgPool.query(countQuery, [userId]);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT * FROM jobs 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pgPool.query(query, [userId, limit, offset]);

      const jobs = result.rows.map(row => Job.fromDatabaseRow({
        ...row,
        metadata: row.metadata || {},
        results: row.results || {}
      }));

      return { jobs, total };

    } catch (error) {
      this.logger.error('Failed to get jobs by user ID', {
        userId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus): Promise<Job[]> {
    try {
      const query = 'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at ASC';
      const result = await this.pgPool.query(query, [status]);

      return result.rows.map(row => Job.fromDatabaseRow({
        ...row,
        metadata: row.metadata || {},
        results: row.results || {}
      }));

    } catch (error) {
      this.logger.error('Failed to get jobs by status', {
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const query = 'DELETE FROM jobs WHERE id = $1';
      const result = await this.pgPool.query(query, [jobId]);

      const deleted = result.rowCount! > 0;
      if (deleted) {
        this.logger.info('Job deleted', { jobId });
      }

      return deleted;

    } catch (error) {
      this.logger.error('Failed to delete job', {
        jobId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    try {
      const query = `
        DELETE FROM jobs 
        WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
        AND status IN ($1, $2, $3)
      `;
      
      const result = await this.pgPool.query(query, [
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.CANCELLED
      ]);

      const deletedCount = result.rowCount || 0;
      
      this.logger.info('Old jobs cleaned up', {
        deletedCount,
        olderThanDays
      });

      return deletedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup old jobs', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(): Promise<Record<string, any>> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          AVG(CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))
          END) as avg_duration_seconds
        FROM jobs 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `;

      const result = await this.pgPool.query(query);
      return result.rows[0];

    } catch (error) {
      this.logger.error('Failed to get job statistics', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Broadcast job status update via WebSocket
   */
  private async broadcastJobStatusUpdate(job: Job, message?: string): Promise<void> {
    if (!this.config.enableWebSocket || !this.io) {
      return;
    }

    try {
      const statusMessage: JobStatusUpdateMessage = {
        type: WebSocketMessageType.JOB_STATUS_UPDATE,
        timestamp: new Date().toISOString(),
        data: {
          jobId: job.id,
          status: job.status,
          message: message || `Job status: ${job.status}`,
          progress: job.progress
        }
      };

      this.io.to(`job_${job.id}`).emit('job_status', statusMessage);

      this.logger.debug('Job status broadcasted', {
        jobId: job.id,
        status: job.status,
        subscribers: this.io.sockets.adapter.rooms.get(`job_${job.id}`)?.size || 0
      });

    } catch (error) {
      this.logger.error('Failed to broadcast job status', {
        jobId: job.id,
        error: (error as Error).message
      });
    }
  }
}

// Factory function
export const createJobStateManager = (
  pgPool: Pool,
  logger: winston.Logger,
  io?: SocketIOServer
): JobStateManager => {
  const config: JobStateManagerConfig = {
    enableWebSocket: Boolean(io),
    progressUpdateInterval: Number(process.env.PROGRESS_UPDATE_INTERVAL) || 1000,
    jobTimeoutDuration: Number(process.env.JOB_TIMEOUT_DURATION) || 30 * 60 * 1000 // 30 minutes
  };

  return new JobStateManager(pgPool, logger, config, io);
}; 