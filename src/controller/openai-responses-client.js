import { access, readFile } from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";

import { MAX_DISCOVERY_SEARCHES } from "../workflow/workflow-limits.js";
import { WORKFLOW_RESULT_JSON_SCHEMA } from "../workflow/workflow-result-contract.js";
import { INTERVIEW_PRACTICE_SCHEMA, validateInterviewResult, verifyInterviewReports } from "./interview-practice-contract.js";

const APPROVED_SEARCH_DOMAINS = Object.freeze([
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "simplify.jobs",
  "github.com",
  "usajobs.gov",
  "calcareers.ca.gov",
  "builtin.com",
  "linkedin.com",
  "indeed.com",
  "wellfound.com",
]);
const SUPPORTED_REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "xhigh", "max"]);

export class OpenAIResponsesRuntimeError extends Error {
  constructor(message, code = "OPENAI_RUNTIME_ERROR", options) {
    super(message, options);
    this.name = "OpenAIResponsesRuntimeError";
    this.code = code;
  }
}

export class OpenAIResponsesClient {
  constructor({
    workspaceRoot = process.cwd(),
    apiKey = process.env.OPENAI_API_KEY,
    apiKeyFile = process.env.OPENAI_API_KEY_FILE,
    model = process.env.OPENAI_MODEL,
    reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "medium",
    clientFactory = (options) => new OpenAI(options),
  } = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.configuredApiKey = cleanOptional(apiKey);
    this.apiKeyFile = apiKeyFile
      ? path.resolve(this.workspaceRoot, apiKeyFile)
      : path.join(this.workspaceRoot, "api_key", "openai_api_key.txt");
    this.model = cleanOptional(model);
    this.reasoningEffort = cleanOptional(reasoningEffort).toLowerCase();
    if (!SUPPORTED_REASONING_EFFORTS.has(this.reasoningEffort)) {
      throw new TypeError(`Unsupported OpenAI reasoning effort: ${this.reasoningEffort || "empty"}.`);
    }
    this.clientFactory = clientFactory;
    this.client = null;
    this.apiKeySource = this.configuredApiKey ? "environment" : null;
    this.connectionReadiness = null;
  }

  async readiness({ checkedAt = new Date().toISOString(), force = false } = {}) {
    let key;
    try {
      key = await this.#resolveApiKey();
    } catch (error) {
      return readiness(
        error?.code || "KEY_FILE_ERROR",
        "OpenAI API key configuration needs attention",
        "The ignored API key file exists but could not be parsed. Use one key or one OPENAI_API_KEY assignment, then recheck.",
        "Not configured",
        checkedAt,
      );
    }
    if (!key) {
      return readiness(
        "KEY_MISSING",
        "OpenAI API key required",
        "Set OPENAI_API_KEY or configure an ignored OPENAI_API_KEY_FILE, then recheck readiness.",
        "Not configured",
        checkedAt,
      );
    }
    if (!this.model) {
      return readiness(
        "MODEL_MISSING",
        "OpenAI API model required",
        "Set OPENAI_MODEL to the approved API model ID, then recheck readiness.",
        "API key configured",
        checkedAt,
      );
    }
    if (this.connectionReadiness && !force) return this.connectionReadiness;
    try {
      const client = await this.#client();
      if (typeof client?.models?.retrieve !== "function") {
        throw new OpenAIResponsesRuntimeError("The OpenAI client cannot validate model access.", "OPENAI_VALIDATION_UNAVAILABLE");
      }
      const model = await client.models.retrieve(this.model);
      if (String(model?.id ?? "") !== this.model) {
        throw new OpenAIResponsesRuntimeError("The configured OpenAI model could not be verified.", "OPENAI_MODEL_ACCESS_FAILED");
      }
      this.connectionReadiness = readiness(
        "READY",
        "OpenAI connection verified",
        `The configured key can access ${this.model} with ${this.reasoningEffort} reasoning. This non-billable check generated no content and performed no web search.`,
        `Verified locally (${this.apiKeySource})`,
        checkedAt,
      );
    } catch (error) {
      this.connectionReadiness = providerReadiness(error, checkedAt, this.apiKeySource);
    }
    return this.connectionReadiness;
  }

