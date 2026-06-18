const authService = require("./authService");
const { getSupabase } = require("./supabase");
const { fetchStore } = require("./dataStore");
const { now, throwIfError } = require("./dbUtils");

const today = () => new Date().toISOString().slice(0, 10);

function normalizeGenderPreference(value) {
  if (value === "same_gender_only" || value === "Same gender only") {
    return "Same gender only";
  }
  return "No preference";
}

function findAccount(store, id) {
  return store.accounts.find((a) => a.id === id) || null;
}

function findRide(store, id) {
  return store.rides.find((r) => Number(r.id) === Number(id)) || null;
}

function isOfferPending(ride) {
  if (!ride || ride.ride_type !== "offer") {
    return false;
  }
  return ride.offer_pending === true || ride.offer_pending === 1;
}

function passengerSeatsUsed(store, rideId) {
  return store.passengers
    .filter((p) => Number(p.ride_id) === Number(rideId))
    .reduce((sum, passenger) => sum + Math.max(1, Number(passenger.party_size) || 1), 0);
}

function nameMatches(account, search) {
  const full = `${account.fname} ${account.lname}`.toLowerCase();
  const q = search.toLowerCase();
  return (
    account.fname.toLowerCase().includes(q) ||
    account.lname.toLowerCase().includes(q) ||
    full.includes(q)
  );
}

async function getProfile(userId) {
  return authService.getAccountById(userId);
}

async function upsertProfile(userId, data) {
  return authService.updateAccount(userId, data);
}

function enrichRide(row, currentUserId, store) {
  const owner = findAccount(store, row.owner_id);
  const pCount = passengerSeatsUsed(store, row.id);
  const currentUserJoined = currentUserId
    ? store.passengers.some(
        (p) =>
          Number(p.ride_id) === Number(row.id) && p.user_id === currentUserId
      )
    : false;
  const commentCount = store.comments.filter(
    (c) => Number(c.ride_id) === Number(row.id)
  ).length;

  const isOffer = row.ride_type === "offer";
  const splitCount = isOffer ? pCount + 1 : 1;
  const splitCost = isOffer ? row.ride_cost / splitCount : 0;
  const totalSeats = row.seats + pCount;

  let my_driver_offer_status = null;
  let my_driver_offer_id = null;
  let pending_driver_offer_count = 0;

  if (row.ride_type === "request") {
    pending_driver_offer_count = store.driver_offers.filter(
      (o) => Number(o.ride_id) === Number(row.id) && o.status === "pending"
    ).length;
    if (currentUserId) {
      const mine = store.driver_offers.find(
        (o) =>
          Number(o.ride_id) === Number(row.id) &&
          o.driver_user_id === currentUserId
      );
      if (mine) {
        my_driver_offer_status = mine.status;
        my_driver_offer_id = mine.id;
      }
    }
  }

  return {
    ...row,
    owner_fname: owner?.fname ?? "",
    owner_lname: owner?.lname ?? "",
    owner_gender: owner?.gender ?? "",
    is_past: row.start_date < today() ? 1 : 0,
    passenger_count: pCount,
    current_user_joined: currentUserJoined ? 1 : 0,
    comment_count: commentCount,
    split_cost: splitCost,
    total_seats: totalSeats,
    is_owner: currentUserId && row.owner_id === currentUserId ? 1 : 0,
    my_driver_offer_status,
    my_driver_offer_id,
    pending_driver_offer_count,
    has_assigned_driver: row.assigned_driver_id ? 1 : 0,
    offer_pending: isOfferPending(row) ? 1 : 0,
  };
}

