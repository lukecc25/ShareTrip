require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { getSupabase } = require("../src/supabase");
const { now, throwIfError } = require("../src/dbUtils");

const DEMO_PASSWORD = "password123";

const SEED_USERS = [
  {
    id: "user_seed_alex",
    fname: "Alex",
    lname: "Driver",
    email: "alex.driver@example.com",
    phone: "555-0100",
    gender: "Male",
  },
  {
    id: "user_seed_jamie",
    fname: "Jamie",
    lname: "Rider",
    email: "jamie.rider@example.com",
    phone: "555-0101",
    gender: "Female",
  },
  {
    id: "user_seed_sam",
    fname: "Sam",
    lname: "Chen",
    email: "sam.chen@example.com",
    phone: "555-0102",
    gender: "Male",
  },
];

const EXAMPLE_RIDES = [
  {
    ownerId: "user_seed_alex",
    ride_type: "offer",
    roundtrip: false,
    seats: 3,
    start_offset: 2,
    origin: "Downtown",
    destination: "Airport",
    ride_cost: 45,
    gender_preference: "No preference",
  },
  {
    ownerId: "user_seed_jamie",
    ride_type: "request",
    roundtrip: false,
    seats: 1,
    start_offset: 4,
    origin: "University Campus",
    destination: "Shopping Center",
    ride_cost: 0,
    gender_preference: "No preference",
  },
  {
    ownerId: "user_seed_sam",
    ride_type: "offer",
    roundtrip: true,
    seats: 2,
    start_offset: 7,
    end_offset: 9,
    origin: "Boston",
    destination: "New York",
    ride_cost: 120,
    gender_preference: "No preference",
  },
];

const RESET_TABLES = [
  "notifications",
  "ratings",
  "comments",
  "passengers",
  "driver_offers",
  "rides",
  "accounts",
];

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function clearTable(table) {
  const sb = getSupabase();
  const query =
    table === "accounts"
      ? sb.from(table).delete().neq("id", "")
      : sb.from(table).delete().gte("id", 0);

  const { error } = await query;
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function resetDatabase() {
  for (const table of RESET_TABLES) {
    await clearTable(table);
  }
}

async function seedDatabase() {
  await resetDatabase();

  const timestamp = now();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const sb = getSupabase();

  const accountRows = SEED_USERS.map((user) => ({
    id: user.id,
    fname: user.fname,
    lname: user.lname,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    able_driver: true,
    password_hash: passwordHash,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  throwIfError(await sb.from("accounts").insert(accountRows));

  const rideRows = EXAMPLE_RIDES.map((ride) => ({
    owner_id: ride.ownerId,
    ride_type: ride.ride_type,
    roundtrip: ride.roundtrip,
    seats: ride.seats,
    start_date: offsetDate(ride.start_offset),
    end_date: offsetDate(ride.end_offset ?? ride.start_offset),
    origin: ride.origin,
    destination: ride.destination,
    ride_cost: ride.ride_cost,
    gender_preference: ride.gender_preference,
    assigned_driver_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  const insertedRides = throwIfError(
    await sb.from("rides").insert(rideRows).select("id")
  );
  const firstRideId = insertedRides[0].id;

  throwIfError(
    await sb.from("passengers").insert({
      ride_id: firstRideId,
      user_id: "user_seed_jamie",
      created_at: timestamp,
    })
  );

  throwIfError(
    await sb
      .from("rides")
      .update({ seats: EXAMPLE_RIDES[0].seats - 1, updated_at: timestamp })
      .eq("id", firstRideId)
  );

  return {
    accountCount: SEED_USERS.length,
    rideCount: insertedRides.length,
    demoPassword: DEMO_PASSWORD,
    emails: SEED_USERS.map((user) => user.email),
  };
}

module.exports = {
  DEMO_PASSWORD,
  resetDatabase,
  seedDatabase,
};
