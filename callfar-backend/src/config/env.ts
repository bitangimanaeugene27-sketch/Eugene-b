import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'callfar_default_access_secret_do_not_use_in_prod',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'callfar_default_refresh_secret_do_not_use_in_prod',
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION || '30d',
  JWT_REFRESH_EXPIRATION_DAYS: parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS || '90', 10),
  
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/callfar?schema=public',
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/callfar?schema=public',

  // Supabase Cloud Integration
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  IS_SUPABASE: Boolean(process.env.DATABASE_URL?.includes('supabase.co') || process.env.SUPABASE_URL),
  IS_PRODUCTION: process.env.NODE_ENV === 'production',

  STUN_SERVERS: (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun.cloudflare.com:3478').split(','),
  TURN_SERVER_URL: process.env.TURN_SERVER_URL || '',
  TURN_SERVER_USERNAME: process.env.TURN_SERVER_USERNAME || '',
  TURN_SERVER_CREDENTIAL: process.env.TURN_SERVER_CREDENTIAL || '',

  ADMIN_INVITE_CODE: process.env.ADMIN_INVITE_CODE || 'admin2026',

  // Email & Password Reset (Gmail SMTP active with fallback for production cloud)
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || 'bitangimanaeugene27@gmail.com',
  SMTP_PASS: process.env.SMTP_PASS || 'ysis gwgt oxgs cebk',
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  EMAIL_FROM: process.env.EMAIL_FROM || 'CallFar Security <bitangimanaeugene27@gmail.com>',
  APP_URL: process.env.APP_URL || process.env.SERVER_URL || 'https://callfar-backend.onrender.com',

  // Optional HTTPS Email APIs (over Port 443 - bypasses Render free tier SMTP blocks)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
};
