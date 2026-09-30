// Posting vocabulary must never become a source of new student claims.
const GRAMMAR = new Set('a an the and or of for to in on at with by from as into through using used use that which this these those their its it they them be was were is are while including include included supporting support supported covering cover covered creating create created developing develop developed building build built documenting document documented maintaining maintain maintained managing manage managed analyzing analyze analyzed preparing prepare prepared presenting present presented improving improve improved helping help helped'.split(' '));
const FAMILIES = [
  ['build', 'built', 'create', 'created', 'develop', 'developed', 'developing', 'creating'],
  ['analyze', 'analyzed', 'analyzing', 'analysis'], ['document', 'documented', 'documenting', 'documentation'],
  ['support', 'supported', 'supporting'], ['manage', 'managed', 'managing'], ['prepare', 'prepared', 'preparing'],
  ['present', 'presented', 'presenting'], ['improve', 'improved', 'improving', 'improvement'],
  ['help', 'helped', 'helping'], ['maintain', 'maintained', 'maintaining'], ['cover', 'covered', 'covering'],
];
const tokens = value => String(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const numbers = value => String(value).match(/[+~]?\d+(?:[.,]\d+)*(?:\+|%|\/\d+)?/g) ?? [];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function validateOne(edit, selected, evidence) {
  const source = evidence.find(item => item.id === edit?.evidenceId);
  if (!source || !selected.some(item => item.evidenceId === edit.evidenceId) ||
      typeof edit.revisedText !== 'string' || !edit.revisedText.trim() || edit.revisedText.length > 1200) {
    throw new TypeError('A resume edit must refer to one selected, verified source line.');
  }
  const before = tokens(source.text), after = tokens(edit.revisedText);
  const sourceWords = new Set(before), revisedWords = new Set(after), allowed = new Set(sourceWords);
  for (const word of GRAMMAR) if (!FAMILIES.some(family => family.includes(word))) allowed.add(word);
  for (const family of FAMILIES) if (family.some(word => sourceWords.has(word))) for (const word of family) allowed.add(word);
  // Keep source nouns, skills, and qualifiers. Verb changes must stay within
  // the source action's family rather than introduce a stronger achievement.
  if (after.some(word => !allowed.has(word)) || before.some(word => !revisedWords.has(word) &&
      (!GRAMMAR.has(word) || FAMILIES.some(family => family.includes(word) && !family.some(next => revisedWords.has(next)))))) {
    throw new TypeError('A proposed resume edit added an unsupported claim or removed a source detail.');
  }
  if (!equal(numbers(source.text).sort(), numbers(edit.revisedText).sort())) {
    throw new TypeError('A proposed resume edit changed an original number, date, or metric.');
  }
  if (!edit.requirement || !edit.rationale) {
    if (!equal([...before].sort(), [...after].sort())) throw new TypeError('A wording change needs its posting requirement and explanation.');
  }
  return edit;
}

/**
 * Allow anchored grammatical rewrites with neutral action equivalents while
 * retaining source details and rejecting new substantive claims.
 * @param {{evidenceId:string,revisedText:string}[]} edits
 * @param {{evidenceId:string}[]} selected
 * @param {{id:string,text:string}[]} evidence
 */
export function validateResumeEdits(edits, selected, evidence) {
  if (!Array.isArray(edits) || edits.length > 4 || new Set(edits.map((item) => item.evidenceId)).size !== edits.length) {
    throw new TypeError("The proposed resume edits must be unique and limited to four lines.");
  }
  return edits.map(edit => validateOne(edit, selected, evidence));
}

/**
 * An unsafe optional wording edit must not block a complete resume whose
 * selected evidence is otherwise verified. Keep rejected lines unchanged;
 * accepted independent edits still receive their own highlights and log.
 * @param {{evidenceId:string,revisedText:string}[]} edits
 * @param {{evidenceId:string}[]} selected
 * @param {{id:string,text:string}[]} evidence
 */
export function safeResumeEdits(edits, selected, evidence) {
  if (!Array.isArray(edits) || edits.length > 4) return { edits: [], omitted: true };
  const accepted = [], seen = new Set(); let omitted = false;
  for (const edit of edits) {
    try {
      if (seen.has(edit?.evidenceId)) throw new TypeError('Duplicate edit.');
      seen.add(edit?.evidenceId);
      const valid = validateOne(edit, selected, evidence);
      const source = evidence.find(item => item.id === edit.evidenceId);
      if (source.text.replace(/\s+/g, ' ').trim() !== edit.revisedText.replace(/\s+/g, ' ').trim()) accepted.push(valid);
    } catch { omitted = true; }
  }
  return { edits: accepted, omitted };
}

/** Word-level diff: unchanged words are not highlighted. */
export function changedTextRuns(original, revised) {
  const before = String(original).match(/\S+\s*/g) ?? [], after = String(revised).match(/\S+\s*/g) ?? [];
  const n = before.length, m = after.length;
  const key = value => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const weight = value => GRAMMAR.has(key(value)) ? 1 : 3;
  const lengths = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    lengths[i][j] = key(before[i]) === key(after[j]) ? weight(before[i]) + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  }
  const runs = []; let i = 0, j = 0;
  const append = (text, highlight) => {
    if (runs.at(-1)?.highlight === highlight) runs.at(-1).text += text;
    else runs.push({ text, highlight });
  };
  while (j < m) {
    if (i < n && key(before[i]) === key(after[j])) { append(after[j], before[i].trim() !== after[j].trim()); j++; i++; }
    else if (i < n && lengths[i + 1][j] > lengths[i][j + 1]) i++;
    else append(after[j++], true);
  }
  return runs;
}
