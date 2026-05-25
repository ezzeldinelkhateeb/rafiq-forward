-- Habits, Habit Logs, and Focus Sessions Schema for Phase 4
CREATE TABLE IF NOT EXISTS public.habits (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT        NULL,
  frequency     TEXT        NOT NULL DEFAULT 'daily', -- 'daily' | 'weekly'
  current_streak INT        NOT NULL DEFAULT 0,
  max_streak    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON public.habits(user_id);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id      UUID        NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON public.habit_logs(user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duration_minutes INT      NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  focus_topic   TEXT        NULL
);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON public.focus_sessions(user_id, completed_at DESC);

-- Enable RLS
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
