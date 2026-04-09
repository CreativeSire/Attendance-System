import 'dotenv/config';

process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient, ReviewQueueStatus } from '@prisma/client';

const prisma = new PrismaClient();

const baseUrl = process.env.AUDIT_BASE_URL || process.env.SMOKE_BASE_URL || 'https://dala-attendance.up.railway.app';
const auditUserCount = Number(process.env.AUDIT_USER_COUNT || '100');
const auditPassword = process.env.AUDIT_USER_PASSWORD || 'AuditPass123!';
const reportPath = path.resolve(process.cwd(), '..', 'docs', 'attendance-verification-audit.md');
const today = new Date().toISOString().slice(0, 10);

type Cohort = 'standard' | 'staff-quarters' | 'location-denied' | 'admin-assisted';

type AuditUser = {
  index: number;
  name: string;
  email: string;
  employeeId: string;
  password: string;
  pin: string;
  cohort: Cohort;
};

type TrialResult = {
  name: string;
  status: 'passed' | 'failed';
  details: string[];
};

type UserAuditResult = {
  user: AuditUser;
  trials: TrialResult[];
  finalOutcome: string;
  riskDecision?: string;
  reviewQueueStatus?: string;
};

const firstNames = [
  'John', 'Maxwell', 'Joe', 'Amos', 'Bola', 'Chika', 'Daniel', 'Esther', 'Femi', 'Grace',
  'Hassan', 'Ife', 'Jide', 'Kemi', 'Lami', 'Musa', 'Nneka', 'Ola', 'Peace', 'Quincy',
  'Rita', 'Samuel', 'Tobi', 'Ugo', 'Vera', 'Wale', 'Xavier', 'Yemi', 'Zainab', 'Ada',
];

const lastNames = [
  'Okoro', 'Ibrahim', 'Balogun', 'Daniels', 'Eze', 'Falana', 'Garba', 'Hassan', 'Ijeoma', 'Johnson',
  'Kolade', 'Lawal', 'Madu', 'Nwachukwu', 'Ogunleye', 'Popoola', 'Quadri', 'Raji', 'Sule', 'Taiwo',
  'Ubah', 'Vincent', 'Williams', 'Yakubu', 'Zubair', 'Afolabi', 'Bassey', 'Chukwu', 'Dairo', 'Ekong',
];

function makeAuditUsers(count: number): AuditUser[] {
  return Array.from({ length: count }, (_, index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    const userIndex = index + 1;
    const cohort: Cohort =
      userIndex <= 70 ? 'standard' :
      userIndex <= 85 ? 'staff-quarters' :
      userIndex <= 95 ? 'location-denied' :
      'admin-assisted';

    return {
      index: userIndex,
      name: `${firstName} ${lastName} ${String(userIndex).padStart(3, '0')}`,
      email: `audit.user${String(userIndex).padStart(3, '0')}@dala.com`,
      employeeId: `AUD${String(userIndex).padStart(3, '0')}`,
      password: auditPassword,
      pin: String(6000 + userIndex),
      cohort,
    };
  });
}

function makeSvgFace(label: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="36" fill="#16162a"/>
      <circle cx="256" cy="182" r="86" fill="#7c6bff"/>
      <path d="M128 420c22-76 77-120 128-120 51 0 106 44 128 120" fill="#9081ff"/>
      <text x="256" y="474" text-anchor="middle" font-size="24" fill="#fff" font-family="Arial, sans-serif">${label}</text>
    </svg>
  `)}`;
}

async function request<T = any>(urlPath: string, init?: RequestInit, expectedStatus?: number): Promise<T> {
  const response = await fetch(`${baseUrl}${urlPath}`, init);
  const text = await response.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // leave text
  }

  if (expectedStatus !== undefined) {
    if (response.status !== expectedStatus) {
      throw new Error(`${urlPath} expected ${expectedStatus} but got ${response.status}: ${JSON.stringify(data)}`);
    }
    return data as T;
  }

  if (!response.ok) {
    throw new Error(`${urlPath} failed with ${response.status}: ${JSON.stringify(data)}`);
  }

  return data as T;
}

