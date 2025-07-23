-- DataCollector Database Initialization Script
-- This script sets up the initial database schema for job tracking and metadata

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create jobs table for tracking collection tasks
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    query TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}',
    CONSTRAINT jobs_status_check CHECK (status IN ('pending', 'running', 'analyzing', 'searching', 'downloading', 'processing', 'indexing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT jobs_type_check CHECK (type IN ('collection', 'processing', 'indexing', 'search'))
);

-- Create job_logs table for detailed logging
CREATE TABLE IF NOT EXISTS job_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    CONSTRAINT job_logs_level_check CHECK (level IN ('debug', 'info', 'warn', 'error'))
);

-- Create documents table for storing document metadata
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    title VARCHAR(500),
    url TEXT,
    file_path TEXT,
    file_type VARCHAR(50),
    file_size BIGINT,
    content_hash VARCHAR(64),
    source VARCHAR(100),
    authors TEXT[],
    publication_date DATE,
    abstract TEXT,
    keywords TEXT[],
    language VARCHAR(10) DEFAULT 'en',
    indexed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create document_chunks table for storing text chunks and embeddings metadata
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    embedding_id VARCHAR(100), -- Reference to vector store
    opensearch_id VARCHAR(100), -- Reference to OpenSearch document
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- Create search_queries table for analytics and optimization
CREATE TABLE IF NOT EXISTS search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    results_count INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create collections table for organizing documents
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id VARCHAR(255),
    document_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create collection_documents junction table
CREATE TABLE IF NOT EXISTS collection_documents (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (collection_id, document_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_timestamp ON job_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_job_logs_level ON job_logs(level);

CREATE INDEX IF NOT EXISTS idx_documents_job_id ON documents(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_id ON document_chunks(embedding_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_opensearch_id ON document_chunks(opensearch_id);

CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries(created_at);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_documents_collection_id ON collection_documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_documents_document_id ON collection_documents(document_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some initial data for testing
INSERT INTO collections (name, description, user_id) VALUES 
('Default Collection', 'Default collection for new documents', 'system'),
('Research Papers', 'Academic research papers and studies', 'system'),
('Clinical Studies', 'Medical and clinical research documents', 'system'),
('Datasets', 'Data files and datasets', 'system');

-- Create view for job statistics
CREATE OR REPLACE VIEW job_statistics AS
SELECT 
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as count_last_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as count_last_7d
FROM jobs 
GROUP BY status;

-- Create view for document statistics
CREATE OR REPLACE VIEW document_statistics AS
SELECT 
    source,
    file_type,
    COUNT(*) as count,
    AVG(file_size) as avg_file_size,
    SUM(file_size) as total_size,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as count_last_24h
FROM documents 
WHERE file_size IS NOT NULL
GROUP BY source, file_type;

COMMENT ON DATABASE datacollector IS 'DataCollector application database for AI-powered data collection and search';
COMMENT ON TABLE jobs IS 'Tracks background job execution and status';
COMMENT ON TABLE job_logs IS 'Detailed logs for job execution debugging';
COMMENT ON TABLE documents IS 'Metadata for collected documents and files';
COMMENT ON TABLE document_chunks IS 'Text chunks from documents with references to vector and search indices';
COMMENT ON TABLE search_queries IS 'User search queries for analytics and optimization';
COMMENT ON TABLE collections IS 'User-defined collections for organizing documents';
COMMENT ON TABLE collection_documents IS 'Many-to-many relationship between collections and documents'; 