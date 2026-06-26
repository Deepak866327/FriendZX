ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