  async validateConnection({ checkedAt = new Date().toISOString() } = {}) {
    return this.readiness({ checkedAt, force: true });
  }

  async runWorkflow({ input, allowWebSearch = false, onEvent = () => {} } = {}) {
    if (!input || typeof input !== "string") throw new TypeError("A task-scoped workflow input is required.");
    const client = await this.#client();
    onEvent({ type: "request.started", allowWebSearch });
    let response;
    try {
      response = await client.responses.create({
        model: this.model,
        input,
        reasoning: { effort: this.reasoningEffort },
        text: {
          format: {
            type: "json_schema",
            name: "internship_workflow_result",
            strict: true,
            schema: WORKFLOW_RESULT_JSON_SCHEMA,
          },
        },
        ...(allowWebSearch
          ? {
              tools: [{
                type: "web_search",
                search_context_size: "low",
                filters: { allowed_domains: [...APPROVED_SEARCH_DOMAINS] },
              }],
              tool_choice: "auto",
              max_tool_calls: MAX_DISCOVERY_SEARCHES,
              include: ["web_search_call.action.sources"],
            }
          : {}),
      });
    } catch (cause) {
      throw normalizeProviderError(cause);
    }

    const searchesPerformed = countWebSearchCalls(response?.output);
    const sources = collectSources(response?.output);
    const outputText = String(response?.output_text ?? "").trim();
    if (!outputText) {
      throw new OpenAIResponsesRuntimeError("The OpenAI API returned no structured workflow result.", "MISSING_RESULT");
    }
    onEvent({
      type: "response.completed",
      responseId: safeIdentifier(response?.id),
      searchesPerformed,
      sourceCount: sources.length,
    });
    return {
      outputText,
      responseId: safeIdentifier(response?.id),
      searchesPerformed,
      sources,
    };
  }

  async runInterviewResearch({ company, roleTitle, location, postingUrl } = {}) {
    if (!company || !roleTitle) throw new TypeError("A company and role are required for interview practice.");
    const client = await this.#client();
    const publicPosting = { company, roleTitle, location: location || "Unknown", postingUrl: postingUrl || "Unknown" };
    const searchTheme = async (theme) => {
      const focus = theme === "QUESTIONS"
        ? "Search ONCE for candidate-reported questions actually asked for this employer and role. Fill reportedQuestions and likelyQuestions; leave process arrays empty."
        : "Search ONCE for candidate-reported interview stages, format, assessments, or employer-published process guidance for this employer and role. Fill reportedProcess and generalProcessGuidance; leave question arrays empty. Candidate accounts are not employer policy.";
      const input = `${focus} Use one focused web-search query and cite accessible public candidate accounts, YouTube descriptions or transcripts, or employer-authorized pages. A snippet or inaccessible video is not proof. For each reported item, include an exact source quote of at most 180 characters. Mark exact versus related roles. Do not invent rounds, timing, or questions. Search with no student name, resume, profile, email, or private information. Return JSON only.\n${JSON.stringify(publicPosting)}`;
      let response;
      try {
        response = await client.responses.create({ model: this.model, input, reasoning: { effort: this.reasoningEffort },
          text: { format: { type: "json_schema", name: "interview_practice_result", strict: true, schema: INTERVIEW_PRACTICE_SCHEMA } },
          tools: [{ type: "web_search", search_context_size: "low" }], tool_choice: "required", max_tool_calls: 1, include: ["web_search_call.action.sources"],
        });
      } catch (cause) { throw normalizeProviderError(cause); }
      if (response?.status !== "completed") throw new OpenAIResponsesRuntimeError(`${theme} interview research did not complete. No new practice set was saved.`, "INTERVIEW_INCOMPLETE");
      const count = countWebSearchCalls(response?.output);
      if (count < 1 || count > 2) throw new OpenAIResponsesRuntimeError(`${theme} interview research did not stay within its search budget.`, "INTERVIEW_BUDGET_EXCEEDED");
      return { text: response.output_text, urls: collectSources(response.output).map((item) => item.url), count, responseId: safeIdentifier(response?.id) };
    };
    const questions = await searchTheme("QUESTIONS");
    const process = await searchTheme("PROCESS");
    const searchesPerformed = questions.count + process.count;
    if (searchesPerformed > 3) throw new OpenAIResponsesRuntimeError("Interview research exceeded its three-search limit.", "INTERVIEW_BUDGET_EXCEEDED");
    let result;
    try {
      const questionResult = validateInterviewResult(questions.text, questions.urls);
      const processResult = validateInterviewResult(process.text, process.urls);
      result = { reportedQuestions: questionResult.reportedQuestions, reportedProcess: processResult.reportedProcess,
        likelyQuestions: questionResult.likelyQuestions, generalProcessGuidance: processResult.generalProcessGuidance,
        searchNotes: [questionResult.searchNotes, processResult.searchNotes].filter(Boolean).join(" ") };
      result = await verifyInterviewReports(result, { company, roleTitle });
    } catch { throw new OpenAIResponsesRuntimeError("Interview research did not pass source and structure checks.", "INTERVIEW_VALIDATION_FAILED"); }
    if (!result.reportedQuestions.length && !result.likelyQuestions.length) result.likelyQuestions = [
      `Why are you interested in the ${roleTitle} internship at ${company}?`,
      `How would you identify and document business requirements for this ${roleTitle} role?`,
      "Describe a project where you analyzed information and explained your recommendation.",
      "How would you check whether a process or system improvement is working?",
      "What would you do if you lacked a skill needed for an internship assignment?",
    ];
    // Do not repackage unverified source claims as generic process guidance.
    result.generalProcessGuidance = [
      "An introductory conversation, a discussion of role-related work, and time for your questions are possibilities—not this employer's confirmed stages.",
      "Ask the recruiter to confirm the actual format, stages, assessments, and timing.",
    ];
    return { ...result, searchesPerformed, sourcesInspected: result.sourcesInspected, responseId: [questions.responseId, process.responseId].filter(Boolean).join(",") };
  }

