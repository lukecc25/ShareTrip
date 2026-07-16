const express = require("express");
const requireApiAuth = require("../middleware/requireApiAuth");
const authService = require("../authService");
const ridesService = require("../ridesService");

const router = express.Router();

// Substrings used to tell validation errors (400) apart from unexpected
// server errors (500). Keep these in sync with the messages thrown in
// authService.js.
const VALIDATION_ERROR_HINTS = [
  "Profile picture",
  "Seat capacity",
  "license plate",
  "vehicle field",
  "available to drive",
];

function isValidationError(message) {
  return VALIDATION_ERROR_HINTS.some((hint) => message.includes(hint));
}

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
    car_make_model: carMakeModel,
    car_color: carColor,
    car_seat_capacity: carSeatCapacity,
    license_plate_partial: licensePlatePartial,
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
      car_make_model: carMakeModel,
      car_color: carColor,
      car_seat_capacity: carSeatCapacity,
      license_plate_partial: licensePlatePartial,
      ...(Object.prototype.hasOwnProperty.call(req.body, "profile_picture_url")
        ? { profile_picture_url: profilePictureUrl }
        : {}),
    });
    res.json(profile);
  } catch (err) {
    const status = isValidationError(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.get("/:userId/overview", requireApiAuth, async (req, res) => {
  try {
    const overview = await ridesService.getUserProfileOverview(req.params.userId);
    if (!overview) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me/password", requireApiAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    await authService.changePassword(req.userId, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (err) {
    const status = err.message.includes("incorrect")
      ? 401
      : err.message.includes("required") || err.message.includes("at least")
        ? 400
        : err.message.includes("not found")
          ? 404
          : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;