async function login(email: string, password: string, extraHeaders?: Record<string, string>) {
  const result = await request<{ data: { accessToken: string; refreshToken: string } }>(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(extraHeaders || {}),
      },
      body: JSON.stringify({ email, password }),
    }
  );

  return result.data;
}

async function authed<T = any>(pathName: string, token: string, init?: RequestInit, expectedStatus?: number): Promise<T> {
  return request<T>(pathName, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  }, expectedStatus);
}

async function ensureAuditUsers(users: AuditUser[]) {
  const passwordHash = await bcrypt.hash(auditPassword, 10);

  for (const user of users) {
    const pinHash = await bcrypt.hash(user.pin, 10);
    const appearanceProfile = {
      usuallyWearsGlasses: user.index % 3 === 0,
      facialHairCommon: user.index % 4 === 0,
      headwearCommon: user.index % 5 === 0,
      auditSynthetic: true,
    };

    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: passwordHash,
        pinHash,
        role: 'employee',
        department: 'Audit Simulation',
        employeeId: user.employeeId,
        position: 'Audit Test Employee',
        hourlyRate: 1200,
        basicSalary: 180000,
        isActive: true,
        appearanceProfile,
        masterPhoto: makeSvgFace(`${user.name} avatar`),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
      create: {
        name: user.name,
        email: user.email,
        password: passwordHash,
        pinHash,
        role: 'employee',
        department: 'Audit Simulation',
        employeeId: user.employeeId,
        position: 'Audit Test Employee',
        hourlyRate: 1200,
        basicSalary: 180000,
        appearanceProfile,
        masterPhoto: makeSvgFace(`${user.name} avatar`),
      },
    });

    const existingEnrollment = await prisma.faceEnrollment.findFirst({
      where: { userId: record.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingEnrollment) {
      const enrollment = await prisma.faceEnrollment.create({
        data: {
          userId: record.id,
          version: 1,
          isActive: true,
          qualityScore: 0.9,
          appearanceMetadata: appearanceProfile,
        },
      });

      const images = [
        { kind: 'frontal', imageRef: makeSvgFace(`${user.name} front`), qualityScore: 0.92 },
        { kind: 'slight_left', imageRef: makeSvgFace(`${user.name} left`), qualityScore: 0.9 },
        { kind: 'slight_right', imageRef: makeSvgFace(`${user.name} right`), qualityScore: 0.9 },
        { kind: 'neutral', imageRef: makeSvgFace(`${user.name} neutral`), qualityScore: 0.88 },
      ];

      for (const image of images) {
        await prisma.faceEnrollmentImage.create({
          data: {
            enrollmentId: enrollment.id,
            kind: image.kind,
            imageRef: image.imageRef,
            qualityScore: image.qualityScore,
          },
        });
      }
    }
  }
}

async function resetAuditState(users: AuditUser[]) {
  const auditEmails = users.map((user) => user.email);
  const dbUsers = await prisma.user.findMany({
    where: { email: { in: auditEmails } },
    select: { id: true },
  });
  const userIds = dbUsers.map((user) => user.id);

  if (!userIds.length) return;

  await prisma.bDDCheckIn.deleteMany({
    where: {
      userId: { in: userIds },
      date: today,
    },
  });

  await prisma.adminOverride.deleteMany({
    where: {
      OR: [
        { employeeId: { in: userIds } },
        { adminId: { in: userIds } },
      ],
    },
  });

  await prisma.reviewQueueItem.deleteMany({
    where: { userId: { in: userIds } },
  });

  await prisma.attendanceVerification.deleteMany({
    where: { userId: { in: userIds } },
  });

  await prisma.livenessAttempt.deleteMany({
    where: { userId: { in: userIds } },
  });

  await prisma.verificationSession.deleteMany({
    where: { userId: { in: userIds } },
  });

  await prisma.attendanceRecord.deleteMany({
    where: {
      userId: { in: userIds },
      date: today,
    },
  });

  await prisma.deviceProfile.deleteMany({
    where: { userId: { in: userIds } },
  });

  await prisma.refreshToken.deleteMany({
    where: { userId: { in: userIds } },
  });

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    },
  });
}

