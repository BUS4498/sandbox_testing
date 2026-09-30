/** @param {string} value */
function wordMultiset(value) {
  return String(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.sort().join("|") ?? "";
}

/**
 * Allow only in-place revisions that reuse every verified source word.
 * This is intentionally stricter than semantic similarity: a model cannot add
 * a credential, employer, date, number, or unsupported responsibility.
 * @param {{evidenceId:string,revisedText:string}[]} edits
 * @param {{evidenceId:string}[]} selected
 * @param {{id:string,text:string}[]} evidence
 */
export function validateResumeEdits(edits, selected, evidence) {
  if (!Array.isArray(edits) || edits.length > 4 || new Set(edits.map((item) => item.evidenceId)).size !== edits.length) {
    throw new TypeError("The proposed resume edits must be unique and limited to four lines.");
  }
  for (const edit of edits) {
    const source = evidence.find((item) => item.id === edit.evidenceId);
    if (!source || !selected.some((item) => item.evidenceId === edit.evidenceId) || typeof edit.revisedText !== "string" || !edit.revisedText.trim() || edit.revisedText.length > 450 ||
        wordMultiset(edit.revisedText) !== wordMultiset(source.text)) {
      throw new TypeError("The proposed resume edits did not preserve the original verified wording and facts.");
    }
  }
  return edits;
}

/**
 * An unsafe optional wording edit must not block a complete resume whose
 * selected evidence is otherwise verified. Retain original lines and their
 * highlighting instead of applying unsupported model wording.
 * @param {{evidenceId:string,revisedText:string}[]} edits
 * @param {{evidenceId:string}[]} selected
 * @param {{id:string,text:string}[]} evidence
 */
export function safeResumeEdits(edits, selected, evidence) {
  try { return { edits: validateResumeEdits(edits, selected, evidence), omitted: false }; }
  catch { return { edits: [], omitted: Array.isArray(edits) && edits.length > 0 }; }
}
