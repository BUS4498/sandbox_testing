import { getChatGPTUser } from "@/app/chatgpt-auth";
import { claimSiteOwner, OwnerVerificationError, ownerVerificationStatus } from "@/lib/hosted/store";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to verify the Site owner." }, { status: 401, headers: privateHeaders });
  try {
    return Response.json(await ownerVerificationStatus(user.userId), { headers: privateHeaders });
  } catch {
    return Response.json({ error: "Owner verification is temporarily unavailable." }, { status: 503, headers: privateHeaders });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to verify the Site owner." }, { status: 401, headers: privateHeaders });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "The verification request was rejected." }, { status: 403, headers: privateHeaders });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Send a verification code in JSON." }, { status: 415, headers: privateHeaders });
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 512) {
    return Response.json({ error: "The verification request is too large." }, { status: 413, headers: privateHeaders });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512) return Response.json({ error: "The verification request is too large." }, { status: 413, headers: privateHeaders });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Enter a valid verification code." }, { status: 400, headers: privateHeaders });
  }
  const code = body && typeof body === "object" && "code" in body ? (body as { code?: unknown }).code : null;
  if (typeof code !== "string" || code.length > 128) {
    return Response.json({ error: "Enter a valid verification code." }, { status: 400, headers: privateHeaders });
  }
  try {
    await claimSiteOwner(user.userId, code);
    return Response.json({ verified: true }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof OwnerVerificationError) {
      if (error.code === "NOT_CONFIGURED") return Response.json({ error: "The owner code has not been configured securely in Site settings." }, { status: 503, headers: privateHeaders });
      if (error.code === "LIMIT") return Response.json({ error: "Too many verification attempts for this account. Try again after the shown time.", retryAt: error.retryAt }, { status: 429, headers: privateHeaders });
      if (error.code === "ALREADY_CLAIMED") return Response.json({ error: "Owner verification is already assigned. Contact the Site owner for recovery." }, { status: 409, headers: privateHeaders });
      return Response.json({ error: "The code did not match. Check the private Site setting and try again." }, { status: 403, headers: privateHeaders });
    }
    return Response.json({ error: "Owner verification could not be completed. No owner access was granted." }, { status: 503, headers: privateHeaders });
  }
}
