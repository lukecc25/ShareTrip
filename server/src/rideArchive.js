const fs = require("fs");
const path = require("path");

const postsDir = path.join(__dirname, "..", "data", "ride-posts");
const logFileName = "posts-log.txt";

function ensurePostsDir() {
  fs.mkdirSync(postsDir, { recursive: true });
}

function buildExportRecord(ride, ownerId, action) {
  return {
    exportedAt: new Date().toISOString(),
    action,
    ownerId,
    ride: {
      id: ride.id,
      owner_id: ride.owner_id,
      ride_type: ride.ride_type,
      roundtrip: ride.roundtrip,
      seats: ride.seats,
      start_date: ride.start_date,
      end_date: ride.end_date,
      origin: ride.origin,
      destination: ride.destination,
      ride_cost: ride.ride_cost,
      gender_preference: ride.gender_preference,
      created_at: ride.created_at,
      updated_at: ride.updated_at,
    },
  };
}

function formatTextFile(record) {
  const ride = record.ride;
  return [
    "ShareTrip Ride Post Export",
    "==========================",
    `Exported: ${record.exportedAt}`,
    `Action: ${record.action}`,
    `Ride ID: ${ride.id}`,
    `Owner ID: ${record.ownerId}`,
    "",
    "Ride details",
    "------------",
    `Type: ${ride.ride_type}`,
    `Trip: ${ride.roundtrip ? "round trip" : "one way"}`,
    `Origin: ${ride.origin}`,
    `Destination: ${ride.destination}`,
    `Start date: ${ride.start_date}`,
    `End date: ${ride.end_date}`,
    `Seats available: ${ride.seats}`,
    `Total cost: $${Number(ride.ride_cost).toFixed(2)}`,
    `Gender preference: ${ride.gender_preference}`,
    "",
    "Database import (JSON)",
    "----------------------",
    JSON.stringify(record, null, 2),
    "",
  ].join("\n");
}

function saveRidePost(ride, ownerId, action = "created") {
  if (!ride?.id) {
    return null;
  }

  ensurePostsDir();

  const record = buildExportRecord(ride, ownerId, action);
  const fileName = `ride-${ride.id}.txt`;
  const filePath = path.join(postsDir, fileName);
  const logPath = path.join(postsDir, logFileName);

  fs.writeFileSync(filePath, formatTextFile(record), "utf8");
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");

  return filePath;
}

module.exports = {
  postsDir,
  saveRidePost,
};
