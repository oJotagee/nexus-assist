-- CreateEnum
CREATE TYPE "FollowUpState" AS ENUM ('AWAITING_ANSWER', 'NEW_PROBLEM');

-- AlterEnum
ALTER TYPE "HandoffReason" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "followUp" "FollowUpState",
ADD COLUMN     "followUpTicketId" TEXT;