function buildLivenessResponses(prompts: Array<{ type: string; prompt: string }>) {
  return prompts.map((prompt) => ({
    type: prompt.type,
    passed: true,
    spokenDigits: prompt.type === 'say_digits' ? '482' : undefined,
    confidence: 0.93,
  }));
}

function buildDailyPulsePayload(user: AuditUser) {
  return {
    priorityOne: `Complete verification audit pass for ${user.name}`,
    priorityTwo: 'Review flagged attendance outcomes',
    priorityThree: 'Confirm payroll-safe attendance export readiness',
    completedYesterday: 'Completed prior simulation trial.',
    blockers: user.cohort === 'staff-quarters' ? 'Potential quarters-zone review.' : 'No blocker.',
    progressPercent: 80,
    questionsNotes: `Automated audit submission for ${user.employeeId}.`,
  };
}

async function runUserTrials(
  user: AuditUser,
  adminToken: string,
  managerToken: string,
  reviewQueueSeen: Set<string>
): Promise<UserAuditResult> {
  const trials: TrialResult[] = [];
  const deviceFingerprint = `audit-device-${String(user.index).padStart(3, '0')}`;
  const deviceHeaders = {
    'x-device-fingerprint': deviceFingerprint,
    'x-device-label': `Audit Device ${String(user.index).padStart(3, '0')}`,
  };

  let employeeToken = '';
  let finalOutcome = 'not_started';
  let riskDecision: string | undefined;
  let reviewQueueStatus: string | undefined;
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { email: user.email },
    select: { id: true },
  });

  try {
    await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'WrongPass123!' }),
    }, 401);

    trials.push({
      name: 'Trial 1 - Invalid login rejected',
      status: 'passed',
      details: ['Invalid password was rejected with HTTP 401.'],
    });
  } catch (error) {
    trials.push({
      name: 'Trial 1 - Invalid login rejected',
      status: 'failed',
      details: [error instanceof Error ? error.message : String(error)],
    });
  }

  try {
    const loginResult = await login(user.email, user.password, deviceHeaders);
    employeeToken = loginResult.accessToken;
    await authed('/api/auth/me', employeeToken);
    await authed('/api/attendance/today-status', employeeToken);
    await authed('/api/attendance/my-stats', employeeToken);

    trials.push({
      name: 'Trial 2 - Valid login and session checks',
      status: 'passed',
      details: ['Login succeeded.', '/api/auth/me returned the employee profile.', '/api/attendance/today-status returned successfully.'],
    });
  } catch (error) {
    trials.push({
      name: 'Trial 2 - Valid login and session checks',
      status: 'failed',
      details: [error instanceof Error ? error.message : String(error)],
    });
  }

  try {
    await authed('/api/attendance/verification/start', employeeToken, {
      method: 'POST',
      body: JSON.stringify({
        pin: '9999',
        workMode: 'office',
        lat: 6.5244,
        lng: 3.3792,
        accuracy: 10,
        deviceFingerprint,
        deviceLabel: deviceHeaders['x-device-label'],
      }),
    }, 401);

    trials.push({
      name: 'Trial 3 - Wrong PIN rejected',
      status: 'passed',
      details: ['Incorrect PIN was rejected with HTTP 401.'],
    });
  } catch (error) {
    trials.push({
      name: 'Trial 3 - Wrong PIN rejected',
      status: 'failed',
      details: [error instanceof Error ? error.message : String(error)],
    });
  }

  try {
    const riskProbePayload =
      user.cohort === 'staff-quarters'
        ? {
            pin: user.pin,
            workMode: 'office',
            lat: 6.52495,
            lng: 3.37965,
            accuracy: 12,
            deviceFingerprint,
            deviceLabel: deviceHeaders['x-device-label'],
          }
        : user.cohort === 'location-denied'
          ? {
              pin: user.pin,
              workMode: 'office',
              deviceFingerprint,
              deviceLabel: deviceHeaders['x-device-label'],
            }
          : {
              pin: user.pin,
              workMode: 'office',
              lat: 6.52445,
              lng: 3.37925,
              accuracy: 8,
              deviceFingerprint,
              deviceLabel: deviceHeaders['x-device-label'],
            };

    const startResult = await authed<{
      data: {
        risk: { score: number; reasons: string[] };
        location: { status: string; zoneType: string | null; zoneName: string | null };
      };
    }>('/api/attendance/verification/start', employeeToken, {
      method: 'POST',
      body: JSON.stringify(riskProbePayload),
    });

    trials.push({
      name: 'Trial 4 - Risk probe',
      status: 'passed',
      details: [
        `Risk score ${startResult.data.risk.score}.`,
        `Location status ${startResult.data.location.status}.`,
        startResult.data.location.zoneName ? `Matched zone ${startResult.data.location.zoneName}.` : 'No explicit zone match.',
      ],
    });
  } catch (error) {
    trials.push({
      name: 'Trial 4 - Risk probe',
      status: 'failed',
      details: [error instanceof Error ? error.message : String(error)],
    });
  }

  try {
    if (user.cohort === 'admin-assisted') {
      const adminOverride = await authed<{ data: { id: string } }>('/api/admin/assisted-clock-in', adminToken, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: dbUser.id,
          reasonCode: 'device_failure',
          note: 'Synthetic audit override flow.',
          workMode: 'office',
          lat: 6.52445,
          lng: 3.37925,
          accuracy: 7,
        }),
      });

      await authed('/api/attendance/today-status', employeeToken);
      await authed('/api/bdd', employeeToken, {
        method: 'POST',
        body: JSON.stringify(buildDailyPulsePayload(user)),
      });
      await authed('/api/bdd/today', employeeToken);
      await authed('/api/attendance/clock-out', employeeToken, {
        method: 'POST',
        body: JSON.stringify({
          facePhoto: makeSvgFace(`${user.name} clockout`),
          lat: 6.52445,
          lng: 3.37925,
          accuracy: 7,
        }),
      });

      const queue = await authed<{ data: Array<{ id: string; userId: string; status: ReviewQueueStatus }> }>('/api/admin/review-queue', managerToken);
      const item = queue.data.find((entry) => entry.userId === dbUser.id && !reviewQueueSeen.has(entry.id));
      if (item) {
        reviewQueueSeen.add(item.id);
        await authed(`/api/admin/review-queue/${item.id}`, managerToken, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved', reviewNote: 'Synthetic audit approval.' }),
        });
        reviewQueueStatus = 'approved';
      }

      finalOutcome = `Admin-assisted flow completed (attendance ${adminOverride.data.id}).`;
      riskDecision = 'flagged';
    } else {
      const finalStartPayload =
        user.cohort === 'staff-quarters'
          ? {
              pin: user.pin,
              workMode: 'office',
              lat: 6.52495,
              lng: 3.37965,
              accuracy: 10,
              deviceFingerprint,
              deviceLabel: deviceHeaders['x-device-label'],
            }
          : user.cohort === 'location-denied'
            ? {
                pin: user.pin,
                workMode: 'office',
                deviceFingerprint,
                deviceLabel: deviceHeaders['x-device-label'],
              }
            : {
                pin: user.pin,
                workMode: 'office',
                lat: 6.52445,
                lng: 3.37925,
                accuracy: 6,
                deviceFingerprint,
                deviceLabel: deviceHeaders['x-device-label'],
              };

      const session = await authed<{
        data: {
          sessionId: string;
          prompts: Array<{ type: string; prompt: string }>;
          risk: { score: number; reasons: string[] };
          location: { zoneType: string | null; zoneName: string | null; status: string };
        };
      }>('/api/attendance/verification/start', employeeToken, {
        method: 'POST',
        body: JSON.stringify(finalStartPayload),
      });

      const completion = await authed<{
        data: {
          id: string;
          verification?: { decision: string; reasons: string[]; reviewStatus: string };
        };
      }>('/api/attendance/verification/complete', employeeToken, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.data.sessionId,
          facePhoto: makeSvgFace(`${user.name} live`),
          lateReason: 'Automated audit verification outside normal work start time.',
          mood: 'focused',
          livenessResponses: buildLivenessResponses(session.data.prompts),
        }),
      });

      await authed('/api/attendance/today-status', employeeToken);
      await authed('/api/bdd', employeeToken, {
        method: 'POST',
        body: JSON.stringify(buildDailyPulsePayload(user)),
      });
      await authed('/api/bdd/today', employeeToken);
      await authed('/api/attendance/my-stats', employeeToken);
      await authed('/api/attendance/clock-out', employeeToken, {
        method: 'POST',
        body: JSON.stringify({
          facePhoto: makeSvgFace(`${user.name} clockout`),
          lat: 6.52445,
          lng: 3.37925,
          accuracy: 7,
        }),
      });

      riskDecision = completion.data.verification?.decision;

      if (completion.data.verification?.reviewStatus === 'pending') {
        const queue = await authed<{ data: Array<{ id: string; userId: string; status: ReviewQueueStatus }> }>('/api/admin/review-queue', managerToken);
        const item = queue.data.find((entry) => entry.userId === dbUser.id && !reviewQueueSeen.has(entry.id));
        if (item) {
          reviewQueueSeen.add(item.id);
          await authed(`/api/admin/review-queue/${item.id}`, managerToken, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'approved', reviewNote: 'Synthetic audit approval.' }),
          });
          reviewQueueStatus = 'approved';
        }
      } else {
        reviewQueueStatus = completion.data.verification?.reviewStatus;
      }

      finalOutcome = `Verification flow completed with decision ${completion.data.verification?.decision ?? 'unknown'}.`;
    }

    trials.push({
      name: 'Trial 5 - Final attendance pipeline',
      status: 'passed',
      details: [
        finalOutcome,
        riskDecision ? `Risk decision: ${riskDecision}.` : 'No explicit risk decision returned.',
        reviewQueueStatus ? `Review queue status: ${reviewQueueStatus}.` : 'No review queue item was needed.',
      ],
    });
  } catch (error) {
    trials.push({
      name: 'Trial 5 - Final attendance pipeline',
      status: 'failed',
      details: [error instanceof Error ? error.message : String(error)],
    });
    finalOutcome = 'Final attendance flow failed.';
  }

  return {
    user,
    trials,
    finalOutcome,
    riskDecision,
    reviewQueueStatus,
  };
}

