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

function passengerCount(store, rideId) {
  return store.passengers.filter((p) => Number(p.ride_id) === Number(rideId))
    .length;
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
  const pCount = passengerCount(store, row.id);
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
        store.passengers.some(
          (p) =>
            Number(p.ride_id) === Number(r.id) && p.user_id === currentUserId
        )
    );
  } else {
    rows = rows.filter((r) => r.start_date >= today());
  }

  if (q) {
    rows = rows.filter((r) => {
      if (
        r.origin.toLowerCase().includes(q.toLowerCase()) ||
        r.destination.toLowerCase().includes(q.toLowerCase())
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

async function saveRide(ownerId, payload) {
  const isOffer = payload.rideType === "offer";
  const roundtrip = payload.tripType === "roundtrip";
  const startDate = payload.startDate;
  const endDate = roundtrip ? payload.endDate : startDate;
  const seats = isOffer ? Math.max(1, Number(payload.seats) || 1) : 1;
  const rideCost = isOffer ? Math.max(0, Number(payload.rideCost) || 0) : 0;
  const genderPreference = isOffer
    ? normalizeGenderPreference(payload.genderPreference)
    : "No preference";
  const timestamp = now();
  const sb = getSupabase();

  if (payload.rideId) {
    const existing = throwIfError(
      await sb
        .from("rides")
        .select("id")
        .eq("id", payload.rideId)
        .eq("owner_id", ownerId)
        .maybeSingle()
    );
    if (!existing) {
      throw new Error("That ride could not be found for your account.");
    }

    throwIfError(
      await sb
        .from("rides")
        .update({
          ride_type: payload.rideType,
          roundtrip,
          seats,
          start_date: startDate,
          end_date: endDate,
          origin: payload.origin,
          destination: payload.destination,
          ride_cost: rideCost,
          gender_preference: genderPreference,
          updated_at: timestamp,
        })
        .eq("id", payload.rideId)
        .eq("owner_id", ownerId)
    );
    return getRideById(payload.rideId, ownerId);
  }

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
        ride_cost: rideCost,
        gender_preference: genderPreference,
        assigned_driver_id: null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id")
      .single()
  );

  return getRideById(row.id, ownerId);
}

async function joinRide(rideId, userId) {
  const store = await fetchStore();
  const ride = findRide(store, rideId);
  if (!ride || ride.ride_type !== "offer") {
    throw new Error("That ride offer is not available.");
  }
  if (ride.owner_id === userId) {
    throw new Error("You cannot join your own ride.");
  }
  if (ride.seats < 1) {
    throw new Error("That ride is full.");
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
    .update({ seats: ride.seats - 1, updated_at: now() })
    .eq("id", rideId)
    .gte("seats", 1)
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
      .select("id")
  );
  if (!removed.length) {
    throw new Error("You are not a passenger on that ride.");
  }

  throwIfError(
    await sb
      .from("rides")
      .update({ seats: ride.seats + 1, updated_at: now() })
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

async function listNotifications(userId, unreadOnly = true) {
  const store = await fetchStore();
  let rows = store.notifications.filter((n) => n.user_id === userId);
  if (unreadOnly) {
    rows = rows.filter((n) => !n.read_flag);
  } else {
    rows = rows.slice(0, 50);
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  return row;
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
    throwIfError(
      await sb
        .from("rides")
        .update({
          assigned_driver_id: offer.driver_user_id,
          updated_at: timestamp,
        })
        .eq("id", rideId)
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
      "Your offer for a ride has been accepted.",
      "driver_offer_accepted",
      rideId,
      offerId
    );

    return { status: "accepted", message: "Driver offer accepted." };
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
  respondToDriverOffer,
};