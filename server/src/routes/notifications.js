const express = require("express");
const requireApiAuth = require("../middleware/requireApiAuth");
const ridesService = require("../ridesService");

const router = express.Router();

router.get("/", requireApiAuth, async (req, res) => {
  try {
    const unreadOnly = req.query.unread !== "0";
    const notifications = await ridesService.listNotifications(
      req.userId,
      unreadOnly
    );
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/read", requireApiAuth, async (req, res) => {
  try {
    await ridesService.markNotificationsRead(req.userId, req.body.ids);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/delete", requireApiAuth, async (req, res) => {
  try {
    await ridesService.deleteNotifications(req.userId, req.body.ids);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
