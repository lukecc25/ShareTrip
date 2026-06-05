function u() {
  return window.ShareTripUtils;
}

const MESSAGES = {
  created: "Your ride has been posted.",
  updated: "Your ride has been updated.",
  joined: "You joined the ride.",
  left: "You left the ride.",
  canceled: "Your ride has been canceled.",
  commented: "Your comment has been posted.",
};

let state = {
  scope: "all",
  search: "",
  showForm: false,
  editId: 0,
  rides: [],
  profile: null,
  hideRequestRides: false,
  message: "",
  messageType: "success",
};

function filterUrl(scope, search) {
  const params = new URLSearchParams({ scope });
  if (search) {
    params.set("q", search);
  }
  return `/dashboard.html?${params.toString()}`;
}

function showMessage(key, type = "success") {
  state.message = MESSAGES[key] || "";
  state.messageType = type;
}

function parseInitialState() {
  const query = u().readQuery();
  state.scope = query.get("scope") === "my" ? "my" : "all";
  state.search = query.get("q") || "";
  state.showForm = query.has("showForm");
  state.editId = Number(query.get("edit") || 0);

  if (query.has("created")) showMessage("created");
  if (query.has("updated")) showMessage("updated");
  if (query.has("joined")) showMessage("joined");
  if (query.has("left")) showMessage("left");
  if (query.has("canceled")) showMessage("canceled");
  if (query.has("commented")) showMessage("commented");
  if (query.has("driver_pending")) {
    state.message = "Your driver offer is pending approval.";
    state.messageType = "success";
  }
}

async function loadRides() {
  const params = new URLSearchParams({ scope: state.scope });
  if (state.search) {
    params.set("q", state.search);
  }
  state.rides = await ShareTripApi.apiFetch(`/api/rides?${params.toString()}`);
}

function editingRide() {
  if (!state.editId) {
    return null;
  }
  return state.rides.find((ride) => Number(ride.id) === state.editId) || null;
}

function visibleRides() {
  if (state.scope === "my" || u().isAbleDriver(state.profile)) {
    return state.rides;
  }
  if (!state.hideRequestRides) {
    return state.rides;
  }
  return state.rides.filter((ride) => ride.ride_type !== "request");
}

function renderRequestDriverActions(ride) {
  if (ride.is_owner) {
    if (ride.pending_driver_offer_count > 0) {
      return `<a href="/ride-details.html?ride=${ride.id}#driver-offers" class="primary-small-button">Review ${ride.pending_driver_offer_count} offer${ride.pending_driver_offer_count === 1 ? "" : "s"}</a>`;
    }
    if (ride.has_assigned_driver) {
      return '<span class="ride-status">Driver assigned</span>';
    }
    return "";
  }

  if (ride.has_assigned_driver) {
    return '<span class="ride-status">Driver assigned</span>';
  }

  const status = ride.my_driver_offer_status;
  if (status === "pending") {
    return '<span class="ride-status pending-badge">Pending</span>';
  }
  if (status === "accepted") {
    return '<span class="ride-status">Accepted as driver</span>';
  }

  return `<button type="button" class="primary-small-button" data-action="become-driver" data-ride-id="${ride.id}">Become Driver</button>`;
}

