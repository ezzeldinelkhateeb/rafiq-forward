-- ============================================================
-- RAFIQ FULL DATABASE INITIALIZATION SCHEMA
-- Consolidates all migrations into a single, clean script
-- Order of creation:
-- 1. extensions
-- 2. users & sessions
-- 3. interactions
-- 4. memory tables (identity_memory, behavioral_patterns, etc.)
-- 5. habits & focus tables
-- 6. brain_nodes & node_links
-- 7. plans & plan_steps
-- ============================================================

-- Enable pgvector (for future semantic recall)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. USERS & SESSIONS ───
CREATE TABLE IF NOT EXISTS public.users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name      TEXT,
  preferred_persona TEXT        NOT NULL DEFAULT 'friend',
  auth_user_id      UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  message_count INT         NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id, created_at DESC);

-- ─── 2. INTERACTIONS ───
CREATE TABLE IF NOT EXISTS public.interactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            TEXT        NOT NULL,
  persona               TEXT        NOT NULL,
  user_text             TEXT        NOT NULL,
  validate              TEXT,
  reframe               TEXT,
  action                TEXT,
  action_done           BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id               UUID        REFERENCES public.users(id) ON DELETE CASCADE,
  session_ref           UUID        REFERENCES public.sessions(id) ON DELETE CASCADE,
  emotional_tag         TEXT,
  response_mode         TEXT,
  action_done_at        TIMESTAMPTZ,
  parent_interaction_id UUID        NULL
);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON public.interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_session_ref ON public.interactions(session_ref);
CREATE INDEX IF NOT EXISTS idx_interactions_session ON public.interactions (session_id, created_at DESC);

-- ─── 3. MEMORY TABLES ───
CREATE TABLE IF NOT EXISTS public.identity_memory (
  user_id         UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  goals           TEXT[]      NOT NULL DEFAULT '{}',
  struggles       TEXT[]      NOT NULL DEFAULT '{}',
  personality     TEXT,
  preferred_tone  TEXT        NOT NULL DEFAULT 'warm',
  trigger_words   TEXT[]      NOT NULL DEFAULT '{}',
  sleep_target    TEXT        NULL,
  small_pleasures TEXT[]      NOT NULL DEFAULT '{}',
  onboarding_done BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memory_snapshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  snapshot_type TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  covers_from   TIMESTAMPTZ,
  covers_to     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_snapshots_user_type_created_idx
  ON public.memory_snapshots (user_id, snapshot_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.behavioral_patterns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pattern_type     TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  confidence       NUMERIC     NULL,
  occurrence_count INT         NOT NULL DEFAULT 1,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern_type)
);
CREATE INDEX IF NOT EXISTS behavioral_patterns_user_last_seen_idx
  ON public.behavioral_patterns (user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.emotional_timeline (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id      TEXT,
  emotional_state TEXT        NOT NULL,
  intensity       INTEGER,
  source_text     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emotional_timeline_user_created_idx
  ON public.emotional_timeline (user_id, created_at DESC);

-- ─── 4. HABITS & FOCUS ───
CREATE TABLE IF NOT EXISTS public.habits (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  description       TEXT,
  frequency         TEXT        NOT NULL DEFAULT 'daily',
  current_streak    INTEGER     NOT NULL DEFAULT 0,
  max_streak        INTEGER     NOT NULL DEFAULT 0,
  last_completed_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS habits_user_created_idx ON public.habits (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id      UUID        NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS habit_logs_user_completed_idx ON public.habit_logs (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS habit_logs_habit_completed_idx ON public.habit_logs (habit_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duration_minutes INTEGER     NOT NULL,
  focus_topic      TEXT,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS focus_sessions_user_completed_idx ON public.focus_sessions (user_id, completed_at DESC);

-- ─── 5. BRAIN-MAP (Phase 1) ───
CREATE TABLE IF NOT EXISTS public.brain_nodes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('problem', 'goal', 'fear', 'task')),
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  parent_id     UUID        NULL REFERENCES public.brain_nodes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brain_nodes_user ON public.brain_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_brain_nodes_parent ON public.brain_nodes(parent_id);

CREATE TABLE IF NOT EXISTS public.node_links (
  from_node     UUID        NOT NULL REFERENCES public.brain_nodes(id) ON DELETE CASCADE,
  to_node       UUID        NOT NULL REFERENCES public.brain_nodes(id) ON DELETE CASCADE,
  relation_type TEXT        NOT NULL CHECK (relation_type IN ('causes', 'helps', 'blocks', 'subtask')),
  PRIMARY KEY (from_node, to_node)
);
CREATE INDEX IF NOT EXISTS idx_node_links_from ON public.node_links(from_node);
CREATE INDEX IF NOT EXISTS idx_node_links_to ON public.node_links(to_node);

-- ─── 6. PLANS & MICRO-TASKS (Phase 2) ───
CREATE TABLE IF NOT EXISTS public.plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  brain_node_id UUID        NULL REFERENCES public.brain_nodes(id) ON DELETE SET NULL,
  target_date   TIMESTAMPTZ NULL,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON public.plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_brain_node ON public.plans(brain_node_id);

CREATE TABLE IF NOT EXISTS public.plan_steps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  order_index   INTEGER     NOT NULL,
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  due_at        TIMESTAMPTZ NULL,
  completed_at  TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_steps_plan ON public.plan_steps(plan_id);

-- ─── 7. TRIGGERS ───
CREATE OR REPLACE FUNCTION public.update_user_last_seen()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users SET last_seen_at = now() WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_update_last_seen ON public.sessions;
CREATE TRIGGER trg_session_update_last_seen
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_last_seen();

-- ─── 8. ROW LEVEL SECURITY (RLS) ───
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_memory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotional_timeline  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_nodes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_links          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_steps          ENABLE ROW LEVEL SECURITY;

-- ─── 9. PERMISSIONS FOR SERVICE_ROLE ───
GRANT ALL ON public.users               TO service_role;
GRANT ALL ON public.sessions            TO service_role;
GRANT ALL ON public.interactions        TO service_role;
GRANT ALL ON public.identity_memory     TO service_role;
GRANT ALL ON public.memory_snapshots    TO service_role;
GRANT ALL ON public.behavioral_patterns TO service_role;
GRANT ALL ON public.emotional_timeline  TO service_role;
GRANT ALL ON public.habits              TO service_role;
GRANT ALL ON public.habit_logs          TO service_role;
GRANT ALL ON public.focus_sessions      TO service_role;
GRANT ALL ON public.brain_nodes         TO service_role;
GRANT ALL ON public.node_links          TO service_role;
GRANT ALL ON public.plans               TO service_role;
GRANT ALL ON public.plan_steps          TO service_role;
