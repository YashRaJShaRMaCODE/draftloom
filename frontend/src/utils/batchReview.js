import { findSensitiveValues } from "./sensitiveData.js";

export const MAX_BATCH_DRAFTS = 5;

export function prepareBatchDrafts(values, maxLength = 5000) {
  const drafts = values.map((value) => String(value).trim()).filter(Boolean);
  if (drafts.length < 2) return { drafts: [], error: "Add at least two drafts to review together." };
  if (drafts.length > MAX_BATCH_DRAFTS) return { drafts: [], error: `Review up to ${MAX_BATCH_DRAFTS} drafts at a time.` };
  if (drafts.some((draft) => [...draft].length > maxLength)) {
    return { drafts: [], error: `Each draft must stay within ${maxLength.toLocaleString()} characters.` };
  }
  const flagged = drafts.flatMap((draft, index) => findSensitiveValues(draft).length ? [index + 1] : []);
  if (flagged.length) {
    return { drafts: [], error: `Possible personal details found in draft ${flagged.join(", ")}. Remove them before batch review.` };
  }
  return { drafts, error: "" };
}
