import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import winston from 'winston';

// Environment configuration interface
export interface EnvironmentConfig {
  // Application
  NODE_ENV: string;
  PORT: number;
  FRONTEND_URL: string;
  
  // Database
  DATABASE_URL: string;
  REDIS_URL: string;
  
  // AI Services
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_EMBEDDING_MODEL: string;
  
  // Search Services
  OPENSEARCH_URL: string;
  CHROMADB_URL: string;
  
  // Scraping
  PLAYWRIGHT_HEADLESS: boolean;
  PLAYWRIGHT_TIMEOUT: number;
  
  // Security
  JWT_SECRET: string;
  
  // Logging
  LOG_LEVEL: string;
}

// Default fallback values for development
const DEFAULT_CONFIG: Partial<EnvironmentConfig> = {
  NODE_ENV: 'development',
  PORT: 3001,
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://postgres:postgres123@localhost:5432/datacollector',
  REDIS_URL: 'redis://:redis123@localhost:6379',
  OPENAI_MODEL: 'gpt-4o-mini',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  OPENSEARCH_URL: 'http://localhost:9200',
  CHROMADB_URL: 'http://localhost:8000',
  PLAYWRIGHT_HEADLESS: true,
  PLAYWRIGHT_TIMEOUT: 30000,
  JWT_SECRET: 'development-secret-change-in-production',
  LOG_LEVEL: 'info'
};

// Critical environment variables that MUST be present
const REQUIRED_VARS = [
  'OPENAI_API_KEY'
] as const;

// Environment variable loading status
export interface EnvironmentStatus {
  envFileExists: boolean;
  envFileLocation: string | null;
  loadedSuccessfully: boolean;
  missingCriticalVars: string[];
  warnings: string[];
  usingFallbacks: string[];
}

/**
 * Attempts to locate and load the .env file from multiple possible locations
 * This approach prevents agents from failing when they can't access .env directly
 */
function loadEnvironmentFile(): EnvironmentStatus {
  const status: EnvironmentStatus = {
    envFileExists: false,
    envFileLocation: null,
    loadedSuccessfully: false,
    missingCriticalVars: [],
    warnings: [],
    usingFallbacks: []
  };

  // Possible .env file locations (in order of preference)
  const possiblePaths = [
    // User-specified absolute path (highest priority)
    'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env',
    // Relative paths from backend directory
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '.env'),
    // Project root variations
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env')
  ];

  // Try to load .env file from each possible location
  for (const envPath of possiblePaths) {
    try {
      if (fs.existsSync(envPath)) {
        console.log(`✅ Found .env file at: ${envPath}`);
        dotenv.config({ path: envPath });
        status.envFileExists = true;
        status.envFileLocation = envPath;
        status.loadedSuccessfully = true;
        break;
      }
    } catch (error) {
      console.warn(`⚠️ Could not access .env file at ${envPath}:`, error instanceof Error ? error.message : 'Unknown error');
      status.warnings.push(`Failed to access: ${envPath}`);
    }
  }

  // If no .env file found, agents can still continue with fallbacks
  if (!status.envFileExists) {
    console.warn('⚠️ No .env file found in any expected location');
    console.log('🔄 Continuing with environment variables from system and defaults...');
    status.warnings.push('No .env file accessible - using system environment and defaults');
  }

  return status;
}

/**
 * Validates that all required environment variables are present
 */
function validateEnvironment(status: EnvironmentStatus): EnvironmentStatus {
  // Check for critical environment variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      status.missingCriticalVars.push(varName);
    }
  }

  // Check which variables are using fallbacks
  for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
    if (!process.env[key] && defaultValue !== undefined) {
      status.usingFallbacks.push(key);
    }
  }

  return status;
}

/**
 * Creates a logger for environment configuration
 */
function createEnvironmentLogger(): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] [ENV] ${level.toUpperCase()}: ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.colorize({ all: true })
      })
    ]
  });
}

/**
 * Loads and validates environment configuration
 * This function is safe for agents to use as it handles missing .env files gracefully
 */
