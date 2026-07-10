const express = require("express");
const requireApiAuth = require("../middleware/requireApiAuth");
const messagesService = require("../messagesService");

const router = express.Router();

router.get("/threads", requireApiAuth, async (req, res) => {
  try {
    const threads = await messagesService.listThreadsForUser(req.userId);
    res.json({ threads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/unread-summary", requireApiAuth, async (req, res) => {
  try {
    const unreadCount = await messagesService.getUnreadMessageCount(req.userId);
    res.json({ has_unread: unreadCount > 0, unread_count: unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;