const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function workspaceUsageCsv(workspace) {
  if (!workspace?.usage || workspace.role !== "owner") return "";
  const fields = [
    ["Workspace", workspace.name],
    ["Period", workspace.usage.period],
    ["Plan", workspace.usage.plan],
    ["AI requests used", workspace.usage.used],
    ["AI request limit", workspace.usage.limit],
    ["Seats", workspace.usage.seats],
    ["Provider cost", "Not measured"],
  ];
  return fields.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
