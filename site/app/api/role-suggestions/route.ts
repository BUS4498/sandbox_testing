import { getChatGPTUser } from "@/app/chatgpt-auth";
import { suggestResumeRoles } from "@/lib/hosted/role-suggestions";
import { readRoleSuggestionCache, roleSuggestionStorageReady } from "@/lib/hosted/role-suggestion-cache";
import { UsageLimitError } from "@/lib/hosted/store";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to view your private role suggestions." }, { status: 401 });
  const fingerprint = new URL(request.url).searchParams.get("fingerprint") ?? "";
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) return Response.json({ error: "Review the current resume preview first." }, { status: 400 });
  try { return Response.json({ result: await readRoleSuggestionCache(user.userId, fingerprint) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "The private suggestions could not be retrieved." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to suggest private internship roles." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The role-suggestion request was rejected." }, { status: 403 });
  if (!roleSuggestionStorageReady()) return Response.json({ error: "Private suggestion storage is unavailable. The default role choices remain available." }, { status: 503 });
  try {
    const raw = await request.text();
    if (raw.length > 64_000) return Response.json({ error: "The reviewed resume preview is too large." }, { status: 413 });
    const result = await suggestResumeRoles(user.userId, JSON.parse(raw));
    return Response.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UsageLimitError) return Response.json({ error: error.message, retryAt: error.retryAt }, { status: 429 });
    const inputError = error instanceof TypeError || error instanceof SyntaxError;
    const busy = error instanceof Error && error.message.includes("already in progress");
    const message = error instanceof Error && /^(OpenAI|The no-web|The role suggestions|A suggestion|The private suggestions)/.test(error.message) ? error.message : "The role suggestions could not be completed. Your saved preferences were not changed.";
    return Response.json({ error: inputError ? (error as Error).message : busy ? "Another workflow is active. Try suggestions after it finishes." : message }, { status: inputError ? 400 : busy ? 409 : 503 });
  }
}
