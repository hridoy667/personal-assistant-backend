/*
  Warnings:

  - You are about to drop the `app_usages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `screen_time_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DeviceOs" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- DropForeignKey
ALTER TABLE "app_usages" DROP CONSTRAINT "app_usages_userId_fkey";

-- DropForeignKey
ALTER TABLE "screen_time_logs" DROP CONSTRAINT "screen_time_logs_userId_fkey";

-- DropTable
DROP TABLE "app_usages";

-- DropTable
DROP TABLE "screen_time_logs";

-- CreateTable
CREATE TABLE "ScreenTimeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalScreenTimeMins" INTEGER NOT NULL,
    "productivityScore" DOUBLE PRECISION,
    "deviceOs" "DeviceOs" NOT NULL DEFAULT 'ANDROID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenTimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageName" TEXT,
    "appName" TEXT,
    "category" "AppCategory" NOT NULL DEFAULT 'NEUTRAL',
    "timeSpentMins" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreenTimeLog_userId_date_key" ON "ScreenTimeLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "ScreenTimeLog" ADD CONSTRAINT "ScreenTimeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUsage" ADD CONSTRAINT "AppUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
