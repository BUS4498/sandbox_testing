import { getChatGPTUser } from "@/app/chatgpt-auth";
import { chooseStudentSetupMode, deletePrivateStudentProfile, latestRun, saveRealStudentSetup } from "@/lib/hosted/store";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to change student setup." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The setup request was rejected." }, { status: 403 });
  try {
    const running = await latestRun(user.userId);
    if (running?.status === "IN_PROGRESS") return Response.json({ error: "Wait for the active collection run before changing student setup." }, { status: 409 });
    const raw = await request.text();
    if (raw.length > 64_000) return Response.json({ error: "The reviewed profile is too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    let setup;
    if (body.action === "SAVE_REAL") setup = await saveRealStudentSetup(user.userId, body);
    else if (body.action === "USE_DEMO") setup = await chooseStudentSetupMode(user.userId, "SYNTHETIC_DEMONSTRATION");
    else if (body.action === "USE_REAL") setup = await chooseStudentSetupMode(user.userId, "REAL");
    else if (body.action === "DELETE_REAL" && body.confirmation === "DELETE") setup = await deletePrivateStudentProfile(user.userId);
    else return Response.json({ error: "Choose a supported student-setup action." }, { status: 400 });
    return Response.json({ setup }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const inputError = error instanceof TypeError || error instanceof SyntaxError;
    return Response.json({ error: inputError && error instanceof Error ? error.message : "The private setup could not be saved or verified. Your current setup was not reported as changed." }, { status: inputError ? 400 : 503 });
  }
}
