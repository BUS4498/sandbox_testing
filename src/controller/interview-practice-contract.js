export const INTERVIEW_PRACTICE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["reportedQuestions", "reportedProcess", "likelyQuestions", "generalProcessGuidance", "searchNotes"],
  properties: {
    reportedQuestions: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false,
      required: ["question", "sourceUrl", "sourceName", "sourceDate", "roleMatch", "evidenceQuote"],
      properties: { question: { type: "string" }, sourceUrl: { type: "string" }, sourceName: { type: "string" }, sourceDate: { type: "string" }, roleMatch: { type: "string", enum: ["EXACT_ROLE", "RELATED_ROLE"] }, evidenceQuote: { type: "string" } },
    } },
    reportedProcess: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false,
      required: ["description", "sourceUrl", "sourceName", "sourceDate", "roleMatch", "sourceKind", "evidenceQuote"],
      properties: { description: { type: "string" }, sourceUrl: { type: "string" }, sourceName: { type: "string" }, sourceDate: { type: "string" }, roleMatch: { type: "string", enum: ["EXACT_ROLE", "RELATED_ROLE"] }, sourceKind: { type: "string", enum: ["CANDIDATE_REPORT", "EMPLOYER_GUIDANCE"] }, evidenceQuote: { type: "string" } },
    } },
    likelyQuestions: { type: "array", maxItems: 10, items: { type: "string" } },
    generalProcessGuidance: { type: "array", maxItems: 5, items: { type: "string" } },
    searchNotes: { type: "string" },
  },
};

const PUBLIC_HOSTS = ["youtube.com", "youtu.be", "reddit.com", "glassdoor.com", "indeed.com", "medium.com", "substack.com", "teamblind.com", "geeksforgeeks.org", "interviewquery.com", "greenhouse.io", "lever.co", "ashbyhq.com"];
const EMPLOYER_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com"];
const clean = (value, limit) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) : "";

export function safeInterviewUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!PUBLIC_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    url.hash = ""; url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|ref$|source$|gh_src$)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}

export function validateInterviewResult(raw, citedUrls = []) {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!value || typeof value !== "object" || !Array.isArray(value.reportedQuestions) || !Array.isArray(value.reportedProcess) || !Array.isArray(value.likelyQuestions) || !Array.isArray(value.generalProcessGuidance) || value.reportedQuestions.length > 8 || value.reportedProcess.length > 5 || value.likelyQuestions.length > 10 || value.generalProcessGuidance.length > 5) throw new TypeError("Interview research returned an invalid structure.");
  const cited = new Set(citedUrls.map(safeInterviewUrl).filter(Boolean));
  const seen = new Set();
  const reportedQuestions = value.reportedQuestions.flatMap((item) => {
    const question = clean(item?.question, 180), sourceUrl = safeInterviewUrl(item?.sourceUrl), evidenceQuote = clean(item?.evidenceQuote, 180);
    if (!question || !sourceUrl || !cited.has(sourceUrl) || evidenceQuote.length < 12 || !["EXACT_ROLE", "RELATED_ROLE"].includes(item?.roleMatch) || seen.has(question.toLowerCase())) return [];
    seen.add(question.toLowerCase());
    return [{ question, sourceUrl, sourceName: clean(item.sourceName, 80) || new URL(sourceUrl).hostname, sourceDate: clean(item.sourceDate, 40) || "Unknown", roleMatch: item.roleMatch, evidenceQuote }];
  });
  const likelyQuestions = value.likelyQuestions.map((item) => clean(item, 180)).filter(Boolean).filter((item) => { const key = item.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  const reportedProcess = value.reportedProcess.flatMap((item) => {
    const description = clean(item?.description, 220), sourceUrl = safeInterviewUrl(item?.sourceUrl), evidenceQuote = clean(item?.evidenceQuote, 180);
    if (!description || !sourceUrl || !cited.has(sourceUrl) || evidenceQuote.length < 12 || !["EXACT_ROLE", "RELATED_ROLE"].includes(item?.roleMatch) || !["CANDIDATE_REPORT", "EMPLOYER_GUIDANCE"].includes(item?.sourceKind) || seen.has(description.toLowerCase())) return [];
    const host = new URL(sourceUrl).hostname;
    if (item.sourceKind === "EMPLOYER_GUIDANCE" && !EMPLOYER_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return [];
    seen.add(description.toLowerCase());
    return [{ description, sourceUrl, sourceName: clean(item.sourceName, 80) || host, sourceDate: clean(item.sourceDate, 40) || "Unknown", roleMatch: item.roleMatch, sourceKind: item.sourceKind, evidenceQuote }];
  });
  const generalProcessGuidance = value.generalProcessGuidance.map((item) => clean(item, 220)).filter(Boolean).filter((item) => { const key = item.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  return { reportedQuestions, reportedProcess, likelyQuestions, generalProcessGuidance, searchNotes: clean(value.searchNotes, 300) };
}

function pageText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").toLowerCase();
}

export async function verifyInterviewReports(result, { company, roleTitle, fetchPage = fetch } = {}) {
  const pages = new Map(); const verified = [], verifiedProcess = [];
  async function check(item) {
    if (!pages.has(item.sourceUrl) && pages.size >= 10) return false;
    if (!pages.has(item.sourceUrl)) pages.set(item.sourceUrl, (async () => {
      try {
        let url = item.sourceUrl, response;
        for (let redirect = 0; redirect < 3; redirect++) {
          response = await fetchPage(url, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { Accept: "text/html,text/plain" } });
          if (![301, 302, 303, 307, 308].includes(response.status)) break;
          const next = safeInterviewUrl(new URL(response.headers.get("location") || "", url).toString());
          if (!next) return "";
          url = next;
        }
        if (!response?.ok || Number(response.headers.get("content-length") || 0) > 400_000 || !/text\/html|text\/plain/i.test(response.headers.get("content-type") || "") || !response.body) return "";
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = "", size = 0;
        while (size < 400_000) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 400_000) { await reader.cancel(); return ""; } text += decoder.decode(value, { stream: true }); }
        return pageText(text + decoder.decode());
      } catch { return ""; }
    })());
    const page = await pages.get(item.sourceUrl);
    return Boolean(page && page.includes(pageText(item.evidenceQuote)) && (!company || page.includes(pageText(company))));
  }
  for (const item of result.reportedQuestions) if (await check(item)) verified.push({ question: item.question, sourceUrl: item.sourceUrl, sourceName: item.sourceName, sourceDate: item.sourceDate, roleMatch: roleTitle && !(await pages.get(item.sourceUrl)).includes(pageText(roleTitle)) ? "RELATED_ROLE" : item.roleMatch });
  for (const item of result.reportedProcess) if (await check(item)) verifiedProcess.push({ description: item.description, sourceUrl: item.sourceUrl, sourceName: item.sourceName, sourceDate: item.sourceDate, roleMatch: roleTitle && !(await pages.get(item.sourceUrl)).includes(pageText(roleTitle)) ? "RELATED_ROLE" : item.roleMatch, sourceKind: item.sourceKind });
  const omitted = result.reportedQuestions.length + result.reportedProcess.length - verified.length - verifiedProcess.length;
  return { ...result, reportedQuestions: verified, reportedProcess: verifiedProcess, sourcesInspected: pages.size, searchNotes: omitted ? [result.searchNotes, `${omitted} claimed public report(s) could not be verified from accessible pages and were omitted.`].filter(Boolean).join(" ") : result.searchNotes };
}
