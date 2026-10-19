# CallFar: Professional Internet Calling & Communication Platform

CallFar is a full-stack, real-time internet communication application supporting secure registration, contact discovery, 1-on-1 instant messaging, and low-latency WebRTC voice and video calling.

---

## 🏗️ Architecture Overview

```
CallFar/
├── callfar-backend/               # Node.js + Express + TypeScript + Socket.IO + Prisma
│   ├── prisma/
│   │   └── schema.prisma          # PostgreSQL Relational Schema (UUIDs, 3NF, Indices)
│   ├── src/
│   │   ├── config/                # Environment variables, Prisma client
│   │   ├── controllers/           # Auth, Users, Contacts, Messages, Calls
│   │   ├── middlewares/           # JWT verification, Zod validation, Error handler
│   │   ├── routes/                # Express REST API v1 routes
│   │   ├── services/              # Business logic, Argon2/Bcrypt, Token lifecycle
│   │   ├── signaling/             # WebRTC Signaling & Socket.IO message gateway
│   │   ├── utils/                 # Crypto, JWT, Token hashing
│   │   ├── app.ts                 # Express Application
│   │   └── server.ts              # HTTP & Socket.IO Server bootstrap
│   └── package.json
│
└── callfar-mobile/                # React Native + TypeScript + Expo Prebuild
    ├── src/
    │   ├── api/                   # Axios client with automatic Bearer refresh
    │   ├── components/            # Button, Input, Avatar, Badges
    │   ├── context/               # AuthContext, SocketContext, CallContext (WebRTC)
    │   ├── navigation/            # RootNavigator, Bottom Tabs & Stacks
    │   ├── screens/               # Login, Register, Home, Contacts, Chat, History, Settings
    │   ├── screens/call/          # IncomingCallModal, ActiveCallScreen (RTCView)
    │   ├── styles/                # Modern Dark/Light Theme Design System
    │   └── types/                 # Shared TypeScript interfaces
    ├── app.json                   # WebRTC camera/mic native permissions & config
    └── package.json
```

---

## 🚀 Getting Started on Windows 11

### Prerequisites
1. **Node.js** (LTS v20+ or v25+)
2. **PostgreSQL 15+** (Installed and running on port `5432`)
3. **Android Studio** (For running Android Emulator or physical device with ADB)

---

### Step 1: Configure & Start PostgreSQL

1. Open PowerShell and verify PostgreSQL is running:
   ```powershell
   Get-Service -Name postgresql*
   ```
2. Create the `callfar` database:
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE callfar;"
   ```
3. Update `callfar-backend/.env` with your PostgreSQL password:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/callfar?schema=public"
   ```

---

### Step 2: Set Up Backend

1. Open a PowerShell terminal and navigate to the backend directory:
   ```powershell
   cd c:\Users\user\Desktop\CallFar\callfar-backend
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Push database schema / run migrations:
   ```powershell
   npm run prisma:push
   npm run prisma:generate
   ```
4. Start the backend development server:
   ```powershell
   npm run dev
   ```
   The backend will start at `http://localhost:5000/api/v1` with WebSocket signaling on port `5000`.

---

### Step 3: Set Up Mobile Application

1. Open a second PowerShell terminal:
   ```powershell
   cd c:\Users\user\Desktop\CallFar\callfar-mobile
   ```
2. Install mobile dependencies:
   ```powershell
   npm install
   ```
3. Generate native Android project:
   ```powershell
   npx expo prebuild
   ```
4. Run on Android Emulator:
   ```powershell
   npx expo run:android
   ```

---

## 🔐 Security Features

* **Password Security**: Argon2id / bcrypt hashing with unique salts.
* **Token Model**: Short-lived Access Tokens (15 min) + DB-tracked Rotating Refresh Tokens (30 days).
* **IDOR Protection**: Route controllers filter records by authenticated token `userId`.
* **Media Privacy**: Direct WebRTC peer streams with DTLS-SRTP encryption.
