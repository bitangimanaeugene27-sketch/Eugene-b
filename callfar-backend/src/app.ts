import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import { ENV } from './config/env.js';
import { prisma } from './config/prisma.js';
import { errorHandler } from './middlewares/error.middleware.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import contactRoutes from './routes/contact.routes.js';
import messageRoutes from './routes/message.routes.js';
import callRoutes from './routes/call.routes.js';
import adminRoutes from './routes/admin.routes.js';
import licenseRoutes from './routes/license.routes.js';
import pstnRoutes from './routes/pstn.routes.js';
import networkRoutes from './routes/network.routes.js';

export function createApp() {
  const app = express();

  // Security & HTTP Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: ENV.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Request Logging
  if (ENV.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Global Rate Limiter
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
  });
  app.use(globalLimiter);

  // Serve Standalone Web Admin Hub at /admin
  const adminPathCandidates = [
    path.resolve(process.cwd(), '../callfar-admin'),
    path.resolve(process.cwd(), 'callfar-admin'),
    path.resolve(process.cwd(), '../../callfar-admin'),
  ];
  const adminDir = adminPathCandidates.find((p) => fs.existsSync(p));
  if (adminDir) {
    app.use('/admin', express.static(adminDir));
    app.get('/admin', (req, res) => {
      res.sendFile(path.join(adminDir, 'index.html'));
    });
  }

  // Standalone APK Download Route for other phones
  const getApkPath = () => {
    const candidates = [
      path.resolve(process.cwd(), '../callfar-mobile/android/app/build/outputs/apk/release/app-release.apk'),
      path.resolve(process.cwd(), 'callfar-mobile/android/app/build/outputs/apk/release/app-release.apk'),
      path.resolve(process.cwd(), '../callfar-mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
      path.resolve(process.cwd(), 'callfar-mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
    ];
    return candidates.find((p) => fs.existsSync(p));
  };

  app.get('/callfar.apk', (req, res) => {
    const apkFile = getApkPath();
    if (apkFile) {
      res.download(apkFile, 'CallFar.apk');
    } else {
      res.status(404).json({ success: false, message: 'CallFar APK build is not yet generated.' });
    }
  });

  app.get('/download', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Download CallFar for Android</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', sans-serif;
            background: #070B14;
            color: #F8FAFC;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            background: linear-gradient(145deg, rgba(26, 36, 58, 0.85), rgba(14, 21, 37, 0.95));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 36px 28px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
          }
          .logo {
            width: 72px;
            height: 72px;
            border-radius: 18px;
            background: linear-gradient(135deg, #0284C7, #2563EB);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            margin: 0 auto 20px;
            box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
          }
          h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          p {
            font-size: 14px;
            color: #94A3B8;
            margin-bottom: 24px;
            line-height: 1.5;
          }
          .btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #0284C7, #2563EB);
            color: #FFFFFF;
            text-decoration: none;
            border-radius: 14px;
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 16px;
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
            transition: transform 0.2s;
          }
          .btn:active { transform: scale(0.98); }
          .steps {
            background: rgba(0, 0, 0, 0.25);
            border-radius: 14px;
            padding: 16px;
            text-align: left;
            font-size: 13px;
            color: #CBD5E1;
            line-height: 1.6;
          }
          .steps ol { padding-left: 20px; }
          .badge {
            display: inline-block;
            background: rgba(16, 185, 129, 0.15);
            color: #10B981;
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">📞</div>
          <span class="badge">● Same Wi-Fi Ready</span>
          <h1>CallFar for Android</h1>
          <p>Install CallFar on your phone to start encrypted audio and video calling with your friends on the local network.</p>
          <a href="/callfar.apk" class="btn">📥 Download CallFar APK</a>
          <div class="steps">
            <strong>Easy Setup:</strong>
            <ol>
              <li>Tap <strong>Download CallFar APK</strong>.</li>
              <li>When prompted, tap <strong>Install</strong> (allow "Install unknown apps" if requested).</li>
              <li>Open <strong>CallFar</strong> and create your account.</li>
              <li>Search for your friends and call immediately!</li>
            </ol>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Health Check Endpoint (Cloud & Container Ready)
  app.get('/health', async (req, res) => {
    let dbStatus = 'DISCONNECTED';
    let dbLatencyMs = -1;

    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = 'CONNECTED';
    } catch {
      dbStatus = 'DISCONNECTED';
    }

    const isHealthy = dbStatus === 'CONNECTED';
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'UP' : 'DEGRADED',
      service: 'CallFar API',
      timestamp: new Date().toISOString(),
      environment: ENV.NODE_ENV,
      database: {
        status: dbStatus,
        provider: ENV.DATABASE_URL.includes('supabase.co') ? 'supabase' : 'postgresql',
        latencyMs: dbLatencyMs,
      },
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // API v1 Routes
  app.use(`${ENV.API_PREFIX}/auth`, authRoutes);
  app.use(`${ENV.API_PREFIX}/users`, userRoutes);
  app.use(`${ENV.API_PREFIX}/contacts`, contactRoutes);
  app.use(`${ENV.API_PREFIX}/messages`, messageRoutes);
  app.use(`${ENV.API_PREFIX}/calls`, callRoutes);
  app.use(`${ENV.API_PREFIX}/admin`, adminRoutes);
  app.use(`${ENV.API_PREFIX}/licenses`, licenseRoutes);
  app.use(`${ENV.API_PREFIX}/pstn`, pstnRoutes);
  app.use(`${ENV.API_PREFIX}/network`, networkRoutes);

  // 404 Route Handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Resource not found on path ${req.originalUrl}`,
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
