import { env } from "cloudflare:workers";
import { WORKFLOW_RESULT_JSON_SCHEMA, WorkflowResultValidationError, parseAndValidateWorkflowResult } from "./specs/workflow-result-contract.js";
import { applyObservedSearchCount, observedSearchActionCount } from "./search-activity.js";
import { canonicalUrl } from "./store";
import { TARGETED_UPDATE_JSON_SCHEMA, validateTargetedUpdate } from "./targeted-update-contract.js";
import { INTERVIEW_PRACTICE_SCHEMA, validateInterviewPractice, verifyReportedQuestions } from "./interview-practice-contract.js";
import { PRIVATE_ASSESSMENT_JSON_SCHEMA, mergePrivateAssessment } from "./private-assessment-contract.js";
import { OPENAI_MODEL, OPENAI_REASONING_EFFORT } from "./openai-model";

const MAX_SEARCHES = 10;
// Approved discovery sites plus employer-authorized application systems linked
// from those sources. These extra domains are for verification, not new boards.
const APPROVED_DOMAINS = ["greenhouse.io", "lever.co", "ashbyhq.com", "myworkdayjobs.com", "lifeattiktok.com", "eightfold.ai", "oraclecloud.com", "smartrecruiters.com", "simplify.jobs", "github.com", "usajobs.gov", "calcareers.ca.gov", "builtin.com", "linkedin.com", "indeed.com", "wellfound.com"];

export type ValidatedResult = ReturnType<typeof parseAndValidateWorkflowResult>;
type ScopedSelection = { updateDisposition: string; existingOpportunityId: string | null; opportunity: Record<string, unknown>; applicationPrep: { status: string } };

export function hasHostedKey(): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

function sourceUrls(output: unknown[]): string[] {
  const urls = new Set<string>();
  for (const raw of output) {
    const item = raw as Record<string, unknown>;
    const action = item.action as Record<string, unknown> | undefined;
    const sources = action?.sources;
    if (Array.isArray(sources)) for (const source of sources) {
      const url = (source as Record<string, unknown>).url;
      if (typeof url === "string") try { urls.add(canonicalUrl(url)); } catch { /* Ignore malformed source. */ }
    }
    const content = item.content;
    if (Array.isArray(content)) for (const block of content) {
      const annotations = (block as Record<string, unknown>).annotations;
      if (Array.isArray(annotations)) for (const annotation of annotations) {
        const url = (annotation as Record<string, unknown>).url;
        if (typeof url === "string") try { urls.add(canonicalUrl(url)); } catch { /* Ignore malformed citation. */ }
      }
    }
  }
  return [...urls];
}

function messageText(output: unknown[]): string {
  return output.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    if (item.type !== "message" || !Array.isArray(item.content)) return [];
    return item.content.map((part) => {
      const block = part as Record<string, unknown>;
      return block.type === "output_text" && typeof block.text === "string" ? block.text : "";
    });
  }).join("").trim();
}

export class HostedOpenAIError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

export type InterviewPracticeResult = {
  reportedQuestions: { question: string; sourceUrl: string; sourceName: string; sourceDate: string; roleMatch: "EXACT_ROLE" | "RELATED_ROLE" }[];
  reportedProcess: { description: string; sourceUrl: string; sourceName: string; sourceDate: string; roleMatch: "EXACT_ROLE" | "RELATED_ROLE"; sourceKind: "CANDIDATE_REPORT" | "EMPLOYER_GUIDANCE" }[];
  likelyQuestions: string[];
  generalProcessGuidance: string[];
  searchNotes: string;
  searchesPerformed: number;
  sourcesInspected: number;
};

type BackgroundResponse = Record<string, unknown>;

