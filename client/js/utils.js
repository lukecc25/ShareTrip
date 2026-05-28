function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateValue(date) {
  if (!date || date === "0000-00-00") {
    return "Date not set";
  }
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "Date not set";
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCommentDate(date) {
  if (!date) {
    return "";
  }
  const parsed = new Date(date.includes("T") ? date : `${date.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRatingValue(rating) {
  if (rating === null || rating === undefined || rating === "") {
    return "New";
  }
  return Number(rating).toFixed(1);
}

function rideTypeLabel(type) {
  const normalized = String(type || "").toLowerCase().trim();
  if (normalized === "offer" || normalized === "offering") {
    return "Offer";
  }
  if (normalized === "request" || normalized === "requested") {
    return "Request";
  }
  return type ? String(type).charAt(0).toUpperCase() + String(type).slice(1) : "";
}

function fullName(person) {
  const name = `${person?.fname ?? ""} ${person?.lname ?? ""}`.trim();
  return name || "ShareTrip member";
}

function routeIconSvg(roundtrip) {
  if (roundtrip) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" aria-hidden="true">
      <path d="M7 7h10"></path><path d="m14 4 3 3-3 3"></path>
      <path d="M17 17H7"></path><path d="m10 14-3 3 3 3"></path>
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" aria-hidden="true">
    <path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>
  </svg>`;
}

function readQuery() {
  return new URLSearchParams(window.location.search);
}

function setQuery(params) {
  const url = new URL(window.location.href);
  url.search = "";
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  window.location.href = url.toString();
}

window.ShareTripUtils = {
  escapeHtml,
  formatDateValue,
  formatCommentDate,
  formatRatingValue,
  rideTypeLabel,
  fullName,
  routeIconSvg,
  readQuery,
  setQuery,
};
