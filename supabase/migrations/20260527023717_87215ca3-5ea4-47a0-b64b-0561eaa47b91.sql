
-- identity_memory
CREATE TABLE public.identity_memory (
  user_id UUID PRIMARY KEY,
  goals TEXT[] NOT NULL DEFAULT '{}',
  struggles TEXT[] NOT NULL DEFAULT '{}',
  personality TEXT,
  preferred_tone TEXT,
  trigger_words TEXT[] NOT NULL DEFAULT '{}',
  sleep_target TEXT,
  small_pleasures TEXT[] NOT NULL DEFAULT '{}',
  onboarding_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.identity_memory TO service_role;
ALTER TABLE public.identity_memory ENABLE ROW LEVEL SECURITY;

-- memory_snapshots
CREATE TABLE public.memory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_type TEXT NOT NULL,
  content TEXT NOT NULL,
  covers_from TIMESTAMPTZ,
  covers_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX memory_snapshots_user_type_created_idx
  ON public.memory_snapshots (user_id, snapshot_type, created_at DESC);
GRANT ALL ON public.memory_snapshots TO service_role;
ALTER TABLE public.memory_snapshots ENABLE ROW LEVEL SECURITY;

-- behavioral_patterns
CREATE TABLE public.behavioral_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence NUMERIC,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern_type)
);
CREATE INDEX behavioral_patterns_user_last_seen_idx
  ON public.behavioral_patterns (user_id, last_seen_at DESC);
GRANT ALL ON public.behavioral_patterns TO service_role;
ALTER TABLE public.behavioral_patterns ENABLE ROW LEVEL SECURITY;

-- emotional_timeline
CREATE TABLE public.emotional_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id TEXT,
  emotional_state TEXT NOT NULL,
  intensity INTEGER,
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX emotional_timeline_user_created_idx
  ON public.emotional_timeline (user_id, created_at DESC);
GRANT ALL ON public.emotional_timeline TO service_role;
ALTER TABLE public.emotional_timeline ENABLE ROW LEVEL SECURITY;