  async close() {}

  async #client() {
    if (this.client) return this.client;
    const apiKey = await this.#resolveApiKey();
    if (!apiKey) throw new OpenAIResponsesRuntimeError("The OpenAI API key is not configured.", "OPENAI_KEY_MISSING");
    if (!this.model) throw new OpenAIResponsesRuntimeError("The OpenAI API model is not configured.", "OPENAI_MODEL_MISSING");
    this.client = this.clientFactory({ apiKey });
    return this.client;
  }

  async #resolveApiKey() {
    if (this.configuredApiKey) return this.configuredApiKey;
    try {
      await access(this.apiKeyFile);
      const content = await readFile(this.apiKeyFile, "utf8");
      const parsed = parseSecretFile(content);
      if (parsed) {
        this.configuredApiKey = parsed;
        this.apiKeySource = "ignored secret file";
      }
      return parsed;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw new OpenAIResponsesRuntimeError("The configured API key file could not be read.", "OPENAI_KEY_FILE_ERROR", { cause: error });
    }
  }
}

export function countWebSearchCalls(output) {
  if (!Array.isArray(output)) return 0;
  return output.reduce((total, item) => {
    if (String(item?.type ?? "").toLowerCase() !== "web_search_call") return total;
    const actionType = String(item?.action?.type ?? "").toLowerCase();
    if (actionType && actionType !== "search") return total;
    return total + 1;
  }, 0);
}

export function collectSources(output) {
  const urls = new Map();
  for (const item of Array.isArray(output) ? output : []) {
    if (String(item?.type ?? "").toLowerCase() !== "web_search_call") continue;
    const sources = item?.action?.sources;
    for (const source of Array.isArray(sources) ? sources : []) {
      const url = cleanOptional(source?.url);
      if (!url || urls.has(url)) continue;
      urls.set(url, { url, title: cleanOptional(source?.title) || null });
    }
  }
  return [...urls.values()].slice(0, 100);
}

