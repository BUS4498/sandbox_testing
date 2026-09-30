import { getChatGPTUser } from "@/app/chatgpt-auth";
import { advanceResumableCollection } from "@/lib/hosted/collect-resumable";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to continue collection." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "The collection request was rejected." }, { status: 403 });
  }
  try {
    const run = await advanceResumableCollection(user.userId);
    return Response.json({ run }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The collection stage could not be checked. It remains saved for retry." }, { status: 503 });
  }
}
