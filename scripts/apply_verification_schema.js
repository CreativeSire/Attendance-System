const { Client } = require('pg');

const rawUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

if (!rawUrl) {
  console.error('DATABASE_PUBLIC_URL or DATABASE_URL is required.');
  process.exit(1);
}

const connectionString = rawUrl.replace(/\?sslmode=require$/i, '');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const sql = `
DO $$ BEGIN
  CREATE TYPE "OfficeZoneType" AS ENUM (
    'entry_zone',
    'work_zone',
    'staff_quarters_zone',
    'admin_zone',
    'warehouse_zone',
    'restricted_zone'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationMethod" AS ENUM (
    'qr_fallback',
    'pin_face_location',
    'admin_override'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationDecision" AS ENUM (
    'approved',
    'flagged',
    'blocked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReviewQueueStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'escalated'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LivenessChallengeType" AS ENUM (
    'blink_twice',
    'turn_left',
    'turn_right',
    'nod_slowly',
    'say_digits'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinLockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appearanceProfile" JSONB;

ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "requireEmployeePin" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "reviewDecision" "VerificationDecision" NOT NULL DEFAULT 'approved';
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "verificationMethod" "VerificationMethod" NOT NULL DEFAULT 'qr_fallback';
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "reviewReasons" JSONB;

CREATE TABLE IF NOT EXISTS "DeviceProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "label" TEXT,
  "platform" TEXT,
  "userAgent" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trusted" BOOLEAN NOT NULL DEFAULT false,
  "riskFlags" JSONB,
  CONSTRAINT "DeviceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceProfile_userId_fingerprint_key"
  ON "DeviceProfile"("userId", "fingerprint");

DO $$ BEGIN
  ALTER TABLE "DeviceProfile"
    ADD CONSTRAINT "DeviceProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FaceEnrollment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "appearanceMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceEnrollment_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "FaceEnrollment"
    ADD CONSTRAINT "FaceEnrollment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "FaceEnrollment_userId_isActive_idx"
  ON "FaceEnrollment"("userId", "isActive");

CREATE TABLE IF NOT EXISTS "FaceEnrollmentImage" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "imageRef" TEXT NOT NULL,
  "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceEnrollmentImage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "FaceEnrollmentImage"
    ADD CONSTRAINT "FaceEnrollmentImage_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "FaceEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OfficeZone" (
  "id" TEXT NOT NULL,
  "officeLocationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "OfficeZoneType" NOT NULL,
  "centerLat" DOUBLE PRECISION NOT NULL,
  "centerLng" DOUBLE PRECISION NOT NULL,
  "radiusMeters" INTEGER NOT NULL DEFAULT 50,
  "allowedForAttendance" BOOLEAN NOT NULL DEFAULT true,
  "riskWeight" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficeZone_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "OfficeZone"
    ADD CONSTRAINT "OfficeZone_officeLocationId_fkey"
    FOREIGN KEY ("officeLocationId") REFERENCES "OfficeLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "OfficeZone_officeLocationId_idx"
  ON "OfficeZone"("officeLocationId");

CREATE TABLE IF NOT EXISTS "VerificationSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workMode" "WorkMode" NOT NULL DEFAULT 'office',
  "pinVerified" BOOLEAN NOT NULL DEFAULT false,
  "deviceFingerprint" TEXT,
  "deviceLabel" TEXT,
  "locationLat" DOUBLE PRECISION,
  "locationLng" DOUBLE PRECISION,
  "locationAccuracy" DOUBLE PRECISION,
  "locationStatus" TEXT,
  "distanceFromOffice" DOUBLE PRECISION,
  "officeZoneId" TEXT,
  "challengeTypes" "LivenessChallengeType"[] NOT NULL DEFAULT ARRAY[]::"LivenessChallengeType"[],
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "riskReasons" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationSession_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "VerificationSession"
    ADD CONSTRAINT "VerificationSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "VerificationSession"
    ADD CONSTRAINT "VerificationSession_officeZoneId_fkey"
    FOREIGN KEY ("officeZoneId") REFERENCES "OfficeZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "VerificationSession_userId_createdAt_idx"
  ON "VerificationSession"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "AttendanceVerification" (
  "id" TEXT NOT NULL,
  "attendanceRecordId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "verificationSessionId" TEXT,
  "pinVerified" BOOLEAN NOT NULL DEFAULT false,
  "faceScore" DOUBLE PRECISION,
  "faceDecision" "VerificationDecision" NOT NULL DEFAULT 'flagged',
  "livenessScore" DOUBLE PRECISION,
  "locationStatus" TEXT,
  "zoneType" "OfficeZoneType",
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "riskReasons" JSONB,
  "aiSummary" TEXT,
  "reviewStatus" "ReviewQueueStatus" NOT NULL DEFAULT 'pending',
  "deviceProfileId" TEXT,
  "method" "VerificationMethod" NOT NULL DEFAULT 'pin_face_location',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceVerification_attendanceRecordId_key"
  ON "AttendanceVerification"("attendanceRecordId");

DO $$ BEGIN
  ALTER TABLE "AttendanceVerification"
    ADD CONSTRAINT "AttendanceVerification_attendanceRecordId_fkey"
    FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceVerification"
    ADD CONSTRAINT "AttendanceVerification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceVerification"
    ADD CONSTRAINT "AttendanceVerification_verificationSessionId_fkey"
    FOREIGN KEY ("verificationSessionId") REFERENCES "VerificationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceVerification"
    ADD CONSTRAINT "AttendanceVerification_deviceProfileId_fkey"
    FOREIGN KEY ("deviceProfileId") REFERENCES "DeviceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LivenessAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "verificationSessionId" TEXT,
  "attendanceVerificationId" TEXT,
  "challengeTypes" "LivenessChallengeType"[] NOT NULL DEFAULT ARRAY[]::"LivenessChallengeType"[],
  "spokenDigits" TEXT,
  "resultScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivenessAttempt_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "LivenessAttempt"
    ADD CONSTRAINT "LivenessAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LivenessAttempt"
    ADD CONSTRAINT "LivenessAttempt_verificationSessionId_fkey"
    FOREIGN KEY ("verificationSessionId") REFERENCES "VerificationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LivenessAttempt"
    ADD CONSTRAINT "LivenessAttempt_attendanceVerificationId_fkey"
    FOREIGN KEY ("attendanceVerificationId") REFERENCES "AttendanceVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReviewQueueItem" (
  "id" TEXT NOT NULL,
  "attendanceVerificationId" TEXT NOT NULL,
  "attendanceRecordId" TEXT,
  "userId" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "status" "ReviewQueueStatus" NOT NULL DEFAULT 'pending',
  "recommendation" TEXT,
  "reasons" JSONB,
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewQueueItem_attendanceVerificationId_key"
  ON "ReviewQueueItem"("attendanceVerificationId");

DO $$ BEGIN
  ALTER TABLE "ReviewQueueItem"
    ADD CONSTRAINT "ReviewQueueItem_attendanceVerificationId_fkey"
    FOREIGN KEY ("attendanceVerificationId") REFERENCES "AttendanceVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewQueueItem"
    ADD CONSTRAINT "ReviewQueueItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AdminOverride" (
  "id" TEXT NOT NULL,
  "attendanceRecordId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminOverride_attendanceRecordId_key"
  ON "AdminOverride"("attendanceRecordId");

DO $$ BEGIN
  ALTER TABLE "AdminOverride"
    ADD CONSTRAINT "AdminOverride_attendanceRecordId_fkey"
    FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AdminOverride"
    ADD CONSTRAINT "AdminOverride_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AdminOverride"
    ADD CONSTRAINT "AdminOverride_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;

async function main() {
  await client.connect();
  await client.query(sql);
  console.log('Verification schema applied successfully.');
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
