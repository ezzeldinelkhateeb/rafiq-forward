-- Open loops table: tracking commitments, avoidances, promises, and excuses.
-- Used to remind the user of unfinished loops in future turns.

CREATE TABLE IF NOT EXISTS open_loops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loop_type TEXT NOT NULL CHECK (loop_type IN ('promise','postponement','excuse','avoidance','win','collapse')),
  content TEXT NOT NULL,
  extracted_from UUID REFERENCES interactions(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_by TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  recurrence_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for fast retrieval of open loops for a user
CREATE INDEX IF NOT EXISTS idx_open_loops_user_status
  ON open_loops(user_id, status, created_at DESC);