async function listRides({ scope = "all", search = "" }, currentUserId) {
  const store = await fetchStore();
  let rows = [...store.rides];
  const q = search.trim();

  if (scope === "my" && currentUserId) {
    rows = rows.filter(
      (r) =>
        r.owner_id === currentUserId ||
        r.assigned_driver_id === currentUserId ||
        store.passengers.some(
          (p) =>
            Number(p.ride_id) === Number(r.id) && p.user_id === currentUserId
        )
    );
  } else {
    rows = rows.filter((r) => r.start_date >= today() && !isOfferPending(r));
  }

  if (q) {
    rows = rows.filter((r) => {
      if (
        r.origin.toLowerCase().includes(q.toLowerCase()) ||
        r.destination.toLowerCase().includes(q.toLowerCase()) ||
        String(r.destination_state || "").toLowerCase().includes(q.toLowerCase())
      ) {
        return true;
      }
      const owner = findAccount(store, r.owner_id);
      if (owner && nameMatches(owner, q)) {
        return true;
      }
      return store.passengers.some((p) => {
        if (Number(p.ride_id) !== Number(r.id)) {
          return false;
        }
        const passenger = findAccount(store, p.user_id);
        return passenger && nameMatches(passenger, q);
      });
    });
  }

  const t = today();
  if (scope === "my") {
    rows.sort((a, b) => {
      const aPast = a.start_date < t;
      const bPast = b.start_date < t;
      if (aPast !== bPast) {
        return aPast ? 1 : -1;
      }
      if (!aPast && !bPast) {
        return a.start_date.localeCompare(b.start_date);
      }
      if (aPast && bPast) {
        return b.start_date.localeCompare(a.start_date);
      }
      return Number(b.id) - Number(a.id);
    });
  } else {
    rows.sort((a, b) => {
      const byDate = a.start_date.localeCompare(b.start_date);
      return byDate !== 0 ? byDate : Number(b.id) - Number(a.id);
    });
  }

  return rows.map((row) => enrichRide(row, currentUserId, store));
}

async function getRideById(rideId, currentUserId) {
  const store = await fetchStore();
  const row = findRide(store, rideId);
  if (!row) {
    return null;
  }
  return enrichRide(row, currentUserId, store);
}

function normalizeDestinationState(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, 50) : null;
}

