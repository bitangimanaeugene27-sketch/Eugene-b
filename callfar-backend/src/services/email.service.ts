import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../config/env.js';

export interface SendPasswordResetOptions {
  to: string;
  username: string;
  displayName?: string;
  resetUrl: string;
  resetCode: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  private static async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (ENV.SMTP_HOST && ENV.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        secure: ENV.SMTP_SECURE,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        auth: {
          user: ENV.SMTP_USER,
          pass: ENV.SMTP_PASS,
        },
      });
      console.log(`[EmailService] Using configured SMTP transport at ${ENV.SMTP_HOST}:${ENV.SMTP_PORT}`);
    } else {
      // In development or when SMTP not provided, use an Ethereal test account or local stream fallback
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        const testAccount: any = await Promise.race([nodemailer.createTestAccount(), timeoutPromise]);
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          connectionTimeout: 4000,
          greetingTimeout: 4000,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log(`[EmailService] Created Ethereal test account: ${testAccount.user}`);
      } catch (err) {
        // Fallback json/stream transporter for instantaneous local execution without network block
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
        console.log(`[EmailService] Using instantaneous JSON/Stream transport fallback`);
      }
    }

    return this.transporter;
  }

  /**
   * Send a branded, professional, attractive password reset email
   */
  static async sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<{ previewUrl?: string | false; success: boolean }> {
    const { to, username, displayName, resetUrl, resetCode } = options;
    const recipientName = displayName || username || 'CallFar Member';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your CallFar Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B0F19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #E2E8F0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0B0F19;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .card {
      max-width: 540px;
      margin: 0 auto;
      background: linear-gradient(180deg, #131D31 0%, #0F172A 100%);
      border: 1px solid #1E293B;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      background: linear-gradient(135deg, #1E3A8A 0%, #0284C7 50%, #2563EB 100%);
      padding: 36px 30px;
      text-align: center;
    }
    .brand-title {
      font-size: 28px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 1px;
      margin: 0 0 6px 0;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #BAE6FD;
      font-weight: 500;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .content {
      padding: 36px 32px;
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      color: #F8FAFC;
      margin: 0 0 16px 0;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #94A3B8;
      margin: 0 0 20px 0;
    }
    .btn-container {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #2563EB 0%, #0284C7 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      padding: 15px 36px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
      letter-spacing: 0.3px;
    }
    .code-box {
      background-color: #070B14;
      border: 1px dashed #3B82F6;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .code-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #60A5FA;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .code-value {
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #38BDF8;
    }
    .divider {
      height: 1px;
      background-color: #1E293B;
      margin: 28px 0;
    }
    .security-note {
      font-size: 13px;
      color: #64748B;
      background-color: rgba(30, 41, 59, 0.4);
      padding: 14px 18px;
      border-radius: 8px;
      line-height: 1.5;
    }
    .footer {
      padding: 20px 32px 30px;
      text-align: center;
      font-size: 12px;
      color: #475569;
      border-top: 1px solid #1E293B;
    }
    .footer a {
      color: #3B82F6;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1 class="brand-title">CallFar</h1>
        <p class="brand-subtitle">SECURE COMMUNICATION PLATFORM</p>
      </div>
      <div class="content">
        <h2>Password Reset Request</h2>
        <p>Hello <strong>${recipientName}</strong>,</p>
        <p>We received a request to reset your password for your CallFar account (<strong>@${username}</strong>). Click the secure button below to set a new password:</p>
        
        <div class="btn-container">
          <a href="${resetUrl}" target="_blank" class="btn">Reset My Password &rarr;</a>
        </div>

        <p style="text-align: center; font-size: 13px; color: #64748B; margin-bottom: 24px;">
          Alternatively, if you are resetting directly inside the CallFar mobile app, enter this 6-digit verification code:
        </p>

        <div class="code-box">
          <div class="code-label">Mobile App Verification Code</div>
          <div class="code-value">${resetCode}</div>
        </div>

        <div class="divider"></div>

        <div class="security-note">
          🔒 <strong>Security Notice:</strong> This password reset link and verification code are valid for <strong>15 minutes</strong>. If you did not make this request, someone may have mistyped their email. Your account remains completely secure and no action is needed.
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} CallFar Platform. All rights reserved.<br>
        Ultra High-Definition Voice, Video & Real-Time Messaging.
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const plainText = `
CallFar Password Reset
======================

Hello ${recipientName},

We received a request to reset your CallFar account password (@${username}).

To reset your password, visit the following secure link:
${resetUrl}

Or, if you are using the CallFar mobile app, enter your 6-digit verification code:
${resetCode}

This code and link will expire in 15 minutes.
If you did not request this, you can safely ignore this email.
`;

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: ENV.EMAIL_FROM,
        to,
        subject: '🔒 Reset Your CallFar Password',
        text: plainText,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EmailService] ✉️ Password reset email sent! Test preview URL: ${previewUrl}`);
      } else {
        console.log(`[EmailService] ✉️ Password reset email sent to ${to} (MessageId: ${info.messageId})`);
      }

      return {
        success: true,
        previewUrl,
      };
    } catch (err: any) {
      console.error(`[EmailService] Failed to send email to ${to}:`, err.message || err);
      // Don't crash auth flow; return failure flag
      return {
        success: false,
      };
    }
  }
}
