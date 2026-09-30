export const INTERVIEW_PRACTICE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["reportedQuestions", "reportedProcess", "likelyQuestions", "generalProcessGuidance", "searchNotes"],
  properties: {
    reportedQuestions: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false,
      required: ["question", "sourceUrl", "sourceName", "sourceDate", "roleMatch", "evidenceQuote"],
      properties: {
        question: { type: "string" }, sourceUrl: { type: "string" }, sourceName: { type: "string" },
        sourceDate: { type: "string" }, roleMatch: { type: "string", enum: ["EXACT_ROLE", "RELATED_ROLE"] },
        evidenceQuote: { type: "string" },
      },
    } },
    reportedProcess: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false,
      required: ["description", "sourceUrl", "sourceName", "sourceDate", "roleMatch", "sourceKind", "evidenceQuote"],
      properties: {
        description: { type: "string" }, sourceUrl: { type: "string" }, sourceName: { type: "string" },
        sourceDate: { type: "string" }, roleMatch: { type: "string", enum: ["EXACT_ROLE", "RELATED_ROLE"] },
        sourceKind: { type: "string", enum: ["CANDIDATE_REPORT", "EMPLOYER_GUIDANCE"] }, evidenceQuote: { type: "string" },
      },
    } },
    likelyQuestions: { type: "array", maxItems: 10, items: { type: "string" } },
    generalProcessGuidance: { type: "array", maxItems: 5, items: { type: "string" } },
    searchNotes: { type: "string" },
  },
};

const ALLOWED_HOSTS = ["youtube.com", "youtu.be", "reddit.com", "glassdoor.com", "indeed.com", "medium.com", "substack.com", "teamblind.com", "geeksforgeeks.org", "interviewquery.com", "greenhouse.io", "lever.co", "ashbyhq.com"];
const EMPLOYER_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com"];

export function safeInterviewSource(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|ref$|source$|gh_src$)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}

