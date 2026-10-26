# CallFar Maintenance & Developer Guide 🛠️

This guide covers everything you need to easily run, maintain, and continue developing CallFar.

---

## 🚀 1. How to Run Tomorrow (Fastest Way)

### Option A: 1-Click Launcher (Recommended)
Simply **double-click** the file in your `CallFar` folder:
👉 **[`start-callfar.bat`](start-callfar.bat)**

It will automatically:
1. Connect your Android phone and tunnel ports `5000` (backend) & `8081` (Metro).
2. Open the Backend in a separate window.
3. Open the Metro Bundler in a separate window.
4. Launch the CallFar app on your phone.

---

### Option B: Manual Commands in VS Code / IDE Terminals

> 💡 **Important:** Starting `npm run dev` and `npx expo start` in terminals starts the **PC servers** (Backend & Metro bundler). To open the app on your phone, you run the 3rd command or simply **tap the CallFar icon on your phone screen**.

**Step 1 — Terminal 1 (Backend & USB Port Tunnels):**
```bash
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081
cd callfar-backend
npm run dev
```

**Step 2 — Terminal 2 (Metro Bundler):**
```bash
cd callfar-mobile
npx expo start --dev-client --port 8081
```

**Step 3 — Open App on Phone:**
- **Way 1:** Simply tap the **CallFar** icon on your phone home screen! 📱
- **Way 2:** Run `npm run app` from the main `CallFar` folder!
- **Way 3:** Or run the adb command directly:
  ```bash
  adb shell am force-stop com.callfar.app
  adb shell am start -n com.callfar.app/.MainActivity
  ```

---

## 🌐 2. Network & Phone Connection Rules

