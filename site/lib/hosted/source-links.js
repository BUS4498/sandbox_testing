const SECONDARY_HOSTS = ["linkedin.com", "indeed.com", "wellfound.com", "builtin.com", "simplify.jobs"];
const APPROVED_POSTING_HOSTS = [...SECONDARY_HOSTS, "greenhouse.io", "lever.co", "ashbyhq.com", "usajobs.gov", "calcareers.ca.gov",
  // Employer-authorized systems reached from the approved portfolio.
  "myworkdayjobs.com", "lifeattiktok.com", "eightfold.ai", "oraclecloud.com", "smartrecruiters.com"];

export function isApprovedPostingUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      && APPROVED_POSTING_HOSTS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
      && !isMultiOpportunityIndexUrl(value);
  } catch { return false; }
}

// Source acceptance is not a claim that an employer confirmed an active opening.
// Both collection paths use this same rule; unknown status is kept unchanged.
export function postingAdmissionIssue(posting, evidenceUrls, disposition = "NEW") {
  if (!posting.company?.trim() || !posting.roleTitle?.trim()) return "Company and role evidence is incomplete.";
  if (isMultiOpportunityIndexUrl(posting.postingUrl)) return "The supplied URL is a discovery index, not this role's posting.";
  if (!evidenceUrls.includes(posting.postingUrl)) return "The posting URL is absent from returned web-source evidence.";
  if (posting.postingStatus === "CLOSED" && disposition === "NEW") return "This new posting is known to be closed.";
  if (posting.postingStatus === "UNCERTAIN" && !isApprovedPostingUrl(posting.postingUrl)) return "The uncertain listing is not from an approved posting source.";
  return null;
}

export function isSecondaryListing(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SECONDARY_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

// A collection page can establish that a lead appeared in a list, but it is
// not a distinct posting URL for any one role.
export function isMultiOpportunityIndexUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.toLowerCase();
    const path = pathname.toLowerCase().replace(/\/+$/, "");
    if (SECONDARY_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`)) && !path) return true;
    if ((host === "github.com" || host === "raw.githubusercontent.com") &&
        path.startsWith("/simplifyjobs/summer2027-internships/") &&
        path.endsWith("/readme.md")) return true;
    if (host === "github.com" && path === "/simplifyjobs/summer2027-internships") return true;
    if (host === "simplify.jobs" && path === "/l/top-summer-internships-2027") return true;
    if (host === "intern.usajobs.gov" && (path === "" || path === "/")) return true;
    if (host === "calcareers.ca.gov" && path === "/calhrpublic/jobs/students.aspx") return true;
    if (host === "builtin.com" && path === "/jobs/internships") return true;
    if ((host === "linkedin.com" || host.endsWith(".linkedin.com")) && (path === "/jobs" || path.startsWith("/jobs/search"))) return true;
    if ((host === "indeed.com" || host.endsWith(".indeed.com")) && ["/jobs", "/q", "/search"].includes(path)) return true;
    if ((host === "wellfound.com" || host.endsWith(".wellfound.com")) && path === "/jobs") return true;
    if (host === "builtin.com" && path === "/jobs") return true;
    return false;
  } catch {
    return false;
  }
}

// The caller supplies URLs canonicalized by the collection's URL rules.
// A direct application URL is displayed only when the search response cited it
// or it is the same verified posting page.
export function isEvidenceBackedApplicationUrl(applicationUrl, postingUrl, evidenceUrls) {
  return Boolean(applicationUrl) && !isSecondaryListing(applicationUrl) && (applicationUrl === postingUrl || evidenceUrls.includes(applicationUrl));
}
