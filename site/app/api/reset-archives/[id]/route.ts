import { getChatGPTUser } from "@/app/chatgpt-auth";
import { deleteResetArchive, readResetArchive } from "@/lib/hosted/reset-archive";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to download a private recovery archive." }, { status: 401 });
  const { id } = await context.params;
  try {
    const result = await readResetArchive(user.userId, id);
    if (!result) return Response.json({ error: "This recovery archive was not found." }, { status: 404 });
    return new Response(result.bytes as BodyInit, { headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="internship-prep-reset-${id}.zip"`,
      "Content-Length": String(result.bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "This recovery archive could not be verified for download." }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to delete a private recovery archive." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The archive deletion request was rejected." }, { status: 403 });
  const { id } = await context.params;
  try {
    const raw = await request.text();
    if (raw.length > 100 || (JSON.parse(raw) as { confirmation?: unknown }).confirmation !== "DELETE") {
      throw new TypeError("Type DELETE exactly to remove this recovery archive permanently.");
    }
    const deleted = await deleteResetArchive(user.userId, id);
    if (!deleted) return Response.json({ error: "This recovery archive was not found." }, { status: 404 });
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "The recovery archive could not be deleted or verified. It remains listed if still present." }, { status: 503 });
  }
}
