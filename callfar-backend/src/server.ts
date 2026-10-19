import http from 'http';
import { createApp } from './app.js';
import { ENV } from './config/env.js';
import { setupSocketServer } from './signaling/socket.server.js';
import { prisma } from './config/prisma.js';

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.IO Signaling Server
  const io = setupSocketServer(server, ENV.CORS_ORIGIN);

  server.listen(ENV.PORT, () => {
    const dbTarget = ENV.DATABASE_URL.includes('supabase.co')
      ? 'Supabase Cloud PostgreSQL'
      : (ENV.DATABASE_URL.includes('localhost') || ENV.DATABASE_URL.includes('127.0.0.1'))
      ? 'Local PostgreSQL'
      : 'Remote PostgreSQL';

    console.log(`===============================================`);
    console.log(`🚀 CallFar Backend Server Active`);
    console.log(`📡 HTTP API:        http://localhost:${ENV.PORT}${ENV.API_PREFIX}`);
    console.log(`🩺 Health check:    http://localhost:${ENV.PORT}/health`);
    console.log(`⚡ WebSocket URL:   ws://localhost:${ENV.PORT}`);
    console.log(`🗄️  Database:        ${dbTarget}`);
    console.log(`🌐 Environment:     ${ENV.NODE_ENV}`);
    console.log(`===============================================`);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down CallFar server...`);
    io.close();
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Database disconnected. Process exited.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
