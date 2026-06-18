function now() {
  return new Date().toISOString();
}

function throwIfError({ data, error }) {
  if (error) {
    if (error.code === "23505") {
      throw new Error("That record already exists.");
    }
    throw new Error(error.message);
  }
  return data;
}

function normalizeAccount(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    able_driver: row.able_driver ? 1 : 0,
  };
}

function normalizeRide(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    id: Number(row.id),
    roundtrip: row.roundtrip ? 1 : 0,
    ride_cost: Number(row.ride_cost),
    seats: Number(row.seats),
    offer_pending: row.offer_pending ? 1 : 0,
  };
}

function normalizeNotification(row) {
  return {
    ...row,
    id: Number(row.id),
    ride_id: row.ride_id == null ? null : Number(row.ride_id),
    offer_id: row.offer_id == null ? null : Number(row.offer_id),
    read_flag: row.read_flag ? 1 : 0,
  };
}

function normalizeGuestDetails(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeIdRow(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    id: Number(row.id),
    ride_id: Number(row.ride_id),
    party_size: Math.max(1, Number(row.party_size) || 1),
    guest_details: normalizeGuestDetails(row.guest_details),
  };
}

module.exports = {
  now,
  throwIfError,
  normalizeAccount,
  normalizeRide,
  normalizeNotification,
  normalizeIdRow,
};
