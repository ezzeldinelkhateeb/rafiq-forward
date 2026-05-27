-- Brain-Map tables for Phase 1
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

-- Enable Row Level Security (RLS)
ALTER TABLE public.brain_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_links ENABLE ROW LEVEL SECURITY;
