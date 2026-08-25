import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  listUniversities,
  listColleges,
  listDepartments,
  listPrograms,
} from "@/lib/academic/service";

export const runtime = "nodejs";

// Cascading lookups for the upload selectors:
//   /api/academic?level=universities
//   /api/academic?level=colleges&parentId=<universityId>
//   /api/academic?level=departments&parentId=<collegeId>
//   /api/academic?level=programs&parentId=<departmentId>
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const parentId = searchParams.get("parentId") ?? "";

  switch (level) {
    case "universities":
      return NextResponse.json({ items: await listUniversities() });
    case "colleges":
      if (!parentId) return badParent();
      return NextResponse.json({ items: await listColleges(parentId) });
    case "departments":
      if (!parentId) return badParent();
      return NextResponse.json({ items: await listDepartments(parentId) });
    case "programs":
      if (!parentId) return badParent();
      return NextResponse.json({ items: await listPrograms(parentId) });
    default:
      return NextResponse.json({ error: "Unknown level." }, { status: 400 });
  }
}

function badParent() {
  return NextResponse.json({ error: "parentId is required." }, { status: 400 });
}
