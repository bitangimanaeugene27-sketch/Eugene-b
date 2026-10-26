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

  private static createTransporterInstance(): Transporter {
    const host = ENV.SMTP_HOST?.trim() || '';
    const user = ENV.SMTP_USER?.trim() || '';
    const rawPass = ENV.SMTP_PASS || '';
    const pass = rawPass.replace(/["'\s]/g, '');

    if (host && user && pass) {
      if (host.toLowerCase().includes('gmail')) {
        return nodemailer.createTransport({
          service: 'gmail',
          connectionTimeout: 20000,
          greetingTimeout: 20000,
          socketTimeout: 25000,
          auth: {
            user,
            pass,
          },
        });
      } else {
        return nodemailer.createTransport({
          host,
          port: ENV.SMTP_PORT || 587,
          secure: ENV.SMTP_SECURE || ENV.SMTP_PORT === 465,
          connectionTimeout: 20000,
          greetingTimeout: 20000,
          socketTimeout: 25000,
          auth: {
            user,
            pass,
          },
        });
      }
    }

    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  private static async getTransporter(): Promise<Transporter> {
    if (!this.transporter) {
      this.transporter = this.createTransporterInstance();
    }
    return this.transporter;
  }

  public static resetTransporter(): void {
    if (this.transporter) {
      try {
        this.transporter.close();
      } catch {}
      this.transporter = null;
    }
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
                    <div style="background: rgba(30, 41, 59, 0.7); border: 1.5px solid #2563EB; border-radius: 16px; padding: 26px 20px; margin-bottom: 24px; text-align: center; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.35);">
                      <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #60A5FA; margin-bottom: 8px;">
                        🔗 Step 1 &bull; Click to Accept &amp; Reset
                      </div>
                      <p style="margin: 0 0 16px 0; font-size: 13.5px; color: #CBD5E1; line-height: 1.5;">
                        Tap the secure button below to choose your new CallFar password:
                      </p>
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 auto;">
                        <tr>
                          <td align="center">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                              <tr>
                                <td align="center" style="border-radius: 14px; background: linear-gradient(135deg, #2563EB 0%, #0284C7 100%);">
                                  <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: block; padding: 18px 48px; font-size: 16.5px; font-weight: 800; color: #FFFFFF; text-decoration: none; border-radius: 14px; background: #2563EB; letter-spacing: 0.4px; text-align: center; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.5);">
                                    👉 Accept &amp; Reset Password
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top: 14px; font-size: 12px; color: #94A3B8;">
                        Opens the official, encrypted CallFar password reset portal in your browser.
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
                          Code &amp; link expire in 15 minutes
                        </span>
                      </div>
                    </div>

                    <!-- Direct URL Backup Box -->
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">
                      Direct Link (Copy and paste into your browser):
                    </p>
                    <div style="background: #0B1120; border: 1px solid #1E293B; border-radius: 8px; padding: 12px 14px; word-break: break-all; margin-bottom: 24px;">
                      <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; text-decoration: underline; font-family: monospace; font-size: 13px; line-height: 1.5;">
                        ${resetUrl}
                      </a>
                    </div>

                    <!-- Security Notice Box -->
                    <div style="background: rgba(15, 23, 42, 0.6); border-left: 3px solid #3B82F6; border-radius: 0 10px 10px 0; padding: 14px 16px; margin-bottom: 10px;">
                      <div style="font-size: 13px; font-weight: 700; color: #F1F5F9; margin-bottom: 4px;">
                        Important Security Notice:
                      </div>
                      <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.6; color: #94A3B8;">
                        <li>If you did not request this password reset, someone may have entered your email by mistake. Your account is <strong>completely safe</strong>, and no action is required.</li>
                        <li>Never share this link or verification code with anyone. CallFar staff will never ask for your password.</li>
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
                Protected by 256-Bit End-to-End Encryption &bull; Ultra HD Voice, Video &amp; Messaging<br />
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

OPTION 1: Direct Web Password Reset
Visit this secure link in your browser to set a new password:
${resetUrl}

OPTION 2: In-App Verification Code
If you are resetting directly in the CallFar mobile app, enter this 6-digit code:
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
        from: ENV.EMAIL_FROM || `"CallFar Security" <${ENV.SMTP_USER}>`,
        replyTo: ENV.EMAIL_FROM || `"CallFar Support" <${ENV.SMTP_USER}>`,
        to,
        subject: '🔐 Reset Your CallFar Password',
        text: plainText,
        html: htmlContent,
      };

      // Helper to attempt sending with 25s timeout
      const attemptSend = async (): Promise<any> => {
        const activeTransporter = await this.getTransporter();
        const sendPromise = activeTransporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SMTP sendMail exceeded 25000ms limit')), 25000)
        );
        return await Promise.race([sendPromise, timeoutPromise]);
      };

      let info: any;
      try {
        info = await attemptSend();
      } catch (firstErr: any) {
        console.warn(`[EmailService] ⚠️ First send attempt failed (${firstErr?.message || firstErr}), resetting transport & retrying immediately...`);
        this.resetTransporter();
        info = await attemptSend();
      }

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
      this.resetTransporter();
      console.error(`[EmailService] ❌ Failed to send email to ${to} after retry:`, err.message || err);
      return {
        success: false,
      };
    }
  }
}
