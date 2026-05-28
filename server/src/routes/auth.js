const express = require("express");
const authService = require("../authService");

const router = express.Router();

router.get("/session", (req, res) => {
  const userId = req.session?.userId ?? null;
  res.json({
    isAuthenticated: Boolean(userId),
    userId,
  });
});

router.post("/signup", async (req, res) => {
  const { fname, lname, email, phone, gender, password } = req.body;

  if (!fname || !lname || !email || !gender || !password) {
    res.status(400).json({
      error: "First name, last name, email, gender, and password are required.",
    });
    return;
  }
  if (!["Male", "Female"].includes(gender)) {
    res.status(400).json({ error: "gender must be Male or Female." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  try {
    const account = await authService.createAccount({
      fname,
      lname,
      email,
      phone,
      gender,
      password,
    });
    req.session.userId = account.id;
    res.status(201).json({ account });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  try {
    const account = await authService.verifyLogin(email, password);
    if (!account) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }
    req.session.userId = account.id;
    res.json({ account });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Could not log out." });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

module.exports = router;
