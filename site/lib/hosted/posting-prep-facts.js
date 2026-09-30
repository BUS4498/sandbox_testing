/**
 * Public facts retained from the inspected posting. Historical records may
 * lack these fields; absence remains explicit instead of being invented.
 * @param {{company:string,roleTitle:string,location:string,postingUrl:string,responsibilities?:string[],requiredQualifications?:string[],preferredQualifications?:string[]}} record
 */
export function publicPostingFacts(record) {
  const concise = (items) => (Array.isArray(items) ? items : []).filter((item) => typeof item === "string" && item.trim()).slice(0, 12).map((item) => item.trim().slice(0, 500));
  return {
    company: record.company,
    roleTitle: record.roleTitle,
    location: record.location,
    postingUrl: record.postingUrl,
    responsibilities: concise(record.responsibilities),
    requirements: [...concise(record.requiredQualifications), ...concise(record.preferredQualifications)],
  };
}
