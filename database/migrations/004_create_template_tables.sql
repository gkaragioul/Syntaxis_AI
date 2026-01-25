-- Create extension for encryption if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create schema for templates
CREATE SCHEMA IF NOT EXISTS templates;

-- Create enum for template status
CREATE TYPE templates.template_status AS ENUM (
    'active',
    'archived',
    'deleted'
);

-- Create enum for template type
CREATE TYPE templates.template_type AS ENUM (
    'invoice',
    'receipt',
    'statement',
    'custom'
);

-- Create templates table
CREATE TABLE templates.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type templates.template_type NOT NULL DEFAULT 'custom',
    status templates.template_status NOT NULL DEFAULT 'active',
    
    -- Encrypted template logic using pgcrypto
    logic_encrypted BYTEA NOT NULL,
    logic_iv BYTEA NOT NULL,
    
    -- Template metadata
    vendor_name VARCHAR(255),
    vendor_pattern VARCHAR(255),
    page_numbers INTEGER[],
    table_index INTEGER,
    header_row INTEGER,
    column_mappings JSONB NOT NULL DEFAULT '{}',
    filters JSONB NOT NULL DEFAULT '{}',
    
    -- Performance metrics
    success_rate DECIMAL(3,2) DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT templates_name_user_unique UNIQUE (user_id, name) 
        WHERE deleted_at IS NULL,
    CONSTRAINT templates_success_rate_check 
        CHECK (success_rate >= 0 AND success_rate <= 1),
    CONSTRAINT templates_usage_count_check 
        CHECK (usage_count >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_templates_user_id ON templates.templates(user_id);
CREATE INDEX idx_templates_status ON templates.templates(status);
CREATE INDEX idx_templates_type ON templates.templates(type);
CREATE INDEX idx_templates_vendor_name ON templates.templates(vendor_name);
CREATE INDEX idx_templates_created_at ON templates.templates(created_at);
CREATE INDEX idx_templates_success_rate ON templates.templates(success_rate);

-- Create GIN indexes for JSONB fields
CREATE INDEX idx_templates_column_mappings ON templates.templates USING GIN (column_mappings);
CREATE INDEX idx_templates_filters ON templates.templates USING GIN (filters);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION templates.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates.templates
    FOR EACH ROW
    EXECUTE FUNCTION templates.update_updated_at_column();

-- Create function to encrypt template logic
CREATE OR REPLACE FUNCTION templates.encrypt_template_logic(
    logic JSONB,
    encryption_key TEXT
) RETURNS TABLE (
    encrypted BYTEA,
    iv BYTEA
) AS $$
DECLARE
    iv BYTEA;
BEGIN
    -- Generate random IV
    iv := gen_random_bytes(16);
    
    -- Encrypt the logic using AES-256-GCM
    RETURN QUERY
    SELECT 
        pgp_sym_encrypt(
            logic::TEXT,
            encryption_key,
            'compress-algo=1, cipher-algo=aes256'
        )::BYTEA,
        iv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrypt template logic
CREATE OR REPLACE FUNCTION templates.decrypt_template_logic(
    encrypted BYTEA,
    iv BYTEA,
    encryption_key TEXT
) RETURNS JSONB AS $$
BEGIN
    -- Decrypt the logic using AES-256-GCM
    RETURN pgp_sym_decrypt(
        encrypted::TEXT,
        encryption_key,
        'compress-algo=1, cipher-algo=aes256'
    )::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create table for template application history
CREATE TABLE templates.template_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates.templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    batch_job_id UUID,
    file_id UUID REFERENCES files.files(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT template_applications_file_or_batch CHECK (
        (file_id IS NOT NULL AND batch_job_id IS NULL) OR
        (file_id IS NULL AND batch_job_id IS NOT NULL)
    )
);

-- Create indexes for template applications
CREATE INDEX idx_template_applications_template_id ON templates.template_applications(template_id);
CREATE INDEX idx_template_applications_user_id ON templates.template_applications(user_id);
CREATE INDEX idx_template_applications_status ON templates.template_applications(status);
CREATE INDEX idx_template_applications_created_at ON templates.template_applications(created_at);

-- Create function to update template success rate
CREATE OR REPLACE FUNCTION templates.update_template_success_rate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE templates.templates
        SET 
            success_rate = (
                SELECT 
                    CASE 
                        WHEN COUNT(*) = 0 THEN 0
                        ELSE COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)
                    END
                FROM templates.template_applications
                WHERE template_id = NEW.template_id
            ),
            usage_count = usage_count + 1,
            last_used_at = NEW.completed_at
        WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating success rate
CREATE TRIGGER update_template_success_rate
    AFTER UPDATE OF status ON templates.template_applications
    FOR EACH ROW
    EXECUTE FUNCTION templates.update_template_success_rate(); 