async function saveRide(ownerId, payload) {
  const roundtrip = payload.tripType === "roundtrip";
  const startDate = payload.startDate;
  const endDate = roundtrip ? payload.endDate : startDate;
  const destinationState = normalizeDestinationState(payload.destinationState);
  const timestamp = now();
  const sb = getSupabase();

  if (payload.rideId) {
    const existing = throwIfError(
      await sb
        .from("rides")
        .select("*")
        .eq("id", payload.rideId)
        .eq("owner_id", ownerId)
        .maybeSingle()
    );
    if (!existing) {
      throw new Error("That ride could not be found for your account.");
    }

    const wasPending = isOfferPending(existing);
    const isOffer = wasPending ? true : payload.rideType === "offer";
    const seats = isOffer ? Math.max(1, Number(payload.seats) || 1) : 1;
    const rideCost = isOffer ? Math.max(0, Number(payload.rideCost) || 0) : 0;
    const genderPreference = isOffer
      ? normalizeGenderPreference(payload.genderPreference)
      : "No preference";

    if (wasPending) {
      if (!String(payload.origin || "").trim() || !String(payload.destination || "").trim()) {
        throw new Error("Enter departure and destination before publishing your offer.");
      }
      if (rideCost <= 0) {
        throw new Error("Set a total cost before publishing your offer.");
      }
      if (seats < 1) {
        throw new Error("Set at least one passenger seat before publishing your offer.");
      }
    }

    throwIfError(
      await sb
        .from("rides")
        .update({
          ride_type: isOffer ? "offer" : payload.rideType,
          roundtrip,
          seats,
          start_date: startDate,
          end_date: endDate,
          origin: payload.origin,
          destination: payload.destination,
          destination_state: destinationState,
          ride_cost: rideCost,
          gender_preference: genderPreference,
          offer_pending: false,
          updated_at: timestamp,
        })
        .eq("id", payload.rideId)
        .eq("owner_id", ownerId)
    );

    if (wasPending) {
      const store = await fetchStore();
      const publishedRide = findRide(store, payload.rideId);
      const routeLabel = publishedRide ? formatRideRoute(publishedRide) : "the ride";
      const passengers = store.passengers.filter(
        (p) => Number(p.ride_id) === Number(payload.rideId)
      );
      for (const passenger of passengers) {
        await createNotification(
          passenger.user_id,
          `Your ride offer for ${routeLabel} has been published and is now open on the ride board.`,
          "ride_joined",
          Number(payload.rideId),
          null
        );
      }
    }

    const ride = await getRideById(payload.rideId, ownerId);
    return { ...ride, published: wasPending ? 1 : 0 };
  }

  const isOffer = payload.rideType === "offer";
  const seats = isOffer ? Math.max(1, Number(payload.seats) || 1) : 1;
  const rideCost = isOffer ? Math.max(0, Number(payload.rideCost) || 0) : 0;
  const genderPreference = isOffer
    ? normalizeGenderPreference(payload.genderPreference)
    : "No preference";

  const row = throwIfError(
    await sb
      .from("rides")
      .insert({
        owner_id: ownerId,
        ride_type: payload.rideType,
        roundtrip,
        seats,
        start_date: startDate,
        end_date: endDate,
        origin: payload.origin,
        destination: payload.destination,
        destination_state: destinationState,
        ride_cost: rideCost,
        gender_preference: genderPreference,
        assigned_driver_id: null,
        offer_pending: false,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id")
      .single()
  );

  return getRideById(row.id, ownerId);
}

function normalizeGuests(guests, seatsJoining) {
  const expected = Math.max(0, seatsJoining - 1);
  const list = Array.isArray(guests) ? guests : [];
  if (list.length !== expected) {
    throw new Error(
      expected === 0
        ? "Guest details are not needed for a solo join."
        : `Please provide details for ${expected} additional guest${expected === 1 ? "" : "s"}.`
    );
  }

  return list.map((guest, index) => {
    const name = String(guest?.name || "").trim();
    if (!name) {
      throw new Error(`Guest ${index + 1} name is required.`);
    }
    const phone = String(guest?.phone || "").trim();
    return {
      name: name.slice(0, 75),
      phone: phone ? phone.slice(0, 20) : null,
    };
  });
}

async function joinRide(rideId, userId, options = {}) {
  const partySizeInput =
    typeof options === "number" ? options : Number(options?.partySize ?? options);
  const seatsJoining = Math.max(1, Math.floor(Number(partySizeInput) || 1));
  const guestDetails = normalizeGuests(
    typeof options === "object" ? options.guests : [],
    seatsJoining
  );
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride || ride.ride_type !== "offer") {
    throw new Error("That ride offer is not available.");
  }
  if (isOfferPending(ride)) {
    throw new Error("This ride offer is not published yet.");
  }
  if (ride.owner_id === userId) {
    throw new Error("You cannot join your own ride.");
  }
  if (ride.seats < seatsJoining) {
    throw new Error(
      seatsJoining === 1
        ? "That ride is full."
        : `Only ${ride.seats} seat${ride.seats === 1 ? "" : "s"} available.`
    );
  }

  const joiner = findAccount(store, userId);
  const driver = findAccount(store, ride.owner_id);
  if (
    ride.gender_preference === "Same gender only" &&
    joiner?.gender &&
    driver?.gender &&
    joiner.gender.toLowerCase() !== driver.gender.toLowerCase()
  ) {
    throw new Error(
      "This ride is limited to passengers with the same gender as the driver."
    );
  }

  if (
    store.passengers.some(
      (p) => Number(p.ride_id) === Number(rideId) && p.user_id === userId
    )
  ) {
    throw new Error("You have already joined this ride.");
  }

  const sb = getSupabase();
  const passengerResult = await sb.from("passengers").insert({
    ride_id: Number(rideId),
    user_id: userId,
    party_size: seatsJoining,
    guest_details: guestDetails,
    created_at: now(),
  });
  if (passengerResult.error) {
    if (passengerResult.error.code === "23505") {
      throw new Error("You have already joined this ride.");
    }
    throw new Error(passengerResult.error.message);
  }

  const rideResult = await sb
    .from("rides")
    .update({ seats: ride.seats - seatsJoining, updated_at: now() })
    .eq("id", rideId)
    .gte("seats", seatsJoining)
    .select("id")
    .maybeSingle();

  if (rideResult.error) {
    throw new Error(rideResult.error.message);
  }
  if (!rideResult.data) {
    await sb
      .from("passengers")
      .delete()
      .eq("ride_id", rideId)
      .eq("user_id", userId);
    throw new Error("That ride is full.");
  }

  await createNotification(
    userId,
    `You joined a ride (${formatRideRoute(ride)}).`,
    "ride_joined",
    Number(rideId),
    null
  );
}

async function leaveRide(rideId, userId) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride || ride.ride_type !== "offer") {
    throw new Error("That ride offer is not available.");
  }
  if (ride.owner_id === userId) {
    throw new Error("Drivers cannot leave their own ride.");
  }

  const sb = getSupabase();
  const removed = throwIfError(
    await sb
      .from("passengers")
      .delete()
      .eq("ride_id", rideId)
      .eq("user_id", userId)
      .select("id, party_size")
  );
  if (!removed.length) {
    throw new Error("You are not a passenger on that ride.");
  }

  const seatsReleased = Math.max(1, Number(removed[0].party_size) || 1);

  throwIfError(
    await sb
      .from("rides")
      .update({ seats: ride.seats + seatsReleased, updated_at: now() })
      .eq("id", rideId)
  );
}

