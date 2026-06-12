const express = require("express");
const requireApiAuth = require("../middleware/requireApiAuth");
const authService = require("../authService");
const ridesService = require("../ridesService");

const router = express.Router();

router.get("/me/overview", requireApiAuth, async (req, res) => {
  try {
    const overview = await ridesService.getUserProfileOverview(req.userId);
    if (!overview) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me/profile", requireApiAuth, async (req, res) => {
  try {
    const profile = await authService.getAccountById(req.userId);
    if (!profile) {
      req.session.destroy(() => {
        res.clearCookie("connect.sid", req.app.get("sessionCookieOptions") || { path: "/" });
        res.status(401).json({ error: "Session expired. Please sign in again." });
      });
      return;
    }
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me/profile", requireApiAuth, async (req, res) => {
  const {
    fname,
    lname,
    phone,
    gender,
    email,
    able_driver: ableDriver,
    profile_picture_url: profilePictureUrl,
  } = req.body;
  if (!fname || !lname || !gender || !email) {
    res.status(400).json({
      error: "fname, lname, email, and gender are required.",
    });
    return;
  }
  if (!["Male", "Female"].includes(gender)) {
    res.status(400).json({ error: "gender must be Male or Female." });
    return;
  }

  try {
    const profile = await authService.updateAccount(req.userId, {
      fname,
      lname,
      phone,
      gender,
      email,
      able_driver: ableDriver,
      ...(Object.prototype.hasOwnProperty.call(req.body, "profile_picture_url")
        ? { profile_picture_url: profilePictureUrl }
        : {}),
    });
    res.json(profile);
  } catch (err) {
    const status = err.message.includes("Profile picture") ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
