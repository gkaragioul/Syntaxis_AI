-- CreateTable
CREATE TABLE "wizard_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'UPLOAD_READY',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "batchJobId" TEXT,
    "groupsData" JSONB,
    "exportResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wizard_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wizard_sessions_userId_idx" ON "wizard_sessions"("userId");

-- CreateIndex
CREATE INDEX "wizard_sessions_state_idx" ON "wizard_sessions"("state");

-- CreateIndex
CREATE INDEX "wizard_sessions_createdAt_idx" ON "wizard_sessions"("createdAt");

-- AddForeignKey
ALTER TABLE "wizard_sessions" ADD CONSTRAINT "wizard_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_sessions" ADD CONSTRAINT "wizard_sessions_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "BatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
