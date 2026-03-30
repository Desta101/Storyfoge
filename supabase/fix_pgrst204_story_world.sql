-- Run this in Supabase Dashboard → SQL Editor (same project as your .env URL).
-- Fixes: PGRST204 — Could not find the 'story_world' column of 'projects' in the schema cache

alter table public.projects
  add column if not exists story_world jsonb not null default '{}'::jsonb;

alter table public.projects
  add column if not exists generation_mode text;

update public.projects
set story_world = '{}'::jsonb
where story_world is null;

notify pgrst, 'reload schema';
