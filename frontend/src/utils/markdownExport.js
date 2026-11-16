export function markdownResult(text) {
  const body = String(text ?? "").trim();
  return body ? `# Clear Writing result\n\n${body}\n` : "";
}
