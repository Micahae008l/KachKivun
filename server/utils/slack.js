/** Best-effort ping to the owner's Slack (SLACK_WEBHOOK_URL); never delays or fails the caller. */
export function notifySlack(env, message) {
  const url = String(env?.SLACK_WEBHOOK_URL || "").trim();
  if (!url.startsWith("https://hooks.slack.com/")) return;
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: message }),
    signal: AbortSignal.timeout(5000),
  }).catch((error) => console.warn("[slack] notify failed", error.message));
}