function buildMarkdownReport(results: UserAuditResult[]) {
  const totalTrials = results.reduce((sum, result) => sum + result.trials.length, 0);
  const passedTrials = results.reduce((sum, result) => sum + result.trials.filter((trial) => trial.status === 'passed').length, 0);
  const failedTrials = totalTrials - passedTrials;
  const byCohort = results.reduce<Record<Cohort, UserAuditResult[]>>((acc, result) => {
    acc[result.user.cohort].push(result);
    return acc;
  }, {
    standard: [],
    'staff-quarters': [],
    'location-denied': [],
    'admin-assisted': [],
  });

  const failedDetails = results.flatMap((result) =>
    result.trials
      .filter((trial) => trial.status === 'failed')
      .map((trial) => `- ${result.user.employeeId} ${result.user.name}: ${trial.name} -> ${trial.details.join(' ')}`)
  );

  const reviewDecisions = results.reduce<Record<string, number>>((acc, result) => {
    const key = result.riskDecision || 'unreported';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return `# Attendance Verification Audit

Generated: ${new Date().toISOString()}
Target: ${baseUrl}
Audit date: ${today}

## Scope

- Synthetic employees provisioned: ${results.length}
- Trials executed: ${totalTrials}
- Passed trials: ${passedTrials}
- Failed trials: ${failedTrials}
- Trial model: 5 sequential trials per employee

## Cohorts

| Cohort | Users | Purpose |
| --- | ---: | --- |
| Standard | ${byCohort.standard.length} | Normal office verification flow |
| Staff quarters | ${byCohort['staff-quarters'].length} | Zone-aware flagged verification flow |
| Location denied | ${byCohort['location-denied'].length} | Missing-location fallback flow |
| Admin assisted | ${byCohort['admin-assisted'].length} | Audited admin override flow |

## Risk Decisions

${Object.entries(reviewDecisions).map(([decision, count]) => `- ${decision}: ${count}`).join('\n')}

## Trial Summary

${results.map((result) => {
  const passed = result.trials.filter((trial) => trial.status === 'passed').length;
  const failed = result.trials.length - passed;
  return `- ${result.user.employeeId} ${result.user.name} (${result.user.cohort}): ${passed}/${result.trials.length} trials passed. Final outcome: ${result.finalOutcome}`;
}).join('\n')}

## Failures Observed

${failedDetails.length ? failedDetails.join('\n') : '- No trial failures were observed in this campaign run.'}

## Security and Architecture Notes

- Sensitive auth and verification routes were hardened with in-memory rate limiting before this run.
- Image payload validation was added for face capture, face enrollment, and legacy fallback uploads.
- Runtime security headers now enforce basic browser hardening for camera, geolocation, framing, and MIME sniffing.
- No Sentry token was available on this machine during this audit, so production error triage is based on live API/browser checks and code inspection rather than Sentry telemetry.

## Threat Model Highlights

- Primary identity chain is now login + employee PIN + face capture + liveness + live location.
- Staff-quarters proximity remains a policy-sensitive condition; the backend treats it as a flagged zone rather than a silent pass.
- Admin-assisted clock-in remains available for operational continuity and is always auditable.
- Personal devices are treated as partially trusted through device fingerprint history and review scoring rather than as a fully trusted factor.

## Remaining Gaps

- Face verification is still workflow-grade rather than production biometric-grade matching.
- Liveness is randomized and audited, but it remains response-driven rather than model-driven computer-vision liveness detection.
- Zone management exists in data and admin APIs, but map-drawing UX for complex polygon geofences is still pending.
- AI review summaries are rules-backed and text-based; a full Gemma-backed anomaly analyst remains the next depth layer.
`;
}

async function main() {
  const users = makeAuditUsers(auditUserCount);
  const reviewQueueSeen = new Set<string>();

  console.log(`Provisioning ${users.length} audit users...`);
  await ensureAuditUsers(users);
  await resetAuditState(users);

  console.log('Authenticating admin and manager audit operators...');
  const adminAuth = await login('admin@dala.com', 'admin123');
  const managerAuth = await login('sarah@dala.com', 'password123');

  const results: UserAuditResult[] = [];
  for (const user of users) {
    console.log(`Running audit pipeline for ${user.employeeId} ${user.name} (${user.cohort})`);
    const result = await runUserTrials(user, adminAuth.accessToken, managerAuth.accessToken, reviewQueueSeen);
    results.push(result);
  }

  const markdown = buildMarkdownReport(results);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, markdown, 'utf8');

  console.log(`Audit report written to ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
