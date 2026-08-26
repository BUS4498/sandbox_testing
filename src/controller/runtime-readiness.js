const READY_ACCOUNT_LABELS = Object.freeze({
  chatgpt: "ChatGPT managed sign-in",
  chatgptAuthTokens: "ChatGPT sign-in",
  apiKey: "Configured API credential",
  amazonBedrock: "Configured model provider",
});

export function publicRuntimeReadiness(result, { checkedAt = new Date().toISOString() } = {}) {
  const accountType = typeof result?.account?.type === "string" ? result.account.type : null;
  if (!result?.account && result?.requiresOpenaiAuth === true) {
    return {
      status: "AUTH_REQUIRED",
      label: "Codex sign-in required",
      detail: "Sign in through the local Codex application or CLI, then recheck readiness.",
      authentication: "Not signed in",
      checkedAt,
      diagnosticCode: null,
    };
  }

  if (result?.account || result?.requiresOpenaiAuth === false) {
    return {
      status: "READY",
      label: "Codex ready",
      detail: "The local Codex harness is available for Collect and targeted opportunity updates.",
      authentication: READY_ACCOUNT_LABELS[accountType] ?? "Configured runtime authentication",
      checkedAt,
      diagnosticCode: null,
    };
  }

  return {
    status: "UNKNOWN",
    label: "Codex readiness unknown",
    detail: "The local harness responded without a conclusive authentication state.",
    authentication: "Unknown",
    checkedAt,
    diagnosticCode: "INCONCLUSIVE_ACCOUNT_STATE",
  };
}

export function unavailableRuntimeReadiness(error, { checkedAt = new Date().toISOString() } = {}) {
  return {
    status: "UNAVAILABLE",
    label: "Codex unavailable",
    detail: "The local Codex harness could not be reached. Run the Codex readiness check, then try again.",
    authentication: "Unknown",
    checkedAt,
    diagnosticCode: safeDiagnosticCode(error?.code),
  };
}

function safeDiagnosticCode(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || null;
}
