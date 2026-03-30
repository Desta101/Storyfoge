import { NextResponse } from "next/server";
import { projectApiErrorResponse } from "../../../lib/projectApiResponse";
import {
  deleteProject,
  getProjectById,
  updateProject,
  type UpdateProjectInput,
} from "../../../lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await getProjectById(id);
  if (error) {
    return projectApiErrorResponse(
      { route: "/api/projects/[id]", method: "GET", projectId: id },
      error,
      "loadOne",
    );
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: UpdateProjectInput;
  try {
    body = (await req.json()) as UpdateProjectInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { data, error } = await updateProject(id, body);
  if (error) {
    return projectApiErrorResponse(
      { route: "/api/projects/[id]", method: "PATCH", projectId: id },
      error,
      "save",
    );
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await deleteProject(id);
  if (error) {
    return projectApiErrorResponse(
      { route: "/api/projects/[id]", method: "DELETE", projectId: id },
      error,
      "delete",
    );
  }
  return NextResponse.json({ ok: true });
}
