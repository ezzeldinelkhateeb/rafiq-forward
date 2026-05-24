-- ============================================================
-- RAFIQ BRAIN SCHEMA — v2 Full Rebuild
-- Adds: users, sessions, identity_memory, behavioral_patterns,
--       emotional_timeline, memory_snapshots
-- Modifies: interactions (adds user_id FK, new columns)
-- ============================================================

-- Enable pgvector for future semantic recall (v2 feature, harmless now)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- USERS: Persistent identity — survives browser/device changes
-- ============================================================
CREATE TABLE public.users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name      TEXT,
  preferred_persona TEXT        NOT NULL DEFAULT 'friend',
  -- future: link to auth.users for account claiming
  auth_user_id      UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- SESSIONS: One per browser visit, linked to user
-- ============================================================
CREATE TABLE public.sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  message_count INT         NOT NULL DEFAULT 0
);
CREATE INDEX idx_sessions_user ON public.sessions(user_id, created_at DESC);

-- ============================================================
-- INTERACTIONS v2: Extended with user_id + behavioral metadata
-- ============================================================
ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS action_done_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emotional_tag  TEXT,      -- detected emotion label
  ADD COLUMN IF NOT EXISTS response_mode  TEXT,      -- which strategy was used
  ADD COLUMN IF NOT EXISTS session_ref    UUID REFERENCES public.sessions(id);

-- Backfill: existing rows without user_id stay nullable (legacy data)
CREATE INDEX IF NOT EXISTS idx_interactions_user ON public.interactions(user_id, created_at DESC);

-- ============================================================
-- IDENTITY MEMORY: Stable user profile — updated slowly
-- ============================================================
CREATE TABLE public.identity_memory (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  goals           TEXT[]      NOT NULL DEFAULT '{}',
  struggles       TEXT[]      NOT NULL DEFAULT '{}',
  personality     TEXT,
  preferred_tone  TEXT        NOT NULL DEFAULT 'warm',  -- 'direct' | 'warm' | 'philosophical'
  trigger_words   TEXT[]      NOT NULL DEFAULT '{}',    -- words that indicate distress
  onboarding_done BOOLEAN     NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BEHAVIORAL PATTERNS: Detected recurring patterns
-- ============================================================
CREATE TABLE public.behavioral_patterns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pattern_type     TEXT        NOT NULL,  -- 'doomscroll' | 'collapse_hour' | 'focus_window' | 'avoidance'
  description      TEXT        NOT NULL,
  confidence       FLOAT       NOT NULL DEFAULT 0.5,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurrence_count INT         NOT NULL DEFAULT 1
);
CREATE INDEX idx_patterns_user ON public.behavioral_patterns(user_id, last_seen_at DESC);

-- ============================================================
-- EMOTIONAL TIMELINE: Chronological emotional history
-- ============================================================
CREATE TABLE public.emotional_timeline (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id      UUID        REFERENCES public.sessions(id) ON DELETE SET NULL,
  emotional_state TEXT        NOT NULL,  -- 'drained' | 'scattered' | 'motivated' | 'anxious' | 'rebuilding'
  intensity       INT         NOT NULL DEFAULT 5 CHECK (intensity BETWEEN 1 AND 10),
  source_text     TEXT,                  -- what the user said that indicated this
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_emotional_user ON public.emotional_timeline(user_id, created_at DESC);

-- ============================================================
-- MEMORY SNAPSHOTS: Compressed narrative summaries (LLM-generated)
-- "Rafiq remembers stories, not just states."
-- ============================================================
CREATE TABLE public.memory_snapshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  snapshot_type TEXT        NOT NULL,  -- 'relationship' | 'weekly' | 'emotional_arc'
  content       TEXT        NOT NULL,  -- narrative paragraph(s)
  covers_from   TIMESTAMPTZ NOT NULL,
  covers_to     TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_snapshots_user ON public.memory_snapshots(user_id, snapshot_type, created_at DESC);

-- ============================================================
-- Row-Level Security: all access via service role (server fns)
-- ============================================================
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_memory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotional_timeline  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_snapshots    ENABLE ROW LEVEL SECURITY;

-- Update users.last_seen_at on new session creation (trigger)
CREATE OR REPLACE FUNCTION public.update_user_last_seen()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users SET last_seen_at = now() WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_session_update_last_seen
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_last_seen();
