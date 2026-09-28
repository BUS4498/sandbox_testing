import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnvironment } from "../src/config/local-env.js";
import { OpenAIResponsesClient } from "../src/controller/openai-responses-client.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadLocalEnvironment(path.join(repositoryRoot, ".env"));

const client = new OpenAIResponsesClient({ workspaceRoot: repositoryRoot });
const readiness = await client.readiness();
process.stdout.write(`${readiness.label}\n${readiness.detail}\n`);
process.exitCode = readiness.status === "READY" ? 0 : 1;
