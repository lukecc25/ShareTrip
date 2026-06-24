const { getSupabase } = require("./supabase");
const {
  throwIfError,
  normalizeAccount,
  normalizeRide,
  normalizeNotification,
  normalizeIdRow,
} = require("./dbUtils");

async function fetchStore() {
  const sb = getSupabase();
  const results = await Promise.all([
    sb.from("accounts").select("*"),
    sb.from("rides").select("*"),
    sb.from("passengers").select("*"),
    sb.from("comments").select("*"),
    sb.from("ratings").select("*"),
    sb.from("driver_offers").select("*"),
    sb.from("notifications").select("*"),
    sb.from("messages").select("*"),
    sb.from("message_reads").select("*"),
    sb.from("guest_tokens").select("*"),
  ]);

  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const [
    accounts,
    rides,
    passengers,
    comments,
    ratings,
    driver_offers,
    notifications,
    messages,
    message_reads,
    guest_tokens,
  ] = results.map((r) => r.data);

  return {
    accounts: accounts.map(normalizeAccount),
    rides: rides.map(normalizeRide),
    passengers: passengers.map(normalizeIdRow),
    comments: comments.map(normalizeIdRow),
    ratings: ratings.map(normalizeIdRow),
    driver_offers: driver_offers.map(normalizeIdRow),
    notifications: notifications.map(normalizeNotification),
    messages: messages.map(normalizeIdRow),
    message_reads: message_reads.map(normalizeIdRow),
    guest_tokens: guest_tokens.map(normalizeIdRow),
  };
}

module.exports = { fetchStore };