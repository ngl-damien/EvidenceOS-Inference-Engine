export const METHOD_VERSION = "lexical-path-evidence/0.1.0";

const STOP = new Set([
  "about","after","again","against","also","among","and","any","are","because",
  "been","before","being","between","both","build","built","can","could","does",
  "each","enable","enables","for","from","has","have","into","its","more","most",
  "not","our","provides","provide","should","such","than","that","the","their",
  "them","then","there","these","they","this","those","through","use","used",
  "using","uses","was","were","what","when","where","which","while","will","with",
  "within","would","you","your"
]);

export function tokenize(value) {
  return [...new Set(String(value).toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP.has(token)))];
}
