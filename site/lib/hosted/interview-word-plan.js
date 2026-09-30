/** @param {Record<string, any>} record @param {Record<string, any>} result */
export function interviewWordPlan(record, result) {
  const postingThemes = [...(record.responsibilities ?? []), ...(record.requiredQualifications ?? []), ...(record.preferredQualifications ?? [])].slice(0, 8);
  const reported = (result.reportedQuestions ?? []).map((item) => `${item.question} [${item.roleMatch === "EXACT_ROLE" ? "Same role" : "Related role"}; ${item.sourceName}; ${item.sourceDate}; ${item.sourceUrl}]`);
  const process = (result.reportedProcess ?? []).map((item) => `${item.description} [${item.sourceKind === "EMPLOYER_GUIDANCE" ? "Employer guidance" : "Candidate account"}; ${item.roleMatch === "EXACT_ROLE" ? "Same role" : "Related role"}; ${item.sourceName}; ${item.sourceDate}; ${item.sourceUrl}]`);
  const likely = (result.likelyQuestions ?? []).map((item) => `${item} [Generated practice question; not reported by a candidate]`);
  const general = (result.generalProcessGuidance ?? []).map((item) => `${item} [General preparation guidance; not this employer's confirmed procedure]`);
  return {
    title: "Interview Questions and Process Practice", company: record.company, role: record.roleTitle,
    sections: [
      { heading: "Themes from the selected posting", bullets: postingThemes.length ? postingThemes : ["This older record does not retain source-backed responsibilities or qualifications. Refresh the posting before treating practice prompts as role-specific."] },
      { heading: "Publicly reported questions", bullets: reported.length ? reported : ["No question could be verified in an accessible public candidate account for this role. Do not represent generated questions as actual employer questions."] },
      { heading: "Publicly reported interview process", bullets: process.length ? process : ["No role-specific interview procedure could be verified from an accessible public source. The actual stages, format, and timing remain unknown."] },
      { heading: "Likely questions to practice", bullets: likely.length ? likely : ["No additional generated questions were needed for this practice set."] },
      { heading: "General process preparation", bullets: general.length ? general : ["Ask the recruiter to confirm the actual format, stages, assessments, and timing." ] },
      { heading: "How to use this practice set", paragraphs: ["These are preparation prompts, not promises about the interview. Candidate reports may concern related roles and could be outdated.", "Prepare honest examples from your own verified experience. Open the current posting through Apply in the dashboard before relying on this guide.", ...(result.searchNotes ? result.searchNotes.split(/\n+/).filter(Boolean) : ["No further source note."])] },
    ],
    placeholders: [],
    includeChecklist: false,
    nextStep: "Review the public source links and practice your own truthful answers.",
  };
}
