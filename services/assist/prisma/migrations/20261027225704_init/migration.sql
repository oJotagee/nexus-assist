-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('EMPLOYEE', 'ANALYST');

-- CreateEnum
CREATE TYPE "SupportLevel" AS ENUM ('N1', 'N2');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('AGENT', 'WAITING_ANALYST', 'WITH_ANALYST', 'CLOSED');

-- CreateEnum
CREATE TYPE "HandoffReason" AS ENUM ('USER_REQUESTED', 'CRITICAL', 'OVERDUE', 'LOW_CONFIDENCE');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('EMPLOYEE', 'AGENT', 'ANALYST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DraftMode" AS ENUM ('CREATE', 'UPDATE', 'REOPEN');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL,
    "supportLevel" "SupportLevel",
    "passwordChangedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "state" "ConversationState" NOT NULL DEFAULT 'AGENT',
    "assignedAnalystId" TEXT,
    "handoffReason" "HandoffReason",
    "handoffSummary" TEXT,
    "handoffGroup" "SupportLevel",
    "handoffAt" TIMESTAMP(3),
    "focusTicketId" TEXT,
    "resolvedByAgent" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "author" "MessageAuthor" NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "text" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionTrace" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "understood" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceBand" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "rulesApplied" TEXT[],
    "steps" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketDraft" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "mode" "DraftMode" NOT NULL,
    "targetTicketId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "priorityRule" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "resultTicketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],

    CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Conversation_employeeId_lastMessageAt_idx" ON "Conversation"("employeeId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_state_lastMessageAt_idx" ON "Conversation"("state", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_conversationId_index_key" ON "ChatSession"("conversationId", "index");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionTrace_messageId_key" ON "DecisionTrace"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketDraft_idempotencyKey_key" ON "TicketDraft"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TicketDraft_conversationId_status_idx" ON "TicketDraft"("conversationId", "status");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedAnalystId_fkey" FOREIGN KEY ("assignedAnalystId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionTrace" ADD CONSTRAINT "DecisionTrace_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDraft" ADD CONSTRAINT "TicketDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
