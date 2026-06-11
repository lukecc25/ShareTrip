const { resetDatabase } = require("./supabaseData");

resetDatabase()
  .then(() => {
    console.log("Cleared all ShareTrip data from Supabase.");
  })
  .catch((error) => {
    console.error("Failed to reset Supabase data:", error.message);
    process.exitCode = 1;
  });