function renderRideCard(ride) {
  const { escapeHtml, formatDateValue, rideTypeLabel, routeIconSvg } = u();
  const typeLabel = rideTypeLabel(ride.ride_type);
  const typeClass = typeLabel === "Request" ? "request" : "offer";
  const isOffer = typeLabel === "Offer";
  const isOwner = ride.is_owner === 1;
  const hasJoined = ride.current_user_joined === 1;
  const remainingSeats = ride.seats;
  const totalSeats = ride.total_seats;
  const splitCost = ride.split_cost;
  const commentCount = ride.comment_count;

  let footer = `<a href="/ride-details.html?ride=${ride.id}" class="details-link">Details${
    commentCount > 0 ? ` (${commentCount})` : ""
  }</a>`;

  if (isOwner) {
    footer += `
      <div class="ride-owner-actions">
        <a href="/dashboard.html?edit=${ride.id}&showForm=1&scope=${state.scope}#createRideForm" class="edit-ride-link">Edit</a>
        <button type="button" class="danger-button" data-action="cancel" data-ride-id="${ride.id}">Cancel Ride</button>
      </div>`;
  } else if (isOffer && hasJoined) {
    footer += `
      <div class="ride-owner-actions">
        <span class="ride-status">Joined</span>
        <button type="button" class="secondary-button" data-action="leave" data-ride-id="${ride.id}">Leave Ride</button>
      </div>`;
  } else if (isOffer && remainingSeats > 0) {
    footer += `<button type="button" class="primary-small-button" data-action="join" data-ride-id="${ride.id}">Join Ride</button>`;
  } else if (isOffer) {
    footer += `<span class="ride-status full">Full</span>`;
  } else if (!isOffer) {
    footer += renderRequestDriverActions(ride);
  }

  const pastBadge =
    state.scope === "my" && ride.is_past
      ? '<span class="ride-time-status">Past</span>'
      : "";

  const offerDetails = isOffer
    ? `
      <div>
        <span>Passenger Seats</span>
        <strong>${escapeHtml(remainingSeats)}/${escapeHtml(totalSeats)}</strong>
      </div>
      <div>
        <span>Cost</span>
        <strong>$${Number(splitCost).toFixed(2)} each</strong>
      </div>`
    : "";

  const priceBlock = isOffer
    ? `<span class="ride-price">
        <strong>$${Number(splitCost).toFixed(2)}</strong>
        <small>$${Number(ride.ride_cost).toFixed(2)} total</small>
      </span>`
    : "";

  return `
    <article class="ride-card" id="ride-${ride.id}">
      <div class="ride-card-top">
        <div class="ride-card-badges">
          <span class="ride-type ${typeClass}">${escapeHtml(typeLabel)}</span>
          ${pastBadge}
        </div>
        ${priceBlock}
      </div>
      <h2 class="route-title">
        <span>${escapeHtml(ride.origin)}</span>
        <span class="route-icon" aria-hidden="true">${routeIconSvg(ride.roundtrip)}</span>
        <span>${escapeHtml(ride.destination)}</span>
      </h2>
      <div class="ride-details">
        <div><span>Start</span><strong>${escapeHtml(formatDateValue(ride.start_date))}</strong></div>
        <div><span>End</span><strong>${escapeHtml(formatDateValue(ride.end_date))}</strong></div>
        ${offerDetails}
        <div><span>Preference</span><strong>${escapeHtml(ride.gender_preference)}</strong></div>
      </div>
      <footer>${footer}</footer>
    </article>
  `;
}

