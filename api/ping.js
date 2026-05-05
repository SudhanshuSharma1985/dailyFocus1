module.exports = (req, res) => {
  res.status(200).json({ ok: true, message: "pong", node: process.version });
};
