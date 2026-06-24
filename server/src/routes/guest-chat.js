const express = require("express");
const requireApiAuth = require("../middleware/requireApiAuth");
const guestChatService = require("../guestChatService");

const router = express.Router();

// Driver creates a guest token for a non-account passenger.
// POST /api/guest-chat/rides/:id/tokens
router.post("/rides/:id/tokens", requireApiAuth, async (req, res) => {
  try {
    const result = await guestChatService.createGuestToken(
      req.params.id,
      req.userId,
      req.body.guest_name,
      req.body.guest_phone
    );
    res.status(201).json(result);
  } catch (err) {
    const status = err.message.includes("Only the driver") ? 403
      : err.message.includes("not found") ? 404
      : 400;
    res.status(status).json({ error: err.message });
  }
});

// Driver lists all guest tokens for a ride.
// GET /api/guest-chat/rides/:id/tokens
router.get("/rides/:id/tokens", requireApiAuth, async (req, res) => {
  try {
    const tokens = await guestChatService.listGuestTokens(req.params.id, req.userId);
    res.json({ tokens });
  } catch (err) {
    const status = err.message.includes("Only the driver") ? 403
      : err.message.includes("not found") ? 404
      : 500;
    res.status(status).json({ error: err.message });
  }
});

// Guest resolves their token and gets ride info + messages.
// GET /api/guest-chat?token=xxx
router.get("/", async (req, res) => {
  try {
    const result = await guestChatService.resolveGuestToken(req.query.token);
    res.json(result);
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("expired") ? 401
      : err.message.includes("not found") || err.message.includes("no longer exists") ? 404
      : 400;
    res.status(status).json({ error: err.message });
  }
});

// Guest sends a message using their token.
// POST /api/guest-chat/messages
router.post("/messages", async (req, res) => {
  try {
    await guestChatService.sendGuestMessage(req.body.token, req.body.body);
    res.json({ ok: true });
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("expired") ? 401
      : err.message.includes("Please enter") ? 400
      : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;