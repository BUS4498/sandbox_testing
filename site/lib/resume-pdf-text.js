/** Respect explicit PDF.js line endings as well as geometric line changes. */
export function linesFromPdfTextItems(items) {
  const lines = [];
  let current = "";
  let previousY = null;
  for (const item of items) {
    if (!item || typeof item.str !== "string") continue;
    const y = Array.isArray(item.transform) ? Number(item.transform[5]) : NaN;
    if (current && Number.isFinite(y) && previousY !== null && Math.abs(y - previousY) > 2) {
      lines.push(current.trim());
      current = "";
    }
    const segment = item.str.trim();
    if (segment) current += `${current ? " " : ""}${segment}`;
    if (item.hasEOL && current) {
      lines.push(current.trim());
      current = "";
      previousY = null;
    } else if (Number.isFinite(y)) {
      previousY = y;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
