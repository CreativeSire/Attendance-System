import { prisma } from '../config/prisma';

interface AuditPayload {
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
}

export async function createAuditLog(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: payload.actorId ?? null,
        actorName: payload.actorName ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId ?? null,
        metadata: payload.metadata as object | undefined,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit entry', error);
  }
}
