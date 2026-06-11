const { seedDatabase } = require("./supabaseData");

seedDatabase()
  .then(({ accountCount, rideCount, demoPassword, emails }) => {
    console.log(`Seeded ${accountCount} demo accounts (password: ${demoPassword}).`);
    console.log(`  ${emails.join(", ")}`);
    console.log(`Seeded ${rideCount} example rides.`);
  })
  .catch((error) => {
    console.error("Failed to seed Supabase data:", error.message);
    process.exitCode = 1;
  });
