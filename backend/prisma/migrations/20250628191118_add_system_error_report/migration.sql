-- CreateTable
CREATE TABLE "system_error_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operation" TEXT,
    "error" TEXT NOT NULL,
    "stack" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "isRecoverable" BOOLEAN NOT NULL DEFAULT true,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "context" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "system_error_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_error_reports_userId_idx" ON "system_error_reports"("userId");

-- CreateIndex
CREATE INDEX "system_error_reports_category_idx" ON "system_error_reports"("category");

-- CreateIndex
CREATE INDEX "system_error_reports_severity_idx" ON "system_error_reports"("severity");

-- CreateIndex
CREATE INDEX "system_error_reports_timestamp_idx" ON "system_error_reports"("timestamp");

-- CreateIndex
CREATE INDEX "system_error_reports_resolved_idx" ON "system_error_reports"("resolved");

-- AddForeignKey
ALTER TABLE "system_error_reports" ADD CONSTRAINT "system_error_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