function parseSecretFile(content) {
  const lines = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length !== 1) {
    throw new OpenAIResponsesRuntimeError(
      "The API key file must contain exactly one key or one OPENAI_API_KEY assignment.",
      "OPENAI_KEY_FILE_INVALID",
    );
  }
  const assignment = lines[0].match(/^OPENAI_API_KEY\s*[:=]\s*(.+)$/i);
  const raw = assignment ? assignment[1] : lines[0];
  const value = raw.replace(/^['"]|['"]$/g, "").trim();
  if (value.length < 20 || /\s/.test(value)) {
    throw new OpenAIResponsesRuntimeError("The API key file does not contain a usable key.", "OPENAI_KEY_FILE_INVALID");
  }
  return value;
}

function normalizeProviderError(error) {
  const status = Number(error?.status);
  const code = status === 401
    ? "OPENAI_AUTH_FAILED"
    : status === 429
      ? "OPENAI_RATE_LIMITED"
      : status >= 500
        ? "OPENAI_UNAVAILABLE"
        : status === 400
          ? "OPENAI_INVALID_REQUEST"
          : "OPENAI_REQUEST_FAILED";
  const messages = {
    OPENAI_AUTH_FAILED: "The OpenAI API rejected the configured key.",
    OPENAI_RATE_LIMITED: "The OpenAI API rate or usage limit was reached.",
    OPENAI_UNAVAILABLE: "The OpenAI API is temporarily unavailable.",
    OPENAI_INVALID_REQUEST: "The OpenAI API rejected the request configuration.",
    OPENAI_REQUEST_FAILED: "The OpenAI API request could not be completed.",
  };
  const normalized = new OpenAIResponsesRuntimeError(messages[code], code, { cause: error });
  normalized.providerStatus = Number.isFinite(status) ? status : null;
  normalized.providerParam = safeProviderField(error?.param);
  normalized.providerType = safeProviderField(error?.type);
  return normalized;
}

function providerReadiness(error, checkedAt, apiKeySource) {
  const status = Number(error?.status ?? error?.cause?.status);
  const providerCode = String(error?.code ?? error?.cause?.code ?? "").toLowerCase();
  if (status === 401 || providerCode === "invalid_api_key") {
    return readiness("AUTH_FAILED", "OpenAI API key rejected", "Replace the invalid or revoked local API key, restart the app, and check the connection again.", `Configured locally (${apiKeySource || "unknown source"})`, checkedAt);
  }
  if ([403, 404].includes(status) || providerCode === "model_not_found" || error?.code === "OPENAI_MODEL_ACCESS_FAILED") {
    return readiness("MODEL_ACCESS_FAILED", "Configured model unavailable", "The API key cannot access the configured model. Check the model ID, project, organization, and key permissions.", "API key reached OpenAI", checkedAt);
  }
  if (status === 429) {
    const quota = /quota|credit|billing|balance/i.test(String(error?.message ?? error?.cause?.message ?? ""));
    return readiness(quota ? "QUOTA_EXHAUSTED" : "RATE_LIMITED", quota ? "OpenAI API quota unavailable" : "OpenAI API rate limit reached", quota ? "Check API billing and usage limits before retrying." : "Wait briefly, then check the connection again.", "API key reached OpenAI", checkedAt);
  }
  if (status >= 500) {
    return readiness("UNAVAILABLE", "OpenAI temporarily unavailable", "The provider returned a temporary service failure. Check the connection again later.", "API key reached OpenAI", checkedAt);
  }
  return readiness("NETWORK_UNAVAILABLE", "OpenAI connection unavailable", "The local app could not reach OpenAI. Check the internet connection, firewall, or local network restrictions, then try again.", `Configured locally (${apiKeySource || "unknown source"})`, checkedAt);
}

function readiness(status, label, detail, authentication, checkedAt) {
  return { status, label, detail, authentication, checkedAt, diagnosticCode: status === "READY" ? null : status };
}

function cleanOptional(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safeIdentifier(value) {
  if (!value) return null;
  return String(value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 160) || null;
}

function safeProviderField(value) {
  if (!value) return null;
  return String(value).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 120) || null;
}
