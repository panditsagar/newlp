import { getDb } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { vid, sid, eventName, page, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, meta, raw_params } = body;

    if (!vid || !eventName) {
      return res.status(400).json({ error: "vid and eventName are required" });
    }

    const sql = getDb();
    await sql`
      insert into funnel_events
        (vid, sid, event_name, page, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, meta, raw_params)
      values
        (${vid}, ${sid || null}, ${eventName}, ${page || null}, ${utm_source || null}, ${utm_medium || null}, ${utm_campaign || null},
         ${utm_content || null}, ${utm_term || null}, ${fbclid || null}, ${gclid || null},
         ${sql.json(meta || null)}, ${sql.json(raw_params || null)})
    `;

    return res.status(204).end();
  } catch (err) {
    console.error("[track] error", err.message);
    return res.status(500).json({ error: "Failed to record event" });
  }
}
