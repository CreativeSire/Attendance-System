import { prisma } from '../config/prisma';
import { getIO } from '../socket';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

async function refreshExpiredTokens() {
  try {
    const now = new Date();
    const entryPoints = await prisma.entryPoint.findMany({ where: { isActive: true } });

    for (const ep of entryPoints) {
      // Check if there's a valid token
      const valid = await prisma.qRToken.findFirst({
        where: {
          entryPointId: ep.id,
          expiresAt: { gt: now },
          usedAt: null,
        },
      });

      if (!valid) {
        // Generate new token
        const token = uuidv4();
        const expiresAt = new Date(now.getTime() + 3 * 60 * 1000);
        const qrDataUrl = await QRCode.toDataURL(token, { width: 300, margin: 2 });

        const newToken = await prisma.qRToken.create({
          data: { token, entryPointId: ep.id, entryPointName: ep.name, expiresAt },
        });

        // Emit to subscribed screens
        try {
          getIO().to(`entry:${ep.id}`).emit('qr:refresh', {
            token: newToken.token,
            qrDataUrl,
            entryPointId: ep.id,
            entryPointName: ep.name,
            expiresAt: newToken.expiresAt,
          });
        } catch {
          // Socket not ready yet
        }
      }
    }
  } catch {
    // DB not ready yet
  }
}

export function startQRRefreshJob() {
  setInterval(refreshExpiredTokens, 30_000);
  // Also run immediately after a short delay
  setTimeout(refreshExpiredTokens, 5_000);
  console.log('⏱  QR refresh job started (30s interval)');
}
