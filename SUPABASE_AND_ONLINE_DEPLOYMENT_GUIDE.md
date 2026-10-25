# CallFar: Professional Supabase & Online Cloud Server Architecture

This comprehensive guide outlines the exact, professional procedure for deploying **CallFar** from a local development environment to an enterprise-grade online cloud infrastructure with **Supabase (Managed PostgreSQL)** and a scalable **Node.js WebRTC Signaling & REST API Server**.

---

## 🏛️ System Architecture

```
                  ┌────────────────────────────────────────┐
                  │          CallFar Mobile Client         │
                  │   (React Native / Expo Prebuild APK)   │
                  └──────────┬──────────────────▲──────────┘
                             │ HTTPS            │ WSS (WebSockets)
                             ▼                  │
                  ┌─────────────────────────────┴──────────┐
                  │      CallFar Online Cloud Backend      │
                  │   (Render / Railway / Fly.io / VPS)    │
                  │    Express + Socket.IO + Prisma ORM    │
                  └──────────┬──────────────────▲──────────┘
                             │                  │
                Port 6543    │                  │  Port 5432
         (Supavisor Pooler)  │                  │  (Direct Migrations)
                             ▼                  ▼
                  ┌────────────────────────────────────────┐
                  │        Supabase Cloud Database         │
                  │        (Managed PostgreSQL 15+)        │
                  │   + High Availability + Auto Backups   │
                  └────────────────────────────────────────┘
```

---

## ⚡ Phase 1: Setting Up Supabase (Managed PostgreSQL)

### Step 1.1: Create Your Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create an account or sign in.
2. Click **New Project**.
3. Fill in the project details:
   - **Name**: `CallFar-Production` (or your preferred name)
   - **Database Password**: Generate and securely store a strong password. *(You will need this for the connection strings!)*
   - **Region**: Choose a region closest to your primary user base (e.g., `Frankfurt (eu-central-1)`, `Ohio (us-east-2)`, etc.).
4. Click **Create new project** and wait ~2 minutes for provisioning.

---

### Step 1.2: Retrieve Database Connection Strings
Supabase provides two connection strings. In professional architectures with Prisma ORM:
- **`DATABASE_URL` (Connection Pooler - Port 6543)**: Used by the running Node.js server for runtime application queries. Prevents database connection exhaustion.
- **`DIRECT_URL` (Direct Connection - Port 5432)**: Used by Prisma CLI for schema migrations (`prisma db push` / `prisma migrate`).

To obtain these in your Supabase Dashboard:
1. In the left navigation, click **Project Settings** (gear icon) ➔ **Database**.
2. Scroll to the **Connection string** section.
3. Select the **URI** tab:
   - **Mode: Transaction (Port 6543)**:
     ```
     postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
     👉 Copy this and set as `DATABASE_URL`.
   - **Mode: Session / Direct (Port 5432)**:
     ```
     postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
     ```
     👉 Copy this and set as `DIRECT_URL`.

*(Optional: Under Project Settings ➔ **API**, copy your `Project URL` and `anon public` / `service_role` keys if you want to use Supabase Storage for user avatar uploads).*

---

### Step 1.3: Apply Connection Strings to CallFar Backend
Open `callfar-backend/.env` and update the database configuration:

```env
# Database Configuration (Supabase Cloud Database)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Optional: Supabase Storage & Client API
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

---

### Step 1.4: Verify Connection & Push Database Schema
We created automated diagnostics and deployment scripts for you. Run these commands from `callfar-backend`:

1. **Verify Supabase Connection**:
   ```bash
   npm run test:supabase
   ```
   *Expected output: `✅ Database Connected Successfully!`, reporting target as `⚡ Supabase PostgreSQL Cloud`.*

2. **Push CallFar Schema to Supabase**:
   ```bash
   npm run db:supabase:push
   ```
   *This automatically creates all 15 relational tables (`users`, `user_profiles`, `calls`, `call_participants`, `messages`, `contacts`, `license_keys`, etc.) on Supabase.*

3. **Re-run Diagnostics**:
   ```bash
   npm run test:supabase
   ```
   *Will report: `✅ All core CallFar tables exist and are ready for production!`*

---

## 🚀 Phase 2: Deploying the Backend to an Online Cloud Server

Because CallFar uses **Socket.IO** for real-time WebRTC call signaling and instant chat, the cloud host must support persistent **WebSockets**. Below are the top 3 recommended production deployment options:

---

### Option A: Render.com (Recommended — 1-Click Deployment)
Render offers automatic SSL, WebSocket support, and zero-downtime Git deployments.

