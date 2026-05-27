-- Schema for Phase 2: Plans & Micro-Tasks (Task Arm)
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

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_steps ENABLE ROW LEVEL SECURITY;

-- Grant access to service_role
GRANT ALL ON public.plans TO service_role;
GRANT ALL ON public.plan_steps TO service_role;
