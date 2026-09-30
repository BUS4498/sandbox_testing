const provisionalFitNote = /no private resume evidence was used in discovery|student-specific fit assessments? remain .*pending.*no-web assessment|pending the separate no-web assessment/i;

export function finalAssessmentIssues(discoveryIssues, assessedIssues) {
  return [...new Set([...discoveryIssues, ...assessedIssues].filter((issue) =>
    typeof issue === "string" && issue.trim() && !provisionalFitNote.test(issue)
  ))];
}
