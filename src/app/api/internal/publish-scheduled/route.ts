import { NextRequest, NextResponse } from "next/server";
import { publishDueArticles } from "@/lib/admin/publish-scheduled";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await publishDueArticles();
    console.log(
      `[publish-scheduled] checked=${result.checked} due=${result.due} published=${result.published} skipped=${result.skipped} failed=${result.failed.length}`,
    );
    if (result.failed.length > 0) {
      console.log(
        `[publish-scheduled] failed IDs: ${result.failed.map((f) => f.id).join(", ")}`,
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[publish-scheduled] error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
