-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "processingTime" INTEGER NOT NULL,
    "queueWaitTime" INTEGER NOT NULL DEFAULT 0,
    "totalTime" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "textLength" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "enginesUsed" TEXT[],
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "confidenceMetrics" JSONB,
    "resourceUsage" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceMetric_fileId_idx" ON "PerformanceMetric"("fileId");

-- CreateIndex
CREATE INDEX "PerformanceMetric_userId_idx" ON "PerformanceMetric"("userId");

-- CreateIndex
CREATE INDEX "PerformanceMetric_engine_idx" ON "PerformanceMetric"("engine");

-- CreateIndex
CREATE INDEX "PerformanceMetric_timestamp_idx" ON "PerformanceMetric"("timestamp");

-- CreateIndex
CREATE INDEX "PerformanceMetric_success_idx" ON "PerformanceMetric"("success");

-- CreateIndex
CREATE INDEX "PerformanceMetric_confidence_idx" ON "PerformanceMetric"("confidence");

-- CreateIndex
CREATE INDEX "PerformanceMetric_processingTime_idx" ON "PerformanceMetric"("processingTime");

-- AddForeignKey
ALTER TABLE "PerformanceMetric" ADD CONSTRAINT "PerformanceMetric_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceMetric" ADD CONSTRAINT "PerformanceMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
