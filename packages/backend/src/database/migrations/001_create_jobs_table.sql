-- DataCollector Jobs Table Migration
-- Creates the jobs table for the asynchronous job processing system

BEGIN;

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    query TEXT NOT NULL,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    user_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Error handling
    error_message TEXT,
    
    -- JSON data columns
    metadata JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);

-- Create partial indexes for active jobs
CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(created_at) 
WHERE status IN ('pending', 'running', 'analyzing', 'searching', 'downloading', 'processing', 'indexing');

-- JSONB indexes for metadata queries
CREATE INDEX IF NOT EXISTS idx_jobs_metadata_gin ON jobs USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_jobs_results_gin ON jobs USING GIN(results);

-- Add constraints
ALTER TABLE jobs ADD CONSTRAINT chk_valid_status 
CHECK (status IN ('pending', 'running', 'analyzing', 'searching', 'downloading', 'processing', 'indexing', 'completed', 'failed', 'cancelled'));

ALTER TABLE jobs ADD CONSTRAINT chk_valid_type 
CHECK (type IN ('collection', 'processing', 'indexing', 'search'));

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE jobs IS 'Stores asynchronous job processing information for the DataCollector system';
COMMENT ON COLUMN jobs.id IS 'Unique identifier for the job (UUID)';
COMMENT ON COLUMN jobs.type IS 'Type of job: collection, processing, indexing, search';
COMMENT ON COLUMN jobs.status IS 'Current status of the job processing pipeline';
COMMENT ON COLUMN jobs.query IS 'Original user query that initiated the job';
COMMENT ON COLUMN jobs.progress IS 'Job completion percentage (0-100)';
COMMENT ON COLUMN jobs.user_id IS 'ID of the user who created the job (optional)';
COMMENT ON COLUMN jobs.metadata IS 'Job configuration and options (JSON)';
COMMENT ON COLUMN jobs.results IS 'Job execution results and output data (JSON)';
COMMENT ON COLUMN jobs.error_message IS 'Error details if job failed';

COMMIT; 