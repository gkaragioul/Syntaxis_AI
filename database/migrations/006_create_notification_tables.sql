-- Create notification schema
CREATE SCHEMA IF NOT EXISTS notifications;

-- Create notification type enum
CREATE TYPE notifications.notification_type AS ENUM (
    'batch_job_started',
    'batch_job_completed',
    'batch_job_failed',
    'extraction_error',
    'export_error',
    'system_alert'
);

-- Create notification priority enum
CREATE TYPE notifications.notification_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Create notifications table
CREATE TABLE notifications.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    batch_job_id UUID REFERENCES batch.jobs(id) ON DELETE SET NULL,
    type notifications.notification_type NOT NULL,
    priority notifications.notification_priority NOT NULL DEFAULT 'medium',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_sent_status VARCHAR(20),
    email_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT notifications_email_status_check 
        CHECK (email_sent_status IS NULL OR email_sent_status IN ('pending', 'sent', 'failed')),
    CONSTRAINT notifications_expires_at_check 
        CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create error reports table
CREATE TABLE notifications.error_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    batch_job_id UUID REFERENCES batch.jobs(id) ON DELETE SET NULL,
    file_id UUID REFERENCES files.files(id) ON DELETE SET NULL,
    error_type VARCHAR(50) NOT NULL,
    error_code VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    error_details JSONB NOT NULL DEFAULT '{}',
    troubleshooting_tips JSONB NOT NULL DEFAULT '[]',
    stack_trace TEXT,
    context_data JSONB NOT NULL DEFAULT '{}',
    report_path TEXT,
    report_size INTEGER,
    report_format VARCHAR(10) CHECK (report_format IN ('pdf', 'csv')),
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT error_reports_expires_at_check 
        CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT error_reports_report_size_check 
        CHECK (report_size IS NULL OR report_size > 0)
);

-- Create notification preferences table
CREATE TABLE notifications.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    in_app_notifications BOOLEAN NOT NULL DEFAULT true,
    notification_types JSONB NOT NULL DEFAULT '{
        "batch_job_started": true,
        "batch_job_completed": true,
        "batch_job_failed": true,
        "extraction_error": true,
        "export_error": true,
        "system_alert": false
    }',
    email_frequency VARCHAR(20) NOT NULL DEFAULT 'immediate' 
        CHECK (email_frequency IN ('immediate', 'daily', 'weekly')),
    last_email_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create notification delivery logs table
CREATE TABLE notifications.delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications.notifications(id) ON DELETE CASCADE,
    delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('email', 'in_app')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications.notifications(user_id);
CREATE INDEX idx_notifications_batch_job_id ON notifications.notifications(batch_job_id);
CREATE INDEX idx_notifications_type ON notifications.notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications.notifications(created_at);
CREATE INDEX idx_notifications_read_at ON notifications.notifications(read_at);
CREATE INDEX idx_notifications_email_sent_at ON notifications.notifications(email_sent_at);

CREATE INDEX idx_error_reports_user_id ON notifications.error_reports(user_id);
CREATE INDEX idx_error_reports_batch_job_id ON notifications.error_reports(batch_job_id);
CREATE INDEX idx_error_reports_file_id ON notifications.error_reports(file_id);
CREATE INDEX idx_error_reports_error_type ON notifications.error_reports(error_type);
CREATE INDEX idx_error_reports_created_at ON notifications.error_reports(created_at);

CREATE INDEX idx_delivery_logs_notification_id ON notifications.delivery_logs(notification_id);
CREATE INDEX idx_delivery_logs_status ON notifications.delivery_logs(status);
CREATE INDEX idx_delivery_logs_next_retry_at ON notifications.delivery_logs(next_retry_at);

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION notifications.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications.notifications
    FOR EACH ROW
    EXECUTE FUNCTION notifications.update_updated_at_column();

CREATE TRIGGER update_error_reports_updated_at
    BEFORE UPDATE ON notifications.error_reports
    FOR EACH ROW
    EXECUTE FUNCTION notifications.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON notifications.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION notifications.update_updated_at_column();

CREATE TRIGGER update_delivery_logs_updated_at
    BEFORE UPDATE ON notifications.delivery_logs
    FOR EACH ROW
    EXECUTE FUNCTION notifications.update_updated_at_column();

-- Create function to clean up expired notifications and error reports
CREATE OR REPLACE FUNCTION notifications.cleanup_expired()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired notifications
    WITH deleted AS (
        DELETE FROM notifications.notifications
        WHERE expires_at < NOW()
        AND deleted_at IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    -- Delete expired error reports
    WITH deleted AS (
        DELETE FROM notifications.error_reports
        WHERE expires_at < NOW()
        AND deleted_at IS NULL
        RETURNING id
    )
    SELECT deleted_count + COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark notifications as read
CREATE OR REPLACE FUNCTION notifications.mark_notifications_read(
    p_user_id UUID,
    p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE notifications.notifications
    SET read_at = NOW()
    WHERE user_id = p_user_id
    AND (p_notification_ids IS NULL OR id = ANY(p_notification_ids))
    AND read_at IS NULL
    AND deleted_at IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get unread notification count
CREATE OR REPLACE FUNCTION notifications.get_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO unread_count
    FROM notifications.notifications
    WHERE user_id = p_user_id
    AND read_at IS NULL
    AND deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

    RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE notifications.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications.delivery_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY notifications_user_policy ON notifications.notifications
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY error_reports_user_policy ON notifications.error_reports
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY user_preferences_policy ON notifications.user_preferences
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY delivery_logs_admin_policy ON notifications.delivery_logs
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND role = 'admin'
    ));

-- Create initial notification preferences for existing users
INSERT INTO notifications.user_preferences (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM notifications.user_preferences); 