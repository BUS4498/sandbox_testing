import { getChatGPTUser } from "@/app/chatgpt-auth";
import { materialStorageReady, validateMaterialTypes } from "@/lib/hosted/materials-store";
import { prepareMaterials } from "@/lib/hosted/prepare-materials";
import { UsageLimitError } from "@/lib/hosted/store";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to prepare private Word drafts." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The preparation request was rejected." }, { status: 403 });
  if (!materialStorageReady()) return Response.json({ error: "Private Word draft storage is not available yet." }, { status: 503 });
  try {
    const raw = await request.text();
    if (raw.length > 2_000) return Response.json({ error: "The preparation request is too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.opportunityId !== "string" || !body.opportunityId || body.opportunityId.length > 150) throw new TypeError("Choose one tracked opportunity.");
    if (typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new TypeError("Start a fresh preparation request.");
    const types = validateMaterialTypes(body.types);
    const run = await prepareMaterials(user.userId, body.opportunityId, types, body.requestId);
    return Response.json({ run }, { status: run.status === "SUCCESS" ? 200 : 207, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UsageLimitError) return Response.json({ error: error.message, retryAt: error.retryAt }, { status: 429 });
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    const busy = error instanceof Error && error.message.includes("already in progress");
    return Response.json({ error: busy ? "Another workflow is active. Try preparing this opportunity again after it finishes." : "The Word draft request could not be completed. Check the current collection and try again." }, { status: busy ? 409 : 503 });
  }
}
