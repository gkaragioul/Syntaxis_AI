-- CreateTable
CREATE TABLE "confidence_thresholds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "thresholds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confidence_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "confidence_thresholds_userId_idx" ON "confidence_thresholds"("userId");

-- CreateIndex
CREATE INDEX "confidence_thresholds_createdAt_idx" ON "confidence_thresholds"("createdAt");

-- AddForeignKey
ALTER TABLE "confidence_thresholds" ADD CONSTRAINT "confidence_thresholds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
