import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: "SLACK_WEBHOOK_URL not configured" });
  }

  const { text } = req.body ?? {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text field" });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    return res.status(502).json({ error: "Slack webhook failed", status: response.status });
  }

  return res.status(200).json({ ok: true });
}
