const PATTERNS = [
  { type: "API key or access token", regex: /\b(?:sk_(?:live|test)_[A-Za-z0-9]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{25,})\b/g },
  { type: "email address", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone number", regex: /\+?\d[\d\s().-]{7,}\d/g },
];

export function findSensitiveValues(text) {
  const findings = [];
  for (const pattern of PATTERNS) {
    for (const match of String(text).matchAll(pattern.regex)) {
      const digits = match[0].replace(/\D/g, "").length;
      if (pattern.type === "phone number" && (digits < 10 || digits > 15)) continue;
      if (!findings.some((item) => match.index < item.end && match.index + match[0].length > item.start)) {
        findings.push({ type: pattern.type, value: match[0], start: match.index, end: match.index + match[0].length });
      }
    }
  }
  return findings.sort((a, b) => a.start - b.start);
}

export function redactSensitiveValues(text, findings = findSensitiveValues(text)) {
  let output = "";
  let cursor = 0;
  for (const item of findings) {
    output += text.slice(cursor, item.start) + `[REDACTED: ${item.type}]`;
    cursor = item.end;
  }
  return output + text.slice(cursor);
}
