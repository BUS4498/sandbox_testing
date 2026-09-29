export const INTERVIEW_PRACTICE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["reportedQuestions", "likelyQuestions", "searchNotes"],
  properties: {
    reportedQuestions: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false,
      required: ["question", "sourceUrl", "sourceName", "sourceDate", "roleMatch", "evidenceQuote"],
      properties: { question: { type: "string" }, sourceUrl: { type: "string" }, sourceName: { type: "string" }, sourceDate: { type: "string" }, roleMatch: { type: "string", enum: ["EXACT_ROLE", "RELATED_ROLE"] }, evidenceQuote: { type: "string" } },
    } },
    likelyQuestions: { type: "array", maxItems: 10, items: { type: "string" } },
    searchNotes: { type: "string" },
  },
};

const PUBLIC_HOSTS = ["youtube.com", "youtu.be", "reddit.com", "glassdoor.com", "indeed.com", "medium.com", "substack.com", "teamblind.com", "geeksforgeeks.org", "interviewquery.com"];
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
  if (!value || typeof value !== "object" || !Array.isArray(value.reportedQuestions) || !Array.isArray(value.likelyQuestions) || value.reportedQuestions.length > 8 || value.likelyQuestions.length > 10) throw new TypeError("Interview research returned an invalid structure.");
  const cited = new Set(citedUrls.map(safeInterviewUrl).filter(Boolean));
  const seen = new Set();
  const reportedQuestions = value.reportedQuestions.flatMap((item) => {
    const question = clean(item?.question, 180), sourceUrl = safeInterviewUrl(item?.sourceUrl), evidenceQuote = clean(item?.evidenceQuote, 180);
    if (!question || !sourceUrl || !cited.has(sourceUrl) || evidenceQuote.length < 12 || !["EXACT_ROLE", "RELATED_ROLE"].includes(item?.roleMatch) || seen.has(question.toLowerCase())) return [];
    seen.add(question.toLowerCase());
    return [{ question, sourceUrl, sourceName: clean(item.sourceName, 80) || new URL(sourceUrl).hostname, sourceDate: clean(item.sourceDate, 40) || "Unknown", roleMatch: item.roleMatch, evidenceQuote }];
  });
  const likelyQuestions = value.likelyQuestions.map((item) => clean(item, 180)).filter(Boolean).filter((item) => { const key = item.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
  return { reportedQuestions, likelyQuestions, searchNotes: clean(value.searchNotes, 300) };
}

function pageText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").toLowerCase();
}

export async function verifyInterviewReports(result, { company, roleTitle, fetchPage = fetch } = {}) {
  const pages = new Map(); const verified = [];
  for (const item of result.reportedQuestions) {
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
    if (page && page.includes(pageText(item.evidenceQuote)) && (!company || page.includes(pageText(company)))) verified.push({ question: item.question, sourceUrl: item.sourceUrl, sourceName: item.sourceName, sourceDate: item.sourceDate, roleMatch: roleTitle && !page.includes(pageText(roleTitle)) ? "RELATED_ROLE" : item.roleMatch });
  }
  return { ...result, reportedQuestions: verified, searchNotes: verified.length < result.reportedQuestions.length ? [result.searchNotes, `${result.reportedQuestions.length - verified.length} claimed public question(s) could not be verified from accessible pages and were omitted.`].filter(Boolean).join(" ") : result.searchNotes };
}