async function cancelRide(rideId, ownerId) {
  const result = await getSupabase()
    .from("rides")
    .delete()
    .eq("id", rideId)
    .eq("owner_id", ownerId)
    .select("id");

  if (result.error) {
    throw new Error(result.error.message);
  }
  if (!result.data?.length) {
    throw new Error("That ride could not be found for your account.");
  }
}

function listCommentsFromStore(store, rideId, currentUserId) {
  return store.comments
    .filter((c) => Number(c.ride_id) === Number(rideId))
    .sort((a, b) => {
      const byDate = a.created_at.localeCompare(b.created_at);
      return byDate !== 0 ? byDate : Number(a.id) - Number(b.id);
    })
    .map((c) => {
      const account = findAccount(store, c.user_id);
      return {
        ...c,
        fname: account?.fname ?? "",
        lname: account?.lname ?? "",
        is_own: currentUserId && c.user_id === currentUserId ? 1 : 0,
      };
    });
}

async function addComment(rideId, userId, body) {
  const text = body.trim().slice(0, 500);
  if (!text) {
    throw new Error("Please enter a comment before posting.");
  }

  const ride = throwIfError(
    await getSupabase().from("rides").select("id").eq("id", rideId).maybeSingle()
  );
  if (!ride) {
    throw new Error("That ride could not be found.");
  }

  throwIfError(
    await getSupabase().from("comments").insert({
      ride_id: Number(rideId),
      user_id: userId,
      body: text,
      created_at: now(),
    })
  );
}

async function deleteComment(rideId, commentId, userId) {
  const sb = getSupabase();

  const existing = throwIfError(
    await sb
      .from("comments")
      .select("id, user_id")
      .eq("id", commentId)
      .eq("ride_id", rideId)
      .maybeSingle()
  );
  if (!existing) {
    throw new Error("Comment not found.");
  }
  if (existing.user_id !== userId) {
    throw new Error("You can only delete your own comments.");
  }

  throwIfError(
    await sb.from("comments").delete().eq("id", commentId)
  );
}

async function updateComment(rideId, commentId, userId, body) {
  const text = body.trim().slice(0, 500);
  if (!text) {
    throw new Error("Please enter a comment before saving.");
  }

  const sb = getSupabase();

  const existing = throwIfError(
    await sb
      .from("comments")
      .select("id, user_id")
      .eq("id", commentId)
      .eq("ride_id", rideId)
      .maybeSingle()
  );
  if (!existing) {
    throw new Error("Comment not found.");
  }
  if (existing.user_id !== userId) {
    throw new Error("You can only edit your own comments.");
  }

  throwIfError(
    await sb
      .from("comments")
      .update({ body: text, updated_at: now() })
      .eq("id", commentId)
  );
}

