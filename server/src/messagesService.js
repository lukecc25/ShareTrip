const { getSupabase } = require("./supabase");
const { fetchStore } = require("./dataStore");
const { now, throwIfError } = require("./dbUtils");

function findRide(store, id) {
  return store.rides.find((r) => Number(r.id) === Number(id)) || null;
}

function findAccount(store, id) {
  return store.accounts.find((a) => a.id === id) || null;
}

function getChatDriverId(ride) {
  return ride.ride_type === "offer" ? ride.owner_id : ride.assigned_driver_id;
}

function isThreadParticipant(ride, userId, store) {
  if (!ride || !userId) {
    return false;
  }
  if (ride.owner_id === userId) {
    return true;
  }
  const driverId = getChatDriverId(ride);
  if (driverId && driverId === userId) {
    return true;
  }
  if (ride.ride_type === "offer") {
    return store.passengers.some(
      (p) => Number(p.ride_id) === Number(ride.id) && p.user_id === userId
    );
  }
  return false;
}

function getLastReadAt(store, userId, rideId) {
  const row = store.message_reads.find(
    (r) => r.user_id === userId && Number(r.ride_id) === Number(rideId)
  );
  return row?.last_read_at ?? null;
}

async function markThreadRead(userId, rideId) {
  throwIfError(
    await getSupabase()
      .from("message_reads")
      .upsert(
        { user_id: userId, ride_id: Number(rideId), last_read_at: now() },
        { onConflict: "user_id,ride_id" }
      )
  );
}

async function listThreadsForUser(userId) {
  const store = await fetchStore();
  const threads = [];

  for (const ride of store.rides) {
    if (!isThreadParticipant(ride, userId, store)) {
      continue;
    }

    const driverId = getChatDriverId(ride);
    if (!driverId) {
      continue;
    }

    const driver = findAccount(store, driverId);
    const rideMessages = store.messages
      .filter((m) => Number(m.ride_id) === Number(ride.id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const lastMessage = rideMessages[rideMessages.length - 1] || null;

    const lastReadAt = getLastReadAt(store, userId, ride.id);
    const unreadCount = rideMessages.filter(
      (m) => m.user_id !== userId && (!lastReadAt || m.created_at > lastReadAt)
    ).length;

    threads.push({
      ride_id: ride.id,
      ride_type: ride.ride_type,
      origin: ride.origin,
      destination: ride.destination,
      destination_state: ride.destination_state,
      start_date: ride.start_date,
      driver_id: driver?.id ?? null,
      driver_fname: driver?.fname ?? "",
      driver_lname: driver?.lname ?? "",
      driver_profile_picture_url: driver?.profile_picture_url ?? null,
      last_message: lastMessage?.body ?? null,
      last_message_at: lastMessage?.created_at ?? null,
      unread_count: unreadCount,
    });
  }

  threads.sort((a, b) => {
    const aTime = a.last_message_at || "";
    const bTime = b.last_message_at || "";
    if (aTime === bTime) {
      return Number(b.ride_id) - Number(a.ride_id);
    }
    return bTime.localeCompare(aTime);
  });

  return threads;
}

async function hasUnreadMessages(userId) {
  const threads = await listThreadsForUser(userId);
  return threads.some((thread) => thread.unread_count > 0);
}

async function listMessages(rideId, userId) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride) {
    throw new Error("Ride not found.");
  }
  if (!isThreadParticipant(ride, userId, store)) {
    throw new Error("You do not have access to this chat.");
  }

  const driverId = getChatDriverId(ride);
  const isDriver = userId === driverId;

  const passengerRows = store.passengers.filter(
    (p) => Number(p.ride_id) === Number(rideId)
  );
  const passengers = passengerRows.map((p) => {
    const account = findAccount(store, p.user_id);
    return {
      user_id: p.user_id,
      fname: account?.fname ?? "",
      lname: account?.lname ?? "",
      pickup_spot: p.pickup_spot ?? null,
      is_own: p.user_id === userId,
    };
  });

  const messages = store.messages
    .filter((m) => Number(m.ride_id) === Number(rideId))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => {
      const sender = findAccount(store, m.user_id);
      return {
        id: m.id,
        ride_id: m.ride_id,
        user_id: m.user_id,
        body: m.body,
        created_at: m.created_at,
        fname: sender?.fname ?? "",
        lname: sender?.lname ?? "",
        is_own: m.user_id === userId,
      };
    });

  await markThreadRead(userId, rideId);

  return {
    ride: {
      id: ride.id,
      ride_type: ride.ride_type,
      origin: ride.origin,
      destination: ride.destination,
      destination_state: ride.destination_state,
      start_date: ride.start_date,
      departure_time: ride.departure_time ?? null,
      ride_notes: ride.ride_notes ?? null,
    },
    viewer: { is_driver: isDriver },
    passengers,
    messages,
  };
}

async function sendMessage(rideId, userId, body) {
  const text = String(body || "").trim().slice(0, 1000);
  if (!text) {
    throw new Error("Please enter a message before sending.");
  }

  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride) {
    throw new Error("Ride not found.");
  }
  if (!isThreadParticipant(ride, userId, store)) {
    throw new Error("You do not have access to this chat.");
  }

  throwIfError(
    await getSupabase().from("messages").insert({
      ride_id: Number(rideId),
      user_id: userId,
      body: text,
      created_at: now(),
    })
  );

  await markThreadRead(userId, rideId);
}

// Updates departure_time and ride_notes on the ride. Driver only.
async function updateRideDetails(rideId, userId, { departureTime, rideNotes }) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride) {
    throw new Error("Ride not found.");
  }

  const driverId = getChatDriverId(ride);
  if (userId !== driverId) {
    throw new Error("Only the driver can update ride details.");
  }

  throwIfError(
    await getSupabase()
      .from("rides")
      .update({
        departure_time: departureTime ? String(departureTime).trim().slice(0, 50) : null,
        ride_notes: rideNotes ? String(rideNotes).trim().slice(0, 500) : null,
        updated_at: now(),
      })
      .eq("id", Number(rideId))
  );
}

async function updatePickupSpot(rideId, passengerUserId, requestingUserId, pickupSpot) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride) {
    throw new Error("Ride not found.");
  }

  const driverId = getChatDriverId(ride);
  const isDriver = requestingUserId === driverId;
  const isOwnRow = requestingUserId === passengerUserId;

  if (!isDriver && !isOwnRow) {
    throw new Error("You can only update your own pickup spot.");
  }
  if (!isThreadParticipant(ride, requestingUserId, store)) {
    throw new Error("You do not have access to this chat.");
  }

  const passengerRow = store.passengers.find(
    (p) =>
      Number(p.ride_id) === Number(rideId) && p.user_id === passengerUserId
  );
  if (!passengerRow) {
    throw new Error("Passenger not found on this ride.");
  }

  throwIfError(
    await getSupabase()
      .from("passengers")
      .update({
        pickup_spot: pickupSpot ? String(pickupSpot).trim().slice(0, 200) : null,
      })
      .eq("id", passengerRow.id)
  );
}

module.exports = {
  isThreadParticipant,
  listThreadsForUser,
  hasUnreadMessages,
  listMessages,
  sendMessage,
  updateRideDetails,
  updatePickupSpot,
};