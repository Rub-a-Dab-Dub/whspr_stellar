-- Migration: Create platform_config table and add isAdmin to users
-- Run this SQL manually or through your migration tool

-- 1. Create platform_config table
CREATE TABLE IF NOT EXISTS platform_config (
    key VARCHAR PRIMARY KEY,
    value JSONB NOT NULL,
    description VARCHAR,
    "updatedBy" VARCHAR,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 2. Insert default configuration values
INSERT INTO platform_config (key, value, description) VALUES
('xp_multiplier', '1.0', 'XP multiplier for all activities'),
('platform_fee_percentage', '2.0', 'Platform fee percentage for tips and room entries'),
('allowed_reactions', '["👍","❤️","😂","😮","😢","🔥"]', 'Allowed emoji reactions'),
('rate_limit_messages_per_minute', '10', 'Rate limit for messages per user per minute'),
('feature_flags', '{"tipping":true,"rooms":true,"reactions":true}', 'Feature flags for platform features')
ON CONFLICT (key) DO NOTHING;

-- 3. Add isAdmin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT FALSE;

-- 4. (Optional) Make your user an admin
-- UPDATE users SET "isAdmin" = TRUE WHERE email = 'your-email@example.com';
