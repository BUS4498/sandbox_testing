import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectSources, countWebSearchCalls, OpenAIResponsesClient } from "../src/controller/openai-responses-client.js";

test("readiness verifies configured model access without making a generation request", async () => {
  let modelChecks = 0;
  const client = new OpenAIResponsesClient({
    apiKey: "sk-synthetic-key-with-enough-characters",
    model: "approved-model-id",
    clientFactory: () => ({
      models: { retrieve: async (model) => { modelChecks += 1; return { id: model }; } },
      responses: { create: async () => { throw new Error("Generation must not run during readiness."); } },
    }),
  });
  const readiness = await client.readiness({ checkedAt: "2026-09-25T12:00:00.000Z" });
  assert.equal(readiness.status, "READY");
  assert.match(readiness.detail, /approved-model-id with medium reasoning/);
  assert.match(readiness.detail, /generated no content/);
  assert.equal(modelChecks, 1);
  await client.readiness();
  assert.equal(modelChecks, 1);
  assert.doesNotMatch(JSON.stringify(readiness), /synthetic-key/);
});

test("reads an ignored one-line key file without exposing its value", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openai-config-test-"));
  try {
    await mkdir(path.join(root, "api_key"));
    await writeFile(path.join(root, "api_key", "openai_api_key.txt"), "OPENAI_API_KEY=sk-synthetic-file-key-123456789\n");
    const client = new OpenAIResponsesClient({ workspaceRoot: root, apiKey: "", model: "approved-model-id", clientFactory: () => ({ models: { retrieve: async (model) => ({ id: model }) } }) });
    const readiness = await client.readiness();
    assert.equal(readiness.status, "READY");
    assert.match(readiness.authentication, /ignored secret file/);
    assert.doesNotMatch(JSON.stringify(readiness), /synthetic-file-key/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("accepts a protected key file with spaces around the assignment", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openai-config-test-"));
  try {
    await mkdir(path.join(root, "api_key"));
    await writeFile(path.join(root, "api_key", "openai_api_key.txt"), "OPENAI_API_KEY = sk-synthetic-file-key-123456789\n");
    const client = new OpenAIResponsesClient({ workspaceRoot: root, apiKey: "", model: "approved-model-id", clientFactory: () => ({ models: { retrieve: async (model) => ({ id: model }) } }) });
    assert.equal((await client.readiness()).status, "READY");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("connection validation returns a safe actionable authentication failure", async () => {
  const error = Object.assign(new Error("Incorrect API key provided: secret-value"), { status: 401, code: "invalid_api_key" });
  const client = new OpenAIResponsesClient({
    apiKey: "sk-synthetic-key-with-enough-characters",
    model: "approved-model-id",
    clientFactory: () => ({ models: { retrieve: async () => { throw error; } } }),
  });
  const readiness = await client.validateConnection();
  assert.equal(readiness.status, "AUTH_FAILED");
  assert.match(readiness.detail, /Replace the invalid or revoked local API key/);
  assert.doesNotMatch(JSON.stringify(readiness), /secret-value|sk-synthetic/);
});

test("discovery uses the Responses web-search tool and returns sanitized metadata", async () => {
  let request;
  const client = new OpenAIResponsesClient({
    apiKey: "sk-synthetic-key-with-enough-characters",
    model: "approved-model-id",
    clientFactory: () => ({ responses: { create: async (value) => {
      request = value;
      return {
        id: "resp_test-1",
        output_text: "{\"schemaVersion\":1}",
        output: [{ type: "web_search_call", action: { sources: [{ url: "https://example.com/job", title: "Job" }] } }],
      };
    } } }),
  });
  const result = await client.runWorkflow({ input: "bounded task", allowWebSearch: true });
  assert.equal(request.model, "approved-model-id");
  assert.deepEqual(request.reasoning, { effort: "medium" });
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.name, "internship_workflow_result");
  assert.equal(request.text.format.strict, true);
  assert.deepEqual(request.text.format.schema.required, ["schemaVersion", "runSummary", "selectedOpportunities", "unresolvedIssues"]);
  assert.equal(request.text.format.schema.additionalProperties, false);
  assert.equal(request.text.format.schema.properties.selectedOpportunities.items.additionalProperties, false);
  assert.equal(request.tools[0].type, "web_search");
  assert.equal(request.tools[0].search_context_size, "low");
  assert.equal(request.max_tool_calls, 6);
  assert.ok(request.tools[0].filters.allowed_domains.includes("simplify.jobs"));
  assert.equal(result.searchesPerformed, 1);
  assert.deepEqual(result.sources, [{ url: "https://example.com/job", title: "Job" }]);
});

test("uses the configured supported reasoning effort", async () => {
  let request;
  const client = new OpenAIResponsesClient({
    apiKey: "sk-synthetic-key-with-enough-characters",
    model: "gpt-6-luna",
    reasoningEffort: "high",
    clientFactory: () => ({ responses: { create: async (value) => {
      request = value;
      return { id: "resp_reasoning", output_text: "{\"schemaVersion\":1}", output: [] };
    } } }),
  });
  await client.runWorkflow({ input: "bounded task" });
  assert.deepEqual(request.reasoning, { effort: "high" });
  assert.throws(
    () => new OpenAIResponsesClient({ apiKey: "sk-synthetic-key-with-enough-characters", model: "gpt-6-luna", reasoningEffort: "extreme" }),
    /Unsupported OpenAI reasoning effort/,
  );
});

test("counts hosted search calls once without counting query variants or posting-page validation", () => {
  const output = [
    {
      type: "web_search_call",
      action: {
        type: "search",
        queries: ["business analyst internship", "AI systems analyst internship", "technology consulting internship"],
        sources: [{ url: "https://example.com/a" }, { url: "https://example.com/a" }],
      },
    },
    { type: "web_search_call", action: { type: "open_page", url: "https://example.com/a" } },
    { type: "web_search_call", action: { type: "find_in_page", pattern: "qualifications" } },
    { type: "message" },
  ];
  assert.equal(countWebSearchCalls(output), 1);
  assert.equal(collectSources(output).length, 1);
});

test("counts separate hosted search actions toward the six-call budget", () => {
  const output = Array.from({ length: 6 }, (_, index) => ({
    type: "web_search_call",
    action: { type: "search", queries: [`query-${index}-a`, `query-${index}-b`] },
  }));
  assert.equal(countWebSearchCalls(output), 6);
});

test("counts a legacy search action without query metadata as one search", () => {
  assert.equal(countWebSearchCalls([{ type: "web_search_call", action: {} }]), 1);
});

test("normalizes an invalid provider request without exposing the provider message", async () => {
  const providerError = Object.assign(new Error("Unsafe raw provider detail"), {
    status: 400,
    type: "invalid_request_error",
    param: "response_format",
  });
  const client = new OpenAIResponsesClient({
    apiKey: "sk-synthetic-key-with-enough-characters",
    model: "approved-model-id",
    clientFactory: () => ({ responses: { create: async () => { throw providerError; } } }),
  });
  await assert.rejects(
    client.runWorkflow({ input: "bounded task" }),
    (error) => {
      assert.equal(error.code, "OPENAI_INVALID_REQUEST");
      assert.equal(error.message, "The OpenAI API rejected the request configuration.");
      assert.equal(error.providerStatus, 400);
      assert.equal(error.providerType, "invalid_request_error");
      assert.equal(error.providerParam, "response_format");
      assert.doesNotMatch(error.message, /Unsafe raw provider detail/);
      return true;
    },
  );
});
