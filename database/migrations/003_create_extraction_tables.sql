-- Create schema for extraction module
CREATE SCHEMA IF NOT EXISTS extraction;

-- Table for storing extracted tables
CREATE TABLE extraction.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    batch_job_id UUID REFERENCES batch_jobs(id) ON DELETE SET NULL,
    table_index INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    extraction_metadata JSONB NOT NULL DEFAULT '{}',
    raw_data JSONB NOT NULL, -- Stores the complete table data including headers and rows
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'edited')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    last_edited_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT tables_file_table_index_unique UNIQUE (file_id, table_index),
    CONSTRAINT tables_confidence_check CHECK (
        (status = 'completed' AND confidence_score > 0) OR
        (status != 'completed')
    )
);

-- Table for storing user edits to tables
CREATE TABLE extraction.table_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES extraction.tables(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    edited_cells JSONB NOT NULL DEFAULT '{}', -- Format: {"rowIndex": {"colIndex": "newValue"}}
    edit_metadata JSONB NOT NULL DEFAULT '{}', -- Stores additional edit info like edit type, timestamp
    version INTEGER NOT NULL DEFAULT 1,
    is_committed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    committed_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT table_edits_version_check CHECK (version > 0)
);

-- Table for storing extraction error reports
CREATE TABLE extraction.error_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID REFERENCES extraction.tables(id) ON DELETE CASCADE,
    batch_job_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE,
    error_type VARCHAR(50) NOT NULL,
    error_details JSONB NOT NULL,
    suggested_actions JSONB NOT NULL DEFAULT '[]',
    report_data JSONB NOT NULL, -- Sanitized data for error analysis
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    downloaded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- Constraints
    CONSTRAINT error_reports_table_or_batch CHECK (
        (table_id IS NOT NULL AND batch_job_id IS NULL) OR
        (table_id IS NULL AND batch_job_id IS NOT NULL)
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_tables_file_id ON extraction.tables(file_id);
CREATE INDEX idx_tables_batch_job_id ON extraction.tables(batch_job_id);
CREATE INDEX idx_tables_status ON extraction.tables(status);
CREATE INDEX idx_tables_confidence ON extraction.tables(confidence_score);
CREATE INDEX idx_tables_created_at ON extraction.tables(created_at);

CREATE INDEX idx_table_edits_table_id ON extraction.table_edits(table_id);
CREATE INDEX idx_table_edits_user_id ON extraction.table_edits(user_id);
CREATE INDEX idx_table_edits_version ON extraction.table_edits(version);
CREATE INDEX idx_table_edits_created_at ON extraction.table_edits(created_at);

CREATE INDEX idx_error_reports_table_id ON extraction.error_reports(table_id);
CREATE INDEX idx_error_reports_batch_job_id ON extraction.error_reports(batch_job_id);
CREATE INDEX idx_error_reports_created_at ON extraction.error_reports(created_at);
CREATE INDEX idx_error_reports_expires_at ON extraction.error_reports(expires_at);

-- Create GIN indexes for JSONB columns
CREATE INDEX idx_tables_extraction_metadata ON extraction.tables USING GIN (extraction_metadata);
CREATE INDEX idx_tables_raw_data ON extraction.tables USING GIN (raw_data);
CREATE INDEX idx_table_edits_edited_cells ON extraction.table_edits USING GIN (edited_cells);
CREATE INDEX idx_table_edits_edit_metadata ON extraction.table_edits USING GIN (edit_metadata);
CREATE INDEX idx_error_reports_error_details ON extraction.error_reports USING GIN (error_details);
CREATE INDEX idx_error_reports_suggested_actions ON extraction.error_reports USING GIN (suggested_actions);
CREATE INDEX idx_error_reports_report_data ON extraction.error_reports USING GIN (report_data);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION extraction.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_tables_timestamp
    BEFORE UPDATE ON extraction.tables
    FOR EACH ROW
    EXECUTE FUNCTION extraction.update_timestamp();

CREATE TRIGGER update_table_edits_timestamp
    BEFORE UPDATE ON extraction.table_edits
    FOR EACH ROW
    EXECUTE FUNCTION extraction.update_timestamp();

-- Function to handle table edit versioning
CREATE OR REPLACE FUNCTION extraction.increment_edit_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for edit versioning
CREATE TRIGGER increment_table_edits_version
    BEFORE UPDATE ON extraction.table_edits
    FOR EACH ROW
    WHEN (OLD.edited_cells IS DISTINCT FROM NEW.edited_cells)
    EXECUTE FUNCTION extraction.increment_edit_version();

-- Function to clean up expired error reports
CREATE OR REPLACE FUNCTION extraction.cleanup_expired_reports()
RETURNS void AS $$
BEGIN
    DELETE FROM extraction.error_reports
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired reports (runs daily)
SELECT cron.schedule(
    'cleanup-expired-reports',
    '0 0 * * *', -- Run at midnight every day
    $$SELECT extraction.cleanup_expired_reports()$$
); 