-- Create export schema
CREATE SCHEMA IF NOT EXISTS export;

-- Create export status enum
CREATE TYPE export.export_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'virus_scanning',
    'virus_scan_failed',
    'expired'
);

-- Create export format enum
CREATE TYPE export.export_format AS ENUM (
    'xlsx',
    'csv'
);

-- Create exports table
CREATE TABLE export.exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    batch_job_id UUID REFERENCES batch.jobs(id) ON DELETE SET NULL,
    file_id UUID REFERENCES files.files(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates.templates(id) ON DELETE SET NULL,
    
    -- Export metadata
    format export.export_format NOT NULL,
    status export.export_status NOT NULL DEFAULT 'pending',
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    virus_scan_status VARCHAR(20),
    virus_scan_result JSONB,
    
    -- Export options
    include_headers BOOLEAN NOT NULL DEFAULT true,
    include_metadata BOOLEAN NOT NULL DEFAULT true,
    custom_filename VARCHAR(255),
    
    -- Download tracking
    download_count INTEGER NOT NULL DEFAULT 0,
    download_limit INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    error_details JSONB,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT exports_file_path_check 
        CHECK ((status IN ('completed', 'virus_scanning') AND file_path IS NOT NULL) 
            OR status NOT IN ('completed', 'virus_scanning')),
    CONSTRAINT exports_file_size_check 
        CHECK (file_size IS NULL OR file_size > 0),
    CONSTRAINT exports_download_limit_check 
        CHECK (download_limit IS NULL OR download_limit > 0),
    CONSTRAINT exports_expires_at_check 
        CHECK (expires_at > created_at)
);

-- Create export events table for analytics
CREATE TABLE export.export_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES export.exports(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT export_events_type_check 
        CHECK (event_type IN (
            'export_started',
            'export_completed',
            'export_failed',
            'virus_scan_started',
            'virus_scan_completed',
            'virus_scan_failed',
            'download_started',
            'download_completed',
            'error_report_downloaded'
        ))
);

-- Create indexes
CREATE INDEX idx_exports_user_id ON export.exports(user_id);
CREATE INDEX idx_exports_batch_job_id ON export.exports(batch_job_id);
CREATE INDEX idx_exports_file_id ON export.exports(file_id);
CREATE INDEX idx_exports_status ON export.exports(status);
CREATE INDEX idx_exports_created_at ON export.exports(created_at);
CREATE INDEX idx_exports_expires_at ON export.exports(expires_at);
CREATE INDEX idx_export_events_export_id ON export.export_events(export_id);
CREATE INDEX idx_export_events_event_type ON export.export_events(event_type);
CREATE INDEX idx_export_events_created_at ON export.export_events(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION export.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_exports_updated_at
    BEFORE UPDATE ON export.exports
    FOR EACH ROW
    EXECUTE FUNCTION export.update_updated_at_column();

-- Create function to clean up expired exports
CREATE OR REPLACE FUNCTION export.cleanup_expired_exports()
RETURNS void AS $$
BEGIN
    UPDATE export.exports
    SET status = 'expired'
    WHERE status NOT IN ('expired', 'deleted')
    AND expires_at < NOW();
END;
$$ language 'plpgsql';

-- Create function to track export events
CREATE OR REPLACE FUNCTION export.track_export_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Track status changes as events
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO export.export_events (export_id, event_type, event_data)
        VALUES (
            NEW.id,
            CASE NEW.status
                WHEN 'processing' THEN 'export_started'
                WHEN 'completed' THEN 'export_completed'
                WHEN 'failed' THEN 'export_failed'
                WHEN 'virus_scanning' THEN 'virus_scan_started'
                WHEN 'virus_scan_failed' THEN 'virus_scan_failed'
                ELSE NULL
            END,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'error_code', NEW.error_code,
                'error_message', NEW.error_message
            )
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for export events
CREATE TRIGGER track_export_status_changes
    AFTER UPDATE ON export.exports
    FOR EACH ROW
    EXECUTE FUNCTION export.track_export_event();

-- Add comment to schema
COMMENT ON SCHEMA export IS 'Schema for managing data exports and downloads';

-- Add comments to tables
COMMENT ON TABLE export.exports IS 'Stores export records and their metadata';
COMMENT ON TABLE export.export_events IS 'Tracks export-related events for analytics';

-- Add comments to columns
COMMENT ON COLUMN export.exports.virus_scan_status IS 'Status of virus scanning (pending, clean, infected)';
COMMENT ON COLUMN export.exports.virus_scan_result IS 'Detailed results from virus scanning';
COMMENT ON COLUMN export.exports.error_details IS 'Additional error information in JSON format';
COMMENT ON COLUMN export.export_events.event_data IS 'Additional event-specific data in JSON format'; 