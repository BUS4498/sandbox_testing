import { fileURLToPath } from "node:url";

import { CodexAppServerClient } from "../src/controller/index.js";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const client = new CodexAppServerClient({ cwd: repositoryRoot });
const stderr = [];

client.on("stderr", (chunk) => stderr.push(chunk));

try {
  const result = await client.initialize();
  const platform = [result?.platformFamily, result?.platformOs]
    .filter(Boolean)
    .join(" / ");

  console.log("Codex App Server handshake succeeded.");
  if (platform) {
    console.log(`Runtime platform: ${platform}`);
  }
  const accountResult = await client.readAccount();
  const authenticationReady = Boolean(accountResult?.account) || accountResult?.requiresOpenaiAuth === false;
  console.log(`Authentication ready: ${authenticationReady ? "yes" : "no"}.`);
  if (accountResult?.account?.type) {
    console.log(`Authentication mode: ${publicAuthenticationMode(accountResult.account.type)}.`);
  }
  if (!authenticationReady) {
    throw new Error("Codex App Server is running, but no usable local authentication is available.");
  }
  console.log("No thread, model turn, web search, or external action was started.");
} catch (error) {
  console.error(`Codex App Server handshake failed: ${error.message}`);
  if (error.cause?.code) {
    console.error(`Launch error: ${error.cause.code}`);
  }
  if (error.cause?.code === "ENOENT") {
    console.error("Ensure the Codex CLI is installed and available on PATH.");
  }
  if (["EACCES", "EPERM"].includes(error.cause?.code)) {
    console.error(
      "The current process cannot execute the configured Codex binary. " +
        "Use an accessible Codex CLI installation or set CODEX_BINARY for this shell.",
    );
  }
  const diagnostic = stderr.join("").trim();
  if (diagnostic) {
    console.error(diagnostic);
  }
  process.exitCode = 1;
} finally {
  await client.close();
}

function publicAuthenticationMode(value) {
  const normalized = String(value).toLowerCase();
  const labels = {
    chatgpt: "ChatGPT managed sign-in",
    apikey: "API key",
    amazonbedrock: "Amazon Bedrock",
  };
  return labels[normalized] ?? "configured provider";
}
