export function templateVariables(body) {
  return [...new Set([...String(body).matchAll(/\{\{([a-z][a-z0-9_]{0,39})\}\}/g)].map((match) => match[1]))];
}

export function renderTemplate(body, values) {
  return String(body).replace(/\{\{([a-z][a-z0-9_]{0,39})\}\}/g, (_, name) => values[name]?.trim() || "");
}
