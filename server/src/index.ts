import http from 'http';
import { createApp } from './app';
import { initSocket } from './socket';
import { env } from './config/env';
import { startQRRefreshJob } from './utils/qrJob';

const app = createApp();
const server = http.createServer(app);
initSocket(server);
startQRRefreshJob();

server.listen(env.PORT, () => {
  console.log(`\n🚀 Dala Server running on port ${env.PORT}`);
  console.log(`📦 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 Client URL: ${env.CLIENT_URL}\n`);
});

export { server };
