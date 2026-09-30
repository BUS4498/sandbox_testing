const SECONDARY_HOSTS = ["linkedin.com", "indeed.com", "wellfound.com", "builtin.com", "simplify.jobs"];

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
    if ((host === "github.com" || host === "raw.githubusercontent.com") &&
        path.startsWith("/simplifyjobs/summer2027-internships/") &&
        path.endsWith("/readme.md")) return true;
    if (host === "github.com" && path === "/simplifyjobs/summer2027-internships") return true;
    if (host === "simplify.jobs" && path === "/l/top-summer-internships-2027") return true;
    if (host === "intern.usajobs.gov" && (path === "" || path === "/")) return true;
    if (host === "calcareers.ca.gov" && path === "/calhrpublic/jobs/students.aspx") return true;
    if (host === "builtin.com" && path === "/jobs/internships") return true;
    if (host === "www.linkedin.com" && (path === "/jobs" || path === "/jobs/search")) return true;
    if (host === "wellfound.com" && path === "/jobs") return true;
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
