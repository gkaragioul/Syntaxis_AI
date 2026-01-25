-- CreateTable
CREATE TABLE "corrections" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "revertedAt" TIMESTAMP(3),
    "revertReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fieldName" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "corrections_invoiceId_idx" ON "corrections"("invoiceId");

-- CreateIndex
CREATE INDEX "corrections_userId_idx" ON "corrections"("userId");

-- CreateIndex
CREATE INDEX "corrections_fieldName_idx" ON "corrections"("fieldName");

-- CreateIndex
CREATE INDEX "corrections_status_idx" ON "corrections"("status");

-- CreateIndex
CREATE INDEX "corrections_createdAt_idx" ON "corrections"("createdAt");

-- CreateIndex
CREATE INDEX "correction_templates_userId_idx" ON "correction_templates"("userId");

-- CreateIndex
CREATE INDEX "correction_templates_fieldName_idx" ON "correction_templates"("fieldName");

-- CreateIndex
CREATE INDEX "correction_templates_autoApply_idx" ON "correction_templates"("autoApply");

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_templates" ADD CONSTRAINT "correction_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
