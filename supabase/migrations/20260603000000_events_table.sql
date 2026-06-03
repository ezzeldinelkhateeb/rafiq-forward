-- Events table: unified behavioral event tracking
-- Used by the behavioral score engine (Phase 2 backbone)

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for efficient querying: recent events per user, filtered by type
CREATE INDEX IF NOT EXISTS idx_events_user_created
  ON events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_user_type
  ON events(user_id, event_type, created_at DESC);
