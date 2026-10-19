/**
 * CallFar End-to-End API and Logic Verification Test Suite
 */
import { createApp } from './app.js';
import http from 'http';
import { setupSocketServer } from './signaling/socket.server.js';
import { io as ClientSocket } from 'socket.io-client';

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING CALLFAR SYSTEM VERIFICATION & TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Boot local test server
  const app = createApp();
  const server = http.createServer(app);
  const testPort = 5099;
  setupSocketServer(server, '*');

  await new Promise<void>((resolve) => server.listen(testPort, resolve));
  const baseUrl = `http://localhost:${testPort}/api/v1`;

  try {
    // TEST 1: Health Check
    console.log('--- Test Suite 1: Health & Diagnostics ---');
    const healthRes = await fetch(`http://localhost:${testPort}/health`);
    const healthData = (await healthRes.json()) as any;
    assert(healthRes.status === 200 && healthData.status === 'UP', 'Server Health Check Endpoint returns 200 UP');

    // TEST 2: Input Validation & Registration
    console.log('\n--- Test Suite 2: Registration & Validation ---');
    const badReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'A', username: 'a', email: 'notanemail', password: '123' }),
    });
    assert(badReg.status === 400, 'Zod Schema rejects invalid email and short password (HTTP 400)');

    // TEST 3: ICE Servers endpoint security
    console.log('\n--- Test Suite 3: Security & Authorization ---');
    const unauthIce = await fetch(`${baseUrl}/calls/ice-servers`);
    assert(unauthIce.status === 401, 'Protected endpoints reject unauthenticated requests (HTTP 401)');

    const unauthContacts = await fetch(`${baseUrl}/contacts`);
    assert(unauthContacts.status === 401, 'Contacts access requires Bearer token (HTTP 401)');

    // TEST 4: Real-time Socket Connection Authentication
    console.log('\n--- Test Suite 4: WebRTC Signaling Gateway ---');
    const unauthSocket = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    const socketAuthRejected = await new Promise<boolean>((resolve) => {
      unauthSocket.on('connect_error', (err) => {
        resolve(err.message.includes('Authentication token required'));
      });
      setTimeout(() => resolve(false), 2000);
    });
    unauthSocket.disconnect();

    assert(socketAuthRejected, 'Socket.IO gateway rejects unauthenticated connections');

    // TEST 5: Telecom & Carrier Recognition (MTN, Airtel-Tigo, Safaricom, International)
    console.log('\n--- Test Suite 5: Telecom & PSTN Gateway ---');
    const countriesRes = await fetch(`${baseUrl}/pstn/countries`);
    const countriesData = (await countriesRes.json()) as any;
    assert(countriesRes.status === 200 && countriesData.data.length >= 35, `Countries Database loaded (${countriesData.data?.length} countries)`);

    // Detect MTN Rwanda (078...)
    const mtnRes = await fetch(`${baseUrl}/pstn/detect?phoneNumber=0788123456&country=RW`);
    const mtnData = (await mtnRes.json()) as any;
    assert(
      mtnData.data?.carrierBrand === 'MTN' && mtnData.data?.carrierName === 'MTN Rwanda' && mtnData.data?.e164 === '+250788123456',
      'Detects MTN Rwanda cellular number (0788... -> +250788123456)'
    );

    // Detect Airtel Rwanda (073...)
    const airtelRes = await fetch(`${baseUrl}/pstn/detect?phoneNumber=0730123456&country=RW`);
    const airtelData = (await airtelRes.json()) as any;
    assert(
      airtelData.data?.carrierBrand === 'AIRTEL' && airtelData.data?.carrierName.includes('Airtel'),
      'Detects Airtel-Tigo Rwanda cellular number (0730...)'
    );

    // Detect Safaricom Kenya (+254712...)
    const safaricomRes = await fetch(`${baseUrl}/pstn/detect?phoneNumber=+254712345678&country=KE`);
    const safaricomData = (await safaricomRes.json()) as any;
    assert(
      safaricomData.data?.carrierBrand === 'SAFARICOM' && safaricomData.data?.carrierName.includes('Safaricom'),
      'Detects Safaricom Kenya cellular number (+254712...)'
    );

    // TEST 6: User vs Admin Entry & Admin Elevation
    console.log('\n--- Test Suite 6: User vs Admin Dual Entry ---');
    // Register a fresh standard user
    const testUserSuffix = Date.now().toString().slice(-6);
    const memberUsername = `user_${testUserSuffix}`;
    const freshReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Member',
        username: memberUsername,
        email: `${memberUsername}@callfar.test`,
        password: 'Password123!',
        role: 'MEMBER',
      }),
    });
    const freshRegData = (await freshReg.json()) as any;
    const memberToken = freshRegData.data?.tokens?.accessToken;
    assert(freshReg.status === 201 && freshRegData.data?.user?.role === 'MEMBER', `New user (${memberUsername}) registers successfully as MEMBER`);

    // Attempt admin stats with member token -> should be 403
    const forbiddenAdmin = await fetch(`${baseUrl}/admin/stats`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(forbiddenAdmin.status === 403, 'Standard Member is rejected from Admin stats (HTTP 403)');

    // Elevate Member with admin security passcode (admin2026)
    const elevateRes = await fetch(`${baseUrl}/auth/elevate-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({ adminPasscode: 'admin2026' }),
    });
    const elevateData = (await elevateRes.json()) as any;
    assert(elevateRes.status === 200 && elevateData.data?.user?.role === 'ADMIN', 'Elevates Member to ADMIN using admin security passcode');

    // Login as Alice (Default System Admin)
    const aliceLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'alice', password: 'Password123!' }),
    });
    const aliceData = (await aliceLogin.json()) as any;
    const aliceToken = aliceData.data?.tokens?.accessToken;
    assert(aliceLogin.status === 200 && aliceData.data?.user?.role === 'ADMIN', 'Alice enters system as authorized System Administrator');

    // Admin can access admin stats and PSTN telecom logs
    const adminStats = await fetch(`${baseUrl}/admin/stats`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(adminStats.status === 200, 'Administrator accesses System Admin Stats successfully (HTTP 200)');

    const pstnLogsRes = await fetch(`${baseUrl}/pstn/admin/logs`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(pstnLogsRes.status === 200, 'Administrator accesses Telecom Cellular Logs successfully (HTTP 200)');
  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n========================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
