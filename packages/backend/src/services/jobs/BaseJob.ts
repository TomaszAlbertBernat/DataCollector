/**
 * Base Job Class
 * 
 * Abstract base class for all job implementations.
 * Provides common functionality and enforces the job processing pattern.
 */

import { JobData, JobStatus, ILogger, IStatusNotifier, IServiceContainer, IConfig } from '../../types/job';
import { Job } from '../../models/Job';

/**
 * Abstract base class for all job types
 * 
 * This class demonstrates the clear separation between:
 * - JobData (from types/) - for runtime job processing
 * - Job (from models/) - for database persistence
 */
export abstract class BaseJob {
  protected readonly jobData: JobData;
  protected readonly logger: ILogger;
  protected readonly statusNotifier: IStatusNotifier;
  protected readonly services: IServiceContainer;
  protected readonly config: IConfig;
  
  // Database model instance for persistence
  protected jobModel: Job;
  
  // Job execution state
  private _isRunning: boolean = false;
  private _isCancelled: boolean = false;
  private _startTime: Date | null = null;

  constructor(
    jobData: JobData,
    logger: ILogger,
    statusNotifier: IStatusNotifier,
    services: IServiceContainer,
    config: IConfig
  ) {
    this.jobData = jobData;
    this.logger = logger;
    this.statusNotifier = statusNotifier;
    this.services = services;
    this.config = config;
    
    // Create database model from job data
    this.jobModel = Job.fromDatabaseRow({
      id: jobData.id,
      type: jobData.type,
      status: jobData.status,
      query: jobData.query,
      progress: jobData.progress,
      user_id: jobData.userId || null,
      created_at: jobData.createdAt,
      started_at: jobData.startedAt || null,
      completed_at: jobData.completedAt || null,
      error_message: jobData.errorMessage || null,
      metadata: jobData.metadata,
      results: {}
    });
  }

  /**
   * Abstract methods that must be implemented by specific job types
   */
  abstract validate(): Promise<void>;
  abstract execute(): Promise<void>;

  /**
   * Main job processing method called by JobProcessor
   */
  async process(): Promise<void> {
    try {
      this.logger.info(`Starting job processing`, { jobId: this.jobData.id, type: this.jobData.type });
      
      this._isRunning = true;
      this._startTime = new Date();
      
      // Update status to running
      await this.updateStatus(JobStatus.RUNNING);
      
      // Validate job data
      await this.validate();
      this.logger.debug('Job validation completed');
      
      // Check if cancelled during validation
      if (this._isCancelled) {
        await this.handleCancellation();
        return;
      }
      
      // Execute the specific job logic
      await this.execute();
      
      // Mark as completed if not cancelled
      if (!this._isCancelled) {
        await this.onSuccess();
      }
      
         } catch (error) {
       const err = error as Error;
       this.logger.error('Job processing failed', { 
         jobId: this.jobData.id, 
         error: err.message,
         stack: err.stack 
       });
       
       await this.onFailure(err);
    } finally {
      this._isRunning = false;
    }
  }

  /**
   * Cancel the job
   */
  async cancel(reason?: string): Promise<void> {
    this.logger.info(`Cancelling job`, { jobId: this.jobData.id, reason });
    
    this._isCancelled = true;
    
    if (this._isRunning) {
      // Let the current processing finish gracefully
      await this.handleCancellation();
    } else {
      await this.updateStatus(JobStatus.CANCELLED);
      await this.statusNotifier.broadcast(
        this.jobData.id, 
        JobStatus.CANCELLED, 
        reason || 'Job was cancelled'
      );
    }
  }

  /**
   * Success handler - called when job completes successfully
   */
  async onSuccess(): Promise<void> {
    const duration = this.getDuration();
    
    this.logger.info(`Job completed successfully`, { 
      jobId: this.jobData.id, 
      duration: `${duration}ms` 
    });
    
    await this.updateStatus(JobStatus.COMPLETED);
    await this.updateProgress(100, 'Job completed successfully');
    
    await this.statusNotifier.broadcast(
      this.jobData.id,
      JobStatus.COMPLETED,
      'Job completed successfully',
      {
        duration,
        results: this.jobModel.results
      }
    );
  }

