import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { JobType, JobStatus } from '../types/job';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/json',
    'text/plain',
    'text/html'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '100000000'), // 100MB default
    files: parseInt(process.env.UPLOAD_MAX_FILES || '10') // 10 files max
  }
});

export const createUploadRouter = (deps: any): Router => {
  const router = Router();
  const { jobQueue, stateManager, logger } = deps;

  // Single file upload
  router.post('/single',
    upload.single('file'),
    [
      body('description').optional().isString().isLength({ max: 500 }),
      body('tags').optional().isArray(),
      body('generateEmbeddings').optional().isBoolean(),
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, error: errors.array() });
        }
        if (!req.file) {
          return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        const jobId = uuidv4();
        const userId = req.headers['x-user-id'] as string || 'anonymous';
        logger.info('Creating upload processing job', {
          jobId,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          userId
        });
        const createJobData = {
          id: jobId,
          type: JobType.PROCESSING,
          query: `Process uploaded file: ${req.file.originalname}`,
          userId,
          metadata: {
            uploadInfo: {
              originalName: req.file.originalname,
              fileName: req.file.filename,
              filePath: req.file.path,
              fileSize: req.file.size,
              mimeType: req.file.mimetype,
              description: req.body.description,
              tags: req.body.tags ? JSON.parse(req.body.tags) : [],
              uploadedAt: new Date().toISOString()
            },
            processingOptions: {
              generateEmbeddings: req.body.generateEmbeddings === 'true'
            }
          }
        };
        const job = await stateManager.createJob(createJobData);
        const jobData = {
          id: jobId,
          type: JobType.PROCESSING,
          status: JobStatus.PENDING,
          query: `Process uploaded file: ${req.file.originalname}`,
          progress: 0,
          userId,
          metadata: {
            downloadUrls: [`file://${req.file.path}`],
            processingOptions: {
              generateEmbeddings: req.body.generateEmbeddings === 'true'
            }
          },
          createdAt: job.createdAt
        };
        const submission = await jobQueue.submitJob(jobData);
        res.json({
          success: true,
          data: {
            jobId: submission.jobId,
            status: JobStatus.PENDING,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            estimatedDuration: submission.estimatedStartTime ? Math.round((submission.estimatedStartTime.getTime() - Date.now()) / 1000) : undefined,
            queuePosition: submission.queuePosition
          },
          timestamp: new Date().toISOString()
        });
        return;
      } catch (error) {
        logger.error('Upload API error:', error as Error);
        next(error);
        return;
      }
    }
  );

  // Multiple file upload
  router.post('/multiple',
    upload.array('files', parseInt(process.env.UPLOAD_MAX_FILES || '10')),
    [
      body('description').optional().isString().isLength({ max: 500 }),
      body('tags').optional().isArray(),
      body('generateEmbeddings').optional().isBoolean(),
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, error: errors.array() });
        }
        if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
          return res.status(400).json({ success: false, error: 'No files uploaded' });
        }
        const files = req.files as Express.Multer.File[];
        const jobId = uuidv4();
        const userId = req.headers['x-user-id'] as string || 'anonymous';
        logger.info('Creating multiple upload processing job', {
          jobId,
          fileCount: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          userId
        });
        const createJobData = {
          id: jobId,
          type: JobType.PROCESSING,
          query: `Process ${files.length} uploaded files`,
          userId,
          metadata: {
            uploadInfo: {
              fileCount: files.length,
              files: files.map(file => ({
                originalName: file.originalname,
                fileName: file.filename,
                filePath: file.path,
                fileSize: file.size,
                mimeType: file.mimetype
              })),
              description: req.body.description,
              tags: req.body.tags ? JSON.parse(req.body.tags) : [],
              uploadedAt: new Date().toISOString()
            },
            processingOptions: {
              generateEmbeddings: req.body.generateEmbeddings === 'true'
            }
          }
        };
        const job = await stateManager.createJob(createJobData);
        const jobData = {
          id: jobId,
          type: JobType.PROCESSING,
          status: JobStatus.PENDING,
          query: `Process ${files.length} uploaded files`,
          progress: 0,
          userId,
          metadata: {
            downloadUrls: files.map(file => `file://${file.path}`),
            processingOptions: {
              generateEmbeddings: req.body.generateEmbeddings === 'true'
            }
          },
          createdAt: job.createdAt
        };
        const submission = await jobQueue.submitJob(jobData);
        res.json({
          success: true,
          data: {
            jobId: submission.jobId,
            status: JobStatus.PENDING,
            fileCount: files.length,
            totalSize: files.reduce((sum, file) => sum + file.size, 0),
            files: files.map(file => ({
              originalName: file.originalname,
              fileSize: file.size
            })),
            estimatedDuration: submission.estimatedStartTime ? Math.round((submission.estimatedStartTime.getTime() - Date.now()) / 1000) : undefined,
            queuePosition: submission.queuePosition
          },
          timestamp: new Date().toISOString()
        });
        return;
      } catch (error) {
        logger.error('Multiple upload API error:', error as Error);
        next(error);
        return;
      }
    }
  );

  return router;
};
