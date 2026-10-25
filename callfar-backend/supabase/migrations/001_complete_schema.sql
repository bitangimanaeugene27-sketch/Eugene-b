-- =====================================================================
-- CallFar Platform — Complete Supabase Database Schema
-- =====================================================================
-- This migration creates ALL tables for the CallFar platform on Supabase.
-- It mirrors the Prisma schema exactly, and adds NEW tables for features
-- that were previously stored in-memory (audit logs, PSTN logs, 
-- broadcasts, notifications, push tokens, and app config).
--
-- Run with: psql $DATABASE_URL -f 001_complete_schema.sql
-- Or paste into Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =====================================================================

-- Enable UUID extension (Supabase has this by default, but just in case)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- ENUMS
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LicenseTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE', 'MASTER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'RINGING', 'ONGOING', 'COMPLETED', 'REJECTED', 'MISSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'CONNECTED', 'LEFT', 'DECLINED', 'BUSY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- NEW ENUMS (for additional tables)
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'MISSED_CALL', 'CONTACT_REQUEST', 'CONTACT_ACCEPTED',
    'MESSAGE', 'BROADCAST', 'LICENSE_UPGRADE', 'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM (
    'CREATE_USER', 'DELETE_USER', 'SUSPEND_USER', 'ACTIVATE_USER',
    'CHANGE_ROLE', 'RESET_PASSWORD', 'REVOKE_SESSIONS',
    'UPDATE_LICENSE', 'GENERATE_KEY', 'REVOKE_KEY',
    'UPDATE_CONFIG', 'BROADCAST_ANNOUNCEMENT', 'FORCE_DISCONNECT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILURE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BroadcastPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PstnCallStatus" AS ENUM ('COMPLETED', 'MISSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =====================================================================
-- TABLE 1: users (core user accounts)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "users" (
  "id"                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email"             TEXT        NOT NULL UNIQUE,
  "username"          TEXT        NOT NULL UNIQUE,
  "password_hash"     TEXT        NOT NULL,
  "phone_number"      TEXT        UNIQUE,
  "is_phone_verified" BOOLEAN     NOT NULL DEFAULT false,
  "is_active"         BOOLEAN     NOT NULL DEFAULT true,
  "role"              "Role"      NOT NULL DEFAULT 'MEMBER',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- TABLE 2: user_profiles (display name, avatar, online status)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id"           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"      UUID        NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "display_name" TEXT        NOT NULL,
  "avatar_url"   TEXT,
  "bio"          VARCHAR(500),
  "last_seen"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "is_online"    BOOLEAN     NOT NULL DEFAULT false
);


-- =====================================================================
-- TABLE 3: user_settings (preferences)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "user_settings" (
  "id"                    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"               UUID    NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "theme"                 TEXT    NOT NULL DEFAULT 'system',
  "allow_incoming_calls"  BOOLEAN NOT NULL DEFAULT true,
  "allow_read_receipts"   BOOLEAN NOT NULL DEFAULT true,
  "call_ringtone"         TEXT    NOT NULL DEFAULT 'default',
  "notifications_enabled" BOOLEAN NOT NULL DEFAULT true
);


-- =====================================================================
-- TABLE 4: refresh_tokens (JWT refresh token hashes)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id"         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"    UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT        NOT NULL UNIQUE,
  "device_id"  TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "is_revoked" BOOLEAN     NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user_id" ON "refresh_tokens"("user_id");


-- =====================================================================
-- TABLE 5: devices (registered mobile devices & push tokens)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "devices" (
  "id"          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"     UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "device_id"   TEXT        NOT NULL,
  "platform"    TEXT        NOT NULL DEFAULT 'android',
  "fcm_token"   TEXT,
  "last_active" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE ("user_id", "device_id")
);


-- =====================================================================
-- TABLE 6: contacts (mutual contacts / address book)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "contacts" (
  "id"              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"         UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "contact_user_id" UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "alias_name"      TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE ("user_id", "contact_user_id")
);

CREATE INDEX IF NOT EXISTS "idx_contacts_user_id" ON "contacts"("user_id");


-- =====================================================================
-- TABLE 7: contact_requests (friend requests / invitations)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "contact_requests" (
  "id"          UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  "sender_id"   UUID                   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "receiver_id" UUID                   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"      "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"  TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ            NOT NULL DEFAULT NOW(),

  UNIQUE ("sender_id", "receiver_id", "status")
);