function renderRideForm(ride) {
  const { escapeHtml } = u();
  const isEdit = Boolean(ride);

  return `
    <section class="ride-form-panel" id="createRideForm">
      <div class="form-panel-header">
        <div>
          <h2>${isEdit ? "Edit Ride" : "Create a Ride"}</h2>
          <p>${isEdit ? "Update the details for your posted ride." : "Post a new ride offer or request for other members to find."}</p>
        </div>
        <a href="${filterUrl(state.scope, state.search)}" class="cancel-form-link">Cancel</a>
      </div>
      <form class="ride-form" id="rideForm">
        <input type="hidden" name="rideId" value="${ride?.id ?? ""}">
        <div class="form-row">
          <div>
            <label for="rideType">Request or Offer</label>
            <select name="rideType" id="rideType" required>
              <option value="offer" ${ride?.ride_type === "offer" ? "selected" : ""}>Offer</option>
              <option value="request" ${ride?.ride_type === "request" ? "selected" : ""}>Request</option>
            </select>
          </div>
          <div>
            <label for="tripType">Trip Type</label>
            <select name="tripType" id="tripType" required>
              <option value="oneway" ${!ride?.roundtrip ? "selected" : ""}>One way</option>
              <option value="roundtrip" ${ride?.roundtrip ? "selected" : ""}>Round trip</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Start Date</label>
            <input type="date" name="startDate" value="${escapeHtml(ride?.start_date ?? "")}" required>
          </div>
          <div id="endDateField">
            <label>End Date</label>
            <input type="date" name="endDate" value="${escapeHtml(ride?.end_date ?? "")}">
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Origin</label>
            <input type="text" name="origin" maxlength="75" value="${escapeHtml(ride?.origin ?? "")}" required>
          </div>
          <div>
            <label>Destination</label>
            <input type="text" name="destination" maxlength="75" value="${escapeHtml(ride?.destination ?? "")}" required>
          </div>
        </div>
        <div class="form-row offer-only-fields">
          <div class="offer-only-field">
            <label>Total Cost</label>
            <input type="number" name="rideCost" min="0" step="0.01" value="${escapeHtml(ride?.ride_cost ?? "")}" required>
          </div>
          <div class="offer-only-field">
            <label>Seats</label>
            <input type="number" name="seats" min="1" step="1" value="${escapeHtml(ride?.seats ?? "1")}" required>
          </div>
        </div>
        <div class="form-row single-column offer-only-fields">
          <div>
            <label>Gender Preference</label>
            <select name="genderPreference" required>
              <option value="No preference" ${ride?.gender_preference === "No preference" ? "selected" : ""}>No preference</option>
              <option value="Same gender only" ${ride?.gender_preference === "Same gender only" ? "selected" : ""}>Same gender only</option>
            </select>
          </div>
        </div>
        <button type="submit">${isEdit ? "Save Changes" : "Post Ride"}</button>
      </form>
    </section>
  `;
}

function updateStaticChrome() {
  const welcomeName = state.profile
    ? `${state.profile.fname} ${state.profile.lname}`.trim()
    : "there";

  document.getElementById("welcome-eyebrow").textContent = `Welcome, ${welcomeName}`;

  const createLink = document.getElementById("create-ride-link");
  if (createLink) {
    createLink.href = `/dashboard.html?showForm=1&scope=${state.scope}#createRideForm`;
  }

  const headerBlurb = document.querySelector(".dashboard-header > div > p:last-of-type");
  if (headerBlurb) {
    headerBlurb.textContent =
      state.showForm || state.editId
        ? "Fill out the form below to post your ride. The board is hidden until you save or cancel."
        : "Browse every ride offer and request currently shared by the community.";
  }

  document.getElementById("filter-all").classList.toggle("active", state.scope === "all");
  document.getElementById("filter-my").classList.toggle("active", state.scope === "my");
  document.getElementById("filter-all").href = filterUrl("all", state.search);
  document.getElementById("filter-my").href = filterUrl("my", state.search);

  document.getElementById("search-scope").value = state.scope;
  document.getElementById("rideSearch").value = state.search;

  const clearSearch = document.getElementById("clear-search");
  if (state.search) {
    clearSearch.hidden = false;
    clearSearch.href = filterUrl(state.scope, "");
  } else {
    clearSearch.hidden = true;
  }

  const requestFilter = document.getElementById("hide-request-rides-filter");
  if (requestFilter) {
    const showFilter = state.scope === "all" && !u().isAbleDriver(state.profile);
    requestFilter.hidden = !showFilter;
    if (showFilter) {
      const checkbox = requestFilter.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = state.hideRequestRides;
      }
    }
  }

  const messageEl = document.getElementById("dashboard-message");
  if (state.message) {
    messageEl.hidden = false;
    messageEl.textContent = state.message;
    messageEl.classList.toggle("error", state.messageType === "error");
  } else {
    messageEl.hidden = true;
    messageEl.textContent = "";
    messageEl.classList.remove("error");
  }
}