async function deleteRating(rideId, ratedUserId, raterUserId) {
  const sb = getSupabase();

  const existing = throwIfError(
    await sb
      .from("ratings")
      .select("id")
      .eq("ride_id", rideId)
      .eq("rated_user_id", ratedUserId)
      .eq("rater_user_id", raterUserId)
      .maybeSingle()
  );
  if (!existing) {
    throw new Error("Rating not found.");
  }

  throwIfError(
    await sb.from("ratings").delete().eq("id", existing.id)
  );
}

function getUserRatingStatsFromStore(store, userId) {
  const driven = store.rides.filter((r) => r.owner_id === userId).length;
  const passengerTrips = store.passengers.filter((p) => p.user_id === userId)
    .length;
  const userRatings = store.ratings.filter((r) => r.rated_user_id === userId);
  const ratingCount = userRatings.length;
  const ratingAverage =
    ratingCount > 0
      ? userRatings.reduce((sum, r) => sum + r.rating, 0) / ratingCount
      : null;

  return {
    driven_count: driven,
    passenger_count: passengerTrips,
    rating_average: ratingAverage,
    rating_count: ratingCount,
  };
}

function getUserRoleOnRide(store, ride, userId) {
  if (ride.owner_id === userId) {
    return ride.ride_type === "offer" ? "driver" : "owner";
  }
  if (ride.assigned_driver_id === userId) {
    return "driver";
  }
  if (
    store.passengers.some(
      (p) => Number(p.ride_id) === Number(ride.id) && p.user_id === userId
    )
  ) {
    return "passenger";
  }
  return null;
}

