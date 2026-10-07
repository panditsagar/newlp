import { getDb } from "./_db.js";

// Routing form / booking answers arrive as [{ label, type, answer }, ...] — flatten to a
// plain object for easy reading, and pull out name/email/phone if present among them.
function summarizeAnswers(answers) {
  if (!Array.isArray(answers)) return { fields: {}, identity: {} };

  var fields = {};
  var identity = {};

  answers.forEach(function (a) {
    if (!a || !a.label) return;
    fields[a.label] = a.answer;

    var type = (a.type || "").toLowerCase();
    var label = (a.label || "").toLowerCase();
    if (type === "email" || label.includes("email")) identity.email = a.answer;
    else if (type === "phone" || label.includes("phone") || label.includes("mobile")) identity.phone = a.answer;
    else if (type === "name" || label.includes("name")) identity.name = a.answer;
  });

  return { fields: fields, identity: identity };
}

function mapEvent(payload) {
  if (payload.event === "routing_form.viewed") {
    return { name: "routing_form_view", meta: null, lead: null };
  }

  if (payload.event === "form.submitted") {
    var qualified = payload.result && payload.result.type !== "custom_message" && payload.result.type !== "external_url";
    var summary = summarizeAnswers(payload.answers);
    return {
      name: "routing_form_submitted",
      meta: { qualified: !!qualified, resultType: payload.result?.type, resultLabel: payload.result?.label, rule: payload.rule?.name },
      lead: Object.assign({}, summary.identity, { answers: summary.fields }),
    };
  }

  if (payload.event === "booking.created" || payload.event === "booking.cancelled" || payload.event === "booking.rescheduled") {
    var name = payload.event === "booking.created" ? "booking_created" : payload.event === "booking.cancelled" ? "booking_cancelled" : "booking_rescheduled";
    var summary = summarizeAnswers(payload.answers);
    return {
      name: name,
      meta: { bookingId: payload.booking?.id, startTime: payload.booking?.startTime, status: payload.booking?.status },
      lead: Object.assign(
        { name: payload.booking?.bookerName, email: payload.booking?.bookerEmail },
        summary.identity,
        { answers: summary.fields }
      ),
    };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const tracking = payload.tracking || payload.booking?.trackingData || {};
    const vid = tracking.vid;

    const mapped = mapEvent(payload);

    if (!vid || !mapped) {
      // Nothing to correlate yet (hashcal hasn't been updated to forward tracking data),
      // or an event type we don't handle — ack anyway so hashcal doesn't retry forever.
      return res.status(204).end();
    }

    const sql = getDb();
    await sql`
      insert into funnel_events
        (vid, sid, event_name, page, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, meta, raw_params, lead)
      values
        (${vid}, ${tracking.sid || null}, ${mapped.name}, ${"hashcal"}, ${tracking.utm_source || null}, ${tracking.utm_medium || null},
         ${tracking.utm_campaign || null}, ${tracking.utm_content || null}, ${tracking.utm_term || null},
         ${tracking.fbclid || null}, ${tracking.gclid || null}, ${sql.json(mapped.meta || null)},
         ${sql.json(tracking || null)}, ${sql.json(mapped.lead || null)})
    `;

    return res.status(204).end();
  } catch (err) {
    console.error("[hashcal-webhook] error", err.message);
    // Ack 200 regardless so hashcal's retry logic doesn't hammer us on our own bugs
    return res.status(200).json({ received: true, error: true });
  }
}
