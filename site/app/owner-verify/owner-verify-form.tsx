"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type VerificationStatus = { verified: boolean; pairingReady: boolean; error?: string };

export default function OwnerVerifyForm() {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let current = true;
    void fetch("/api/owner-verification", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as VerificationStatus;
        if (!response.ok) throw new Error(result.error || "Verification status is unavailable.");
        if (current) setStatus(result);
      })
      .catch((error: unknown) => {
        if (current) setMessage(error instanceof Error ? error.message : "Verification status is unavailable.");
      });
    return () => { current = false; };
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/owner-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json() as { verified?: boolean; error?: string; retryAt?: string | null };
      if (!response.ok) throw new Error(`${result.error || "Verification could not be completed."}${result.retryAt ? ` Try again after ${new Date(result.retryAt).toLocaleString()}.` : ""}`);
      setCode("");
      setStatus({ verified: true, pairingReady: true });
      setMessage("Owner account verified. Your Collect starts are now unlimited; provider usage may still incur charges.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="owner-verify-page">
    <Link className="owner-verify-back" href="/">← Back to Internship Prep Desk</Link>
    <section className="owner-verify-card" aria-labelledby="owner-verify-title">
      <p className="eyebrow">SITE ADMINISTRATION</p>
      <h1 id="owner-verify-title">Verify the Site owner</h1>
      <p>This one-time step links your signed-in ChatGPT account to the owner role. It does not start a Collect run or access student profiles.</p>
      {status?.verified ? <p className="owner-verify-success" role="status">This account is verified. Owner Collect starts have no daily limit. The one-active-run rule and each run’s search limits still apply.</p>
        : <>
          <p>First set <code>SITE_OWNER_PAIRING_CODE</code> as a private Site environment variable, using a randomly generated URL-safe code of 32–128 characters. Do not place it in GitHub or chat. Then enter that code below while signed into your own account.</p>
          {status && !status.pairingReady && <p className="owner-verify-warning" role="status">The private owner code is not configured yet. The student Collect limits remain in force.</p>}
          <form onSubmit={verify}>
            <label htmlFor="owner-code">Private owner verification code</label>
            <input id="owner-code" type="password" autoComplete="off" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} minLength={32} maxLength={128} required disabled={busy || !status?.pairingReady} />
            <button type="submit" disabled={busy || !status?.pairingReady || code.length < 32}>{busy ? "Verifying…" : "Verify my account"}</button>
          </form>
          <small>Five attempts per signed-in account are allowed within 24 hours. Only one account can claim the owner role.</small>
        </>}
      {message && <p className={status?.verified ? "owner-verify-success" : "owner-verify-warning"} role={status?.verified ? "status" : "alert"}>{message}</p>}
    </section>
  </main>;
}
