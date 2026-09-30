import { getChatGPTUser } from "@/app/chatgpt-auth";
import { hasJevKey } from "@/lib/hosted/jev";
import { hasHostedKey } from "@/lib/hosted/openai";
import { collectionAllowance, getStudentSetup, latestRun, listOpportunities, listStudentResponses } from "@/lib/hosted/store";
import { listMaterials, materialStorageReady } from "@/lib/hosted/materials-store";
import { listInterviewPractice } from "@/lib/hosted/interview-practice";
import { resetStorageReady } from "@/lib/hosted/reset-archive";
import { materialMatchesSetup } from "@/lib/hosted/opportunity-state.js";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to view the private collection." }, { status: 401 });
  try {
    const [run, opportunities, setup, studentResponses, materials, interviewPractice, collectAllowance] = await Promise.all([latestRun(user.userId), listOpportunities(user.userId), getStudentSetup(user.userId), listStudentResponses(user.userId), listMaterials(user.userId), listInterviewPractice(user.userId), collectionAllowance(user.userId)]);
    const currentSince = setup.confirmedAt ? Date.parse(setup.confirmedAt) : null;
    const currentResponses = studentResponses.filter((item) => currentSince === null || Date.parse(item.createdAt) >= currentSince);
    const currentMaterials = materials.filter((item) => item.type === "INTERVIEW_PRACTICE" || materialMatchesSetup(item, setup));
    return Response.json({ setup, keyConfigured: hasHostedKey(), jevConfigured: hasJevKey(), run, opportunities, studentResponses: currentResponses, materials: currentMaterials, interviewPractice, collectAllowance, capabilities: { realResume: true, email: false, wordDrafts: materialStorageReady(), interviewPractice: hasHostedKey() && materialStorageReady(), dailyRun: false, reset: resetStorageReady(), updateOpportunity: true, preliminaryFitScore: true } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Private collection storage is unavailable." }, { status: 503 });
  }
}
