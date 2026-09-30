// The private fit review needs source-checked job facts, not the whole discovery
// transcript or provisional decisions. This keeps the no-web request focused.
export function privateAssessmentInput(discovery) {
  if (!discovery || !Array.isArray(discovery.selectedOpportunities)) throw new TypeError("Validated selected opportunities are required.");
  return discovery.selectedOpportunities.map((selection, selectionIndex) => {
    const opportunity = selection.opportunity ?? {};
    return {
      selectionIndex,
      company: opportunity.company,
      roleTitle: opportunity.roleTitle,
      location: opportunity.location,
      workArrangement: opportunity.workArrangement,
      internshipPeriod: opportunity.internshipPeriod,
      deadline: opportunity.deadline,
      postingStatus: opportunity.postingStatus,
      postingUrl: opportunity.postingUrl,
      source: opportunity.source,
      responsibilities: opportunity.responsibilities,
      requiredQualifications: opportunity.requiredQualifications,
      preferredQualifications: opportunity.preferredQualifications,
      selectionEvidence: selection.selectionEvidence,
      sourceUnknowns: selection.fitEvidence?.unknowns,
      unresolvedSourceIssue: selection.unresolvedIssue,
    };
  });
}
