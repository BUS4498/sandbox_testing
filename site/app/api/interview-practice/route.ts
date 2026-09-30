import { getChatGPTUser } from "@/app/chatgpt-auth";
import { hasHostedKey } from "@/lib/hosted/openai";
import { materialStorageReady } from "@/lib/hosted/materials-store";
import { prepareInterviewPractice } from "@/lib/hosted/interview-practice";
import { UsageLimitError } from "@/lib/hosted/store";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to prepare private interview questions." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The interview-practice request was rejected." }, { status: 403 });
  if (!hasHostedKey() || !materialStorageReady()) return Response.json({ error: "The private search or Word storage is not configured." }, { status: 503 });
  try {
    const raw = await request.text();
    if (raw.length > 1_000) return Response.json({ error: "The request is too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.opportunityId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.opportunityId)) throw new TypeError("Choose one tracked opportunity.");
    if (typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new TypeError("Start a fresh interview-practice request.");
    const run = await prepareInterviewPractice(user.userId, body.opportunityId, body.requestId);
    return Response.json({ run }, { status: run.status === "SUCCESS" ? 200 : 207, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UsageLimitError) return Response.json({ error: error.message, retryAt: error.retryAt }, { status: 429 });
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    const busy = error instanceof Error && error.message.includes("already in progress");
    return Response.json({ error: busy ? "Another workflow is active. Try again after it finishes." : "Interview practice could not be completed. Try again later." }, { status: busy ? 409 : 503 });
  }
}
