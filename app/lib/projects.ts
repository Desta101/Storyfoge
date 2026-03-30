import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUser } from "./auth";
import {
  type CharacterDraft,
  type ComicPanelDraft,
  type GenerationMode,
  type StoryFormat,
  type StoryWorldSettings,
  defaultStoryWorld,
} from "./storyDraft";
import { createSupabaseServerClient } from "./supabase/server";

export type SupabaseProject = {
  id: string;
  user_id: string;
  title: string;
  format: StoryFormat;
  idea: string;
  summary: string;
  chapter_preview: string;
  characters: CharacterDraft[];
  comic_panels: ComicPanelDraft[];
  story_world: StoryWorldSettings | null;
  generation_mode: GenerationMode | null;
  created_at: string;
  updated_at: string;
};

export type CreateProjectInput = {
  title: string;
  format: StoryFormat;
  idea: string;
  summary: string;
  chapter_preview: string;
  characters: CharacterDraft[];
  comic_panels: ComicPanelDraft[];
  story_world?: StoryWorldSettings | null;
  generation_mode?: GenerationMode | null;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

type ServiceResult<T> = {
  data: T | null;
  error: PostgrestError | Error | null;
};

const TABLE = "projects";

function notConfiguredError() {
  return new Error("Supabase is not configured.");
}

function unauthorizedError() {
  return new Error("Unauthorized");
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ServiceResult<SupabaseProject>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: null, error: notConfiguredError() };

  const user = await getCurrentUser();
  if (!user) return { data: null, error: unauthorizedError() };
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      ...input,
      story_world: input.story_world ?? defaultStoryWorld(),
      generation_mode: input.generation_mode ?? null,
    })
    .select("*")
    .single();

  return { data: (data as SupabaseProject | null) ?? null, error };
}

export async function updateProject(
  id: string,
  updates: UpdateProjectInput,
): Promise<ServiceResult<SupabaseProject>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: null, error: notConfiguredError() };

  const user = await getCurrentUser();
  if (!user) return { data: null, error: unauthorizedError() };
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...updates,
      generation_mode:
        updates.generation_mode === undefined ? undefined : updates.generation_mode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  return { data: (data as SupabaseProject | null) ?? null, error };
}

export async function deleteProject(id: string): Promise<ServiceResult<true>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: null, error: notConfiguredError() };

  const user = await getCurrentUser();
  if (!user) return { data: null, error: unauthorizedError() };
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return { data: error ? null : true, error };
}

export async function getProjectsByUser(): Promise<ServiceResult<SupabaseProject[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: [], error: null };

  const user = await getCurrentUser();
  if (!user) return { data: null, error: unauthorizedError() };
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return { data: (data as SupabaseProject[] | null) ?? [], error };
}

export async function getProjectById(
  id: string,
): Promise<ServiceResult<SupabaseProject>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { data: null, error: notConfiguredError() };

  const user = await getCurrentUser();
  if (!user) return { data: null, error: unauthorizedError() };
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  return { data: (data as SupabaseProject | null) ?? null, error };
}
