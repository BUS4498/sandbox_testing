import { getChatGPTUser } from "@/app/chatgpt-auth";
import { listResetArchives } from "@/lib/hosted/reset-archive";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to view private recovery archives." }, { status: 401 });
  try {
    return Response.json({ archives: await listResetArchives(user.userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Private recovery archives could not be listed." }, { status: 503 });
  }
}
