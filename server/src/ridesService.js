const authService = require("./authService");
const { readStore, mutate, now, nextId } = require("./localStore");

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
  const store = await readStore();
  {
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

    const enriched = [];
    for (const row of rows) {
      enriched.push(enrichRide(row, currentUserId, store));
    }
    return enriched;
  }
}

async function getRideById(rideId, currentUserId) {
  const store = await readStore();
  const row = findRide(store, rideId);
  if (!row) {
    return null;
  }
  return enrichRide(row, currentUserId, store);
}

async function saveRide(ownerId, payload) {
  const isOffer = payload.rideType === "offer";
  const roundtrip = payload.tripType === "roundtrip" ? 1 : 0;
  const startDate = payload.startDate;
  const endDate = roundtrip ? payload.endDate : startDate;
  const seats = isOffer ? Math.max(1, Number(payload.seats) || 1) : 1;
  const rideCost = isOffer ? Math.max(0, Number(payload.rideCost) || 0) : 0;
  const genderPreference = isOffer
    ? normalizeGenderPreference(payload.genderPreference)
    : "No preference";

  const rideId = await mutate((store) => {
    const timestamp = now();

    if (payload.rideId) {
      const index = store.rides.findIndex(
        (r) => Number(r.id) === Number(payload.rideId) && r.owner_id === ownerId
      );
      if (index < 0) {
        throw new Error("That ride could not be found for your account.");
      }
      store.rides[index] = {
        ...store.rides[index],
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
      };
      return payload.rideId;
    }

    const id = nextId("rides");
    store.rides.push({
      id,
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
    });
    return id;
  });

  return getRideById(rideId, ownerId);
}

async function joinRide(rideId, userId) {
  await mutate((store) => {
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

    store.passengers.push({
      id: nextId("passengers"),
      ride_id: Number(rideId),
      user_id: userId,
      created_at: now(),
    });

    const rideIndex = store.rides.findIndex((r) => Number(r.id) === Number(rideId));
    if (store.rides[rideIndex].seats < 1) {
      throw new Error("That ride is full.");
    }
    store.rides[rideIndex].seats -= 1;
    store.rides[rideIndex].updated_at = now();
  });
}

async function leaveRide(rideId, userId) {
  await mutate((store) => {
    const ride = findRide(store, rideId);
    if (!ride || ride.ride_type !== "offer") {
      throw new Error("That ride offer is not available.");
    }
    if (ride.owner_id === userId) {
      throw new Error("Drivers cannot leave their own ride.");
    }

    const before = store.passengers.length;
    store.passengers = store.passengers.filter(
      (p) => !(Number(p.ride_id) === Number(rideId) && p.user_id === userId)
    );
    if (store.passengers.length === before) {
      throw new Error("You are not a passenger on that ride.");
    }

    const rideIndex = store.rides.findIndex((r) => Number(r.id) === Number(rideId));
    store.rides[rideIndex].seats += 1;
    store.rides[rideIndex].updated_at = now();
  });
}

async function cancelRide(rideId, ownerId) {
  await mutate((store) => {
    const ride = findRide(store, rideId);
    if (!ride || ride.owner_id !== ownerId) {
      throw new Error("That ride could not be found for your account.");
    }

    const id = Number(rideId);
    store.passengers = store.passengers.filter((p) => Number(p.ride_id) !== id);
    store.comments = store.comments.filter((c) => Number(c.ride_id) !== id);
    store.ratings = store.ratings.filter((r) => Number(r.ride_id) !== id);
    store.driver_offers = store.driver_offers.filter(
      (o) => Number(o.ride_id) !== id
    );
    store.notifications = store.notifications.filter(
      (n) => n.ride_id == null || Number(n.ride_id) !== id
    );
    store.rides = store.rides.filter((r) => Number(r.id) !== id);
  });
}

function listCommentsFromStore(store, rideId) {
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
      };
    });
}

async function listComments(rideId) {
  const store = await readStore();
  return listCommentsFromStore(store, rideId);
}

