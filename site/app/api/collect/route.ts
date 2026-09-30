import { getChatGPTUser } from "@/app/chatgpt-auth";
import { hasHostedKey } from "@/lib/hosted/openai";
import { startResumableCollection } from "@/lib/hosted/collect-resumable";
import { getStudentSetup, UsageLimitError } from "@/lib/hosted/store";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to collect opportunities." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The collection request was rejected." }, { status: 403 });
  if (!hasHostedKey()) return Response.json({ error: "The Site has no OpenAI API key configured." }, { status: 503 });
  try {
    const setup = await getStudentSetup(user.userId);
    if (!setup.ready) return Response.json({ error: "Complete and confirm student setup before collecting opportunities." }, { status: 409 });
    const run = await startResumableCollection(user.userId);
    return Response.json({ run }, { status: run.status === "FAILURE" ? 502 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UsageLimitError) return Response.json({ error: error.message, retryAt: error.retryAt }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const busy = error instanceof Error && error.message.includes("already in progress");
    return Response.json({ error: busy ? "A collection run is already in progress." : error instanceof TypeError ? error.message : "The collection run could not start. Check both provider connections and try again." }, { status: busy ? 409 : error instanceof TypeError ? 400 : 503 });
  }
}
