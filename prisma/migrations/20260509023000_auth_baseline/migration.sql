-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT,
ADD COLUMN     "email_normalized" TEXT,
ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "password_salt" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "last_login_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");
