export function networkStatusMessage(isOnline) {
  return isOnline ? "" : "You are offline. Your draft stays in this tab; reconnect, then choose Rewrite or Summarise again.";
}
