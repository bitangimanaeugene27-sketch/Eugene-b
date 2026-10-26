import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refreshToken(refreshToken);
      res.status(200).json({
        success: true,
        message: 'Session refreshed successfully.',
        data: tokens,
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.userId;
      await AuthService.logout(refreshToken, userId);
      res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: req.user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async elevateToAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { adminPasscode } = req.body;
      const result = await AuthService.elevateToAdmin(userId, adminPasscode);
      res.status(200).json({
        success: true,
        message: 'Account successfully elevated to Master Administrator.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request password reset link and verification code
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, identifier } = req.body;
      const targetIdentifier = identifier || email;
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
      const clientBaseUrl = host ? `${proto}://${host}` : undefined;
      const result = await AuthService.forgotPassword(targetIdentifier, clientBaseUrl);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Check if a reset token is valid
   */
  static async verifyResetToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = (req.query.token || req.body.token || req.body.code) as string;
      if (!token) {
        res.status(400).json({ success: false, message: 'Token or verification code is required.' });
        return;
      }
      const result = await AuthService.verifyResetToken(token);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Submit new password using reset token or code
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tokenOrCode, token, code, newPassword } = req.body;
      const effectiveToken = tokenOrCode || token || code;
      const result = await AuthService.resetPassword(effectiveToken, newPassword);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Render an attractive, responsive web page for resetting password from email link
   */
  static async renderResetPasswordPage(req: Request, res: Response): Promise<void> {
    const rawToken = (req.query.token as string) || '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - CallFar</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background-color: #070B14;
      color: #F8FAFC;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      position: relative;
      overflow-x: hidden;
    }
    .bg-glow-1 {
      position: absolute;
      top: -120px;
      left: 50%;
      transform: translateX(-50%);
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .bg-glow-2 {
      position: absolute;
      bottom: -100px;
      right: 10%;
      width: 350px;
      height: 350px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .container {
      width: 100%;
      max-width: 460px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      z-index: 10;
      position: relative;
    }
    .brand {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(37, 99, 235, 0.18);
      border: 1px solid rgba(59, 130, 246, 0.4);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: #60A5FA;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .brand h1 {
      font-size: 30px;
      font-weight: 800;
      background: linear-gradient(135deg, #FFFFFF 0%, #BAE6FD 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }
    .brand p {
      font-size: 14px;
      color: #94A3B8;
      margin-top: 6px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #CBD5E1;
      margin-bottom: 8px;
    }
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    input {
      width: 100%;
      background: #0B1120;
      border: 1px solid #1E293B;
      border-radius: 12px;
      padding: 14px 44px 14px 16px;
      color: #FFFFFF;
      font-size: 15px;
      outline: none;
      transition: all 0.2s ease;
    }
    input:focus {
      border-color: #38BDF8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18);
    }
    .toggle-pwd {
      position: absolute;
      right: 12px;
      background: transparent;
      border: none;
      color: #64748B;
      cursor: pointer;
      font-size: 16px;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s ease;
    }
    .toggle-pwd:hover {
      color: #38BDF8;
    }
    .requirements {
      background: rgba(11, 17, 32, 0.7);
      border: 1px solid #1E293B;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .req-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748B;
      margin: 4px 0;
      transition: color 0.2s ease;
    }
    .req-item.valid {
      color: #34D399;
    }
    .btn {
      width: 100%;
      background: linear-gradient(135deg, #2563EB 0%, #0284C7 100%);
      color: #FFFFFF;
      border: none;
      border-radius: 14px;
      padding: 15px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(37, 99, 235, 0.6);
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .alert {
      padding: 14px 16px;
      border-radius: 12px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
      line-height: 1.5;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #FCA5A5;
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #6EE7B7;
    }
    .success-card {
      display: none;
      text-align: center;
      padding: 20px 0;
    }
    .success-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid #10B981;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin: 0 auto 20px;
    }
    .footer-links {
      text-align: center;
      margin-top: 24px;
      font-size: 13px;
      color: #64748B;
    }
    .footer-links a {
      color: #38BDF8;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="bg-glow-1"></div>
  <div class="bg-glow-2"></div>

  <div class="container">
    <div class="brand">
      <div class="brand-badge">🔒 CallFar Security</div>
      <h1>Reset Password</h1>
      <p id="pageSubtitle">Choose a new, secure password for your account</p>
    </div>

    <div id="alertBox" class="alert"></div>

    <form id="resetForm" onsubmit="handleReset(event)">
      <div class="form-group">
        <label for="newPassword">New Password</label>
        <div class="input-wrapper">
          <input
            type="password"
            id="newPassword"
            placeholder="At least 8 characters, 1 uppercase, 1 number"
            required
            oninput="validateRules()"
          />
          <button type="button" class="toggle-pwd" onclick="toggleVisibility('newPassword', this)" title="Show/Hide Password">👁️</button>
        </div>
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <div class="input-wrapper">
          <input
            type="password"
            id="confirmPassword"
            placeholder="Re-enter your new password"
            required
            oninput="validateRules()"
          />
          <button type="button" class="toggle-pwd" onclick="toggleVisibility('confirmPassword', this)" title="Show/Hide Password">👁️</button>
        </div>
      </div>

      <div class="requirements">
        <div id="reqLen" class="req-item"><span>○</span> At least 8 characters</div>
        <div id="reqUpper" class="req-item"><span>○</span> At least one uppercase letter (A-Z)</div>
        <div id="reqNum" class="req-item"><span>○</span> At least one number (0-9)</div>
        <div id="reqMatch" class="req-item"><span>○</span> Passwords match</div>
      </div>

      <button type="submit" id="submitBtn" class="btn">
        <span>Save New Password &rarr;</span>
      </button>
    </form>

    <div id="successCard" class="success-card">
      <div class="success-icon">✓</div>
      <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">Password Updated!</h2>
      <p style="color: #94A3B8; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        Your password has been securely reset. You can now open CallFar and log in with your updated credentials.
      </p>
      <a href="callfar://login" class="btn" style="text-decoration: none; display: inline-flex;">
        Open CallFar App
      </a>
    </div>

    <div class="footer-links">
      CallFar Platform &bull; End-to-End Encrypted VoIP
    </div>
  </div>

  <script>
    const token = ${JSON.stringify(rawToken)};

    function toggleVisibility(inputId, btn) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    }

    function validateRules() {
      const pwd = document.getElementById('newPassword').value;
      const confirm = document.getElementById('confirmPassword').value;

      const hasLen = pwd.length >= 8;
      const hasUpper = /[A-Z]/.test(pwd);
      const hasNum = /[0-9]/.test(pwd);
      const matches = pwd && pwd === confirm;

      updateReq('reqLen', hasLen);
      updateReq('reqUpper', hasUpper);
      updateReq('reqNum', hasNum);
      updateReq('reqMatch', matches);

      return hasLen && hasUpper && hasNum && matches;
    }

    function updateReq(id, valid) {
      const el = document.getElementById(id);
      if (valid) {
        el.className = 'req-item valid';
        el.querySelector('span').textContent = '●';
      } else {
        el.className = 'req-item';
        el.querySelector('span').textContent = '○';
      }
    }

    function showAlert(msg, isError) {
      const alert = document.getElementById('alertBox');
      alert.textContent = msg;
      alert.className = isError ? 'alert alert-error' : 'alert alert-success';
      alert.style.display = 'block';
    }

    async function handleReset(e) {
      e.preventDefault();
      const pwd = document.getElementById('newPassword').value;
      const confirm = document.getElementById('confirmPassword').value;
      const submitBtn = document.getElementById('submitBtn');

      if (!token) {
        showAlert('Reset token is missing from the link. Please check the email link or request a new one.', true);
        return;
      }

      if (!validateRules()) {
        showAlert('Please make sure your password satisfies all requirements and passwords match.', true);
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Updating Password...</span>';

        const res = await fetch('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenOrCode: token, newPassword: pwd })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to reset password. Link may have expired.');
        }

        document.getElementById('resetForm').style.display = 'none';
        document.getElementById('alertBox').style.display = 'none';
        document.getElementById('pageSubtitle').style.display = 'none';
        document.getElementById('successCard').style.display = 'block';
      } catch (err) {
        showAlert(err.message, true);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Save New Password &rarr;</span>';
      }
    }

    // Check token existence on load
    if (!token) {
      showAlert('No reset token found in URL. Please click the link directly from your password reset email.', true);
      document.getElementById('submitBtn').disabled = true;
    }
  </script>
</body>
</html>
    `;

    res.status(200).send(html);
  }
}
