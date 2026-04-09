import { LivenessChallengeType, OfficeZoneType, Prisma, VerificationDecision } from '@prisma/client';
import { prisma } from '../config/prisma';
import { classifyLocationEvidence, getRuntimeConfig, haversineDistanceMeters } from './settings';

type LocationPayload = {
  lat?: number;
  lng?: number;
  accuracy?: number;
};

type RiskInput = {
  pinVerified: boolean;
  hasEnrollment: boolean;
  faceScore: number;
  livenessScore: number;
  locationStatus: string;
  zoneType?: OfficeZoneType | null;
  knownDevice: boolean;
  lateMinutes: number;
  previousOverrides: number;
};

export type ResolvedLocationResult = {
  office: Awaited<ReturnType<typeof getRuntimeConfig>>['office'];
  distanceFromOffice: number | null;
  locationStatus: string;
  zone: {
    id: string;
    name: string;
    type: OfficeZoneType;
  } | null;
  zoneType: OfficeZoneType | null;
};

export type RiskAssessmentResult = {
  score: number;
  reasons: string[];
  decision: VerificationDecision;
  recommendReview: boolean;
};

export async function resolveLocationAndZone(input: LocationPayload): Promise<ResolvedLocationResult> {
  const { office } = await getRuntimeConfig();
  if (!office || input.lat === undefined || input.lng === undefined) {
    return {
      office,
      distanceFromOffice: null,
      locationStatus: 'unavailable',
      zone: null,
      zoneType: null as OfficeZoneType | null,
    };
  }

  const distanceFromOffice = haversineDistanceMeters(
    input.lat,
    input.lng,
    office.latitude,
    office.longitude
  );

  const zones = await prisma.officeZone.findMany({
    where: { officeLocationId: office.id },
  });

  let matchedZone: (typeof zones)[number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    const zoneDistance = haversineDistanceMeters(
      input.lat,
      input.lng,
      zone.centerLat,
      zone.centerLng
    );
    if (zoneDistance <= zone.radiusMeters && zoneDistance < bestDistance) {
      matchedZone = zone;
      bestDistance = zoneDistance;
    }
  }

  let locationStatus = classifyLocationEvidence({
    distanceMeters: distanceFromOffice,
    accuracyMeters: input.accuracy,
    radiusMeters: office.radiusMeters,
  });

  if (matchedZone?.type === 'staff_quarters_zone') {
    locationStatus = 'inside_staff_quarters_zone';
  } else if (matchedZone?.type === 'work_zone') {
    locationStatus = 'inside_work_zone';
  } else if (matchedZone?.type === 'entry_zone') {
    locationStatus = 'inside_entry_zone';
  } else if (matchedZone?.type === 'restricted_zone') {
    locationStatus = 'inside_restricted_zone';
  }

  return {
    office,
    distanceFromOffice,
    locationStatus,
    zone: matchedZone
      ? {
          id: matchedZone.id,
          name: matchedZone.name,
          type: matchedZone.type,
        }
      : null,
    zoneType: matchedZone?.type ?? null,
  };
}

export function generateLivenessChallenges(riskScore = 0): LivenessChallengeType[] {
  const pool: LivenessChallengeType[] = [
    'blink_twice',
    'turn_left',
    'turn_right',
    'nod_slowly',
    'say_digits',
  ];

  const copy = [...pool].sort(() => Math.random() - 0.5);
  const count = riskScore >= 55 ? 2 : 1;
  return copy.slice(0, count);
}

export function buildLivenessPrompt(type: LivenessChallengeType) {
  if (type === 'blink_twice') return 'Blink twice slowly while keeping your face inside the frame.';
  if (type === 'turn_left') return 'Turn your head slightly to the left, then face forward.';
  if (type === 'turn_right') return 'Turn your head slightly to the right, then face forward.';
  if (type === 'nod_slowly') return 'Nod slowly once while looking at the camera.';
  return `Say the short number ${Math.floor(100 + Math.random() * 900)} clearly.`;
}

