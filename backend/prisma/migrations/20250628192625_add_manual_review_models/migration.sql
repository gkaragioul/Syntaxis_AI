-- CreateTable
CREATE TABLE "review_tasks" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "assignedTo" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "reviewType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "instructions" TEXT,
    "fieldsToReview" JSONB,
    "estimatedTime" INTEGER,
    "finalConfidence" DOUBLE PRECISION,
    "reviewNotes" TEXT,
    "approvalLevel" TEXT,
    "rejectionReason" TEXT,
    "requiredActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "review_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "fieldName" TEXT,
    "comment" TEXT NOT NULL,
    "commentType" TEXT NOT NULL,
    "priority" TEXT,
    "parentCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_tasks_invoiceId_idx" ON "review_tasks"("invoiceId");

-- CreateIndex
CREATE INDEX "review_tasks_assignedTo_idx" ON "review_tasks"("assignedTo");

-- CreateIndex
CREATE INDEX "review_tasks_status_idx" ON "review_tasks"("status");

-- CreateIndex
CREATE INDEX "review_tasks_priority_idx" ON "review_tasks"("priority");

-- CreateIndex
CREATE INDEX "review_tasks_createdAt_idx" ON "review_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "review_comments_invoiceId_idx" ON "review_comments"("invoiceId");

-- CreateIndex
CREATE INDEX "review_comments_reviewerId_idx" ON "review_comments"("reviewerId");

-- CreateIndex
CREATE INDEX "review_comments_parentCommentId_idx" ON "review_comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "review_comments_createdAt_idx" ON "review_comments"("createdAt");

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "review_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
