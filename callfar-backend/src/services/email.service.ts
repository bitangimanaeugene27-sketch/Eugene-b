import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';
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

    const host = ENV.SMTP_HOST?.trim() || '';
    const user = ENV.SMTP_USER?.trim() || '';
    const rawPass = ENV.SMTP_PASS || '';
    const pass = rawPass.replace(/["'\s]/g, '');

    if (host && user && pass) {
      if (host.toLowerCase().includes('gmail')) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user,
            pass,
          },
        });
        console.log(`[EmailService] Initialized Gmail SMTP transport for user: ${user}`);
      } else {
        this.transporter = nodemailer.createTransport({
          host,
          port: ENV.SMTP_PORT || 587,
          secure: ENV.SMTP_SECURE || ENV.SMTP_PORT === 465,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          auth: {
            user,
            pass,
          },
        });
        console.log(`[EmailService] Initialized custom SMTP transport at ${host}:${ENV.SMTP_PORT}`);
      }
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
    const formattedCode = resetCode.split('').join(' ');

    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>Reset Your CallFar Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #E2E8F0;">
  
  <!-- Outer Table Wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070B14; min-height: 100vh; padding: 32px 12px;">
    <tr>
      <td align="center" valign="top">
        
        <!-- Main Card Container (Max Width 580px) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background: #0F172A; border: 1px solid #1E293B; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 45%, #0284C7 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid rgba(56, 189, 248, 0.2);">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <!-- Icon / Brand Badge -->
                    <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 16px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.25); text-align: center; font-size: 28px; margin-bottom: 12px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);">
                      🛡️
                    </div>
                    <h1 style="margin: 0; font-size: 30px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px; line-height: 1.2;">
                      CallFar
                    </h1>
                    <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; color: #BAE6FD; text-transform: uppercase; letter-spacing: 1.5px;">
                      Secure Communication Platform
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <!-- Heading -->
                    <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F8FAFC; letter-spacing: -0.3px;">
                      Password Reset Request
                    </h2>

                    <!-- Greeting & Context -->
                    <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.6; color: #CBD5E1;">
                      Hello <strong style="color: #F8FAFC;">${recipientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #94A3B8;">
                      We received a request to reset the password associated with your CallFar account (<span style="color: #38BDF8; font-weight: 600;">@${username}</span>). You can complete this securely using either of the two options below:
                    </p>

                    <!-- Option 1: 1-Tap Reset Link Button -->
                    <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 14px; padding: 22px; margin-bottom: 24px; text-align: center;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #60A5FA; margin-bottom: 14px;">
                        Option 1 &bull; 1-Tap Web Password Reset
                      </div>
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                        <tr>
                          <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #2563EB 0%, #0284C7 100%); box-shadow: 0 8px 20px rgba(37, 99, 235, 0.45);">
                            <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; font-size: 15.5px; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 12px; letter-spacing: 0.3px;">
                              🔐 Reset My Password Now &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top: 14px; font-size: 12px; color: #64748B;">
                        Clicking this opens our encrypted password reset page in your browser.
                      </div>
                    </div>

                    <!-- Option 2: In-App 6-Digit Code -->
                    <div style="background: #070B14; border: 1.5px dashed #3B82F6; border-radius: 14px; padding: 20px; margin-bottom: 26px; text-align: center;">
                      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #93C5FD; margin-bottom: 8px;">
                        Option 2 &bull; In-App Verification Code
                      </div>
                      <p style="margin: 0 0 12px 0; font-size: 13px; color: #94A3B8;">
                        If you are currently inside the CallFar mobile app, enter this 6-digit code:
                      </p>
                      <div style="display: inline-block; background: #0B1222; border: 1px solid #1E3A8A; border-radius: 10px; padding: 10px 24px; font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38BDF8;">
                        ${formattedCode}
                      </div>
                      <div style="margin-top: 10px;">
                        <span style="display: inline-block; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #FBBF24; font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
                          ⏱️ Code & link expire in 15 minutes
                        </span>
                      </div>
                    </div>

                    <!-- Direct URL Backup Box -->
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">
                      Button not working? Copy and paste this URL into your browser:
                    </p>
                    <div style="background: #0B1120; border: 1px solid #1E293B; border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 12px; color: #38BDF8; word-break: break-all; margin-bottom: 26px;">
                      <a href="${resetUrl}" target="_blank" style="color: #38BDF8; text-decoration: underline;">
                        ${resetUrl}
                      </a>
                    </div>

                    <!-- Security Notice Box -->
                    <div style="background: rgba(15, 23, 42, 0.6); border-left: 3px solid #3B82F6; border-radius: 0 10px 10px 0; padding: 14px 16px; margin-bottom: 10px;">
                      <div style="font-size: 13px; font-weight: 700; color: #F1F5F9; margin-bottom: 4px;">
                        🔒 Important Security Safeguards:
                      </div>
                      <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.6; color: #94A3B8;">
                        <li>If you did not request this password reset, someone may have entered your email by mistake. Your account is <strong>completely safe</strong>, and no action is required.</li>
                        <li>Never forward or share this link or verification code with anyone. CallFar staff will never ask for your password.</li>
                      </ul>
                    </div>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #0B101E; border-top: 1px solid #1E293B; padding: 24px 30px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">
                &copy; ${new Date().getFullYear()} CallFar Platform. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.5;">
                Protected by 256-Bit End-to-End Encryption &bull; Ultra HD Voice, Video & Messaging<br />
                Sent to <span style="color: #64748B;">${to}</span> as an essential security notification.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `;

    const plainText = `
CallFar Security Notification - Password Reset
==================================================

Hello ${recipientName},

We received a request to reset the password for your CallFar account (@${username}).

OPTION 1: 1-Tap Password Reset Link
Visit this secure link in your browser to set a new password:
${resetUrl}

OPTION 2: In-App Verification Code
If you are resetting directly in the CallFar mobile app, enter:
${resetCode}

SECURITY NOTICE:
* This link and code expire in 15 minutes.
* If you did not make this request, you can safely ignore this email.
* Your account remains secure and no changes have been made.

--------------------------------------------------
CallFar Secure Communication Platform
Ultra High-Definition Voice, Video & Encrypted Messaging
`;

    try {
      const transporter = await this.getTransporter();
      const mailOptions: SendMailOptions = {
        from: ENV.EMAIL_FROM || `CallFar Security <${ENV.SMTP_USER}>`,
        to,
        subject: '🔒 Reset Your CallFar Password',
        text: plainText,
        html: htmlContent,
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
          'X-Mailer': 'CallFar Security Mailer v2.0',
        },
      };

      const info = await transporter.sendMail(mailOptions);

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EmailService] ✉️ Password reset email generated (preview): ${previewUrl}`);
      } else {
        console.log(`[EmailService] ✉️ Password reset email successfully delivered to ${to} (MessageId: ${info.messageId})`);
      }

      return {
        success: true,
        previewUrl,
      };
    } catch (err: any) {
      console.error(`[EmailService] ❌ Failed to send email to ${to}:`, err.message || err);
      return {
        success: false,
      };
    }
  }
}
