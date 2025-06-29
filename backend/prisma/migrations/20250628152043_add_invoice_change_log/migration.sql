-- CreateTable
CREATE TABLE "invoice_change_logs" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changeReason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "invoice_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_change_logs_invoiceId_idx" ON "invoice_change_logs"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_change_logs_userId_idx" ON "invoice_change_logs"("userId");

-- CreateIndex
CREATE INDEX "invoice_change_logs_timestamp_idx" ON "invoice_change_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "invoice_change_logs" ADD CONSTRAINT "invoice_change_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_change_logs" ADD CONSTRAINT "invoice_change_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
