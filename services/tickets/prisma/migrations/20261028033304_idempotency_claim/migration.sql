-- AlterTable
ALTER TABLE "IdempotencyRecord" ADD COLUMN     "completedAt" TIMESTAMP(3),
ALTER COLUMN "statusCode" DROP NOT NULL,
ALTER COLUMN "response" DROP NOT NULL;
