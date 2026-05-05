const APP_LOGIN_EMAIL = String(process.env.APP_LOGIN_EMAIL || "").trim().toLowerCase();

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  const { email } = req.body || {};
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
};