function clean(raw, limit) {
  return typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

export function validateInterviewPractice(raw, sourceUrls = []) {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.reportedQuestions) || !Array.isArray(value.reportedProcess) || !Array.isArray(value.likelyQuestions) || !Array.isArray(value.generalProcessGuidance) || value.reportedQuestions.length > 8 || value.reportedProcess.length > 5 || value.likelyQuestions.length > 10 || value.generalProcessGuidance.length > 5) throw new TypeError("The interview-practice result has an invalid structure.");
  const seen = new Set();
  const sources = new Set(sourceUrls.map((url) => safeInterviewSource(url)).filter(Boolean));
  const reportedQuestions = value.reportedQuestions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const question = clean(item.question, 180);
    const sourceUrl = safeInterviewSource(item.sourceUrl);
    const evidenceQuote = clean(item.evidenceQuote, 180);
    if (!question || !sourceUrl || !sources.has(sourceUrl) || evidenceQuote.length < 12 || !["EXACT_ROLE", "RELATED_ROLE"].includes(item.roleMatch)) return [];
    if (seen.has(question.toLowerCase())) return [];
    seen.add(question.toLowerCase());
    return [{ question, sourceUrl, sourceName: clean(item.sourceName, 80) || new URL(sourceUrl).hostname, sourceDate: clean(item.sourceDate, 40) || "Unknown", roleMatch: item.roleMatch, evidenceQuote }];
  });
  const likelyQuestions = value.likelyQuestions.map((item) => clean(item, 180)).filter(Boolean).filter((question) => {
    const key = question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const reportedProcess = value.reportedProcess.flatMap((item) => {
    const description = clean(item?.description, 220), sourceUrl = safeInterviewSource(item?.sourceUrl), evidenceQuote = clean(item?.evidenceQuote, 180);
    if (!description || !sourceUrl || !sources.has(sourceUrl) || evidenceQuote.length < 12 || !["EXACT_ROLE", "RELATED_ROLE"].includes(item?.roleMatch) || !["CANDIDATE_REPORT", "EMPLOYER_GUIDANCE"].includes(item?.sourceKind)) return [];
    const host = new URL(sourceUrl).hostname;
    if (item.sourceKind === "EMPLOYER_GUIDANCE" && !EMPLOYER_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return [];
    if (seen.has(description.toLowerCase())) return [];
    seen.add(description.toLowerCase());
    return [{ description, sourceUrl, sourceName: clean(item.sourceName, 80) || host, sourceDate: clean(item.sourceDate, 40) || "Unknown", roleMatch: item.roleMatch, sourceKind: item.sourceKind, evidenceQuote }];
  });
  const generalProcessGuidance = value.generalProcessGuidance.map((item) => clean(item, 220)).filter(Boolean).filter((item) => { const key = item.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  return { reportedQuestions, reportedProcess, likelyQuestions, generalProcessGuidance, searchNotes: clean(value.searchNotes, 300) };
}

function normalizePage(raw) {
  return raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ").toLowerCase();
}

export async function verifyReportedQuestions(result, fetchPage = fetch, company = "", roleTitle = "") {
  const cache = new Map();
  const verifiedQuestions = [], verifiedProcess = [];
  async function check(item) {
    if (!cache.has(item.sourceUrl) && cache.size >= 10) return false;
    if (!cache.has(item.sourceUrl)) {
      cache.set(item.sourceUrl, (async () => {
        try {
          let pageUrl = item.sourceUrl;
          let response;
          for (let redirect = 0; redirect < 3; redirect++) {
            response = await fetchPage(pageUrl, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { Accept: "text/html,text/plain" } });
            if (![301, 302, 303, 307, 308].includes(response.status)) break;
            const next = safeInterviewSource(new URL(response.headers.get("location") || "", pageUrl).toString());
            if (!next) return "";
            pageUrl = next;
          }
          if (!response) return "";
          if (!response.ok || Number(response.headers.get("content-length") || 0) > 400_000 || !/text\/html|text\/plain/i.test(response.headers.get("content-type") || "") || !response.body) return "";
          const reader = response.body.getReader();
          const decoder = new TextDecoder(); let pageText = ""; let size = 0;
          while (size < 400_000) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 400_000) { await reader.cancel(); return ""; }
            pageText += decoder.decode(value, { stream: true });
          }
          return normalizePage(pageText + decoder.decode());
        } catch { return ""; }
      })());
    }
    const page = await cache.get(item.sourceUrl);
    return Boolean(page && page.includes(normalizePage(item.evidenceQuote)) && (!company || page.includes(normalizePage(company))));
  }
  for (const item of result.reportedQuestions.slice(0, 8)) if (await check(item)) verifiedQuestions.push({ question: item.question, sourceUrl: item.sourceUrl, sourceName: item.sourceName, sourceDate: item.sourceDate, roleMatch: roleTitle && !(await cache.get(item.sourceUrl)).includes(normalizePage(roleTitle)) ? "RELATED_ROLE" : item.roleMatch });
  for (const item of result.reportedProcess.slice(0, 5)) if (await check(item)) verifiedProcess.push({ description: item.description, sourceUrl: item.sourceUrl, sourceName: item.sourceName, sourceDate: item.sourceDate, roleMatch: roleTitle && !(await cache.get(item.sourceUrl)).includes(normalizePage(roleTitle)) ? "RELATED_ROLE" : item.roleMatch, sourceKind: item.sourceKind });
  const omitted = result.reportedQuestions.length + result.reportedProcess.length - verifiedQuestions.length - verifiedProcess.length;
  return { ...result, reportedQuestions: verifiedQuestions, reportedProcess: verifiedProcess, sourcesInspected: cache.size, searchNotes: omitted ? [result.searchNotes, `${omitted} claimed public report(s) could not be verified from accessible pages and were omitted.`].filter(Boolean).join(" ") : result.searchNotes };
}