async function getUserProfileOverview(userId) {
  const store = await fetchStore();
  const account = findAccount(store, userId);
  if (!account) {
    return null;
  }

  const stats = {
    ...getUserRatingStatsFromStore(store, userId),
    able_driver: (account.able_driver ?? 1) === 1,
  };

  const reviews = store.ratings
    .filter((r) => r.rated_user_id === userId)
    .map((r) => {
      const rater = findAccount(store, r.rater_user_id);
      const ride = findRide(store, r.ride_id);
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        role: r.role,
        created_at: r.created_at,
        rater_fname: rater?.fname ?? "",
        rater_lname: rater?.lname ?? "",
        ride_id: r.ride_id,
        ride_origin: ride?.origin ?? "",
        ride_destination: ride?.destination ?? "",
        ride_start_date: ride?.start_date ?? "",
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const t = today();
  const tripHistory = store.rides
    .filter((ride) => {
      if (ride.start_date >= t) {
        return false;
      }
      return getUserRoleOnRide(store, ride, userId) !== null;
    })
    .map((ride) => ({
      ...enrichRide(ride, userId, store),
      user_role: getUserRoleOnRide(store, ride, userId),
    }))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  return {
    profile: await authService.getAccountById(userId),
    stats,
    reviews,
    trip_history: tripHistory,
  };
}

async function getRideDetail(rideId, currentUserId) {
  const ride = await getRideById(rideId, currentUserId);
  if (!ride) {
    return null;
  }

  const store = await fetchStore();
  const passengers = store.passengers
    .filter((p) => Number(p.ride_id) === Number(rideId))
    .map((p) => {
      const account = findAccount(store, p.user_id);
      return {
        id: account?.id,
        fname: account?.fname,
        lname: account?.lname,
        gender: account?.gender,
        email: account?.email,
        phone: account?.phone,
        user_id: p.user_id,
        guest_details: p.guest_details || [],
      };
    });

  const comments = listCommentsFromStore(store, rideId, currentUserId);
  const rideCompleted = ride.end_date < today();

  const people = [];
  for (const person of passengers) {
    const ratings = getUserRatingStatsFromStore(store, person.user_id);
    const currentRating = currentUserId
      ? store.ratings.find(
          (r) =>
            Number(r.ride_id) === Number(rideId) &&
            r.rated_user_id === person.user_id &&
            r.rater_user_id === currentUserId
        )
      : null;
    people.push({
      ...person,
      ...ratings,
      current_user_rating: currentRating?.rating ?? null,
      current_user_rating_comment: currentRating?.comment ?? "",
    });
  }

  const driverStats = getUserRatingStatsFromStore(store, ride.owner_id);
  const driverRating = currentUserId
    ? store.ratings.find(
        (r) =>
          Number(r.ride_id) === Number(rideId) &&
          r.rated_user_id === ride.owner_id &&
          r.rater_user_id === currentUserId
      )
    : null;

  let pending_driver_offers = [];
  let assigned_driver = null;

  if (ride.ride_type === "request") {
    if (currentUserId && ride.owner_id === currentUserId) {
      pending_driver_offers = store.driver_offers
        .filter(
          (o) =>
            Number(o.ride_id) === Number(rideId) && o.status === "pending"
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((o) => {
          const account = findAccount(store, o.driver_user_id);
          return {
            ...o,
            fname: account?.fname,
            lname: account?.lname,
            gender: account?.gender,
          };
        });
    }
    if (ride.assigned_driver_id) {
      assigned_driver = findAccount(store, ride.assigned_driver_id);
      if (assigned_driver) {
        assigned_driver = {
          id: assigned_driver.id,
          fname: assigned_driver.fname,
          lname: assigned_driver.lname,
          gender: assigned_driver.gender,
        };
      }
    }
  }

  return {
    ride: {
      ...ride,
      driver_driven_count: driverStats.driven_count,
      driver_passenger_trips: driverStats.passenger_count,
      driver_rating_average: driverStats.rating_average,
      driver_rating_count: driverStats.rating_count,
      current_user_driver_rating: driverRating?.rating ?? null,
      current_user_driver_rating_comment: driverRating?.comment ?? "",
      ride_completed: rideCompleted,
    },
    people,
    comments,
    pending_driver_offers,
    assigned_driver,
  };
}

async function ratePerson(rideId, raterUserId, ratedUserId, rating, comment, role) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride || ride.end_date >= today()) {
    throw new Error("Ratings open after the ride is completed.");
  }
  if (ratedUserId === raterUserId) {
    throw new Error("You cannot rate yourself.");
  }

  const note = (comment || "").trim().slice(0, 500);
  const sb = getSupabase();
  const existing = store.ratings.find(
    (r) =>
      Number(r.ride_id) === Number(rideId) &&
      r.rated_user_id === ratedUserId &&
      r.rater_user_id === raterUserId
  );

  if (existing) {
    throwIfError(
      await sb
        .from("ratings")
        .update({ rating, comment: note || null, role })
        .eq("id", existing.id)
    );
    return;
  }

  throwIfError(
    await sb.from("ratings").insert({
      ride_id: Number(rideId),
      rated_user_id: ratedUserId,
      rater_user_id: raterUserId,
      rating,
      comment: note || null,
      role,
      created_at: now(),
    })
  );
}

function formatRideDestination(ride) {
  const destination = String(ride?.destination || "").trim();
  const state = String(ride?.destination_state || "").trim();
  if (!destination) {
    return state;
  }
  if (!state) {
    return destination;
  }
  return `${destination}, ${state}`;
}

function formatRideRoute(ride) {
  const origin = String(ride?.origin || "").trim();
  const destination = formatRideDestination(ride);
  if (!origin && !destination) {
    return "your ride";
  }
  if (!origin) {
    return destination;
  }
  if (!destination) {
    return origin;
  }
  return `${origin} to ${destination}`;
}

async function notifyDriverOfferPending(store, ride, driverUserId, offerId) {
  const driver = findAccount(store, driverUserId);
  const driverName = driver ? `${driver.fname} ${driver.lname}`.trim() : "A driver";
  await createNotification(
    ride.owner_id,
    `${driverName} offered to drive your ride (${formatRideRoute(ride)}).`,
    "driver_offer_pending",
    ride.id,
    offerId
  );
}

async function createNotification(userId, message, kind, rideId, offerId) {
  throwIfError(
    await getSupabase().from("notifications").insert({
      user_id: userId,
      ride_id: rideId ?? null,
      offer_id: offerId ?? null,
      kind,
      message,
      read_flag: false,
      created_at: now(),
    })
  );
}

async function deleteDriverOfferNotifications(offerId) {
  const result = await getSupabase()
    .from("notifications")
    .delete()
    .eq("offer_id", offerId)
    .eq("kind", "driver_offer_pending");

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function listPendingDriverOffers(rideId) {
  const store = await fetchStore();
  return store.driver_offers
    .filter(
      (o) => Number(o.ride_id) === Number(rideId) && o.status === "pending"
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((o) => {
      const account = findAccount(store, o.driver_user_id);
      return {
        ...o,
        fname: account?.fname,
        lname: account?.lname,
        gender: account?.gender,
      };
    });
}

function enrichNotification(row, store, userId) {
  const ride = row.ride_id ? findRide(store, row.ride_id) : null;
  const offer = row.offer_id
    ? store.driver_offers.find((o) => Number(o.id) === Number(row.offer_id))
    : null;
  const driver = offer ? findAccount(store, offer.driver_user_id) : null;
  const canRespond =
    row.kind === "driver_offer_pending" &&
    offer?.status === "pending" &&
    ride?.owner_id === userId;

  return {
    ...row,
    ride_origin: ride?.origin ?? "",
    ride_destination: ride ? formatRideDestination(ride) : "",
    driver_fname: driver?.fname ?? "",
    driver_lname: driver?.lname ?? "",
    offer_status: offer?.status ?? null,
    can_respond: canRespond ? 1 : 0,
  };
}

async function listNotifications(userId, unreadOnly = true) {
  const store = await fetchStore();
  let rows = store.notifications.filter((n) => n.user_id === userId);
  if (unreadOnly) {
    rows = rows.filter((n) => !n.read_flag);
  } else {
    rows = rows.slice(0, 50);
  }
  return rows
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => enrichNotification(row, store, userId));
}

async function markNotificationsRead(userId, ids) {
  let query = getSupabase()
    .from("notifications")
    .update({ read_flag: true })
    .eq("user_id", userId);

  if (ids?.length) {
    query = query.in("id", ids);
  }

  const result = await query;
  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function becomeDriver(rideId, userId) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride || ride.ride_type !== "request") {
    throw new Error("Driver offers are only available on ride requests.");
  }
  if (ride.owner_id === userId) {
    throw new Error("You cannot become the driver on your own request.");
  }
  if (ride.assigned_driver_id) {
    throw new Error("This ride already has an assigned driver.");
  }

  const existing = store.driver_offers.find(
    (o) => Number(o.ride_id) === Number(rideId) && o.driver_user_id === userId
  );

  if (existing?.status === "pending") {
    throw new Error("Your driver offer is already pending approval.");
  }
  if (existing?.status === "accepted") {
    throw new Error("You are already the assigned driver for this ride.");
  }

  const sb = getSupabase();
  const timestamp = now();

  if (existing?.status === "declined") {
    const row = throwIfError(
      await sb
        .from("driver_offers")
        .update({
          status: "pending",
          responded_at: null,
          created_at: timestamp,
        })
        .eq("id", existing.id)
        .select("id, status")
        .single()
    );
    await notifyDriverOfferPending(store, ride, userId, row.id);
    return row;
  }

  const row = throwIfError(
    await sb
      .from("driver_offers")
      .insert({
        ride_id: Number(rideId),
        driver_user_id: userId,
        status: "pending",
        created_at: timestamp,
        responded_at: null,
      })
      .select("id, status")
      .single()
  );
  await notifyDriverOfferPending(store, ride, userId, row.id);
  return row;
}

async function cancelDriverOffer(rideId, userId) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride || ride.ride_type !== "request") {
    throw new Error("Driver offers are only available on ride requests.");
  }

  const offer = store.driver_offers.find(
    (o) =>
      Number(o.ride_id) === Number(rideId) &&
      o.driver_user_id === userId &&
      o.status === "pending"
  );
  if (!offer) {
    throw new Error("You do not have a pending driver offer on this ride.");
  }

  const sb = getSupabase();
  throwIfError(await sb.from("driver_offers").delete().eq("id", offer.id));
  await deleteDriverOfferNotifications(offer.id);

  return { ok: true, message: "Your pending driver offer has been canceled." };
}

