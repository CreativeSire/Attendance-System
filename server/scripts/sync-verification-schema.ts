import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

function buildClientConfig(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');

  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

const sql = `
ALTER TABLE "FaceEnrollmentImage" ADD COLUMN IF NOT EXISTS "descriptor" JSONB;
ALTER TABLE "FaceEnrollmentImage" ADD COLUMN IF NOT EXISTS "captureMetadata" JSONB;
ALTER TABLE "OfficeZone" ADD COLUMN IF NOT EXISTS "geometry" JSONB;
ALTER TABLE "AttendanceVerification" ADD COLUMN IF NOT EXISTS "faceDistance" DOUBLE PRECISION;
ALTER TABLE "AttendanceVerification" ADD COLUMN IF NOT EXISTS "faceCaptureMetadata" JSONB;
ALTER TABLE "AttendanceVerification" ADD COLUMN IF NOT EXISTS "aiRecommendation" TEXT;
ALTER TABLE "AttendanceVerification" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
ALTER TABLE "ReviewQueueItem" ADD COLUMN IF NOT EXISTS "aiRecommendation" TEXT;
ALTER TABLE "ReviewQueueItem" ADD COLUMN IF NOT EXISTS "aiRiskSummary" TEXT;
`;

async function main() {
  const client = new Client(buildClientConfig(connectionString!));
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Verification schema sync complete.');
}

main().catch((error) => {
  console.error('Verification schema sync failed.');
  console.error(error);
  process.exit(1);
});
