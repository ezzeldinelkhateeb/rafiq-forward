-- Extend identity_memory with sleep target and small pleasures/rewards
ALTER TABLE public.identity_memory
  ADD COLUMN IF NOT EXISTS sleep_target TEXT NULL,
  ADD COLUMN IF NOT EXISTS small_pleasures TEXT[] NOT NULL DEFAULT '{}';
