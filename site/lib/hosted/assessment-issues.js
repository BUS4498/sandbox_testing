const provisionalFitNote = /no private resume evidence was used in discovery|student-specific fit assessments? remain .*pending.*no-web assessment|pending the separate no-web assessment/i;
const completedDiscoveryNote = /private (?:resume|profile)(?: evidence)? (?:was|is) (?:intentionally )?(?:omitted|absent|withheld)|private resume was omitted|^No (?:private )?(?:resume|profile) evidence (?:was|is) (?:supplied|provided|used) (?:to|in|during|for) (?:the )?(?:discovery|search)\b|student-specific assessments? are intentionally|qualification matches.*?(?:until|pending).*?no-web assessment|^No (?:required(?:\/preferred)?|student).*qualification.*(?:matches|gaps).*claimed|(?:proposals|pending|subsequent).*no-web assessment|not saved records|^No (?:persistence|spreadsheet writes|private-profile assessment|student qualification matches).*?(?:performed|occurred|saved)/i;

function currentDiscoveryIssue(issue) {
  if (typeof issue !== "string") return "";
  // A discovery item may mix a real source caveat with temporary stage notes.
  // Remove only obsolete sentences; never discard the entire mixed item.
  return issue.split(/(?<=[.!?])\s+(?=[A-Z])/u)
    .filter((sentence) => /\b(?:failed|failure|error|timed out|could not|unable|denied|refused)\b/i.test(sentence)
      || (!provisionalFitNote.test(sentence) && !completedDiscoveryNote.test(sentence)))
    .join(" ").trim();
}

export function finalAssessmentIssues(discoveryIssues, assessedIssues) {
  return [...new Set([...discoveryIssues.map(currentDiscoveryIssue), ...assessedIssues].filter((issue) =>
    typeof issue === "string" && issue.trim() && !provisionalFitNote.test(issue)
  ))];
}
