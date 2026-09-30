import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { JEV_MODEL } from "@/lib/hosted/jev-rubric.js";
import { selectJevModel } from "@/lib/hosted/jev-model-access.js";

function result(status: string, detail: string, httpStatus = 200) {
  return Response.json({ status, detail }, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return result("SIGN_IN_REQUIRED", "Sign in to check the private Jev connection.", 401);
  const key = env.JEV_API_KEY?.trim();
  if (!key) return result("KEY_NOT_CONFIGURED", "The private TypeSafe key is not configured. Jev scoring is required for evidence-ready opportunities.");

  let response: Response;
  try {
    response = await fetch("https://api.typesafe.ai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return result("NETWORK_UNAVAILABLE", "TypeSafe could not be reached from the private Site. No score was requested.");
  }
  if (!response.ok) {
    if (response.status === 401) return result("KEY_REJECTED", "TypeSafe rejected the saved Jev key. No score was requested.");
    if (response.status === 403) return result("ACCESS_DENIED", "This TypeSafe account cannot list available models. Check its access settings; no score was requested.");
    if (response.status === 429) return result("PROVIDER_LIMIT", "TypeSafe temporarily limited the connection check. Try again later; no score was requested.");
    return result("PROVIDER_UNAVAILABLE", "The TypeSafe model-list check was unavailable. No score was requested.");
  }

  try {
    const selected = selectJevModel(await response.json(), JEV_MODEL);
    if (selected) return result("VERIFIED", `TypeSafe lists an available Jev model (${selected}). No student data or scoring request was sent.`);
    return result("MODEL_UNAVAILABLE", "TypeSafe did not list an available Jev model for this account. Check account access before collecting.");
  } catch { /* Use the same sanitized response for an unreadable provider reply. */ }
  return result("PROVIDER_UNAVAILABLE", "TypeSafe returned an unreadable model list. No score was requested.");
}
