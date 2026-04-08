import { prisma } from '../config/prisma';

export async function getRuntimeConfig() {
  const [appConfig, office] = await Promise.all([
    prisma.appConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
      },
    }),
    prisma.officeLocation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return { appConfig, office };
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLng = toRad(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export function classifyLocationEvidence(args: {
  distanceMeters?: number | null;
  accuracyMeters?: number | null;
  radiusMeters?: number | null;
}) {
  const { distanceMeters, accuracyMeters, radiusMeters } = args;

  if (distanceMeters === undefined || distanceMeters === null) return 'unavailable';
  if (accuracyMeters === undefined || accuracyMeters === null) {
    return distanceMeters <= (radiusMeters ?? 75) ? 'inside_radius' : 'far_away';
  }

  if (accuracyMeters > 120) return 'poor_accuracy';
  if (distanceMeters <= (radiusMeters ?? 75)) return 'inside_radius';
  if (distanceMeters <= (radiusMeters ?? 75) + 50) return 'near_office';
  return 'far_away';
}
