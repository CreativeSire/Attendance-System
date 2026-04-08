import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const sql = `
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('admin', 'manager', 'employee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'absent', 'wfh', 'field');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveType" AS ENUM ('Annual', 'Sick', 'Casual', 'Study', 'Unpaid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkMode" AS ENUM ('office', 'wfh', 'field', 'client_site');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'employee',
  "department" TEXT,
  "employeeId" TEXT NOT NULL UNIQUE,
  "position" TEXT,
  "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "masterPhoto" TEXT,
  "phone" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OfficeLocation" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "radiusMeters" INTEGER NOT NULL DEFAULT 75,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AppConfig" (
  "id" TEXT PRIMARY KEY,
  "workStartTime" TEXT NOT NULL DEFAULT '09:00',
  "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 10,
  "qrExpirySeconds" INTEGER NOT NULL DEFAULT 180,
  "requireLocation" BOOLEAN NOT NULL DEFAULT TRUE,
  "requireFaceCapture" BOOLEAN NOT NULL DEFAULT TRUE,
  "requireLiveness" BOOLEAN NOT NULL DEFAULT TRUE,
  "defaultOfficeId" TEXT,
  "latePenaltyMode" TEXT NOT NULL DEFAULT 'track_only',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT,
  "actorName" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "RefreshToken" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "QRToken" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "entryPointId" TEXT NOT NULL,
  "entryPointName" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "usedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "date" TEXT NOT NULL,
  "clockInTime" TIMESTAMP(3),
  "clockOutTime" TIMESTAMP(3),
  "clockInPhoto" TEXT,
  "clockOutPhoto" TEXT,
  "clockInMethod" TEXT,
  "clockOutMethod" TEXT,
  "clockInLat" DOUBLE PRECISION,
  "clockInLng" DOUBLE PRECISION,
  "clockInAccuracy" DOUBLE PRECISION,
  "clockOutLat" DOUBLE PRECISION,
  "clockOutLng" DOUBLE PRECISION,
  "clockOutAccuracy" DOUBLE PRECISION,
  "locationStatus" TEXT,
  "distanceFromOffice" DOUBLE PRECISION,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'present',
  "workMode" "WorkMode" NOT NULL DEFAULT 'office',
  "totalHours" DOUBLE PRECISION,
  "isLate" BOOLEAN NOT NULL DEFAULT FALSE,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "lateReason" TEXT,
  "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mood" TEXT,
  "entryPoint" TEXT,
  "approvedBy" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CorrectionRequest" (
  "id" TEXT PRIMARY KEY,
  "recordId" TEXT NOT NULL UNIQUE REFERENCES "AttendanceRecord"("id"),
  "requestedBy" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "newClockIn" TEXT,
  "newClockOut" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'pending',
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BDDCheckIn" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "date" TEXT NOT NULL,
  "dayOfWeek" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "weeklyGoal" TEXT,
  "lastWeekAccomplishment" TEXT,
  "foreseenChallenges" TEXT,
  "supportNeeded" TEXT,
  "seMeetingFeedback" TEXT,
  "priorityOne" TEXT,
  "priorityTwo" TEXT,
  "priorityThree" TEXT,
  "completedYesterday" TEXT,
  "blockers" TEXT,
  "progressPercent" INTEGER,
  "questionsNotes" TEXT,
  "goalAchieved" TEXT,
  "keyWins" TEXT,
  "aiUsageThisWeek" TEXT,
  "wouldDoDifferently" TEXT,
  "aiSummary" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LeaveRequest" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "type" "LeaveType" NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'pending',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ExpenseRequest" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "title" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "receipt" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'pending',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PerformanceGoal" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "quarter" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "objective" TEXT NOT NULL,
  "keyResultOne" TEXT,
  "keyResultTwo" TEXT,
  "keyResultThree" TEXT,
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "managerNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT FALSE,
  "link" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BroadcastMessage" (
  "id" TEXT PRIMARY KEY,
  "senderName" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "department" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EntryPoint" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Database bootstrap complete.');
}

main().catch((error) => {
  console.error('Database bootstrap failed.');
  console.error(error);
  process.exit(1);
});
