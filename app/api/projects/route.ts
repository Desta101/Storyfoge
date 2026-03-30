import { NextResponse } from "next/server";
import { projectApiErrorResponse } from "../../lib/projectApiResponse";
import {
  createProject,
  getProjectsByUser,
  type CreateProjectInput,
} from "../../lib/projects";

export async function GET() {
  const { data, error } = await getProjectsByUser();
  if (error) {
    return projectApiErrorResponse(
      { route: "/api/projects", method: "GET" },
      error,
      "loadList",
    );
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  let body: CreateProjectInput;
  try {
    body = (await req.json()) as CreateProjectInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { data, error } = await createProject(body);
  if (error) {
    return projectApiErrorResponse(
      { route: "/api/projects", method: "POST", extra: { hasBody: true } },
      error,
      "save",
    );
  }
  return NextResponse.json(data, { status: 201 });
}
