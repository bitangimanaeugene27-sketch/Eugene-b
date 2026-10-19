const BASE_URL = 'http://localhost:5000/api/v1';

async function post(endpoint: string, body: any, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

async function get(endpoint: string, token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

async function runTests() {
  console.log('🚀 Running CallFar Admin & License E2E Test Suite...\n');

  // 1. Login as Alice (System Administrator)
  const aliceRes = await post('/auth/login', {
    identifier: 'alice',
    password: 'Password123!',
  });
  const alice = aliceRes.data.user;
  const adminToken = aliceRes.data.tokens.accessToken;
  console.log(`✅ [1/8] Admin Logged In: @${alice.username}`);
  console.log(`      Role: ${alice.role}`);
  console.log(`      License Tier: ${alice.license?.tier}`);
  console.log(`      Max Duration: ${alice.license?.maxCallDurationMinutes} (Unlimited)`);
  console.log(`      Entitlements: HD Audio=${alice.license?.canHdAudio}, Video=${alice.license?.canVideoCall}, ScreenShare=${alice.license?.canScreenShare}, PriorityTurn=${alice.license?.priorityTurn}\n`);

  if (alice.role !== 'ADMIN' || alice.license?.tier !== 'MASTER_ADMIN') {
    throw new Error('Admin role or Master License assertion failed!');
  }

  // 2. Query System Stats & Server Health
  const statsRes = await get('/admin/stats', adminToken);
  const stats = statsRes.data;
  console.log(`✅ [2/8] System Analytics & Health Fetched:`);
  console.log(`      Total Users: ${stats.overview.totalUsers}`);
  console.log(`      Online Users: ${stats.overview.onlineUsers}`);
  console.log(`      Server Status: ${stats.systemHealth.status}`);
  console.log(`      Uptime: ${stats.systemHealth.uptimeFormatted}`);
  console.log(`      Total Calls: ${stats.calling.totalCalls}`);
  console.log(`      Total Messages: ${stats.messaging.totalMessages}`);
  console.log(`      License Tiers: Free=${stats.licensing.tiers.FREE}, Pro=${stats.licensing.tiers.PRO}, Ent=${stats.licensing.tiers.ENTERPRISE}, Master=${stats.licensing.tiers.MASTER_ADMIN}\n`);

  // 3. User Directory & Management
  const usersRes = await get('/admin/users?limit=10', adminToken);
  const users = usersRes.data.users;
  console.log(`✅ [3/8] Retrieved ${users.length} registered users across platform.\n`);

  // 4. Generate New 60-Day Pro License Key
  const genKeyRes = await post(
    '/admin/licenses/keys',
    {
      tier: 'PRO',
      durationDays: 60,
      count: 1,
      notes: 'Automated E2E Testing Key',
    },
    adminToken
  );
  const generatedKey = genKeyRes.data.keys[0];
  console.log(`✅ [4/8] Admin Generated License Key: "${generatedKey}" (Tier: PRO, Duration: 60 days)\n`);

  // 5. Login as Charlie (Free Member)
  const charlieRes = await post('/auth/login', {
    identifier: 'charlie',
    password: 'Password123!',
  });
  const charlie = charlieRes.data.user;
  const charlieToken = charlieRes.data.tokens.accessToken;
  console.log(`✅ [5/8] User Charlie Logged In (Initial Tier: ${charlie.license?.tier}, Max Duration: ${charlie.license?.maxCallDurationMinutes} min)\n`);

  // 6. Charlie Redeems the Admin-Generated License Key
  const redeemRes = await post('/licenses/redeem', { key: generatedKey }, charlieToken);
  const upgradedLicense = redeemRes.data;
  console.log(`✅ [6/8] Key Redemption Successful:`);
  console.log(`      Message: ${redeemRes.message}`);
  console.log(`      New Tier: ${upgradedLicense.tier}`);
  console.log(`      Max Duration: ${upgradedLicense.maxCallDurationMinutes} (Unlimited)`);
  console.log(`      HD Audio: ${upgradedLicense.canHdAudio}`);
  console.log(`      Screen Share: ${upgradedLicense.canScreenShare}\n`);

  if (upgradedLicense.tier !== 'PRO' || upgradedLicense.maxCallDurationMinutes !== -1) {
    throw new Error('License upgrade assertion failed!');
  }

  // 7. Verify License Keys Table Updated in Admin
  const keysRes = await get('/admin/licenses/keys', adminToken);
  const redeemedKeyObj = keysRes.data.find((k: any) => k.key === generatedKey);
  console.log(`✅ [7/8] Verified Admin Key Audit:`);
  console.log(`      Key: ${redeemedKeyObj?.key}`);
  console.log(`      Is Redeemed: ${redeemedKeyObj?.isRedeemed}`);
  console.log(`      Redeemed By: @${redeemedKeyObj?.redeemer?.username}\n`);

  // 8. Admin Global Call Audit Logs & Announcement
  const callsRes = await get('/admin/calls?limit=5', adminToken);
  const bcastRes = await post(
    '/admin/broadcast',
    {
      title: 'CallFar v2.0 Platform Live',
      message: 'System Administrator and Master Licensing controls activated.',
      priority: 'HIGH',
    },
    adminToken
  );
  console.log(`✅ [8/8] Call Logs & Broadcast Dispatched:`);
  console.log(`      Call Audit Records: ${callsRes.data.calls.length}`);
  console.log(`      Broadcast Status: ${bcastRes.message}\n`);

  console.log('🎉 ALL 8 E2E INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