const DEFAULT_CONVERTED_OFFER_SEATS = 3;

async function convertAcceptedRequestToOffer(sb, ride, driverUserId, timestamp) {
  const originalRequesterId = ride.owner_id;
  const routeLabel = formatRideRoute(ride);
  const initialSeats = DEFAULT_CONVERTED_OFFER_SEATS;

  throwIfError(
    await sb
      .from("rides")
      .update({
        ride_type: "offer",
        owner_id: driverUserId,
        assigned_driver_id: null,
        seats: initialSeats,
        ride_cost: 0,
        offer_pending: true,
        gender_preference: ride.gender_preference || "No preference",
        updated_at: timestamp,
      })
      .eq("id", ride.id)
  );

  const passengerResult = await sb.from("passengers").insert({
    ride_id: Number(ride.id),
    user_id: originalRequesterId,
    party_size: 1,
    guest_details: [],
    created_at: timestamp,
  });
  if (passengerResult.error && passengerResult.error.code !== "23505") {
    throw new Error(passengerResult.error.message);
  }

  if (!passengerResult.error) {
    throwIfError(
      await sb
        .from("rides")
        .update({
          seats: Math.max(0, initialSeats - 1),
          updated_at: timestamp,
        })
        .eq("id", ride.id)
    );
    await createNotification(
      originalRequesterId,
      `Your ride request was accepted. The driver is completing offer details for ${routeLabel}. You are confirmed as a passenger.`,
      "ride_joined",
      Number(ride.id),
      null
    );
  }

  return { routeLabel, originalRequesterId };
}

