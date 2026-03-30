-- Full `projects` DDL for new environments. If your table was created earlier and Save fails
-- with PGRST204 (missing `story_world`), run:
--   supabase/migrations/20260330120000_projects_add_missing_columns.sql
--
-- App expects columns: title, format, idea, summary, chapter_preview, characters, comic_panels,
-- story_world, generation_mode (+ id, user_id, created_at, updated_at).

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format text not null check (format in ('manga', 'comic')),
  idea text not null,
  summary text not null,
  chapter_preview text not null,
  characters jsonb not null default '[]'::jsonb,
  comic_panels jsonb not null default '[]'::jsonb,
  story_world jsonb not null default '{}'::jsonb,
  generation_mode text check (generation_mode in ('ai', 'mock')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_updated_at_idx on public.projects(updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
  on public.projects
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own projects" on public.projects;
create policy "Users can create own projects"
  on public.projects
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
  on public.projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
  on public.projects
  for delete
  using (auth.uid() = user_id);
