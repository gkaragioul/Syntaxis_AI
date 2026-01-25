-- AlterTable
ALTER TABLE "BatchJob" ADD COLUMN     "batchName" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "processingOptions" JSONB,
ADD COLUMN     "resumedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ALTER COLUMN "totalFiles" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "batchJobId" TEXT,
ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "processingStatus" TEXT,
ADD COLUMN     "uploadStatus" TEXT,
ADD COLUMN     "uploadedAt" TIMESTAMP(3),
ADD COLUMN     "validationStatus" TEXT;

-- CreateIndex
CREATE INDEX "File_batchJobId_idx" ON "File"("batchJobId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "BatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
