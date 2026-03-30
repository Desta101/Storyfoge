import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";

const ALLOWED_EVENTS = new Set([
  "signup",
  "login",
  "create_page_viewed",
  "create_story",
  "characters_generated",
  "comic_panels_generated",
  "save_project",
  "dashboard_viewed",
  "project_opened",
  "export",
  "pricing_viewed",
  "upgrade_clicked",
  "premium_activated",
]);

export async function POST(req: Request) {
  let body: { event?: string; properties?: unknown };
  try {
    body = (await req.json()) as { event?: string; properties?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
  }

  const user = await getCurrentUser();
  const properties =
    body.properties && typeof body.properties === "object" && !Array.isArray(body.properties)
      ? body.properties
      : {};

  console.info("[analytics]", {
    event,
    user_id: user?.id ?? null,
    properties,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