function renderRides() {
  const container = document.getElementById("rides-container");
  if (!container) {
    return;
  }

  const rides = visibleRides();

  if (rides.length > 0) {
    container.innerHTML = `<section class="ride-grid">${rides.map(renderRideCard).join("")}</section>`;
  } else {
    const filteredOut =
      state.rides.length > 0 &&
      state.scope === "all" &&
      !u().isAbleDriver(state.profile) &&
      state.hideRequestRides;

    container.innerHTML = `
      <section class="empty-rides">
        <h2>No rides found</h2>
        <p>${
          filteredOut
            ? "Driver requests are hidden. Turn off the filter above to see them."
            : "Try changing the ride view or search terms."
        }</p>
      </section>`;
  }

  bindRideActions();
}

function renderForm() {
  const container = document.getElementById("ride-form-container");
  if (!container) {
    return;
  }

  const editRide = editingRide();
  if (state.editId && !editRide && !state.message) {
    state.message = "That ride could not be found for your account.";
    state.messageType = "error";
    updateStaticChrome();
  }

  if (state.showForm || state.editId) {
    container.innerHTML = renderRideForm(editRide);
    bindFormEvents();
    initRideFormControls();
  } else {
    container.innerHTML = "";
  }
}

function updateComposeMode() {
  const composing = state.showForm || Boolean(state.editId);
  const filterPanel = document.getElementById("ride-filter-panel");
  const ridesContainer = document.getElementById("rides-container");
  const createLink = document.getElementById("create-ride-link");

  if (filterPanel) {
    filterPanel.hidden = composing;
  }
  if (ridesContainer) {
    ridesContainer.hidden = composing;
  }
  if (createLink) {
    createLink.hidden = composing;
  }

  document.body.classList.toggle("dashboard-compose-mode", composing);
}

function render() {
  updateStaticChrome();
  updateComposeMode();
  renderForm();
  if (!state.showForm && !state.editId) {
    renderRides();
  }
}

function initRideFormControls() {
  const rideType = document.getElementById("rideType");
  const tripType = document.getElementById("tripType");
  const endDateField = document.getElementById("endDateField");
  const offerFields = document.querySelectorAll(".offer-only-fields");

  if (!rideType || !tripType || !endDateField) {
    return;
  }

  const endDateInput = endDateField.querySelector("input");

  function updateEndDateField() {
    const isRoundTrip = tripType.value === "roundtrip";
    endDateField.style.display = isRoundTrip ? "block" : "none";
    endDateInput.required = isRoundTrip;
  }

  function updateOfferFields() {
    const isOffer = rideType.value === "offer";
    offerFields.forEach((fieldGroup) => {
      fieldGroup.style.display = isOffer ? "grid" : "none";
      fieldGroup.querySelectorAll("input, select").forEach((field) => {
        field.disabled = !isOffer;
        field.required = isOffer;
      });
    });
  }

  rideType.addEventListener("change", updateOfferFields);
  tripType.addEventListener("change", updateEndDateField);
  updateEndDateField();
  updateOfferFields();
}

