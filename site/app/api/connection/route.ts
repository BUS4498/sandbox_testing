import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ status: "SIGN_IN_REQUIRED", detail: "Sign in to check the private connection." }, { status: 401 });
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) return Response.json({ status: "KEY_NOT_CONFIGURED", detail: "Add the OpenAI API key as a private Sites secret before collecting. No request was sent." });
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/models/gpt-5.6-luna", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
  } catch { return Response.json({ status: "NETWORK_UNAVAILABLE", detail: "OpenAI could not be reached from the private Site. No web search was performed." }); }
  if (response.ok) return Response.json({ status: "VERIFIED", detail: "The private key can access gpt-5.6-luna. This check generated no content and performed no web search." });
  const status = response.status === 401 ? "KEY_REJECTED" : response.status === 403 || response.status === 404 ? "MODEL_UNAVAILABLE" : response.status === 429 ? "PROVIDER_LIMIT" : "PROVIDER_UNAVAILABLE";
  return Response.json({ status, detail: `OpenAI connection check failed (${response.status}). No web search was performed.` });
}
