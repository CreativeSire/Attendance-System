import http from 'http';
import { createApp } from './app';
import { prisma } from './config/prisma';
import { initSocket } from './socket';
import { env } from './config/env';
import { startQRRefreshJob } from './utils/qrJob';

const app = createApp();
const server = http.createServer(app);

let shuttingDown = false;

async function bootstrap() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  initSocket(server);
  startQRRefreshJob();

  server.listen(env.PORT, () => {
    console.log(`\n🚀 Dala Server running on port ${env.PORT}`);
    console.log(`📦 Environment: ${env.NODE_ENV}`);
    console.log(`🌐 Client URL: ${env.CLIENT_URL}\n`);
  });
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception', error);
});

void bootstrap().catch(async (error) => {
  console.error('[Server] Failed to bootstrap application', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

export { server };