CREATE INDEX IF NOT EXISTS "idx_contact_requests_receiver_status" ON "contact_requests"("receiver_id", "status");


-- =====================================================================
-- TABLE 8: blocked_users (user blocking)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "blocked_users" (
  "id"         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "blocker_id" UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE ("blocker_id", "blocked_id")
);

CREATE INDEX IF NOT EXISTS "idx_blocked_users_blocker_id" ON "blocked_users"("blocker_id");


-- =====================================================================
-- TABLE 9: conversations (direct or group chats)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "conversations" (
  "id"         UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  "type"       "ConversationType" NOT NULL DEFAULT 'DIRECT',
  "title"      VARCHAR(120),
  "created_at" TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- TABLE 10: conversation_members (who belongs to which conversation)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "conversation_members" (
  "id"              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "conversation_id" UUID        NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "user_id"         UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"            "Role"      NOT NULL DEFAULT 'MEMBER',
  "joined_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_read_at"    TIMESTAMPTZ,

  UNIQUE ("conversation_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_conversation_members_user_id" ON "conversation_members"("user_id");


-- =====================================================================
-- TABLE 11: messages (chat messages)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "messages" (
  "id"              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  "conversation_id" UUID            NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "sender_id"       UUID            NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content"         TEXT            NOT NULL,
  "status"          "MessageStatus" NOT NULL DEFAULT 'SENT',
  "created_at"      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_messages_conversation_created" ON "messages"("conversation_id", "created_at");


-- =====================================================================
-- TABLE 12: calls (WebRTC call records)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "calls" (
  "id"               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  "initiator_id"     UUID         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "conversation_id"  UUID         REFERENCES "conversations"("id") ON DELETE SET NULL,
  "call_type"        "CallType"   NOT NULL DEFAULT 'VOICE',
  "status"           "CallStatus" NOT NULL DEFAULT 'INITIATED',
  "started_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "answered_at"      TIMESTAMPTZ,
  "ended_at"         TIMESTAMPTZ,
  "duration_seconds" INT          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_calls_initiator_id" ON "calls"("initiator_id");


-- =====================================================================
-- TABLE 13: call_participants (who participated in a call)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "call_participants" (
  "id"        UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  "call_id"   UUID                NOT NULL REFERENCES "calls"("id") ON DELETE CASCADE,
  "user_id"   UUID                NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"    "ParticipantStatus" NOT NULL DEFAULT 'INVITED',
  "joined_at" TIMESTAMPTZ,
  "left_at"   TIMESTAMPTZ,

  UNIQUE ("call_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_call_participants_user_id" ON "call_participants"("user_id");


-- =====================================================================
-- TABLE 14: user_licenses (subscription tier & entitlements)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "user_licenses" (
  "id"                       UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"                  UUID            NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "tier"                     "LicenseTier"   NOT NULL DEFAULT 'FREE',
  "status"                   "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
  "max_call_duration_minutes" INT            NOT NULL DEFAULT 15,
  "can_video_call"           BOOLEAN         NOT NULL DEFAULT true,
  "can_hd_audio"             BOOLEAN         NOT NULL DEFAULT false,
  "can_screen_share"         BOOLEAN         NOT NULL DEFAULT false,
  "can_record_calls"         BOOLEAN         NOT NULL DEFAULT false,
  "priority_turn"            BOOLEAN         NOT NULL DEFAULT false,
  "expires_at"               TIMESTAMPTZ,
  "license_key"              TEXT,
  "issued_by"                UUID,
  "created_at"               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- TABLE 15: license_keys (activation keys generated by admins)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "license_keys" (
  "id"             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key"            TEXT          NOT NULL UNIQUE,
  "tier"           "LicenseTier" NOT NULL DEFAULT 'PRO',
  "duration_days"  INT           NOT NULL DEFAULT 30,
  "is_redeemed"    BOOLEAN       NOT NULL DEFAULT false,
  "redeemed_by_id" UUID          REFERENCES "users"("id") ON DELETE SET NULL,
  "redeemed_at"    TIMESTAMPTZ,
  "created_by_id"  UUID          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "notes"          TEXT,
  "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_license_keys_key" ON "license_keys"("key");


-- =====================================================================
-- =====================================================================
--                     NEW ADDITIONAL TABLES
--     (These persist data that was previously only in-memory)
-- =====================================================================
-- =====================================================================


-- =====================================================================
-- TABLE 16: notifications (in-app notifications)
-- Replaces ephemeral Socket.IO events with persistent notification feed
-- =====================================================================
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"          UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"     UUID               NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"        "NotificationType" NOT NULL,
  "title"       TEXT               NOT NULL,
  "body"        TEXT,
  "data"        JSONB              DEFAULT '{}',
  "is_read"     BOOLEAN            NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications"("user_id", "is_read") WHERE "is_read" = false;


-- =====================================================================
-- TABLE 17: push_tokens (FCM/APNs push notification tokens)
-- Separate from devices table for multiple tokens per device
-- =====================================================================
CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id"         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"    UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token"      TEXT        NOT NULL,
  "platform"   TEXT        NOT NULL DEFAULT 'android',
  "is_active"  BOOLEAN     NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE ("user_id", "token")
);

CREATE INDEX IF NOT EXISTS "idx_push_tokens_user_id" ON "push_tokens"("user_id");


-- =====================================================================
-- TABLE 18: audit_logs (admin action audit trail)
-- Replaces the in-memory auditLogsStore[] in admin.service.ts
-- =====================================================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  "admin_id"       UUID          NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "admin_username" TEXT          NOT NULL,
  "action"         "AuditAction" NOT NULL,
  "target"         TEXT,
  "details"        TEXT          NOT NULL DEFAULT '',
  "status"         "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
  "ip_address"     TEXT,
  "user_agent"     TEXT,
  "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_admin_id" ON "audit_logs"("admin_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs"("action");


-- =====================================================================
-- TABLE 19: broadcasts (system-wide announcements)
-- Replaces the in-memory broadcastHistoryStore[] in admin.service.ts
-- =====================================================================
CREATE TABLE IF NOT EXISTS "broadcasts" (
  "id"               UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title"            TEXT                NOT NULL,
  "message"          TEXT                NOT NULL,
  "priority"         "BroadcastPriority" NOT NULL DEFAULT 'NORMAL',
  "sent_by"          UUID                NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sent_by_username" TEXT                NOT NULL,
  "recipients_count" INT                 NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_broadcasts_created_at" ON "broadcasts"("created_at" DESC);


-- =====================================================================
-- TABLE 20: pstn_call_logs (phone/cellular call history)
-- Replaces the in-memory pstnLogsStore[] in pstn.service.ts
-- =====================================================================
CREATE TABLE IF NOT EXISTS "pstn_call_logs" (
  "id"                 UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id"            UUID             NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "destination_number" TEXT             NOT NULL,
  "carrier_name"       TEXT             NOT NULL,
  "carrier_brand"      TEXT             NOT NULL,
  "country_name"       TEXT             NOT NULL,
  "country_code"       TEXT,
  "country_flag"       TEXT,
  "started_at"         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "duration_seconds"   INT              NOT NULL DEFAULT 0,
  "cost_total"         DECIMAL(10, 4)   NOT NULL DEFAULT 0.0,
  "currency"           TEXT             NOT NULL DEFAULT 'USD',
  "status"             "PstnCallStatus" NOT NULL DEFAULT 'COMPLETED',
  "provider"           TEXT             NOT NULL DEFAULT 'AFRICAS_TALKING',
  "created_at"         TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_pstn_call_logs_user_id" ON "pstn_call_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_pstn_call_logs_created_at" ON "pstn_call_logs"("created_at" DESC);


-- =====================================================================
-- TABLE 21: app_config (system-level configuration, key-value store)
-- Replaces the in-memory systemConfig object in admin.service.ts
-- =====================================================================
CREATE TABLE IF NOT EXISTS "app_config" (
  "id"         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key"        TEXT        NOT NULL UNIQUE,
  "value"      JSONB       NOT NULL DEFAULT '{}',
  "updated_by" UUID        REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_app_config_key" ON "app_config"("key");

-- Insert default app config values
INSERT INTO "app_config" ("key", "value") VALUES
  ('general',         '{"appName": "CallFar", "appVersion": "1.0.0", "maintenanceMode": false}'),
  ('calls',           '{"maxCallDurationMinutes": 120, "enableVideoByDefault": true, "enableRecording": false}'),
  ('messaging',       '{"maxMessageLength": 5000, "enableFileAttachments": true}'),
  ('registration',    '{"requireEmailVerification": false, "requirePhoneVerification": false, "allowPublicRegistration": true}'),
  ('allowed_media',   '{"maxFileSizeMB": 25, "allowedTypes": ["image/jpeg", "image/png", "image/webp", "audio/mp3", "audio/ogg", "video/mp4"]}')
ON CONFLICT ("key") DO NOTHING;


-- =====================================================================
-- TABLE 22: media_attachments (message file attachments)
-- Enables rich media in chat messages (images, audio, video, files)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "media_attachments" (
  "id"           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "message_id"   UUID        NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "file_url"     TEXT        NOT NULL,
  "file_name"    TEXT        NOT NULL,
  "file_type"    TEXT        NOT NULL,
  "file_size"    INT         NOT NULL DEFAULT 0,
  "storage_path" TEXT,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_media_attachments_message_id" ON "media_attachments"("message_id");


-- =====================================================================
-- AUTOMATIC updated_at TRIGGER
-- Keeps the updated_at column current on every UPDATE
-- =====================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables that have an updated_at column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'contact_requests', 'conversations',
      'messages', 'user_licenses', 'push_tokens', 'app_config'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;


-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Supabase best practice: enable RLS on all tables.
-- Since CallFar uses a backend service role key, these policies allow
-- the service role to bypass RLS while still enabling Supabase features.
-- =====================================================================

ALTER TABLE "users"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_profiles"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "devices"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_requests"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blocked_users"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calls"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_participants"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_licenses"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "license_keys"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_tokens"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "broadcasts"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pstn_call_logs"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_config"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_attachments"    ENABLE ROW LEVEL SECURITY;

-- Allow service_role (backend) full access to all tables
-- The backend connects with SUPABASE_SERVICE_ROLE_KEY which bypasses RLS by default.
-- These policies allow authenticated anon users to read their own data if you ever
-- use the Supabase client directly from the mobile app.

CREATE POLICY "service_role_all_users" ON "users"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_user_profiles" ON "user_profiles"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_user_settings" ON "user_settings"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_refresh_tokens" ON "refresh_tokens"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_devices" ON "devices"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_contacts" ON "contacts"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_contact_requests" ON "contact_requests"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_blocked_users" ON "blocked_users"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_conversations" ON "conversations"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_conversation_members" ON "conversation_members"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_messages" ON "messages"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_calls" ON "calls"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_call_participants" ON "call_participants"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_user_licenses" ON "user_licenses"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_license_keys" ON "license_keys"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_notifications" ON "notifications"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_push_tokens" ON "push_tokens"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_audit_logs" ON "audit_logs"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_broadcasts" ON "broadcasts"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_pstn_call_logs" ON "pstn_call_logs"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_app_config" ON "app_config"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_media_attachments" ON "media_attachments"
  FOR ALL USING (true) WITH CHECK (true);


-- =====================================================================
-- SUPABASE STORAGE BUCKETS
-- Create the storage buckets CallFar needs for user avatars & files
-- =====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO NOTHING;

-- Allow public read access to avatars
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated uploads to avatars
CREATE POLICY "avatars_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated uploads to attachments
CREATE POLICY "attachments_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'attachments');

-- Allow public read of attachments
CREATE POLICY "attachments_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'attachments');


-- =====================================================================
-- DONE! 🎉
-- =====================================================================
-- Total Tables: 22
-- 
-- EXISTING (from Prisma schema):
--   1.  users                 - Core user accounts
--   2.  user_profiles         - Display name, avatar, bio, online status
--   3.  user_settings         - Theme, call preferences, notifications
--   4.  refresh_tokens        - JWT refresh token rotation
--   5.  devices               - Registered mobile devices
--   6.  contacts              - Mutual contacts (address book)
--   7.  contact_requests      - Friend requests
--   8.  blocked_users         - User blocking
--   9.  conversations         - Chat conversations (direct/group)
--   10. conversation_members  - Conversation membership
--   11. messages              - Chat messages
--   12. calls                 - WebRTC call records
--   13. call_participants     - Call participants
--   14. user_licenses         - Subscription tiers & entitlements
--   15. license_keys          - License activation keys
--
-- NEW ADDITIONAL:
--   16. notifications         - Persistent notification feed
--   17. push_tokens           - FCM/APNs push notification tokens
--   18. audit_logs            - Admin action audit trail (was in-memory)
--   19. broadcasts            - System announcements (was in-memory)
--   20. pstn_call_logs        - PSTN/cellular call history (was in-memory)
--   21. app_config            - System configuration key-value store (was in-memory)
--   22. media_attachments     - Message file attachments (images, audio, files)
--
-- Storage Buckets: avatars, attachments
-- =====================================================================