function bindFormEvents() {
  const rideForm = document.getElementById("rideForm");
  if (!rideForm) {
    return;
  }

  rideForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(rideForm);
    const rideId = Number(formData.get("rideId") || 0);
    const payload = {
      rideType: formData.get("rideType"),
      tripType: formData.get("tripType"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      origin: formData.get("origin"),
      destination: formData.get("destination"),
      seats: formData.get("seats"),
      rideCost: formData.get("rideCost"),
      genderPreference: formData.get("genderPreference"),
    };

    try {
      if (rideId) {
        await ShareTripApi.apiFetch(`/api/rides/${rideId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        window.location.href = "/dashboard.html?updated=1";
      } else {
        await ShareTripApi.apiFetch("/api/rides", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        window.location.href = "/dashboard.html?created=1";
      }
    } catch (error) {
      state.message = error.message;
      state.messageType = "error";
      render();
    }
  });
}

function bindRequestRideFilter() {
  const requestFilter = document.getElementById("hide-request-rides-filter");
  if (!requestFilter) {
    return;
  }

  const checkbox = requestFilter.querySelector('input[type="checkbox"]');
  if (!checkbox) {
    return;
  }

  checkbox.addEventListener("change", () => {
    state.hideRequestRides = checkbox.checked;
    u().saveHideRequestRidesPreference(state.hideRequestRides);
    renderRides();
    updateStaticChrome();
  });
}

function bindSearchForm() {
  const searchForm = document.getElementById("searchForm");
  if (!searchForm || searchForm.dataset.bound === "true") {
    return;
  }
  searchForm.dataset.bound = "true";

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(searchForm);
    const params = new URLSearchParams();
    params.set("scope", formData.get("scope") || "all");
    const query = formData.get("q");
    if (query) {
      params.set("q", query);
    }
    window.location.href = `/dashboard.html?${params.toString()}`;
  });
}

function bindRideActions() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const rideId = button.dataset.rideId;
      const offerId = button.dataset.offerId;
      const action = button.dataset.action;
      try {
        if (action === "become-driver") {
          await ShareTripApi.apiFetch(`/api/rides/${rideId}/become-driver`, {
            method: "POST",
          });
          window.location.href = `/dashboard.html?driver_pending=1&scope=${state.scope}`;
          return;
        }
        if (action === "accept-offer") {
          await ShareTripApi.apiFetch(
            `/api/rides/${rideId}/driver-offers/${offerId}/accept`,
            { method: "POST" }
          );
          window.location.reload();
          return;
        }
        if (action === "decline-offer") {
          await ShareTripApi.apiFetch(
            `/api/rides/${rideId}/driver-offers/${offerId}/decline`,
            { method: "POST" }
          );
          window.location.reload();
          return;
        }
        if (action === "join") {
          await ShareTripApi.apiFetch(`/api/rides/${rideId}/join`, { method: "POST" });
          window.location.href = "/dashboard.html?joined=1";
        } else if (action === "leave") {
          await ShareTripApi.apiFetch(`/api/rides/${rideId}/leave`, { method: "POST" });
          window.location.href = "/dashboard.html?left=1";
        } else if (action === "cancel") {
          if (!window.confirm("Cancel this ride?")) {
            return;
          }
          await ShareTripApi.apiFetch(`/api/rides/${rideId}`, { method: "DELETE" });
          window.location.href = "/dashboard.html?canceled=1";
        }
      } catch (error) {
        state.message = error.message;
        state.messageType = "error";
        await loadRides();
        render();
      }
    });
  });
}

function showFatalError(message) {
  document.getElementById("rides-container").innerHTML = `
    <section class="empty-rides">
      <h2>Could not load dashboard</h2>
      <p>${u().escapeHtml(message)}</p>
      <p><a href="/sign-in.html">Sign in</a> or <a href="/index.html">return home</a>.</p>
    </section>`;
}

async function initDashboardPage() {
  if (!window.ShareTripUtils) {
    showFatalError("Page scripts failed to load. Refresh and try again.");
    return;
  }

  parseInitialState();
  bindSearchForm();
  bindRequestRideFilter();

  const profile = await ShareTripAuth.requireProfile();
  if (!profile) {
    return;
  }

  state.profile = profile;
  state.hideRequestRides = u().loadHideRequestRidesPreference(profile);
  await ShareTripNavbar.renderNavbar("dashboard");

  if (state.editId) {
    state.showForm = true;
  }

  try {
    await loadRides();
    if (state.editId && !editingRide()) {
      const ride = await ShareTripApi.apiFetch(`/api/rides/${state.editId}`);
      state.rides.push(ride);
    }
  } catch (error) {
    state.message = error.message;
    state.messageType = "error";
  }

  render();

  if (window.ShareTripNotifications) {
    await ShareTripNotifications.showNotificationBanner();
  }

  if (location.hash === "#createRideForm") {
    document.getElementById("createRideForm")?.scrollIntoView({ behavior: "smooth" });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initDashboardPage().catch((error) => {
    console.error(error);
    showFatalError(error.message || "Unexpected error.");
  });
});
