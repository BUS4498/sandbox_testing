import { getChatGPTUser } from "@/app/chatgpt-auth";
import { hasJevKey, scoreSavedOpportunity } from "@/lib/hosted/jev";
import { finishRun, getStudentSetup, listOpportunities, startRun, updateRun, UsageLimitError } from "@/lib/hosted/store";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to score your private collection." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "The scoring request was rejected." }, { status: 403 });
  if (!hasJevKey()) return Response.json({ error: "The private TypeSafe key is not configured. No scoring call was made." }, { status: 503 });
  const setup = await getStudentSetup(user.userId);
  if (!setup.ready) return Response.json({ error: "Confirm a student setup before scoring existing opportunities." }, { status: 409 });
  let run;
  try { run = await startRun(user.userId, "FIT_BACKFILL"); }
  catch (error) {
    if (error instanceof UsageLimitError) return Response.json({ error: error.message, retryAt: error.retryAt }, { status: 429 });
    return Response.json({ error: "Another workflow is active. Try again after it finishes." }, { status: 409 });
  }
  const summary = { examined: 0, providerCalls: 0, scored: 0, skipped: 0, failed: 0, notes: [] as string[] };
  try {
    const records = (await listOpportunities(user.userId)).slice(0, 5);
    for (const record of records) {
      summary.examined++;
      run.stage = "REASON";
      run.detail = `Checking evidence for ${record.company} — ${record.roleTitle}; no web search or application action.`;
      run.progress = Math.min(90, 10 + summary.examined * 16);
      await updateRun(user.userId, run);
      try {
        const outcome = await scoreSavedOpportunity(user.userId, record.opportunityId, setup, run.id);
        if (outcome.called) summary.providerCalls++;
        if (outcome.status === "SCORED") summary.scored++;
        else if (outcome.status === "FAILED") { summary.failed++; summary.notes.push(`${record.company} — ${record.roleTitle}: score unavailable after the provider attempt.`); }
        else { summary.skipped++; summary.notes.push(`${record.company} — ${record.roleTitle}: ${outcome.reason}`); }
      } catch {
        summary.failed++;
        summary.notes.push(`${record.company} — ${record.roleTitle}: scoring could not be verified.`);
      }
    }
    run.status = summary.failed ? "PARTIAL_SUCCESS" : "SUCCESS";
    run.stage = "FINISHED";
    run.detail = `${summary.scored} preliminary scores saved; ${summary.skipped} not eligible or already attempted; ${summary.failed} failed. No discovery search or email was used.`;
  } catch {
    run.status = "FAILURE";
    run.stage = "ACTION_REQUIRED";
    run.detail = "Existing opportunities could not be checked for scoring. No unverified score is shown.";
    run.errorCode = "FIT_BACKFILL_FAILURE";
  }
  run.progress = 100; run.finishedAt = new Date().toISOString(); run.summary = summary;
  await finishRun(user.userId, run);
  return Response.json({ run }, { headers: { "Cache-Control": "no-store" } });
}
