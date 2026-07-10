const { randomBytes } = require("crypto");
const { getSupabase } = require("./supabase");
const { fetchStore } = require("./dataStore");
const { now, throwIfError } = require("./dbUtils");

// Inline helpers to avoid circular dependency with messagesService.
function getChatDriverId(ride) {
  return ride.ride_type === "offer" ? ride.owner_id : ride.assigned_driver_id;
}

function isThreadParticipant(ride, userId, store) {
  if (!ride || !userId) return false;
  if (ride.owner_id === userId) return true;
  const driverId = getChatDriverId(ride);
  if (driverId && driverId === userId) return true;
  if (ride.ride_type === "offer") {
    return store.passengers.some(
      (p) => Number(p.ride_id) === Number(ride.id) && p.user_id === userId
    );
  }
  return false;
}

const TOKEN_EXPIRY_DAYS = 7;

function generateToken() {
  return randomBytes(32).toString("hex");
}

function expiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + TOKEN_EXPIRY_DAYS);
  return d.toISOString();
}

function findRide(store, id) {
  return store.rides.find((r) => Number(r.id) === Number(id)) || null;
}

// Creates a guest token for a non-account passenger.
// Can be called by the driver or by any ride participant (e.g. a passenger
// who joined with guests and needs to share chat links with them).
async function createGuestToken(rideId, requestingUserId, guestName, guestPhone) {
  if (!guestName?.trim()) {
    throw new Error("Guest name is required.");
  }

  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride) {
    throw new Error("Ride not found.");
  }

  if (!isThreadParticipant(ride, requestingUserId, store)) {
    throw new Error("You do not have access to this ride.");
  }

  const token = generateToken();

  throwIfError(
    await getSupabase().from("guest_tokens").insert({
      ride_id: Number(rideId),
      token,
      guest_name: guestName.trim().slice(0, 75),
      guest_phone: guestPhone ? guestPhone.trim().slice(0, 20) : null,
      created_by: requestingUserId,
      created_at: now(),
      expires_at: expiresAt(),
    })
  );

  return { token };
}

// Validates a guest token and returns ride + guest info if valid.
async function resolveGuestToken(token) {
  if (!token) {
    throw new Error("No token provided.");
  }

  const row = throwIfError(
    await getSupabase()
      .from("guest_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle()
  );

  if (!row) {
    throw new Error("Invalid or expired link.");
  }

  if (new Date(row.expires_at) < new Date()) {
    throw new Error("This link has expired.");
  }

  const store = await fetchStore();
  const ride = findRide(store, row.ride_id);
  if (!ride) {
    throw new Error("The ride for this link no longer exists.");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (ride.start_date < todayStr) {
    throw new Error("Chat history is no longer available for past rides.");
  }

  const messages = store.messages
    .filter((m) => Number(m.ride_id) === Number(row.ride_id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => {
      const sender = store.accounts.find((a) => a.id === m.user_id);
      // Check if message was sent by this guest token
      const isOwn = m.guest_token === token;
      return {
        id: m.id,
        body: m.body,
        created_at: m.created_at,
        fname: isOwn ? row.guest_name : (sender?.fname ?? ""),
        lname: isOwn ? "" : (sender?.lname ?? ""),
        is_own: isOwn,
        is_guest: !sender,
      };
    });

  return {
    ride: {
      id: ride.id,
      origin: ride.origin,
      destination: ride.destination,
      destination_state: ride.destination_state,
      start_date: ride.start_date,
      departure_time: ride.departure_time ?? null,
    },
    guest: {
      name: row.guest_name,
      token,
    },
    messages,
  };
}

// Guest sends a message using their token.
async function sendGuestMessage(token, body) {
  const text = String(body || "").trim().slice(0, 1000);
  if (!text) {
    throw new Error("Please enter a message before sending.");
  }

  const row = throwIfError(
    await getSupabase()
      .from("guest_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle()
  );

  if (!row) {
    throw new Error("Invalid or expired link.");
  }
  if (new Date(row.expires_at) < new Date()) {
    throw new Error("This link has expired.");
  }

  const store = await fetchStore();
  const ride = findRide(store, row.ride_id);
  if (!ride) {
    throw new Error("Ride not found.");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (ride.start_date < todayStr) {
    throw new Error("You cannot send messages for a past ride.");
  }

  // Store the guest's token on the message so we can identify it later.
  throwIfError(
    await getSupabase().from("messages").insert({
      ride_id: Number(row.ride_id),
      user_id: null,
      guest_token: token,
      body: text,
      created_at: now(),
    })
  );
}

// Renews an existing guest token by pushing its expiry out another
// TOKEN_EXPIRY_DAYS, so a previously-shared (now expired) link works again
// without the driver having to send a brand new URL.
async function renewGuestToken(rideId, requestingUserId, tokenId) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride) {
    throw new Error("Ride not found.");
  }
  if (!isThreadParticipant(ride, requestingUserId, store)) {
    throw new Error("You do not have access to this ride.");
  }

  const row = (store.guest_tokens || []).find(
    (t) =>
      Number(t.id) === Number(tokenId) &&
      Number(t.ride_id) === Number(rideId) &&
      t.created_by === requestingUserId
  );
  if (!row) {
    throw new Error("Guest link not found.");
  }

  const updated = throwIfError(
    await getSupabase()
      .from("guest_tokens")
      .update({ expires_at: expiresAt() })
      .eq("id", row.id)
      .select("*")
      .single()
  );

  return { token: updated.token, expires_at: updated.expires_at };
}

// Lists guest tokens for a ride. Each user only sees tokens they created.
async function listGuestTokens(rideId, userId) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride) {
    throw new Error("Ride not found.");
  }
  if (!isThreadParticipant(ride, userId, store)) {
    throw new Error("You do not have access to this ride.");
  }

  return (store.guest_tokens || [])
    .filter(
      (t) =>
        Number(t.ride_id) === Number(rideId) && t.created_by === userId
    )
    .map((t) => ({
      id: t.id,
      guest_name: t.guest_name,
      guest_phone: t.guest_phone,
      token: t.token,
      expires_at: t.expires_at,
    }));
}

module.exports = { createGuestToken, resolveGuestToken, sendGuestMessage, listGuestTokens, renewGuestToken };