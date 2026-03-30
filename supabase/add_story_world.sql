-- Deprecated: prefer `migrations/20260330120000_projects_add_missing_columns.sql`.
-- Run in Supabase SQL Editor if Save Project fails with missing `story_world`.

alter table public.projects
  add column if not exists story_world jsonb not null default '{}'::jsonb;

alter table public.projects
  add column if not exists generation_mode text;
