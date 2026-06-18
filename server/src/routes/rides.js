const express = require("express");
const requireApiAuth = require("../middleware/requireApiAuth");

function sessionUserId(req) {
  return req.session?.userId ?? null;
}
const ridesService = require("../ridesService");
const rideArchive = require("../rideArchive");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const scope = req.query.scope === "my" ? "my" : "all";
    const search = req.query.q || "";
    const rides = await ridesService.listRides(
      { scope, search },
      sessionUserId(req)
    );
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/become-driver", requireApiAuth, async (req, res) => {
  try {
    const offer = await ridesService.becomeDriver(req.params.id, req.userId);
    res.status(201).json(offer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/cancel-driver-offer", requireApiAuth, async (req, res) => {
  try {
    const result = await ridesService.cancelDriverOffer(req.params.id, req.userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post(
  "/:id/driver-offers/:offerId/accept",
  requireApiAuth,
  async (req, res) => {
    try {
      const result = await ridesService.respondToDriverOffer(
        req.params.id,
        req.params.offerId,
        req.userId,
        true
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.post(
  "/:id/driver-offers/:offerId/decline",
  requireApiAuth,
  async (req, res) => {
    try {
      const result = await ridesService.respondToDriverOffer(
        req.params.id,
        req.params.offerId,
        req.userId,
        false
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.get("/:id/detail", requireApiAuth, async (req, res) => {
  try {
    const detail = await ridesService.getRideDetail(req.params.id, req.userId);
    if (!detail) {
      res.status(404).json({ error: "Ride not found." });
      return;
    }
    res.json(detail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ride = await ridesService.getRideById(
      req.params.id,
      sessionUserId(req)
    );
    if (!ride) {
      res.status(404).json({ error: "Ride not found." });
      return;
    }
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", requireApiAuth, async (req, res) => {
  try {
    const profile = await ridesService.getProfile(req.userId);
    if (!profile) {
      res.status(400).json({
        error: "Complete your profile before posting a ride.",
        code: "PROFILE_REQUIRED",
      });
      return;
    }
    const ride = await ridesService.saveRide(req.userId, req.body);
    const archivePath = rideArchive.saveRidePost(ride, req.userId, "created");
    res.status(201).json({ ...ride, archivePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", requireApiAuth, async (req, res) => {
  try {
    const ride = await ridesService.saveRide(req.userId, {
      ...req.body,
      rideId: Number(req.params.id),
    });
    const archivePath = rideArchive.saveRidePost(ride, req.userId, "updated");
    res.json({ ...ride, archivePath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/join", requireApiAuth, async (req, res) => {
  try {
    await ridesService.joinRide(req.params.id, req.userId, {
      partySize: req.body?.partySize,
      guests: req.body?.guests,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/leave", requireApiAuth, async (req, res) => {
  try {
    await ridesService.leaveRide(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireApiAuth, async (req, res) => {
  try {
    await ridesService.cancelRide(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/comments", requireApiAuth, async (req, res) => {
  try {
    await ridesService.addComment(
      req.params.id,
      req.userId,
      req.body.commentBody || ""
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// delete comments
router.delete("/:id/comments/:commentId", requireApiAuth, async (req, res) => {
  try {
    await ridesService.deleteComment(
      req.params.id,
      req.params.commentId,
      req.userId
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// edit comments
router.put("/:id/comments/:commentId", requireApiAuth, async (req, res) => {
  try {
    await ridesService.updateComment(
      req.params.id,
      req.params.commentId,
      req.userId,
      req.body.commentBody || ""
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/ratings", requireApiAuth, async (req, res) => {
  try {
    await ridesService.ratePerson(
      req.params.id,
      req.userId,
      req.body.ratedUserId,
      Number(req.body.rating),
      req.body.ratingComment || "",
      req.body.role
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// delete rating
router.delete("/:id/ratings/:ratedUserId", requireApiAuth, async (req, res) => {
  try {
    await ridesService.deleteRating(
      req.params.id,
      req.params.ratedUserId,
      req.userId
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;