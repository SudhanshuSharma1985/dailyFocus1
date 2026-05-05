const APP_LOGIN_EMAIL = String(process.env.APP_LOGIN_EMAIL || "").trim().toLowerCase();

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function parseBody(req) {
  if (req.body !== undefined) return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Request body too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  try {
    const body = await parseBody(req);
    const { email } = body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({ ok: false, error: "Enter a valid email ID." });
      return;
    }

    if (APP_LOGIN_EMAIL && normalizedEmail !== APP_LOGIN_EMAIL) {
      res.status(401).json({ ok: false, error: "This email ID is not allowed." });
      return;
    }

    res.status(200).json({ ok: true, email: normalizedEmail });
  } catch (err) {
    res.status(400).json({ ok: false, error: "Invalid request body." });
  }
};