  /**
   * Failure handler - called when job fails
   */
  async onFailure(error: Error): Promise<void> {
    const duration = this.getDuration();
    
    this.logger.error(`Job failed`, { 
      jobId: this.jobData.id, 
      error: error.message, 
      duration: `${duration}ms` 
    });
    
    // Update model with error
    this.jobModel.setError(error.message);
    
    await this.updateStatus(JobStatus.FAILED, error.message);
    
    await this.statusNotifier.broadcast(
      this.jobData.id,
      JobStatus.FAILED,
      error.message,
      {
        duration,
        errorDetails: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    );
  }

  /**
   * Handle job cancellation
   */
  protected async handleCancellation(): Promise<void> {
    await this.updateStatus(JobStatus.CANCELLED);
    
    await this.statusNotifier.broadcast(
      this.jobData.id,
      JobStatus.CANCELLED,
      'Job was cancelled'
    );
  }

  /**
   * Update job status in database and notify
   */
  protected async updateStatus(status: JobStatus, message?: string): Promise<void> {
    this.jobModel.updateStatus(status);
    
    // Persist to database
    const jobRepository = this.services.get<any>('jobRepository');
    await jobRepository.update(this.jobData.id, {
      status,
      error_message: message || null,
      started_at: this.jobModel.startedAt,
      completed_at: this.jobModel.completedAt
    });
    
    this.logger.debug(`Job status updated`, { 
      jobId: this.jobData.id, 
      status, 
      message 
    });
  }

  /**
   * Update job progress and notify
   */
  protected async updateProgress(progress: number, message?: string): Promise<void> {
    this.jobModel.updateProgress(progress);
    
    // Persist to database
    const jobRepository = this.services.get<any>('jobRepository');
    await jobRepository.update(this.jobData.id, {
      progress: this.jobModel.progress
    });
    
    await this.statusNotifier.broadcast(
      this.jobData.id,
      this.jobModel.status,
      message,
      {
        progress: this.jobModel.progress,
        stage: this.getCurrentStage()
      }
    );
    
    this.logger.debug(`Job progress updated`, { 
      jobId: this.jobData.id, 
      progress, 
      message 
    });
  }

  /**
   * Update job results
   */
  protected async updateResults(results: Record<string, any>): Promise<void> {
    this.jobModel.results = { ...this.jobModel.results, ...results };
    
    // Persist to database
    const jobRepository = this.services.get<any>('jobRepository');
    await jobRepository.update(this.jobData.id, {
      results: this.jobModel.results
    });
  }

  /**
   * Get current processing stage (to be overridden by specific jobs)
   */
  protected getCurrentStage(): string {
    switch (this.jobModel.status) {
      case JobStatus.ANALYZING: return 'Analyzing query';
      case JobStatus.SEARCHING: return 'Searching sources';
      case JobStatus.DOWNLOADING: return 'Downloading content';
      case JobStatus.PROCESSING: return 'Processing files';
      case JobStatus.INDEXING: return 'Indexing content';
      default: return 'Processing';
    }
  }

  /**
   * Check if job should continue processing
   */
  protected shouldContinue(): boolean {
    return !this._isCancelled && this._isRunning;
  }

  /**
   * Get job execution duration
   */
  private getDuration(): number {
    if (!this._startTime) return 0;
    return Date.now() - this._startTime.getTime();
  }

  /**
   * Get job execution statistics
   */
  getExecutionStats(): JobExecutionStats {
    return {
      isRunning: this._isRunning,
      isCancelled: this._isCancelled,
      startTime: this._startTime,
      duration: this.getDuration(),
      progress: this.jobModel.progress,
      status: this.jobModel.status
    };
  }

  /**
   * Get current job model state
   */
  getJobModel(): Job {
    return this.jobModel;
  }
}

/**
 * Job execution statistics
 */
export interface JobExecutionStats {
  isRunning: boolean;
  isCancelled: boolean;
  startTime: Date | null;
  duration: number;
  progress: number;
  status: JobStatus;
}

/**
 * Job step interface for tracking detailed progress
 */
export interface JobStep {
  name: string;
  description: string;
  weight: number; // Percentage of total job
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

/**
 * Job execution context with step tracking
 */
export interface JobExecutionContext {
  currentStep: number;
  totalSteps: number;
  steps: JobStep[];
  metadata: Record<string, any>;
}

/**
 * Helper class for managing job steps
 */
export class JobStepManager {
  private steps: JobStep[] = [];
  private currentStepIndex: number = -1;

  constructor(private job: BaseJob) {}

  addStep(step: Omit<JobStep, 'status'>): void {
    this.steps.push({
      ...step,
      status: 'pending'
    });
  }

     async startStep(stepName: string): Promise<void> {
     const stepIndex = this.steps.findIndex(s => s.name === stepName);
     if (stepIndex === -1) {
       throw new Error(`Step '${stepName}' not found`);
     }

     this.currentStepIndex = stepIndex;
     const step = this.steps[stepIndex];
     if (step) {
       step.status = 'running';
       step.startTime = new Date();

       // Calculate progress based on completed steps
       const progress = this.calculateProgress();
       await (this.job as any).updateProgress(progress, step.description);
     }
   }

     async completeStep(stepName: string): Promise<void> {
     const stepIndex = this.steps.findIndex(s => s.name === stepName);
     if (stepIndex === -1) {
       throw new Error(`Step '${stepName}' not found`);
     }

     const step = this.steps[stepIndex];
     if (step) {
       step.status = 'completed';
       step.endTime = new Date();

       const progress = this.calculateProgress();
       await (this.job as any).updateProgress(progress, `Completed: ${step.description}`);
     }
   }

     async failStep(stepName: string, error: string): Promise<void> {
     const stepIndex = this.steps.findIndex(s => s.name === stepName);
     if (stepIndex === -1) {
       throw new Error(`Step '${stepName}' not found`);
     }

     const step = this.steps[stepIndex];
     if (step) {
       step.status = 'failed';
       step.endTime = new Date();
       step.error = error;
     }
   }

  private calculateProgress(): number {
    const completedWeight = this.steps
      .filter(s => s.status === 'completed')
      .reduce((sum, step) => sum + step.weight, 0);
    
    return Math.min(95, completedWeight); // Never show 100% until job is fully complete
  }

  getSteps(): JobStep[] {
    return [...this.steps];
  }

     getCurrentStep(): JobStep | null {
     return this.currentStepIndex >= 0 ? this.steps[this.currentStepIndex] || null : null;
   }
} 