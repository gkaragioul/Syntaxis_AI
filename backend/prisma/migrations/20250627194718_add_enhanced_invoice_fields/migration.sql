-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "businessRulesScore" DECIMAL(65,30),
ADD COLUMN     "detectedLanguage" TEXT,
ADD COLUMN     "extractionConfidence" DECIMAL(65,30),
ADD COLUMN     "ocrQuality" DECIMAL(65,30),
ADD COLUMN     "templateConfidence" DECIMAL(65,30),
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateType" TEXT,
ADD COLUMN     "validationStatus" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "calculationValid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "extractionConfidence" DECIMAL(65,30),
ADD COLUMN     "itemType" TEXT,
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "templateType" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_templateId_idx" ON "Invoice"("templateId");

-- CreateIndex
CREATE INDEX "Invoice_templateType_idx" ON "Invoice"("templateType");

-- CreateIndex
CREATE INDEX "Invoice_validationStatus_idx" ON "Invoice"("validationStatus");

-- CreateIndex
CREATE INDEX "Invoice_extractionConfidence_idx" ON "Invoice"("extractionConfidence");

-- CreateIndex
CREATE INDEX "Invoice_detectedLanguage_idx" ON "Invoice"("detectedLanguage");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_itemType_idx" ON "InvoiceLineItem"("itemType");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_category_idx" ON "InvoiceLineItem"("category");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_sku_idx" ON "InvoiceLineItem"("sku");

-- CreateIndex
CREATE INDEX "Template_templateType_idx" ON "Template"("templateType");

-- CreateIndex
CREATE INDEX "Template_language_idx" ON "Template"("language");

-- CreateIndex
CREATE INDEX "Template_successRate_idx" ON "Template"("successRate");

-- CreateIndex
CREATE INDEX "Template_isActive_idx" ON "Template"("isActive");
