CREATE TABLE IF NOT EXISTS user_followers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  follower_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, follower_id)
);

CREATE INDEX idx_user_followers_user_id ON user_followers(user_id);
CREATE INDEX idx_user_followers_follower_id ON user_followers(follower_id);