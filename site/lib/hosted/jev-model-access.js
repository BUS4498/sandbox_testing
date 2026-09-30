export function selectJevModel(payload, preferredModel) {
  if (!payload || !Array.isArray(payload.models)) throw new TypeError("Invalid TypeSafe model list.");
  const names = payload.models.map((item) => item?.name).filter((name) => typeof name === "string" && /^jev-(?:latest|\d+(?:\.\d+){1,2})$/i.test(name));
  return names.includes(preferredModel) ? preferredModel : names.includes("jev-latest") ? "jev-latest" : names[0] ?? null;
}

export function inspectJevModels(payload, preferredModel) {
  try { return selectJevModel(payload, preferredModel) ? "AVAILABLE" : "MODEL_UNAVAILABLE"; }
  catch { return "INVALID_RESPONSE"; }
}
