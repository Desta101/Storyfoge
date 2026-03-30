-- Align `public.projects` with the StoryForge app (fixes PGRST204: story_world missing from schema cache).
--
-- App read/write fields (snake_case in DB):
--   id, user_id, title, format, idea, summary, chapter_preview,
--   characters (jsonb), comic_panels (jsonb), story_world (jsonb), generation_mode (text),
--   created_at, updated_at
--
-- Idempotent: safe to run on existing databases that already have some of these columns.

alter table public.projects
  add column if not exists story_world jsonb not null default '{}'::jsonb;

alter table public.projects
  add column if not exists generation_mode text;

-- Backfill null story_world for legacy nullable columns (if any).
update public.projects
set story_world = '{}'::jsonb
where story_world is null;

-- Ask PostgREST to reload the schema cache (fixes stale PGRST204 after ALTER).
-- If this NOTIFY fails with a permission error, the ADD COLUMN above still applies; wait ~1 min or pause/resume project.
notify pgrst, 'reload schema';
