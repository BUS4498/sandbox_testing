import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readWordMaterial } from "@/lib/hosted/materials-store";
import { getStudentSetup } from "@/lib/hosted/store";
import { materialMatchesSetup } from "@/lib/hosted/opportunity-state.js";
import { WORD_MIME } from "@/lib/hosted/word-drafts.js";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to download a private Word draft." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "This Word draft was not found." }, { status: 404 });
  try {
    const result = await readWordMaterial(user.userId, id);
    if (!result) return Response.json({ error: "This Word draft was not found." }, { status: 404 });
    if (result.metadata.type !== "INTERVIEW_PRACTICE") {
      const setup = await getStudentSetup(user.userId);
      if (!materialMatchesSetup(result.metadata, setup)) {
        return Response.json({ error: "This draft belongs to an earlier student setup. Prepare a new draft after reassessment." }, { status: 409 });
      }
    }
    return new Response(result.bytes as BodyInit, { headers: {
      "Content-Type": WORD_MIME,
      "Content-Disposition": `attachment; filename="${result.metadata.fileName}"`,
      "Content-Length": String(result.bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "This Word draft could not be verified for download. Try again later." }, { status: 503 });
  }
}