export function loadEnvironmentConfig(): { config: EnvironmentConfig; status: EnvironmentStatus } {
  const logger = createEnvironmentLogger();
  
  // Load environment file
  let status = loadEnvironmentFile();
  
  // Validate environment
  status = validateEnvironment(status);
  
  // Build configuration with fallbacks
  const config: EnvironmentConfig = {
    NODE_ENV: process.env.NODE_ENV || DEFAULT_CONFIG.NODE_ENV!,
    PORT: parseInt(process.env.PORT || DEFAULT_CONFIG.PORT!.toString()),
    FRONTEND_URL: process.env.FRONTEND_URL || DEFAULT_CONFIG.FRONTEND_URL!,
    DATABASE_URL: process.env.DATABASE_URL || DEFAULT_CONFIG.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL || DEFAULT_CONFIG.REDIS_URL!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OPENAI_MODEL: process.env.OPENAI_MODEL || DEFAULT_CONFIG.OPENAI_MODEL!,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_CONFIG.OPENAI_EMBEDDING_MODEL!,
    OPENSEARCH_URL: process.env.OPENSEARCH_URL || DEFAULT_CONFIG.OPENSEARCH_URL!,
    CHROMADB_URL: process.env.CHROMADB_URL || DEFAULT_CONFIG.CHROMADB_URL!,
    PLAYWRIGHT_HEADLESS: process.env.PLAYWRIGHT_HEADLESS === 'true' || DEFAULT_CONFIG.PLAYWRIGHT_HEADLESS!,
    PLAYWRIGHT_TIMEOUT: parseInt(process.env.PLAYWRIGHT_TIMEOUT || DEFAULT_CONFIG.PLAYWRIGHT_TIMEOUT!.toString()),
    JWT_SECRET: process.env.JWT_SECRET || DEFAULT_CONFIG.JWT_SECRET!,
    LOG_LEVEL: process.env.LOG_LEVEL || DEFAULT_CONFIG.LOG_LEVEL!
  };

  // Log environment status
  if (status.envFileExists) {
    logger.info(`Environment loaded successfully from: ${status.envFileLocation}`);
  } else {
    logger.warn('No .env file found - using system environment and fallbacks');
  }

  if (status.usingFallbacks.length > 0) {
    logger.info(`Using fallback values for: ${status.usingFallbacks.join(', ')}`);
  }

  if (status.warnings.length > 0) {
    status.warnings.forEach(warning => logger.warn(warning));
  }

  // Handle critical missing variables
  if (status.missingCriticalVars.length > 0) {
    const missingVars = status.missingCriticalVars.join(', ');
    logger.error(`CRITICAL: Missing required environment variables: ${missingVars}`);
    
    if (config.NODE_ENV === 'production') {
      throw new Error(`Missing critical environment variables in production: ${missingVars}`);
    } else {
      logger.warn('Continuing in development mode with missing critical variables');
      logger.warn('Some features may not work properly without proper configuration');
    }
  }

  // Validate OpenAI API key format (if present)
  if (config.OPENAI_API_KEY && !config.OPENAI_API_KEY.startsWith('sk-')) {
    logger.warn('OPENAI_API_KEY does not appear to be in correct format (should start with sk-)');
  }

  logger.info('Environment configuration loaded successfully');
  
  return { config, status };
}

/**
 * Environment health check for monitoring and debugging
 */
export function getEnvironmentHealth(): {
  status: 'healthy' | 'warning' | 'error';
  details: EnvironmentStatus & { timestamp: string };
} {
  const { status } = loadEnvironmentConfig();
  
  let healthStatus: 'healthy' | 'warning' | 'error' = 'healthy';
  
  if (status.missingCriticalVars.length > 0) {
    healthStatus = 'error';
  } else if (status.warnings.length > 0 || status.usingFallbacks.length > 0) {
    healthStatus = 'warning';
  }
  
  return {
    status: healthStatus,
    details: {
      ...status,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Get environment info for debugging (safe for agents)
 */
export function getEnvironmentInfo(): {
  nodeEnv: string;
  hasOpenAIKey: boolean;
  envFileFound: boolean;
  servicesConfigured: {
    database: boolean;
    redis: boolean;
    openSearch: boolean;
    chromaDB: boolean;
  };
} {
  const { config, status } = loadEnvironmentConfig();
  
  return {
    nodeEnv: config.NODE_ENV,
    hasOpenAIKey: !!config.OPENAI_API_KEY,
    envFileFound: status.envFileExists,
    servicesConfigured: {
      database: !!config.DATABASE_URL,
      redis: !!config.REDIS_URL,
      openSearch: !!config.OPENSEARCH_URL,
      chromaDB: !!config.CHROMADB_URL
    }
  };
}

// Export the configuration for immediate use
export const { config: ENV_CONFIG, status: ENV_STATUS } = loadEnvironmentConfig(); 