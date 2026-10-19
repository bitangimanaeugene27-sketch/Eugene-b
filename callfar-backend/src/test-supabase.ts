import { prisma } from './config/prisma.js';
import { ENV } from './config/env.js';
import { getSupabaseClient, isSupabaseConfigured } from './config/supabase.js';

async function testSupabase() {
  console.log('\n======================================================');
  console.log('🛡️  CallFar — Supabase & Database Cloud Diagnostics');
  console.log('======================================================\n');

  console.log('1. Checking Database Connection Strings:');
  const isSupabaseUrl = ENV.DATABASE_URL.includes('supabase.co') || ENV.DATABASE_URL.includes('pooler.supabase.com');
  console.log(`   - DATABASE_URL: ${ENV.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`   - DIRECT_URL:   ${ENV.DIRECT_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`   - Target Type:  ${isSupabaseUrl ? '⚡ Supabase PostgreSQL Cloud' : '💻 Local / Standard PostgreSQL'}\n`);

  console.log('2. Probing Database Query Connection...');
  const start = Date.now();
  try {
    const rawResult: any = await prisma.$queryRaw`SELECT version(), current_database(), current_user;`;
    const latency = Date.now() - start;
    console.log(`   ✅ Database Connected Successfully! (${latency}ms round-trip)`);
    if (rawResult && rawResult[0]) {
      console.log(`   - PostgreSQL Version: ${rawResult[0].version?.split(' ')?.[0] || 'PostgreSQL'}`);
      console.log(`   - Database Name:      ${rawResult[0].current_database}`);
      console.log(`   - User:               ${rawResult[0].current_user}\n`);
    }
  } catch (error: any) {
    console.error(`   ❌ Failed to connect to database:`, error.message || error);
    console.log('\n💡 Tip: Verify your DATABASE_URL in .env. If using Supabase, make sure your database password is correct and your project is not paused.');
    process.exit(1);
  }

  console.log('3. Inspecting CallFar Database Tables:');
  try {
    const tables: any = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const tableNames: string[] = tables.map((t: any) => t.table_name);
    const expectedTables = ['users', 'user_profiles', 'messages', 'calls', 'contacts', 'license_keys'];
    const missingTables = expectedTables.filter((t) => !tableNames.includes(t));

    console.log(`   - Found ${tableNames.length} tables in schema 'public'.`);
    if (tableNames.length > 0) {
      console.log(`   - Tables: ${tableNames.join(', ')}`);
    }

    if (missingTables.length > 0) {
      console.log(`   ⚠️  Missing core tables: ${missingTables.join(', ')}`);
      console.log(`   👉 Run: npm run prisma:push (to create all tables on Supabase instantly)`);
    } else {
      console.log('   ✅ All core CallFar tables exist and are ready for production!');
      const userCount = await prisma.user.count();
      console.log(`   - Total Registered Users: ${userCount}`);
    }
  } catch (error: any) {
    console.warn(`   ⚠️ Could not inspect tables:`, error.message);
  }

  console.log('\n4. Checking Supabase Storage & Client API:');
  if (isSupabaseConfigured()) {
    console.log(`   - SUPABASE_URL: ${ENV.SUPABASE_URL}`);
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: buckets, error } = await client.storage.listBuckets();
        if (error) {
          console.log(`   ⚠️  Supabase API responded with: ${error.message}`);
        } else {
          console.log(`   ✅ Supabase API Connected! Found ${buckets?.length || 0} storage bucket(s).`);
          if (buckets && buckets.length > 0) {
            console.log(`      Buckets: ${buckets.map((b) => b.name).join(', ')}`);
          }
        }
      } catch (err: any) {
        console.log(`   ⚠️  Supabase API check failed: ${err.message}`);
      }
    }
  } else {
    console.log('   ℹ️  SUPABASE_URL or API keys not set in .env (Optional: needed if using Supabase Storage for avatars/attachments).');
  }

  console.log('\n======================================================');
  console.log('🚀 Verification Complete');
  console.log('======================================================\n');
  await prisma.$disconnect();
  process.exit(0);
}

testSupabase().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
