const fs = require("fs");
const path = require("path");
const express = require("express");

const router = express.Router();
const feedbackPath = path.join(__dirname, "..", "..", "data", "feedback.jsonl");

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

router.post("/", (req, res) => {
  try {
    const type = cleanText(req.body?.type, 40) || "Other";
    const message = cleanText(req.body?.message, 2000);
    const email = cleanText(req.body?.email, 120);
    const page = cleanText(req.body?.page, 500);

    if (!message) {
      res.status(400).json({ error: "Please enter your feedback before sending." });
      return;
    }

    const entry = {
      created_at: new Date().toISOString(),
      user_id: req.session?.userId || null,
      type,
      message,
      email: email || null,
      page: page || null,
      user_agent: req.get("user-agent") || null,
    };

    fs.mkdirSync(path.dirname(feedbackPath), { recursive: true });
    fs.appendFileSync(feedbackPath, `${JSON.stringify(entry)}\n`, "utf8");
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