export function assessRisk(input: RiskInput): RiskAssessmentResult {
  let score = 0;
  const reasons: string[] = [];

  if (!input.pinVerified) {
    score += 40;
    reasons.push('Employee PIN was not verified.');
  }

  if (!input.hasEnrollment) {
    score += 40;
    reasons.push('No active face enrollment exists for this employee.');
  }

  if (input.faceScore < 0.72) {
    score += 28;
    reasons.push('Face verification confidence is below the safe threshold.');
  } else if (input.faceScore < 0.84) {
    score += 12;
    reasons.push('Face verification confidence is below the user’s normal range.');
  }

  if (input.livenessScore < 0.75) {
    score += 25;
    reasons.push('Liveness confidence is low.');
  }

  if (input.zoneType === 'staff_quarters_zone') {
    score += 35;
    reasons.push('Check-in occurred inside the staff quarters zone.');
  }

  if (input.zoneType === 'restricted_zone') {
    score += 50;
    reasons.push('Check-in occurred inside a restricted zone.');
  }

  if (input.locationStatus === 'poor_accuracy') {
    score += 12;
    reasons.push('Location accuracy is poor.');
  }

  if (input.locationStatus === 'far_away') {
    score += 45;
    reasons.push('Device location is far away from the official office.');
  }

  if (input.locationStatus === 'unavailable') {
    score += 20;
    reasons.push('Live location was unavailable during verification.');
  }

  if (!input.knownDevice) {
    score += 10;
    reasons.push('This device has not been seen for this employee before.');
  }

  if (input.lateMinutes >= 45) {
    score += 6;
    reasons.push('Clock-in is significantly later than the normal start window.');
  }

  if (input.previousOverrides >= 3) {
    score += 10;
    reasons.push('This employee already has multiple manual override events.');
  }

  if (score >= 75) {
    return { score, reasons, decision: 'blocked', recommendReview: true };
  }

  if (score >= 35) {
    return { score, reasons, decision: 'flagged', recommendReview: true };
  }

  return { score, reasons, decision: 'approved', recommendReview: false };
}

export async function upsertDeviceProfile(args: {
  userId: string;
  fingerprint?: string | null;
  label?: string | null;
  userAgent?: string | null;
  platform?: string | null;
}) {
  if (!args.fingerprint) {
    return { profile: null, known: false };
  }

  const existing = await prisma.deviceProfile.findUnique({
    where: {
      userId_fingerprint: {
        userId: args.userId,
        fingerprint: args.fingerprint,
      },
    },
  });

  const profile = await prisma.deviceProfile.upsert({
    where: {
      userId_fingerprint: {
        userId: args.userId,
        fingerprint: args.fingerprint,
      },
    },
    update: {
      label: args.label ?? existing?.label ?? null,
      userAgent: args.userAgent ?? existing?.userAgent ?? null,
      platform: args.platform ?? existing?.platform ?? null,
      lastSeenAt: new Date(),
    },
    create: {
      userId: args.userId,
      fingerprint: args.fingerprint,
      label: args.label ?? null,
      userAgent: args.userAgent ?? null,
      platform: args.platform ?? null,
      lastSeenAt: new Date(),
    },
  });

  return { profile, known: Boolean(existing) };
}

export function buildReviewSummary(args: {
  userName: string;
  score: number;
  reasons: string[];
  zoneType?: OfficeZoneType | null;
  locationStatus: string;
}) {
  const zoneText = args.zoneType ? ` Zone: ${args.zoneType}.` : '';
  const headline = args.score >= 75 ? 'High risk verification event.' : args.score >= 35 ? 'Moderate risk verification event.' : 'Low risk verification event.';
  const reasonText = args.reasons.length > 0
    ? ` Top reasons: ${args.reasons.slice(0, 3).join(' ')}`
    : ' No strong anomalies were detected.';

  return `${headline} ${args.userName} attempted clock-in with location status ${args.locationStatus}.${zoneText}${reasonText}`;
}

export function normalizeJsonObject<T extends Prisma.JsonObject>(value: T): T {
  return value;
}