async function respondToDriverOffer(rideId, offerId, ownerId, accept) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride || ride.ride_type !== "request" || ride.owner_id !== ownerId) {
    throw new Error("That ride request could not be found for your account.");
  }

  const offer = store.driver_offers.find(
    (o) => Number(o.id) === Number(offerId) && Number(o.ride_id) === Number(rideId)
  );
  if (!offer || offer.status !== "pending") {
    throw new Error("That driver offer is no longer pending.");
  }

  const sb = getSupabase();
  const timestamp = now();

  if (accept) {
    throwIfError(
      await sb
        .from("driver_offers")
        .update({ status: "accepted", responded_at: timestamp })
        .eq("id", offerId)
    );

    const { routeLabel } = await convertAcceptedRequestToOffer(
      sb,
      ride,
      offer.driver_user_id,
      timestamp
    );

    const otherPending = store.driver_offers.filter(
      (o) =>
        Number(o.ride_id) === Number(rideId) &&
        o.status === "pending" &&
        Number(o.id) !== Number(offerId)
    );

    for (const other of otherPending) {
      throwIfError(
        await sb
          .from("driver_offers")
          .update({ status: "declined", responded_at: timestamp })
          .eq("id", other.id)
      );
      await createNotification(
        other.driver_user_id,
        "Your offer has been declined.",
        "driver_offer_declined",
        rideId,
        other.id
      );
    }

    await createNotification(
      offer.driver_user_id,
      `Your offer was accepted. Complete seats, cost, and trip details to publish ${routeLabel} on the ride board.`,
      "driver_offer_accepted",
      rideId,
      offerId
    );

    return {
      status: "accepted",
      message:
        "Driver accepted. The ride is an offer pending until the driver updates and saves trip details.",
    };
  }

  throwIfError(
    await sb
      .from("driver_offers")
      .update({ status: "declined", responded_at: timestamp })
      .eq("id", offerId)
  );
  await createNotification(
    offer.driver_user_id,
    "Your offer has been declined.",
    "driver_offer_declined",
    rideId,
    offerId
  );

  return { status: "declined", message: "Driver offer declined." };
}

module.exports = {
  getProfile,
  upsertProfile,
  getUserProfileOverview,
  listRides,
  getRideById,
  getRideDetail,
  saveRide,
  joinRide,
  leaveRide,
  cancelRide,
  addComment,
  deleteComment,
  updateComment,
  deleteRating,
  ratePerson,
  listPendingDriverOffers,
  listNotifications,
  markNotificationsRead,
  becomeDriver,
  cancelDriverOffer,
  respondToDriverOffer,
};