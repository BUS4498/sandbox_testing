import { getChatGPTUser } from "@/app/chatgpt-auth";
import { deleteOriginalResume, readOriginalResume, resumeStatus, saveOriginalResume } from "@/lib/hosted/resume-storage";
import { getStudentSetup, latestRun } from "@/lib/hosted/store";

async function owner(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (request.headers.get("origin") !== new URL(request.url).origin && request.method !== "GET") return null;
  return user.userId;
}

export async function GET(request: Request) {
  const ownerId = await owner(request);
  if (!ownerId) return Response.json({ error: "Sign in to view resume status." }, { status: 401 });
  if (new URL(request.url).searchParams.get("download") === "1") {
    const original = await readOriginalResume(ownerId);
    if (!original) return Response.json({ error: "No original resume is stored." }, { status: 404 });
    return new Response(original.bytes, { headers: { "Content-Type": original.contentType, "Content-Disposition": `attachment; filename="${original.fileName.replace(/[";\\]/g, "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  return Response.json(await resumeStatus(ownerId), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ownerId = await owner(request);
  if (!ownerId) return Response.json({ error: "Sign in to save an original resume." }, { status: 401 });
  try {
    if ((await latestRun(ownerId))?.status === "IN_PROGRESS") return Response.json({ error: "Wait for the active run before changing your resume." }, { status: 409 });
    if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 5_300_000) return Response.json({ error: "Resume is too large." }, { status: 413 });
    const setup = await getStudentSetup(ownerId);
    if (setup.mode !== "REAL" || !setup.ready) return Response.json({ error: "Confirm the real-student setup before retaining an original resume." }, { status: 409 });
    const form = await request.formData();
    if (form.get("retainOriginal") !== "YES" || !(form.get("resume") instanceof File)) return Response.json({ error: "Choose a resume and explicitly approve private retention." }, { status: 400 });
    const status = await saveOriginalResume(ownerId, form.get("resume") as File);
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof TypeError ? error.message : "The original resume could not be stored and verified." }, { status: error instanceof TypeError ? 400 : 503 });
  }
}

export async function DELETE(request: Request) {
  const ownerId = await owner(request);
  if (!ownerId) return Response.json({ error: "Sign in to delete the original resume." }, { status: 401 });
  if ((await latestRun(ownerId))?.status === "IN_PROGRESS") return Response.json({ error: "Wait for the active run before deleting your resume." }, { status: 409 });
  if (request.headers.get("x-confirm-delete") !== "DELETE") return Response.json({ error: "Confirm deletion first." }, { status: 400 });
  await deleteOriginalResume(ownerId);
  return Response.json({ stored: false }, { headers: { "Cache-Control": "no-store" } });
}
