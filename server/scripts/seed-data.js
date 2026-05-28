const fs = require("fs");
const bcrypt = require("bcryptjs");
const {
  EMPTY_STORE,
  STORE_PATH,
  DATA_DIR,
  mutate,
  now,
  nextId,
} = require("../src/localStore");

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
    roundtrip: 0,
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
    roundtrip: 0,
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
    roundtrip: 1,
    seats: 2,
    start_offset: 7,
    end_offset: 9,
    origin: "Boston",
    destination: "New York",
    ride_cost: 120,
    gender_preference: "No preference",
  },
];

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function seed() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const rideIds = [];

  await mutate((store) => {
    const timestamp = now();

    for (const user of SEED_USERS) {
      store.accounts.push({
        ...user,
        password_hash: passwordHash,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }

    for (const ride of EXAMPLE_RIDES) {
      const id = nextId("rides");
      const startDate = offsetDate(ride.start_offset);
      const endDate = offsetDate(ride.end_offset ?? ride.start_offset);
      store.rides.push({
        id,
        owner_id: ride.ownerId,
        ride_type: ride.ride_type,
        roundtrip: ride.roundtrip,
        seats: ride.seats,
        start_date: startDate,
        end_date: endDate,
        origin: ride.origin,
        destination: ride.destination,
        ride_cost: ride.ride_cost,
        gender_preference: ride.gender_preference,
        assigned_driver_id: null,
        created_at: timestamp,
        updated_at: timestamp,
      });
      rideIds.push(id);
    }

    const firstRideId = rideIds[0];
    store.passengers.push({
      id: nextId("passengers"),
      ride_id: firstRideId,
      user_id: "user_seed_jamie",
      created_at: timestamp,
    });
    const firstRide = store.rides.find((r) => r.id === firstRideId);
    if (firstRide) {
      firstRide.seats -= 1;
    }
  });

  console.log(
    `Seeded ${SEED_USERS.length} demo accounts (password: ${DEMO_PASSWORD}).`
  );
  console.log(
    "  alex.driver@example.com, jamie.rider@example.com, sam.chen@example.com"
  );
  console.log(`Seeded ${rideIds.length} example rides.`);
}

seed().catch((error) => {
  console.error("Failed to seed local data:", error.message);
  process.exitCode = 1;
});
