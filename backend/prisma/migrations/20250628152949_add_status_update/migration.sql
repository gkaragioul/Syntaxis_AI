-- CreateTable
CREATE TABLE "status_updates" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "previousStatus" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "status_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "status_updates_invoiceId_idx" ON "status_updates"("invoiceId");

-- CreateIndex
CREATE INDEX "status_updates_userId_idx" ON "status_updates"("userId");

-- CreateIndex
CREATE INDEX "status_updates_status_idx" ON "status_updates"("status");

-- CreateIndex
CREATE INDEX "status_updates_timestamp_idx" ON "status_updates"("timestamp");

-- AddForeignKey
ALTER TABLE "status_updates" ADD CONSTRAINT "status_updates_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_updates" ADD CONSTRAINT "status_updates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
