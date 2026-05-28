const express = require("express");
const requireApiAuth = require("../middleware/requireApiAuth");
const authService = require("../authService");

const router = express.Router();

router.get("/me/profile", requireApiAuth, async (req, res) => {
  try {
    const profile = await authService.getAccountById(req.userId);
    if (!profile) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me/profile", requireApiAuth, async (req, res) => {
  const { fname, lname, phone, gender, email } = req.body;
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
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
