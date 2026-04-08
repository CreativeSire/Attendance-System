import { PrismaClient } from '@prisma/client';

type ExtendedPrismaClient = PrismaClient & {
  appConfig: PrismaClient extends { appConfig: infer T } ? T : any;
  officeLocation: PrismaClient extends { officeLocation: infer T } ? T : any;
  auditLog: PrismaClient extends { auditLog: infer T } ? T : any;
};

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient };

export const prisma = (globalForPrisma.prisma || new PrismaClient()) as ExtendedPrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