1. Push your repository to **GitHub** or **GitLab**.
2. Go to [https://render.com](https://render.com) and click **New ➔ Blueprint** (or **New ➔ Web Service**).
3. Connect your repository. Render will automatically detect `callfar-backend/render.yaml`!
4. Configure the environment variables:
   - `DATABASE_URL`: Your Supabase Transaction Pooler URL (`port 6543`)
   - `DIRECT_URL`: Your Supabase Direct Connection URL (`port 5432`)
   - `JWT_ACCESS_SECRET`: Generate a random secure 64-char key
   - `JWT_REFRESH_SECRET`: Generate a random secure 64-char key
   - `CORS_ORIGIN`: `*`
   - `APP_URL`: `https://callfar-backend.onrender.com` (Your live backend URL for password reset links)
   - *(Optional for Live SMTP Emails)*: `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
5. Click **Create Web Service**.
6. When deployment finishes, Render provides your live URL, e.g.:
   `https://callfar-backend.onrender.com`


---

### Option B: Railway.app (Fastest Setup)
1. Go to [https://railway.app](https://railway.app) and click **New Project ➔ Deploy from GitHub Repo**.
2. Select your CallFar repository (set root directory to `callfar-backend` if needed).
3. Under the service **Variables**, add:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `NODE_ENV=production`
   - `PORT=5000`
4. Under **Settings ➔ Networking**, click **Generate Domain** to get your public URL:
   `https://callfar-backend.up.railway.app`

---

### Option C: Self-Hosted Linux VPS (Ubuntu / Debian / Docker)
If you run on your own VPS (DigitalOcean, AWS EC2, Hetzner, Linode):

1. **Build and Run with Docker**:
   ```bash
   cd c:\Users\user\Desktop\CallFar
   docker compose up -d --build backend
   ```
2. **Or Run with PM2 Node Process Manager**:
   ```bash
   cd callfar-backend
   npm install -g pm2
   npm run build
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   pm2 startup
   ```
3. **Configure NGINX Reverse Proxy with SSL**:
   Use the provided `callfar-backend/nginx.callfar.conf`. It already contains WebSocket upgrade headers (`Upgrade $http_upgrade`, `Connection "upgrade"`), Let's Encrypt SSL directives, and security headers.

---

## 📡 Phase 3: WebRTC STUN & TURN Configuration in the Cloud

- **STUN (Session Traversal Utilities for NAT)**: Google STUN servers are configured by default in CallFar:
  `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun.cloudflare.com:3478`
- **TURN (Traversal Using Relays around NAT)**:
  When users are on cellular mobile networks (4G/5G) or behind strict corporate symmetric firewalls, a TURN relay server is needed.
  - **Free Cloud TURN Option**: Register for free at [Metered.ca](https://www.metered.ca/tools/openrelay/) (provides 50GB/month free TURN bandwidth).
  - Add the TURN credentials to your online server's environment variables:
    ```env
    TURN_SERVER_URL="turn:openrelay.metered.ca:80"
    TURN_SERVER_USERNAME="openrelayproject"
    TURN_SERVER_CREDENTIAL="openrelayproject"
    ```

---

## 📱 Phase 4: Connecting the Mobile App & Admin Dashboard

### 4.1 Mobile App: Dynamic Server Switcher
The mobile app now includes an interactive **Server & Cloud Infrastructure** selector in Settings:

1. Open **CallFar** on your device or emulator.
2. Go to **Settings** ➔ scroll to **Server & Cloud Infrastructure**.
3. Tap **Server Endpoint**:
   - Tap **🌐 Cloud HTTPS** to enter your live online URL (e.g. `https://callfar-backend.onrender.com`).
   - Tap **⚡ Test Connection** to verify live round-trip latency.
   - Tap **Apply & Connect**. The app immediately re-establishes WebSockets securely (`wss://`) with your online cloud backend and persists your preference!

### 4.2 Mobile App: Production APK Environment Build
To compile a production Android APK with your online server hardcoded by default:
1. In `callfar-mobile/.env` (or pass as build argument):
   ```env
   EXPO_PUBLIC_SERVER_URL=https://callfar-backend.onrender.com
   ```
2. Build the release APK:
   ```bash
   cd callfar-mobile
   npx expo run:android --variant release
   ```

### 4.3 Admin Hub: Connecting to Online Backend
1. Open `callfar-admin/index.html`.
2. The Admin Hub will automatically detect whether it is hosted on the same domain as the backend.
3. You can also configure a custom API URL at any time via `API_CONFIG.setBaseUrl('https://callfar-backend.onrender.com')` or from the browser console / settings.

---

## 🛡️ Phase 5: Verification & Production Checklist

| Step | Verification Command / Action | Expected Result |
| :--- | :--- | :--- |
| **1. Supabase Connection** | `npm run test:supabase` in `callfar-backend` | `✅ Database Connected Successfully!`, 15 tables confirmed |
| **2. Online Server Health** | Open `https://your-online-server.com/health` in browser | `{"status":"UP", "database":{"status":"CONNECTED", "provider":"supabase"}}` |
| **3. WebSocket Signaling** | Connect with Mobile app | Socket connected with `wss://` over SSL port 443 |
| **4. P2P Audio/Video** | Call between two phones on different Wi-Fi / 4G | Real-time DTLS-SRTP audio/video stream established |
| **5. Data Persistence** | Register new user in mobile app | Record appears instantly in Supabase **Table Editor ➔ users** |

---

*CallFar is now fully equipped for enterprise production deployment on Supabase and high-availability cloud servers.*
