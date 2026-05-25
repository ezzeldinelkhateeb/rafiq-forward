
-- Users table (anonymous-first identity)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  auth_user_id UUID NULL,
  preferred_persona TEXT NOT NULL DEFAULT 'friend',
  display_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);

-- Extend interactions
ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS session_ref UUID NULL,
  ADD COLUMN IF NOT EXISTS emotional_tag TEXT NULL,
  ADD COLUMN IF NOT EXISTS response_mode TEXT NULL,
  ADD COLUMN IF NOT EXISTS action_done_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS parent_interaction_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_interactions_user_created ON public.interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_session_ref ON public.interactions(session_ref);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- No public policies: all access goes through service role (server functions)
