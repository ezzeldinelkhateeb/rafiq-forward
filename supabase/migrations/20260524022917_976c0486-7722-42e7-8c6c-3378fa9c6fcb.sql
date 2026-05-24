CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  persona TEXT NOT NULL,
  user_text TEXT NOT NULL,
  validate TEXT,
  reframe TEXT,
  action TEXT,
  action_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_session ON public.interactions (session_id, created_at DESC);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
-- No public policies: all access goes through server functions using the service role.