async function startBackground(body: Record<string, unknown>): Promise<string> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new HostedOpenAIError("The private Site has no OpenAI API key configured.", "KEY_NOT_CONFIGURED");
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, background: true, store: false }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new HostedOpenAIError("OpenAI could not start this collection stage. No new opportunity was recorded.", "PROVIDER_START_FAILED");
  }
  if (!response.ok) {
    const code = response.status === 429 ? "PROVIDER_LIMIT" : response.status === 401 ? "PROVIDER_KEY_REJECTED" : response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_REQUEST_REJECTED";
    throw new HostedOpenAIError(`OpenAI could not start this collection stage (${response.status}). No new opportunity was recorded.`, code);
  }
  let payload: BackgroundResponse;
  try { payload = await response.json() as BackgroundResponse; }
  catch { throw new HostedOpenAIError("OpenAI returned an unreadable start response.", "PROVIDER_INVALID_RESPONSE"); }
  if (typeof payload.id !== "string" || !/^resp_[A-Za-z0-9_-]+$/.test(payload.id)) {
    throw new HostedOpenAIError("OpenAI did not return a valid response reference.", "PROVIDER_INVALID_RESPONSE");
  }
  return payload.id;
}

export async function retrieveBackground(responseId: string): Promise<BackgroundResponse> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new HostedOpenAIError("The OpenAI API key is no longer configured.", "KEY_NOT_CONFIGURED");
  if (!/^resp_[A-Za-z0-9_-]+$/.test(responseId)) throw new HostedOpenAIError("The saved response reference is invalid.", "PROVIDER_INVALID_RESPONSE");
  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}?include%5B%5D=web_search_call.action.sources`, {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new HostedOpenAIError("OpenAI status could not be checked. The run is still saved; retry shortly.", "PROVIDER_POLL_FAILED"); }
  if (!response.ok) {
    const code = response.status === 404 ? "PROVIDER_RESPONSE_EXPIRED" : response.status === 429 ? "PROVIDER_LIMIT" : "PROVIDER_POLL_FAILED";
    throw new HostedOpenAIError(`OpenAI could not retrieve the saved response (${response.status}).`, code);
  }
  try { return await response.json() as BackgroundResponse; }
  catch { throw new HostedOpenAIError("OpenAI returned an unreadable status response.", "PROVIDER_INVALID_RESPONSE"); }
}

export async function startBackgroundDiscovery(prompt: string): Promise<string> {
  return startBackground({ model: OPENAI_MODEL, input: prompt, reasoning: { effort: OPENAI_REASONING_EFFORT },
    text: { format: { type: "json_schema", name: "internship_workflow_result", strict: true, schema: WORKFLOW_RESULT_JSON_SCHEMA } },
    tools: [{ type: "web_search", search_context_size: "low", filters: { allowed_domains: APPROVED_DOMAINS } }],
    tool_choice: "auto", max_tool_calls: MAX_SEARCHES, include: ["web_search_call.action.sources"] });
}

export function readBackgroundDiscovery(payload: BackgroundResponse): { result: ValidatedResult; observedSearches: number; evidenceUrls: string[] } | null {
  if (payload.status === "queued" || payload.status === "in_progress") return null;
  if (payload.status !== "completed") throw new HostedOpenAIError("OpenAI did not finish the discovery response.", "PROVIDER_INCOMPLETE");
  const output = Array.isArray(payload.output) ? payload.output : [];
  const observedSearches = observedSearchActionCount(output);
  if (observedSearches > MAX_SEARCHES) throw new HostedOpenAIError("The API run exceeded the approved ten-search maximum.", "SEARCH_BUDGET_EXCEEDED");
  const text = typeof payload.output_text === "string" ? payload.output_text : messageText(output);
  try {
    const result = parseAndValidateWorkflowResult(applyObservedSearchCount(text, observedSearches), { observedSearches, mode: "DISCOVERY" } as Parameters<typeof parseAndValidateWorkflowResult>[1]);
    return { result, observedSearches, evidenceUrls: sourceUrls(output) };
  } catch (error) {
    const detail = error instanceof WorkflowResultValidationError && !error.message.startsWith("Forbidden sensitive or raw-content field:") ? error.message : "The structured result could not be validated.";
    throw new HostedOpenAIError(`The discovery result failed validation: ${detail}`, "RESULT_INVALID_WORKFLOW_RESULT");
  }
}

export async function startBackgroundAssessment(prompt: string): Promise<string> {
  return startBackground({ model: OPENAI_MODEL, input: prompt, reasoning: { effort: OPENAI_REASONING_EFFORT },
    text: { format: { type: "json_schema", name: "internship_private_assessment", strict: true, schema: PRIVATE_ASSESSMENT_JSON_SCHEMA } } });
}

export function readBackgroundAssessment(payload: BackgroundResponse, searchResult: ValidatedResult, observedSearches: number): ValidatedResult | null {
  if (payload.status === "queued" || payload.status === "in_progress") return null;
  if (payload.status !== "completed") throw new HostedOpenAIError("OpenAI did not finish private fit assessment.", "ASSESSMENT_INCOMPLETE");
  const output = Array.isArray(payload.output) ? payload.output : [];
  if (output.some((item) => (item as Record<string, unknown>).type === "web_search_call")) {
    throw new HostedOpenAIError("A private fit assessment attempted web activity; no result was saved.", "ASSESSMENT_WEB_FORBIDDEN");
  }
  const text = typeof payload.output_text === "string" ? payload.output_text : messageText(output);
  let assessed: ValidatedResult;
  try { assessed = mergePrivateAssessment(text, searchResult, observedSearches); }
  catch (error) {
    const detail = error instanceof WorkflowResultValidationError && !error.message.startsWith("Forbidden sensitive or raw-content field:") ? error.message : "The structured assessment could not be validated.";
    throw new HostedOpenAIError(`The private fit assessment failed validation: ${detail} No result was saved.`, "ASSESSMENT_INVALID_RESULT");
  }
  if (searchFacts(assessed) !== searchFacts(searchResult)) {
    throw new HostedOpenAIError("The private fit assessment changed source-checked posting facts or candidate counts; nothing was saved.", "ASSESSMENT_SOURCE_MISMATCH");
  }
  if ((assessed.selectedOpportunities as ScopedSelection[]).some((item) => item.applicationPrep.status !== "NOT_REQUESTED")) {
    throw new HostedOpenAIError("The assessment proposed application drafts outside this workflow; nothing was saved.", "ASSESSMENT_PREP_FORBIDDEN");
  }
  return assessed;
}

export async function runInterviewResearch(posting: { company: string; roleTitle: string; location: string; postingUrl: string; responsibilities: string[]; requirements: string[] }): Promise<InterviewPracticeResult> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new HostedOpenAIError("The private Site has no OpenAI API key configured.", "KEY_NOT_CONFIGURED");
  const publicFacts = JSON.stringify(posting).slice(0, 3_500);
  async function searchTheme(theme: "QUESTIONS" | "PROCESS") {
    const focus = theme === "QUESTIONS"
      ? "Search ONCE for candidate-reported questions asked for this employer and role. Fill reportedQuestions and likelyQuestions; leave reportedProcess and generalProcessGuidance empty. Only report a question if a public candidate account explicitly says it was asked."
      : "Search ONCE for the employer-and-role interview process: candidate-reported stages, format, assessments, or employer-published guidance. Fill reportedProcess and generalProcessGuidance; leave reportedQuestions and likelyQuestions empty. Candidate accounts are not employer policy. Do not invent rounds or timing.";
    const prompt = `${focus} Use one focused web-search query for this theme and cite accessible public sources such as candidate accounts, YouTube descriptions or transcripts, and employer-authorized pages. Give a short EXACT source quote for each reported item (maximum 180 characters). A search snippet, inaccessible video, or generic advice is not proof. Distinguish exact and related roles. Do not include any student name, resume, profile, email, or private information in the query. No application or employer communication.\n\nPublic role facts: ${publicFacts}\n\nReturn only the requested JSON structure.`;
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_MODEL, input: prompt, reasoning: { effort: OPENAI_REASONING_EFFORT },
        text: { format: { type: "json_schema", name: "interview_practice_result", strict: true, schema: INTERVIEW_PRACTICE_SCHEMA } },
        tools: [{ type: "web_search", search_context_size: "low" }], tool_choice: "required", max_tool_calls: 1,
        include: ["web_search_call.action.sources"],
      }), signal: AbortSignal.timeout(180_000),
      });
    } catch { throw new HostedOpenAIError(`${theme === "PROCESS" ? "Interview-process" : "Interview-question"} search could not reach OpenAI. Research is incomplete and no new practice set was saved.`, "INTERVIEW_NETWORK_ERROR"); }
    if (!response.ok) throw new HostedOpenAIError(`${theme === "PROCESS" ? "Interview-process" : "Interview-question"} search failed (${response.status}). No new practice set was saved.`, response.status === 429 ? "INTERVIEW_LIMIT" : "INTERVIEW_PROVIDER_ERROR");
    let payload: Record<string, unknown>;
    try { payload = await response.json() as Record<string, unknown>; }
    catch { throw new HostedOpenAIError("Interview research returned an unreadable response.", "INTERVIEW_INVALID_RESPONSE"); }
    if (payload.status !== "completed") throw new HostedOpenAIError("Interview research did not complete.", "INTERVIEW_INCOMPLETE");
    const output = Array.isArray(payload.output) ? payload.output : [];
    const count = observedSearchActionCount(output);
    if (count < 1 || count > 2) throw new HostedOpenAIError("The requested interview-search theme did not stay within its search budget. No result was saved.", "INTERVIEW_BUDGET_EXCEEDED");
    const text = typeof payload.output_text === "string" ? payload.output_text : messageText(output);
    return { text, urls: sourceUrls(output), count };
  }
  const questions = await searchTheme("QUESTIONS");
  const process = await searchTheme("PROCESS");
  const searchCalls = questions.count + process.count;
  if (searchCalls > 3) throw new HostedOpenAIError("Interview research exceeded its three-search limit. No result was saved.", "INTERVIEW_BUDGET_EXCEEDED");
  try {
    const questionResult = validateInterviewPractice(questions.text, questions.urls);
    const processResult = validateInterviewPractice(process.text, process.urls);
    const parsed = { reportedQuestions: questionResult.reportedQuestions, reportedProcess: processResult.reportedProcess,
      likelyQuestions: questionResult.likelyQuestions, generalProcessGuidance: processResult.generalProcessGuidance,
      searchNotes: "" };
    const verified = await verifyReportedQuestions(parsed, fetch, posting.company, posting.roleTitle);
    const omitted = parsed.reportedQuestions.length + parsed.reportedProcess.length
      - verified.reportedQuestions.length - verified.reportedProcess.length;
    verified.searchNotes = [
      `Question search: ${questions.count} web search${questions.count === 1 ? "" : "es"}; ${verified.reportedQuestions.length} accessible candidate-reported question${verified.reportedQuestions.length === 1 ? "" : "s"} verified.`,
      `Process search: ${process.count} web search${process.count === 1 ? "" : "es"}; ${verified.reportedProcess.length} accessible process report${verified.reportedProcess.length === 1 ? "" : "s"} verified.`,
      ...(omitted > 0 ? [`${omitted} unverified claimed report${omitted === 1 ? " was" : "s were"} omitted.`] : []),
    ].join("\n");
    if (!verified.reportedQuestions.length && !verified.likelyQuestions.length) {
      const themes = [...posting.responsibilities, ...posting.requirements]
        .map((item) => item.replace(/[\r\n<>]/g, " ").trim().slice(0, 160)).filter(Boolean).slice(0, 3);
      verified.likelyQuestions = [
        `Why are you interested in the ${posting.roleTitle} internship at ${posting.company}?`,
        ...themes.map((theme) => `What verified project, coursework, or experience would help you address this posting theme: ${theme}?`),
        "What would you do if you lacked a skill needed for an internship assignment?",
      ];
    }
    // General guidance must never launder an unverified source claim into a process fact.
    verified.generalProcessGuidance = [
      "An introductory conversation, a discussion of role-related work, and time for your questions are possibilities—not this employer's confirmed stages.",
      "Ask the recruiter to confirm the actual format, stages, assessments, and timing before planning around them.",
    ];
    return { ...verified, searchesPerformed: searchCalls, sourcesInspected: verified.sourcesInspected };
  } catch { throw new HostedOpenAIError("Interview questions or process details did not pass source and structure checks. No result was saved.", "INTERVIEW_VALIDATION_FAILED"); }
}

export async function runDiscovery(prompt: string): Promise<{ result: ValidatedResult; observedSearches: number; evidenceUrls: string[] }> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new HostedOpenAIError("The private Site has no OpenAI API key configured. Add it as a Sites secret before collecting.", "KEY_NOT_CONFIGURED");
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
        reasoning: { effort: OPENAI_REASONING_EFFORT },
        text: { format: { type: "json_schema", name: "internship_workflow_result", strict: true, schema: WORKFLOW_RESULT_JSON_SCHEMA } },
        tools: [{ type: "web_search", search_context_size: "low", filters: { allowed_domains: APPROVED_DOMAINS } }],
        tool_choice: "auto",
        max_tool_calls: MAX_SEARCHES,
        include: ["web_search_call.action.sources"],
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new HostedOpenAIError("The OpenAI request could not be completed. Check the connection and retry later.", "PROVIDER_NETWORK_ERROR");
  }
  if (!response.ok) {
    const code = response.status === 401 ? "PROVIDER_KEY_REJECTED" : response.status === 403 || response.status === 404 ? "PROVIDER_MODEL_UNAVAILABLE" : response.status === 429 ? "PROVIDER_LIMIT" : response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_REQUEST_REJECTED";
    const message = response.status === 429 ? "OpenAI reported a rate or usage limit. Check billing and retry later." : `The OpenAI request failed (${response.status}). No opportunity was recorded from this response.`;
    throw new HostedOpenAIError(message, code);
  }
  let payload: Record<string, unknown>;
  try { payload = await response.json() as Record<string, unknown>; }
  catch { throw new HostedOpenAIError("OpenAI returned an unreadable response.", "PROVIDER_INVALID_RESPONSE"); }
  if (payload.status !== "completed") throw new HostedOpenAIError("OpenAI did not finish the discovery response.", "PROVIDER_INCOMPLETE");
  const output = Array.isArray(payload.output) ? payload.output : [];
  const observedSearches = observedSearchActionCount(output);
  if (observedSearches > MAX_SEARCHES) throw new HostedOpenAIError("The API run exceeded the approved ten-search maximum.", "SEARCH_BUDGET_EXCEEDED");
  const text = typeof payload.output_text === "string" ? payload.output_text : messageText(output);
  let result: ValidatedResult;
  try { result = parseAndValidateWorkflowResult(applyObservedSearchCount(text, observedSearches), { observedSearches, mode: "DISCOVERY" } as Parameters<typeof parseAndValidateWorkflowResult>[1]); }
  catch (error) {
    // The validator's messages describe contract fields, not response content.
    // Do not persist the raw model response or a model-supplied object key.
    const detail = error instanceof WorkflowResultValidationError && !error.message.startsWith("Forbidden sensitive or raw-content field:")
      ? error.message
      : "The structured result could not be validated.";
    const code = error instanceof WorkflowResultValidationError ? error.code : "INVALID_WORKFLOW_RESULT";
    throw new HostedOpenAIError(`The API result failed a bounded-workflow check: ${detail} No new opportunity was recorded.`, `RESULT_${code}`);
  }
  return { result, observedSearches, evidenceUrls: sourceUrls(output) };
}

function searchFacts(result: ValidatedResult): string {
  return JSON.stringify({
    counts: [result.runSummary.searchesPerformed, result.runSummary.candidatesDiscovered, result.runSummary.duplicatesOrInvalid, result.runSummary.candidatesRanked],
    selected: (result.selectedOpportunities as ScopedSelection[]).map((item) => [item.updateDisposition, item.existingOpportunityId, item.opportunity]),
  });
}

export async function runPrivateAssessment(prompt: string, searchResult: ValidatedResult, observedSearches: number): Promise<ValidatedResult> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new HostedOpenAIError("The private Site has no OpenAI API key configured.", "KEY_NOT_CONFIGURED");
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
        reasoning: { effort: OPENAI_REASONING_EFFORT },
        text: { format: { type: "json_schema", name: "internship_private_assessment", strict: true, schema: PRIVATE_ASSESSMENT_JSON_SCHEMA } },
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new HostedOpenAIError("The private fit assessment could not reach OpenAI. No opportunity was recorded from this assessment.", "ASSESSMENT_NETWORK_ERROR");
  }
  if (!response.ok) {
    const code = response.status === 429 ? "ASSESSMENT_LIMIT" : response.status >= 500 ? "ASSESSMENT_UNAVAILABLE" : "ASSESSMENT_REJECTED";
    throw new HostedOpenAIError(`The private fit assessment failed (${response.status}). No opportunity was recorded from this assessment.`, code);
  }
  const payload = await response.json() as Record<string, unknown>;
  if (payload.status !== "completed") throw new HostedOpenAIError("The private fit assessment did not finish.", "ASSESSMENT_INCOMPLETE");
  const output = Array.isArray(payload.output) ? payload.output : [];
  if (output.some((item) => (item as Record<string, unknown>).type === "web_search_call")) {
    throw new HostedOpenAIError("A private fit assessment attempted web activity; no result was saved.", "ASSESSMENT_WEB_FORBIDDEN");
  }
  const text = typeof payload.output_text === "string" ? payload.output_text : messageText(output);
  let assessed: ValidatedResult;
  try {
    assessed = mergePrivateAssessment(text, searchResult, observedSearches);
  } catch (error) {
    const detail = error instanceof WorkflowResultValidationError && !error.message.startsWith("Forbidden sensitive or raw-content field:") ? error.message : "The structured assessment could not be validated.";
    throw new HostedOpenAIError(`The private fit assessment failed validation: ${detail}`, "ASSESSMENT_INVALID_RESULT");
  }
  if (searchFacts(assessed) !== searchFacts(searchResult)) {
    throw new HostedOpenAIError("The private fit assessment changed source-checked posting facts or candidate counts; nothing was saved.", "ASSESSMENT_SOURCE_MISMATCH");
  }
  if ((assessed.selectedOpportunities as ScopedSelection[]).some((item) => item.applicationPrep.status !== "NOT_REQUESTED")) {
    throw new HostedOpenAIError("The assessment proposed application drafts outside this feature group; nothing was saved.", "ASSESSMENT_PREP_FORBIDDEN");
  }
  return assessed;
}

export async function runTargetedAssessment(prompt: string, expected: { opportunityId: string; responseId: string; gapCount: number; unknownCount: number }) {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new HostedOpenAIError("The private Site has no OpenAI API key configured. Your response remains saved for retry.", "KEY_NOT_CONFIGURED");
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL, input: prompt, reasoning: { effort: OPENAI_REASONING_EFFORT },
        text: { format: { type: "json_schema", name: "internship_targeted_update", strict: true, schema: TARGETED_UPDATE_JSON_SCHEMA } },
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new HostedOpenAIError("The private reassessment could not reach OpenAI. Your response remains saved for retry.", "TARGETED_NETWORK_ERROR");
  }
  if (!response.ok) {
    const code = response.status === 429 ? "TARGETED_LIMIT" : response.status >= 500 ? "TARGETED_UNAVAILABLE" : "TARGETED_REJECTED";
    throw new HostedOpenAIError(`The private reassessment failed (${response.status}). Your response remains saved for retry.`, code);
  }
  let payload: Record<string, unknown>;
  try { payload = await response.json() as Record<string, unknown>; }
  catch { throw new HostedOpenAIError("The reassessment response was unreadable. Your answer remains saved for retry.", "TARGETED_INVALID_RESPONSE"); }
  if (payload.status !== "completed") throw new HostedOpenAIError("The reassessment did not finish. Your answer remains saved for retry.", "TARGETED_INCOMPLETE");
  const output = Array.isArray(payload.output) ? payload.output : [];
  if (output.some((item) => (item as Record<string, unknown>).type === "web_search_call")) {
    throw new HostedOpenAIError("A targeted reassessment attempted web activity; no assessment was saved.", "TARGETED_WEB_FORBIDDEN");
  }
  const text = typeof payload.output_text === "string" ? payload.output_text : messageText(output);
  try { return validateTargetedUpdate(text, expected); }
  catch { throw new HostedOpenAIError("The reassessment did not match this opportunity and response. Your answer remains saved for retry.", "TARGETED_RESULT_INVALID"); }
}
