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

const HIDE_REQUEST_RIDES_KEY = "sharetrip-hide-request-rides";
const SAME_GENDER_ONLY_FILTER_KEY = "sharetrip-same-gender-only-filter";

function ableDriverClass(isAble) {
  return isAble ? "able-driver" : "not-able-driver";
}

function isAbleDriver(profile) {
  return profile?.able_driver !== false && profile?.able_driver !== 0;
}

function loadHideRequestRidesPreference(profile) {
  if (!isAbleDriver(profile)) {
    saveHideRequestRidesPreference(true);
    return true;
  }
  const stored = localStorage.getItem(HIDE_REQUEST_RIDES_KEY);
  if (stored === null) {
    return false;
  }
  return stored === "1";
}

function applyHideRequestRidesForDriverStatus(profile) {
  if (!isAbleDriver(profile)) {
    saveHideRequestRidesPreference(true);
  }
}

function saveHideRequestRidesPreference(hide) {
  localStorage.setItem(HIDE_REQUEST_RIDES_KEY, hide ? "1" : "0");
}

function loadSameGenderOnlyPreference() {
  return localStorage.getItem(SAME_GENDER_ONLY_FILTER_KEY) === "1";
}

function saveSameGenderOnlyPreference(enabled) {
  localStorage.setItem(SAME_GENDER_ONLY_FILTER_KEY, enabled ? "1" : "0");
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

function formatDestination(ride) {
  const destination = String(ride?.destination || "").trim();
  const state = String(ride?.destination_state || "").trim();
  if (!destination) {
    return state;
  }
  if (!state) {
    return destination;
  }
  return `${destination}, ${state}`;
}

function ensureJoinRideModal() {
  let modal = document.getElementById("join-ride-modal");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "join-ride-modal";
  modal.className = "join-ride-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="join-ride-backdrop"></div>
    <div class="join-ride-dialog" role="dialog" aria-modal="true" aria-labelledby="join-ride-title">
      <h3 id="join-ride-title">Join Ride</h3>
      <p>How many people are joining?</p>
      <label for="join-party-size">Number of people</label>
      <input id="join-party-size" type="number" min="1" step="1" value="1">
      <div class="join-ride-actions">
        <button type="button" class="secondary-button" data-action="cancel">Cancel</button>
        <button type="button" class="primary-small-button" data-action="confirm">Join Ride</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function promptJoinPartySize(maxSeats = 1) {
  return new Promise((resolve) => {
    const modal = ensureJoinRideModal();
    const input = modal.querySelector("#join-party-size");
    const confirmBtn = modal.querySelector("[data-action='confirm']");
    const cancelBtn = modal.querySelector("[data-action='cancel']");
    const backdrop = modal.querySelector(".join-ride-backdrop");
    const max = Math.max(1, Number(maxSeats) || 1);

    input.max = String(max);
    input.min = "1";
    input.value = "1";
    modal.hidden = false;
    input.focus();

    function onInput() {
      const value = Math.floor(Number(input.value) || 1);
      input.value = String(Math.max(1, Math.min(max, value)));
    }

    function cleanup() {
      modal.hidden = true;
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKeydown);
      input.removeEventListener("input", onInput);
    }

    function onConfirm() {
      const value = Math.max(1, Math.min(max, Math.floor(Number(input.value) || 1)));
      cleanup();
      resolve(value);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    function onKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
      if (event.key === "Escape") {
        onCancel();
      }
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKeydown);
    input.addEventListener("input", onInput);
  });
}

window.ShareTripUtils = {
  escapeHtml,
  formatDateValue,
  formatCommentDate,
  formatRatingValue,
  rideTypeLabel,
  fullName,
  routeIconSvg,
  ableDriverClass,
  isAbleDriver,
  loadHideRequestRidesPreference,
  saveHideRequestRidesPreference,
  applyHideRequestRidesForDriverStatus,
  loadSameGenderOnlyPreference,
  saveSameGenderOnlyPreference,
  formatDestination,
  promptJoinPartySize,
  readQuery,
  setQuery,
};
