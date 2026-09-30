import { getChatGPTUser } from "@/app/chatgpt-auth";
import { archiveAndReset, resetStorageReady } from "@/lib/hosted/reset-archive";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to reset your private collection." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The reset request was rejected." }, { status: 403 });
  if (!resetStorageReady()) return Response.json({ error: "Private archive storage is unavailable. Nothing was cleared." }, { status: 503 });
  try {
    const raw = await request.text();
    if (raw.length > 100) throw new TypeError("The reset confirmation is invalid.");
    const input = JSON.parse(raw) as { confirmation?: unknown };
    if (input.confirmation !== "RESET") throw new TypeError("Type RESET exactly to archive and clear the active collection.");
    const result = await archiveAndReset(user.userId);
    return Response.json({ result }, { status: result.retiredWordFilesPending ? 207 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reset could not be completed. Check the current collection and archive list.";
    const validation = error instanceof TypeError;
    const busy = message.includes("workflow is in progress");
    return Response.json({ error: validation || busy || message.includes("Nothing was cleared") ? message : "The reset could not be verified. Check the current collection and archive list before trying again." }, { status: validation ? 400 : busy ? 409 : 503 });
  }
}
