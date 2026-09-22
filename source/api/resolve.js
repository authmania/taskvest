// nuAlt NUBAN account-name resolver proxy (server-side, avoids browser CORS).
// Docs: https://nu-alt.shop/docs
const NU_BASE = "https://nu-alt.shop/v1";
const KEY = process.env.NUALT_API_KEY || "nualt_pEzwOai3PudFMbfFsLHawhFbF7x6oqKvyXs8HdvneLI";

export async function resolveAccount(accNo, bank) {
  const acc = String(accNo || "").replace(/\D/g, "");
  const bankQ = String(bank || "").trim();
  if (!/^\d{10}$/.test(acc) || !bankQ) {
    return { status: 422, body: { ok: false, detail: "acc_no must be exactly 10 digits and bank is required" } };
  }
  try {
    const r = await fetch(
      `${NU_BASE}/resolve?acc_no=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bankQ)}`,
      { headers: { Authorization: "Bearer " + KEY, Accept: "application/json" } }
    );
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { ok: false, detail: text || "Upstream error" }; }
    return { status: r.status, body };
  } catch (err) {
    return { status: 502, body: { ok: false, detail: "Resolver unavailable: " + err.message } };
  }
}

// Vercel / Netlify-style handler
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const q = req.query || {};
  const out = await resolveAccount(q.acc_no, q.bank);
  res.status(out.status).json(out.body);
}
