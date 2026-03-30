import { NextResponse } from "next/server";
import { getCurrentUser } from "../../lib/auth";

type FeedbackBody = {
  liked?: string;
  confusing?: string;
  nextFeature?: string;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 4000);
}

export async function POST(req: Request) {
  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const liked = normalizeText(body.liked);
  const confusing = normalizeText(body.confusing);
  const nextFeature = normalizeText(body.nextFeature);

  if (!liked && !confusing && !nextFeature) {
    return NextResponse.json(
      { error: "Please fill at least one feedback field." },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  console.info("[feedback]", {
    user_id: user?.id ?? null,
    liked,
    confusing,
    nextFeature,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
