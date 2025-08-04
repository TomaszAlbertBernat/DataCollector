import request from 'supertest';
import express from 'express';
import { createJobRouter, JobRouterDependencies } from '../routes/jobs';
import { JobQueue } from '../services/queue/JobQueue';
import { JobStateManager } from '../services/queue/JobStateManager';
import { JobProcessor } from '../services/queue/JobProcessor';
import { JobType, JobStatus, JobPriority } from '../types/job';
import { Job } from '../models/Job';
import winston from 'winston';

// Mock dependencies
jest.mock('../services/queue/JobQueue');
jest.mock('../services/queue/JobStateManager');
jest.mock('../services/queue/JobProcessor');

describe('Jobs Router', () => {
  let app: express.Application;
  let mockJobQueue: jest.Mocked<JobQueue>;
  let mockStateManager: jest.Mocked<JobStateManager>;
  let mockProcessor: jest.Mocked<JobProcessor>;
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    // Create mocked instances
    mockJobQueue = {
      submitJob: jest.fn(),
      cancelJob: jest.fn(),
      getStats: jest.fn(),
      getJobDetails: jest.fn(),
      initialize: jest.fn(),
      close: jest.fn(),
    } as any;

    mockStateManager = {
      createJob: jest.fn(),
      getJobById: jest.fn(),
      updateJobStatus: jest.fn(),
      getJobsByUserId: jest.fn(),
      getJobsByStatus: jest.fn(),
      deleteJob: jest.fn(),
      close: jest.fn(),
    } as any;

    mockProcessor = {
      getStats: jest.fn(),
      initialize: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create app with router
    app = express();
    app.use(express.json());
    
    const deps: JobRouterDependencies = {
      jobQueue: mockJobQueue,
      stateManager: mockStateManager,
      processor: mockProcessor,
      logger: mockLogger,
    };
    
    app.use('/api/jobs', createJobRouter(deps));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/jobs/collection', () => {
    it('should create a collection job with valid data', async () => {
      const jobData = {
        query: 'machine learning',
        sources: ['google_scholar'],
        options: {
          maxResults: 10,
          dateFrom: '2023-01-01',
          fileTypes: ['pdf']
        }
      };

      const mockJob = new Job({
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: JobType.COLLECTION,
        query: 'machine learning',
        status: JobStatus.PENDING,
        metadata: {
          sources: ['google_scholar'],
          options: {
            maxResults: 10,
            priority: JobPriority.NORMAL
          }
        }
      });

      mockJobQueue.submitJob.mockResolvedValue({ jobId: '550e8400-e29b-41d4-a716-446655440000' });
      mockStateManager.createJob.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/jobs/collection')
        .send(jobData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          jobId: '550e8400-e29b-41d4-a716-446655440000',
          status: 'pending'
        }
      });

      expect(mockJobQueue.submitJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: JobType.COLLECTION,
          query: 'machine learning',
          metadata: expect.objectContaining({
            sources: ['google_scholar']
          })
        })
      );
    });

    it('should reject invalid query', async () => {
      const response = await request(app)
        .post('/api/jobs/collection')
        .send({
          query: '', // Empty query
          sources: ['google_scholar']
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid request data');
    });

    it('should reject query that is too long', async () => {
      const longQuery = 'a'.repeat(1001); // Over 1000 characters

      const response = await request(app)
        .post('/api/jobs/collection')
        .send({
          query: longQuery,
          sources: ['google_scholar']
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid request data');
    });

    it('should handle job creation errors', async () => {
      mockJobQueue.submitJob.mockRejectedValue(new Error('Queue error'));

      await request(app)
        .post('/api/jobs/collection')
        .send({
          query: 'machine learning',
          sources: ['google_scholar']
        })
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('GET /api/jobs', () => {
    it('should list jobs with default parameters', async () => {
      const mockJobs = [
        new Job({
          id: '550e8400-e29b-41d4-a716-446655440001',
          type: JobType.COLLECTION,
          query: 'test query 1',
          status: JobStatus.COMPLETED,
        }),
        new Job({
          id: '550e8400-e29b-41d4-a716-446655440002',
          type: JobType.COLLECTION,
          query: 'test query 2',
          status: JobStatus.PENDING,
        })
      ];

      mockStateManager.getJobsByUserId.mockResolvedValue({
        jobs: mockJobs,
        total: 2
      });

      const response = await request(app)
        .get('/api/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter jobs by status', async () => {
      const mockJobs = [
        new Job({
          id: '550e8400-e29b-41d4-a716-446655440003',
          type: JobType.COLLECTION,
          query: 'test query',
          status: JobStatus.COMPLETED,
        })
      ];

      mockStateManager.getJobsByUserId.mockResolvedValue({
        jobs: mockJobs,
        total: 1
      });

      const response = await request(app)
        .get('/api/jobs?status=completed')
        .expect(200);

      expect(mockStateManager.getJobsByUserId).toHaveBeenCalledWith(
        'anonymous',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle pagination parameters', async () => {
      mockStateManager.getJobsByUserId.mockResolvedValue({
        jobs: [],
        total: 20
      });

      const response = await request(app)
        .get('/api/jobs?page=2&limit=5')
        .expect(200);

      expect(mockStateManager.getJobsByUserId).toHaveBeenCalledWith(
        'anonymous',
        5, // limit
        5  // offset (page 2, limit 5 = offset 5)
      );
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should get job by valid ID', async () => {
      const mockJob = new Job({
        id: '550e8400-e29b-41d4-a716-446655440004',
        type: JobType.COLLECTION,
        query: 'test query',
        status: JobStatus.COMPLETED,
      });

      mockStateManager.getJobById.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/jobs/550e8400-e29b-41d4-a716-446655440004')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440004');
    });

    it('should return 404 for non-existent job', async () => {
      mockStateManager.getJobById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/jobs/550e8400-e29b-41d4-a716-446655440005')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Job with ID');
    });

    it('should reject invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/jobs/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid job ID');
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    it('should cancel job successfully', async () => {
      const mockJob = new Job({
        id: '550e8400-e29b-41d4-a716-446655440006',
        type: JobType.COLLECTION,
        query: 'test query',
        status: JobStatus.PENDING,
      });

      mockStateManager.getJobById.mockResolvedValue(mockJob);
      mockJobQueue.cancelJob.mockResolvedValue(true);
      mockStateManager.updateJobStatus.mockResolvedValue({} as any);

      const response = await request(app)
        .delete('/api/jobs/550e8400-e29b-41d4-a716-446655440006')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockJobQueue.cancelJob).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440006', JobType.COLLECTION);
      expect(mockStateManager.updateJobStatus).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440006',
        JobStatus.CANCELLED,
        { message: 'Job cancelled by user' }
      );
    });

    it('should return 404 for non-existent job', async () => {
      mockStateManager.getJobById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/jobs/550e8400-e29b-41d4-a716-446655440007')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle cancellation errors', async () => {
      const mockJob = new Job({
        id: '550e8400-e29b-41d4-a716-446655440006',
        type: JobType.COLLECTION,
        query: 'test query',
        status: JobStatus.PENDING,
      });

      mockStateManager.getJobById.mockResolvedValue(mockJob);
      mockJobQueue.cancelJob.mockRejectedValue(new Error('Cancellation failed'));

      await request(app)
        .delete('/api/jobs/550e8400-e29b-41d4-a716-446655440006')
        .expect(500);
    });
  });


});