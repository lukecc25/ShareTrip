const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { getSupabase } = require("./supabase");
const { now, throwIfError, normalizeAccount } = require("./dbUtils");

const PUBLIC_FIELDS = [
  "id",
  "fname",
  "lname",
  "email",
  "phone",
  "gender",
  "able_driver",
  "profile_picture_url",
  "car_make_model",
  "car_color",
  "car_seat_capacity",
  "license_plate_partial",
  "created_at",
  "updated_at",
];

const MAX_PROFILE_PICTURE_LENGTH = 500000;

// Vehicle field limits. The license plate is intentionally short - only
// the last few characters should ever be collected, never the full plate.
const MAX_CAR_MAKE_MODEL_LENGTH = 100;
const MAX_CAR_COLOR_LENGTH = 40;
const MAX_LICENSE_PLATE_PARTIAL_LENGTH = 8;
const MIN_CAR_SEAT_CAPACITY = 1;
const MAX_CAR_SEAT_CAPACITY = 15;

function normalizeProfilePictureUrl(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Invalid profile picture.");
  }
  const allowedPrefixes = [
    "data:image/jpeg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
  ];
  if (!allowedPrefixes.some((prefix) => value.startsWith(prefix))) {
    throw new Error("Profile picture must be a JPEG, PNG, or WebP image.");
  }
  if (value.length > MAX_PROFILE_PICTURE_LENGTH) {
    throw new Error("Profile picture is too large. Use a smaller image.");
  }
  return value;
}

// Generic short text field for vehicle details (make/model, color).
// Returns null for empty input so the column can be cleared.
function normalizeVehicleText(value, maxLength) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Invalid vehicle field.");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeCarSeatCapacity(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_CAR_SEAT_CAPACITY ||
    parsed > MAX_CAR_SEAT_CAPACITY
  ) {
    throw new Error(
      `Seat capacity must be a whole number between ${MIN_CAR_SEAT_CAPACITY} and ${MAX_CAR_SEAT_CAPACITY}.`
    );
  }
  return parsed;
}

function normalizeLicensePlatePartial(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Invalid license plate value.");
  }
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length > MAX_LICENSE_PLATE_PARTIAL_LENGTH) {
    throw new Error(
      `Enter only the last ${MAX_LICENSE_PLATE_PARTIAL_LENGTH} characters of the license plate, not the full plate number.`
    );
  }
  return trimmed || null;
}

function pickPublic(account) {
  if (!account) {
    return null;
  }
  const row = {};
  for (const key of PUBLIC_FIELDS) {
    if (key === "able_driver") {
      row[key] = Boolean(account.able_driver);
      continue;
    }
    row[key] = account[key];
  }
  return row;
}

async function getAccountById(id) {
  const data = throwIfError(
    await getSupabase().from("accounts").select("*").eq("id", id).maybeSingle()
  );
  return pickPublic(normalizeAccount(data));
}

async function getAccountByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const data = throwIfError(
    await getSupabase()
      .from("accounts")
      .select("*")
      .eq("email", normalized)
      .maybeSingle()
  );
  return data ? normalizeAccount(data) : null;
}

async function createAccount({ fname, lname, email, phone, gender, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const timestamp = now();
  const id = randomUUID();

  const result = await getSupabase()
    .from("accounts")
    .insert({
      id,
      fname,
      lname,
      email: normalizedEmail,
      phone: phone ?? null,
      gender,
      able_driver: true,
      password_hash: passwordHash,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select("*")
    .single();

  if (result.error) {
    if (result.error.code === "23505") {
      throw new Error("An account with that email already exists.");
    }
    throw new Error(result.error.message);
  }

  return pickPublic(normalizeAccount(result.data));
}

async function verifyLogin(email, password) {
  const account = await getAccountByEmail(email);
  if (!account) {
    return null;
  }
  const valid = await bcrypt.compare(password, account.password_hash);
  if (!valid) {
    return null;
  }
  return getAccountById(account.id);
}

async function changePassword(id, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new Error("Current password and new password are required.");
  }
  if (newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  const existing = throwIfError(
    await getSupabase().from("accounts").select("*").eq("id", id).maybeSingle()
  );
  if (!existing) {
    throw new Error("Account not found.");
  }

  const valid = await bcrypt.compare(currentPassword, existing.password_hash);
  if (!valid) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  throwIfError(
    await getSupabase()
      .from("accounts")
      .update({ password_hash: passwordHash, updated_at: now() })
      .eq("id", id)
  );
}

async function updateAccount(id, data) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const conflict = throwIfError(
    await getSupabase()
      .from("accounts")
      .select("id")
      .eq("email", normalizedEmail)
      .neq("id", id)
      .maybeSingle()
  );
  if (conflict) {
    throw new Error("An account with that email already exists.");
  }

  const existing = throwIfError(
    await getSupabase().from("accounts").select("*").eq("id", id).maybeSingle()
  );
  if (!existing) {
    throw new Error("Account not found.");
  }

  const normalized = normalizeAccount(existing);
  const payload = {
    fname: data.fname,
    lname: data.lname,
    email: normalizedEmail,
    phone: data.phone ?? null,
    gender: data.gender,
    able_driver:
      data.able_driver !== undefined ? Boolean(data.able_driver) : Boolean(normalized.able_driver),
    car_make_model:
      data.car_make_model !== undefined
        ? normalizeVehicleText(data.car_make_model, MAX_CAR_MAKE_MODEL_LENGTH)
        : normalized.car_make_model ?? null,
    car_color:
      data.car_color !== undefined
        ? normalizeVehicleText(data.car_color, MAX_CAR_COLOR_LENGTH)
        : normalized.car_color ?? null,
    car_seat_capacity:
      data.car_seat_capacity !== undefined
        ? normalizeCarSeatCapacity(data.car_seat_capacity)
        : normalized.car_seat_capacity ?? null,
    license_plate_partial:
      data.license_plate_partial !== undefined
        ? normalizeLicensePlatePartial(data.license_plate_partial)
        : normalized.license_plate_partial ?? null,
    updated_at: now(),
  };

  if (payload.able_driver) {
    const missingVehicleDetails =
      !payload.car_make_model ||
      !payload.car_color ||
      !payload.car_seat_capacity ||
      !payload.license_plate_partial;
    if (missingVehicleDetails) {
      throw new Error(
        "Vehicle details (make/model, color, seat capacity, and license plate) are required before you can be available to drive."
      );
    }
  }

  if ("profile_picture_url" in data) {
    payload.profile_picture_url = normalizeProfilePictureUrl(data.profile_picture_url);
  }

  const row = throwIfError(
    await getSupabase()
      .from("accounts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()
  );
  return pickPublic(normalizeAccount(row));
}

module.exports = {
  pickPublic,
  getAccountById,
  getAccountByEmail,
  createAccount,
  verifyLogin,
  updateAccount,
  changePassword,
};