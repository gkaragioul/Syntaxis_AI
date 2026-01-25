-- AlterTable
ALTER TABLE "File" ADD COLUMN     "fingerprint" JSONB,
ADD COLUMN     "matchConfidence" DOUBLE PRECISION,
ADD COLUMN     "matchReasons" JSONB,
ADD COLUMN     "matchedTemplateId" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "extractionSchema" JSONB,
ADD COLUMN     "fingerprint" JSONB;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_matchedTemplateId_fkey" FOREIGN KEY ("matchedTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
