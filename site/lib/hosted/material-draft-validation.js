/**
 * Validate model-drafted cover-letter paragraphs without requiring a student
 * evidence citation for a purely prospective opening or polite closing.
 * Factual student claims still require a verified resume excerpt.
 *
 * @param {unknown} raw
 * @param {{id:string,text:string}[]} evidence
 * @returns {{text:string,evidenceIds:string[]}[]}
 */
export const UNVERIFIED_LABEL = "UNVERIFIED — STUDENT MUST VERIFY:";
const NUMBER_PATTERN = /\b\d+(?:[.,]\d+)*(?:%|\+)?/g;

function numbersIn(value) {
  return new Set(String(value ?? "").match(NUMBER_PATTERN) ?? []);
}

function normalizeLetterParagraphs(raw, evidence) {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 5) {
    throw new Error("The cover letter needs three or four complete paragraphs.");
  }
  const knownIds = new Set(evidence.map((item) => item.id));
  const paragraphs = raw.map((item, index) => {
    if (!item || typeof item !== "object" || typeof item.text !== "string" || !Array.isArray(item.evidenceIds)) {
      throw new Error(`Cover letter paragraph ${index + 1} has an invalid structure.`);
    }
    // Evidence IDs are validated from the structured field, not printed as
    // academic-style citations in a student-facing cover letter.
    const text = item.text.replace(/\s*\(\s*E\d+(?:\s*[,;]\s*E\d+)*\s*\)/gi, "").replace(/\s+/g, " ").trim();
    const evidenceIds = [...new Set(item.evidenceIds.map((id) => String(id).trim().toUpperCase()))];
    if (evidenceIds.some((id) => !knownIds.has(id))) {
      throw new Error(`Cover letter paragraph ${index + 1} cites evidence outside the confirmed resume.`);
    }
    return { text, evidenceIds };
  });
  // Models sometimes separate a brief thanks from the substantive closing.
  // Keep every sentence and its citations while returning four paragraphs.
  if (paragraphs.length === 5) {
    const last = paragraphs.pop();
    const previous = paragraphs.pop();
    paragraphs.push({
      text: `${previous.text} ${last.text}`.trim(),
      evidenceIds: [...new Set([...previous.evidenceIds, ...last.evidenceIds])],
    });
  }
  for (const [index, item] of paragraphs.entries()) {
    if (!item.text || item.text.length > 1600) {
      throw new Error(`Cover letter paragraph ${index + 1} is empty or too long for a review draft.`);
    }
  }
  return paragraphs;
}

function needsEvidence(item, index, count) {
  if (item.evidenceIds.length) return false;
  const isOpeningOrClosing = index === 0 || index === count - 1;
  const claimsStudentFact = /\b(?:I\s+(?:have|led|built|managed|developed|created|worked|studied|earned|bring|offer|am\s+(?:a|an|currently|pursuing|studying|experienced|proficient|skilled))|my\s+(?:background|experience|skills|degree|coursework|projects|work|internship)|as\s+a\s+(?:student|graduate|analyst|intern))\b/i.test(item.text);
  return !isOpeningOrClosing || claimsStudentFact || /\b\d+(?:[.,]\d+)?%?\b/.test(item.text);
}

export function validateLetterParagraphs(raw, evidence) {
  const paragraphs = normalizeLetterParagraphs(raw, evidence);
  for (const [index, item] of paragraphs.entries()) {
    const minimum = index === paragraphs.length - 1 ? 20 : 35;
    if (item.text.length < minimum || item.text.length > 850) {
      throw new Error(`Cover letter paragraph ${index + 1} must be a complete, concise paragraph.`);
    }
    if (needsEvidence(item, index, paragraphs.length)) {
      throw new Error(`Cover letter paragraph ${index + 1} needs verified resume evidence for its student claims.`);
    }
  }
  return paragraphs;
}

/**
 * Keep an otherwise usable letter when a claim lacks an evidence citation.
 * An unsupported number is replaced by a review placeholder, not presented
 * as a student accomplishment. The original proposal stays in separate notes.
 */
export function prepareLetterForReview(raw, evidence, verifiedPostingTitle = "") {
  const paragraphs = normalizeLetterParagraphs(raw, evidence);
  if (paragraphs.some((item) => item.text.includes(UNVERIFIED_LABEL))) {
    throw new Error("The model draft contained a reserved verification label.");
  }
  const verificationNotes = [];
  const postingYears = new Set([...numbersIn(verifiedPostingTitle)].filter((number) => /^(?:19|20)\d{2}$/.test(number)));
  for (const [index, item] of paragraphs.entries()) {
    const original = item.text;
    const minimum = index === paragraphs.length - 1 ? 20 : 35;
    const needsLengthReview = original.length < minimum || original.length > 850;
    const citedEvidence = evidence.filter((entry) => item.evidenceIds.includes(entry.id)).map((entry) => entry.text);
    const supportedNumbers = numbersIn(citedEvidence.join(" "));
    const unsupportedPositions = new Set();
    for (const match of original.matchAll(NUMBER_PATTERN)) {
      const number = match[0];
      const preceding = original.slice(Math.max(0, match.index - 20), match.index);
      const verifiedPeriodYear = postingYears.has(number) && /\b(?:Fall|Winter|Spring|Summer)\s*$/i.test(preceding);
      if (!supportedNumbers.has(number) && !verifiedPeriodYear) unsupportedPositions.add(match.index);
    }
    if (unsupportedPositions.size) {
      item.text = item.text.replace(NUMBER_PATTERN, (number, offset) => unsupportedPositions.has(offset) ? "[figure to verify]" : number);
    }
    if (!needsEvidence(item, index, paragraphs.length) && !unsupportedPositions.size && !needsLengthReview) continue;
    verificationNotes.push(unsupportedPositions.size
      ? `Paragraph ${index + 1}: An unsupported number was replaced by [figure to verify]. Check this proposed wording against your original resume and the posting before use: “${original}”`
      : needsLengthReview
        ? `Paragraph ${index + 1}: This paragraph may be too short or long for a complete letter. Revise and verify it before use: “${original}”`
        : `Paragraph ${index + 1}: Confirm or remove this proposed wording against your original resume before use: “${original}”`);
    item.text = `${UNVERIFIED_LABEL} ${item.text}`;
  }
  if (!paragraphs.slice(1, -1).some((item) => item.evidenceIds.length > 0)) {
    throw new Error("The cover letter needs at least one evidence-backed body paragraph before it can be saved.");
  }
  return { paragraphs, verificationNotes };
}