CallFar uses a **Dual-Host Network Architecture** (`callfar-mobile/src/api/client.ts`):
- **Primary:** `http://172.23.224.248:5000` (Your PC's Wi-Fi IP).
  - Works wirelessly as long as your phone and PC share the same Wi-Fi.
- **Fallback:** `http://localhost:5000` (via USB `adb reverse`).
  - Works over USB cable even if Wi-Fi drops.
- **Failover:** If one connection fails, the app automatically retries using the other host seamlessly.

> 💡 **Tip:** Keep your phone plugged in via USB and on the same Wi-Fi network for the fastest and most stable development experience.

---

## 🗄️ 3. Database & User Management

- **Database:** Prisma with SQLite / PostgreSQL.
- **To View or Edit Database Records visually:**
  ```bash
  cd callfar-backend
  npx prisma studio
  ```
  *(Opens a web dashboard in your browser to inspect Users, Profiles, Calls, Messages, and Contacts).*
- **To Reset or Reseed Database:**
  ```bash
  cd callfar-backend
  npm run prisma:seed
  ```

---

## 🛡️ 4. User vs. Administrator Privileges & Web Admin Hub

CallFar strictly separates everyday communication accounts from system administration:

### 👤 Standard User Experience
- **Credentials (Demo):** `bob` / `Password123!` (Role: `MEMBER`)
- **Zero Admin Clutter:** Users installing the app only see their communication tools — encrypted Voice/Video Calling, Direct & Group Chats, Contact Discovery, and personal Settings.
- **Strict Security:** Non-admin accounts cannot view the Admin Hub tab, cannot elevate without administrative authorization, and any direct API requests to `/api/v1/admin/*` are blocked with `HTTP 403 Forbidden`.

### 👑 Executive Web Administration Hub (`callfar-admin`)
Accessible directly in any web browser at:
👉 **[http://localhost:5000/admin](http://localhost:5000/admin)**  
*(Or run standalone via `npm run admin` on port 3000)*

- **Default Master Admin:** `alice` / `Password123!` (Role: `ADMIN`)
- **Complete Feature Suite Across 15 Core Modules:**
  1. **Platform Overview:** Real-time metrics for registered users, active calls, encrypted messages, license counts, and a 7-day traffic activity bar chart.
  2. **User & Account Management:** Search, filter, provision new users/admins, activate or suspend accounts, promote/demote roles, reset passwords, revoke compromised sessions, and customize user licenses.
  3. **Voice & Video Call Auditing:** Complete log of completed, missed, declined, and ongoing calls with duration, timestamps, and participant metadata.
  4. **Contacts & Social Graph:** Overview of friend relationships, pending invitations, and blocked accounts.
  5. **Messages & Chat Telemetry:** Message volume metrics, conversations tracker, and active threads.
  6. **Security & Session Moderation:** Active token inspection, session revocation, and security posture checks.
  7. **System Announcements & Broadcast:** Push real-time high-priority announcements to all connected mobile devices via WebSocket.
  8. **Customer Support Desk:** Interactive ticket queue (Open, In Progress, Resolved) with one-click resolution logging.
  9. **Analytics & Reports:** Usage trends, call completion rates, and one-click JSON/CSV export.
  10. **Infrastructure & Health:** Real-time Node.js memory gauges (RSS, Heap), PostgreSQL query latency test, and Google WebRTC STUN cluster telemetry.
  11. **Application Configuration:** Live toggles for Maintenance Mode (with customizable advisory message), registration access, call duration limits, and allowed media options.
  12. **License Key Generator:** One-click batch generation (`PRO`, `ENTERPRISE`, `MASTER_ADMIN`) with instant clipboard copy and key revocation.
  13. **Database Backups:** Snapshot archive, table count verification, and on-demand backup triggers.
  14. **Admin Staff & RBAC:** Directory of system administrators and permission matrix.
  15. **Cellular Telecom & Locales:** GSM routing rules for MTN & Airtel Rwanda (+250) and multi-language dictionary (English, Kinyarwanda, French).

---

## 📶 5. Cellular PSTN & Global Phone Calling

CallFar allows dialing physical mobile and international phone numbers (GSM/PSTN):
- **Rwanda Cellular Support:**
  - 🟡 **MTN Rwanda:** `078...` and `079...` (auto-formats to `+25078...`)
  - 🔴 **Airtel-Tigo Rwanda:** `072...` and `073...` (auto-formats to `+25073...`)
- **Regional & Global Telcos:**
  - 🟢 **Safaricom Kenya:** `+254...`
  - 🟡 **MTN Uganda & Airtel Uganda:** `+256...`
  - 🌐 **240+ International Destinations:** USA (+1), UK (+44), France (+33), Canada, Germany, etc.
- **Interactive Dialpad & In-Call Engine:**
  - Live carrier detection badge as you dial (with carrier brand coloring).
  - High-fidelity DTMF touch-tone dialer (`0-9`, `*`, `#`).
  - Active call timer, per-minute cost counter, audio mute, and speakerphone toggles.
  - Multi-provider gateway manager (Africa's Talking, Twilio, Direct SIP, and high-fidelity simulator).

---

## 🧩 6. Critical Files & Polyfills (Keep These Safe!)

| File | Purpose |
|------|---------|
| [`callfar-mobile/src/polyfills.ts`](callfar-mobile/src/polyfills.ts) | **Crucial:** Polyfills `globalThis.expo.EventEmitter` & WebRTC module before native bridge loads to prevent startup crashes. |
| [`callfar-mobile/src/api/client.ts`](callfar-mobile/src/api/client.ts) | Dual-host network failover and JWT token auto-refresh. |
| [`callfar-mobile/src/context/AuthContext.tsx`](callfar-mobile/src/context/AuthContext.tsx) | Role state (`isAdmin`, `user`), login/registration, and admin elevation. |
| [`callfar-mobile/src/screens/admin/AdminHubScreen.tsx`](callfar-mobile/src/screens/admin/AdminHubScreen.tsx) | Master administrative control console with telecom routing and license center. |
| [`callfar-mobile/src/screens/call/DialpadScreen.tsx`](callfar-mobile/src/screens/call/DialpadScreen.tsx) | Cellular phone dialer with 240+ countries modal and live carrier detection. |
| [`callfar-mobile/src/screens/call/ActivePstnCallScreen.tsx`](callfar-mobile/src/screens/call/ActivePstnCallScreen.tsx) | Live cellular in-call interface with DTMF touch tones and billing meter. |
| [`callfar-mobile/src/screens/main/CallHistoryScreen.tsx`](callfar-mobile/src/screens/main/CallHistoryScreen.tsx) | Unified VoIP and Cellular call records with carrier badges and quick dial buttons. |
| [`callfar-backend/src/telecom/carrier-detector.ts`](callfar-backend/src/telecom/carrier-detector.ts) | Telecom carrier recognizer for MTN, Airtel, Safaricom, and international telcos. |
| [`callfar-backend/src/telecom/pstn-gateway.ts`](callfar-backend/src/telecom/pstn-gateway.ts) | Multi-provider cellular gateway manager (Africa's Talking / Twilio / Direct SIP). |

---

## 🔧 7. Quick Troubleshooting

| Symptom | Quick Fix |
|---------|-----------|
| **"Unable to load script" / Metro red screen** | 1. Run `adb reverse tcp:8081 tcp:8081`<br>2. Make sure Metro runs on port **8081** (`npx expo start --dev-client --port 8081`)<br>3. Press `R` twice on phone to reload. |
| **"Registration/Login failed"** | 1. Check if backend is running on port 5000 (`http://localhost:5000/health`)<br>2. Run `adb reverse tcp:5000 tcp:5000` |
| **Phone screen goes blank / frozen** | Force stop and re-open:<br>`adb shell am force-stop com.callfar.app`<br>`adb shell am start -n com.callfar.app/.MainActivity` |
| **Port 5000 or 8081 already in use error** | Run in PowerShell: `Get-Process node \| Stop-Process -Force` to clear stale processes. |

---

## 🔐 8. Password Reset & Secure Email Delivery System

CallFar features an enterprise-grade password reset architecture designed for instant delivery, high security, and cross-platform accessibility:

### How It Works:
1. **User Request:** The user enters their registered email (e.g. `bitangimanaeugene27@gmail.com`) in the CallFar mobile app or web portal and taps **"Send Password Reset Link"**.
2. **Account Validation:** The system looks up the account. If no registered user matches, it provides instant helpful feedback offering 1-tap registration.
3. **Parallel Dispatch (<2 Seconds):**
   - Generates a cryptographically secure 32-byte link token and a 6-digit numeric verification code.
   - Stores the hashed token in Supabase PostgreSQL with a **2-hour validity period**.
   - Concurrently dispatches a branded, high-contrast HTML security email directly to the recipient's inbox.
4. **"Accept & Reset" Action:**
   - The user opens the email and taps the prominent **`👉 Accept & Reset Password`** button.
   - The link opens the encrypted web reset portal (`https://callfar-backend.onrender.com/reset-password?token=...`).
   - The portal features real-time password criteria validation (8+ chars, uppercase letter, number), show/hide toggles, and instant updates.
   - Upon successful update, all existing reset tokens for that user are consumed and invalidated for maximum security.

### Email Delivery Infrastructure:
- **Local Machine & Dev:** Uses high-performance pooled Gmail SMTP with pre-warmed connection sockets, delivering in ~1.8 seconds.
- **Production Cloud (Render):** Render's free tier firewall blocks outbound SMTP ports 25, 465, and 587. To ensure emails arrive permanently without interruption:
  - CallFar supports standard **HTTPS REST APIs (Port 443)** using [Resend](https://resend.com) or [Brevo](https://brevo.com).
  - Add `RESEND_API_KEY` or `BREVO_API_KEY` to Render's Environment Variables for zero-block, instant sub-second delivery over HTTPS.

