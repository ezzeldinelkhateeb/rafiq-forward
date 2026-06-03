-- Consolidated migration: create missing tables (brain_map, plans, events, open_loops)
-- with proper GRANTs. RLS enabled but no policies (deny-by-default via Data API);
-- access is via supabaseAdmin server functions only, per project's anonymous-first model.

-- ─── BRAIN MAP ───
CREATE TABLE IF NOT EXISTS public.brain_nodes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('problem','goal','fear','task')),
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
  parent_id     UUID        NULL REFERENCES public.brain_nodes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brain_nodes_user ON public.brain_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_brain_nodes_parent ON public.brain_nodes(parent_id);

GRANT ALL ON public.brain_nodes TO service_role;
ALTER TABLE public.brain_nodes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.node_links (
  from_node     UUID        NOT NULL REFERENCES public.brain_nodes(id) ON DELETE CASCADE,
  to_node       UUID        NOT NULL REFERENCES public.brain_nodes(id) ON DELETE CASCADE,
  relation_type TEXT        NOT NULL CHECK (relation_type IN ('causes','helps','blocks','subtask')),
  PRIMARY KEY (from_node, to_node)
);
CREATE INDEX IF NOT EXISTS idx_node_links_from ON public.node_links(from_node);
CREATE INDEX IF NOT EXISTS idx_node_links_to ON public.node_links(to_node);

GRANT ALL ON public.node_links TO service_role;
ALTER TABLE public.node_links ENABLE ROW LEVEL SECURITY;

-- ─── PLANS ───
CREATE TABLE IF NOT EXISTS public.plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  brain_node_id UUID        NULL REFERENCES public.brain_nodes(id) ON DELETE SET NULL,
  target_date   TIMESTAMPTZ NULL,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON public.plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_brain_node ON public.plans(brain_node_id);

GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.plan_steps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  order_index   INTEGER     NOT NULL,
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  due_at        TIMESTAMPTZ NULL,
  completed_at  TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_steps_plan ON public.plan_steps(plan_id);

GRANT ALL ON public.plan_steps TO service_role;
ALTER TABLE public.plan_steps ENABLE ROW LEVEL SECURITY;

-- ─── EVENTS (Behavioral Engine backbone) ───
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON public.events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_type ON public.events(user_id, event_type, created_at DESC);

GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ─── OPEN LOOPS ───
CREATE TABLE IF NOT EXISTS public.open_loops (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  loop_type        TEXT        NOT NULL CHECK (loop_type IN ('promise','postponement','excuse','avoidance','win','collapse')),
  content          TEXT        NOT NULL,
  extracted_from   UUID        REFERENCES public.interactions(id) ON DELETE SET NULL,
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_by      TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  recurrence_count INT         NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_open_loops_user_status ON public.open_loops(user_id, status, created_at DESC);

GRANT ALL ON public.open_loops TO service_role;
ALTER TABLE public.open_loops ENABLE ROW LEVEL SECURITY;