async function addComment(rideId, userId, body) {
  const text = body.trim().slice(0, 500);
  if (!text) {
    throw new Error("Please enter a comment before posting.");
  }

  await mutate((store) => {
    if (!findRide(store, rideId)) {
      throw new Error("That ride could not be found.");
    }
    store.comments.push({
      id: nextId("comments"),
      ride_id: Number(rideId),
      user_id: userId,
      body: text,
      created_at: now(),
    });
  });
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

async function getUserRatingStats(userId) {
  const store = await readStore();
  return getUserRatingStatsFromStore(store, userId);
}

async function getRideDetail(rideId, currentUserId) {
  const ride = await getRideById(rideId, currentUserId);
  if (!ride) {
    return null;
  }

  const store = await readStore();
  {
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

    const comments = listCommentsFromStore(store, rideId);
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
}

async function ratePerson(rideId, raterUserId, ratedUserId, rating, comment, role) {
  await mutate((store) => {
    const ride = findRide(store, rideId);
    if (!ride || ride.end_date >= today()) {
      throw new Error("Ratings open after the ride is completed.");
    }
    if (ratedUserId === raterUserId) {
      throw new Error("You cannot rate yourself.");
    }

    const note = (comment || "").trim().slice(0, 500);
    const existing = store.ratings.find(
      (r) =>
        Number(r.ride_id) === Number(rideId) &&
        r.rated_user_id === ratedUserId &&
        r.rater_user_id === raterUserId
    );

    if (existing) {
      existing.rating = rating;
      existing.comment = note || null;
      existing.role = role;
    } else {
      store.ratings.push({
        id: nextId("ratings"),
        ride_id: Number(rideId),
        rated_user_id: ratedUserId,
        rater_user_id: raterUserId,
        rating,
        comment: note || null,
        role,
        created_at: now(),
      });
    }
  });
}

function createNotificationInStore(
  store,
  userId,
  message,
  kind,
  rideId,
  offerId
) {
  store.notifications.push({
    id: nextId("notifications"),
    user_id: userId,
    ride_id: rideId ?? null,
    offer_id: offerId ?? null,
    kind,
    message,
    read_flag: 0,
    created_at: now(),
  });
}

async function listPendingDriverOffers(rideId) {
  const store = await readStore();
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
  const store = await readStore();
  let rows = store.notifications.filter((n) => n.user_id === userId);
  if (unreadOnly) {
    rows = rows.filter((n) => !n.read_flag);
  } else {
    rows = rows.slice(0, 50);
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function markNotificationsRead(userId, ids) {
  await mutate((store) => {
    for (const notification of store.notifications) {
      if (notification.user_id !== userId) {
        continue;
      }
      if (!ids?.length || ids.includes(notification.id)) {
        notification.read_flag = 1;
      }
    }
  });
}

async function becomeDriver(rideId, userId) {
  return mutate((store) => {
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
      (o) =>
        Number(o.ride_id) === Number(rideId) && o.driver_user_id === userId
    );

    if (existing?.status === "pending") {
      throw new Error("Your driver offer is already pending approval.");
    }
    if (existing?.status === "accepted") {
      throw new Error("You are already the assigned driver for this ride.");
    }

    if (existing?.status === "declined") {
      existing.status = "pending";
      existing.responded_at = null;
      existing.created_at = now();
      return { id: existing.id, status: "pending" };
    }

    const id = nextId("driver_offers");
    store.driver_offers.push({
      id,
      ride_id: Number(rideId),
      driver_user_id: userId,
      status: "pending",
      created_at: now(),
      responded_at: null,
    });
    return { id, status: "pending" };
  });
}

async function respondToDriverOffer(rideId, offerId, ownerId, accept) {
  return mutate((store) => {
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

    if (accept) {
      offer.status = "accepted";
      offer.responded_at = now();
      ride.assigned_driver_id = offer.driver_user_id;
      ride.updated_at = now();

      const otherPending = store.driver_offers.filter(
        (o) =>
          Number(o.ride_id) === Number(rideId) &&
          o.status === "pending" &&
          Number(o.id) !== Number(offerId)
      );
      for (const other of otherPending) {
        other.status = "declined";
        other.responded_at = now();
        createNotificationInStore(
          store,
          other.driver_user_id,
          "Your offer has been declined.",
          "driver_offer_declined",
          rideId,
          other.id
        );
      }

      createNotificationInStore(
        store,
        offer.driver_user_id,
        "Your offer for a ride has been accepted.",
        "driver_offer_accepted",
        rideId,
        offerId
      );

      return { status: "accepted", message: "Driver offer accepted." };
    }

    offer.status = "declined";
    offer.responded_at = now();
    createNotificationInStore(
      store,
      offer.driver_user_id,
      "Your offer has been declined.",
      "driver_offer_declined",
      rideId,
      offerId
    );

    return { status: "declined", message: "Driver offer declined." };
  });
}

module.exports = {
  getProfile,
  upsertProfile,
  listRides,
  getRideById,
  getRideDetail,
  saveRide,
  joinRide,
  leaveRide,
  cancelRide,
  addComment,
  ratePerson,
  listPendingDriverOffers,
  listNotifications,
  markNotificationsRead,
  becomeDriver,
  respondToDriverOffer,
};
