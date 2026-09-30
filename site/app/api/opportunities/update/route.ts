import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getStudentResponse, getStudentSetup, saveStudentResponse, UsageLimitError } from "@/lib/hosted/store";
import { processTargetedResponse } from "@/lib/hosted/targeted-update";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to update an opportunity." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The update request was rejected." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4_000) return Response.json({ error: "Keep the opportunity response concise." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    const setup = await getStudentSetup(user.userId);
    if (!setup.ready) return Response.json({ error: "Confirm student setup before updating an opportunity." }, { status: 409 });
    let response;
    if (body.action === "SAVE_AND_UPDATE") response = await saveStudentResponse(user.userId, body);
    else if (body.action === "RETRY" && typeof body.responseId === "string") response = await getStudentResponse(user.userId, body.responseId);
    else return Response.json({ error: "Choose Save and Update or retry the saved response." }, { status: 400 });
    if (!response) return Response.json({ error: "The saved response was not found." }, { status: 404 });
    if (response.status === "COMPLETE") return Response.json({ error: "This response was already processed. Review the current opportunity." }, { status: 409 });
    if (body.action === "RETRY" && body.opportunityId !== response.opportunityId) {
      return Response.json({ error: "The saved response belongs to a different opportunity." }, { status: 400 });
    }
    try {
      const run = await processTargetedResponse(user.userId, response.id);
      return Response.json({ responseId: response.id, run, pending: run.status !== "SUCCESS" }, {
        status: run.status === "SUCCESS" ? 200 : 202, headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (error instanceof UsageLimitError) return Response.json({ responseId: response.id, pending: true, error: error.message, retryAt: error.retryAt }, { status: 429, headers: { "Cache-Control": "no-store" } });
      const busy = error instanceof Error && error.message.includes("already in progress");
      return Response.json({ responseId: response.id, pending: true, error: busy ? "Another workflow is active. Your answer was saved. Select Update Opportunity to retry when it finishes." : error instanceof Error ? error.message : "Your answer was saved but could not be processed. Retry this opportunity." }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    const inputError = error instanceof TypeError || error instanceof SyntaxError;
    return Response.json({ error: inputError && error instanceof Error ? error.message : "The response could not be saved or verified. Nothing was reported as processed." }, { status: inputError ? 400 : 503 });
  }
}
