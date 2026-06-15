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
  sameGenderOnly: false,
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

function isOfferRide(ride) {
  return String(ride?.ride_type || "").toLowerCase() === "offer";
}

function matchesSameGenderFilter(ride) {
  const userGender = String(state.profile?.gender || "").trim().toLowerCase();
  if (!userGender) {
    return true;
  }
  const ownerGender = String(ride.owner_gender || "").trim().toLowerCase();
  return ownerGender === userGender;
}

function visibleRides() {
  let rides = state.rides;

  if (state.scope === "all") {
    if (state.hideRequestRides) {
      rides = rides.filter(isOfferRide);
    }
    if (state.sameGenderOnly) {
      rides = rides.filter(matchesSameGenderFilter);
    }
  }

  return rides;
}

function emptyRidesMessage() {
  if (state.scope !== "all" || state.rides.length === 0) {
    return "Try changing the ride view or search terms.";
  }

  const parts = [];
  if (state.hideRequestRides) {
    parts.push("driver requests are hidden");
  }
  if (state.sameGenderOnly) {
    parts.push("only rides posted by people with the same gender as you are shown");
  }

  if (parts.length === 0) {
    return "Try changing the ride view or search terms.";
  }

  return `Some rides are hidden (${parts.join("; ")}). Turn off the filters above to see them.`;
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

  // --- Dynamic Actual Name Resolution ---
  let driverNameDisplay = "";
  
  if (isOffer) {
    if (isOwner) {
      driverNameDisplay = "You";
    } else {
      // Check common API naming patterns for the driver's actual name
      const firstName = ride.driver_fname || ride.owner_fname || ride.user?.fname || "";
      const lastName = ride.driver_lname || ride.owner_lname || ride.user?.lname || "";
      const fullName = `${firstName} ${lastName}`.trim();

      // Fallback to a single name field if names are not split into first/last properties
      driverNameDisplay = fullName || ride.driver_name || ride.owner_name || "Unknown Member";
    }
  } else {
    // If it's a Request, handle the assigned driver's actual name
    if (ride.has_assigned_driver) {
      const assignedFirstName = ride.assigned_driver_fname || ride.assigned_driver?.fname || "";
      const assignedLastName = ride.assigned_driver_lname || ride.assigned_driver?.lname || "";
      const assignedFullName = `${assignedFirstName} ${assignedLastName}`.trim();
      
      driverNameDisplay = assignedFullName || ride.assigned_driver_name || "Assigned Driver";
    } else {
      driverNameDisplay = "No driver assigned yet";
    }
  }
  // ---------------------------------------

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
    footer += `<button type="button" class="primary-small-button" data-action="join" data-ride-id="${ride.id}" data-remaining-seats="${remainingSeats}">Join Ride</button>`;
  } else if (isOffer) {
    footer += `<span class="ride-status full">Full</span>`;
  } else if (!isOffer) {
    footer += renderRequestDriverActions(ride);
  }

  const pastBadge =
    state.scope === "my" && ride.is_past
      ? '<span class="ride-time-status">Past</span>'
      : "";

  const flexibleBadge = ride.flexible
    ? '<span class="flexible-badge">Flexible</span>'
    : "";

  const offerDetails = isOffer
    ? `
      <div>
        <span>Passenger Seats</span>
        <strong>${escapeHtml(remainingSeats)}/${escapeHtml(totalSeats)} Seats Available</strong>
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
    <article class="ride-card ride-card--${typeClass}" id="ride-${ride.id}">
      <div class="ride-card-top">
        <div class="ride-card-badges">
          <span class="ride-type ${typeClass}">${escapeHtml(typeLabel)}</span>
          ${pastBadge}
          ${flexibleBadge}
        </div>
        ${priceBlock}
      </div>
      
      <div class="ride-driver-info" style="margin-bottom: 10px; font-size: 0.9rem; color: #4a5568;">
        <span>Driver:</span> <strong style="color: #2d3748;">${escapeHtml(driverNameDisplay)}</strong>
      </div>

      <h2 class="route-title">
        <span>${escapeHtml(ride.origin)}</span>
        <span class="route-icon" aria-hidden="true">${routeIconSvg(ride.roundtrip)}</span>
        <span>${escapeHtml(u().formatDestination(ride))}</span>
      </h2>
      <div class="ride-details">
        <div><span>Start</span><strong>${escapeHtml(formatDateValue(ride.start_date))}</strong></div>
        <div><span>End</span><strong>${escapeHtml(formatDateValue(ride.end_date))}</strong></div>
        ${ride.start_time ? `<div><span>Pickup Time</span><strong>${escapeHtml(ride.start_time)}</strong></div>` : ""}
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
        <div class="ride-type-selector">
          <p class="ride-type-selector-label">What would you like to do?</p>
          <div class="ride-type-cards">
            <button type="button" class="ride-type-card ${ride?.ride_type === 'offer' ? 'active' : ''}" data-type="offer">
            <strong>Offer a Ride</strong>
          </button>
          <button type="button" class="ride-type-card ${ride?.ride_type === 'request' ? 'active' : ''}" data-type="request">
            <strong>Request a Ride</strong>
          </button>
        </div>
        <input type="hidden" name="rideType" id="rideType" value="${ride?.ride_type ?? ''}">
        </div>
        <div class="form-row">
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
            <input type="date" name="startDate" value="${escapeHtml(ride?.start_date ?? "")}" required class="date-input">
          </div>
          <div id="endDateField">
            <label>End Date</label>
            <input type="date" name="endDate" value="${escapeHtml(ride?.end_date ?? "")}" class="date-input">
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Pickup Time</label>
            <input type="time" name="startTime" value="${escapeHtml(ride?.start_time ?? "")}">
          </div>
          <div class="flexible-row" style="align-self: end; padding-bottom: 12px;">
            <input type="checkbox" name="flexible" id="flexible" value="1" ${ride?.flexible ? "checked" : ""}>
            <label for="flexible">Flexible on time</label>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Departure</label>
            <input type="text" name="origin" maxlength="75" value="${escapeHtml(ride?.origin ?? "")}" required>
          </div>
          <div>
            <label>Destination</label>
            <input type="text" name="destination" maxlength="75" value="${escapeHtml(ride?.destination ?? "")}" required>
          </div>
        </div>
        <div class="form-row destination-state-row">
          <div class="offer-only-fields">
            <label>Total Cost</label>
            <div class="input-with-prefix">
              <span class="input-prefix">$</span>
              <input type="number" name="rideCost" min="0" step="0.01" value="${escapeHtml(ride?.ride_cost ?? "")}" required>
            </div>
            <p class="field-hint">Avg gas cost: ~$0.14/mi (5mi: $0.70 · 10mi: $1.40 · 30mi: $4.20 · 50mi: $7.00)</p>
          </div>
          <div>
            <label for="destinationState">State</label>
            <input type="text" id="destinationState" name="destinationState" maxlength="50" value="${escapeHtml(ride?.destination_state ?? "")}" placeholder="Optional">
          </div>
        </div>
        <div class="form-row offer-only-fields">
          <div>
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

  const showAllFilters = state.scope === "all";

  const requestFilter = document.getElementById("hide-request-rides-filter");
  if (requestFilter) {
    requestFilter.hidden = !showAllFilters;
    if (showAllFilters) {
      const checkbox = requestFilter.querySelector('input[type="checkbox"]');
      if (checkbox) {
        if (!u().isAbleDriver(state.profile)) {
          state.hideRequestRides = true;
          u().saveHideRequestRidesPreference(true);
        }
        checkbox.checked = state.hideRequestRides;
        checkbox.disabled = !u().isAbleDriver(state.profile);
      }
    }
  }

  const genderFilter = document.getElementById("same-gender-only-filter");
  if (genderFilter) {
    genderFilter.hidden = !showAllFilters;
    if (showAllFilters) {
      const checkbox = genderFilter.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = state.sameGenderOnly;
      }
    }
  }

  const messageEl = document.getElementById("dashboard-message");
  if (messageEl) {
    u().renderSiteAlert(messageEl, state.message, {
      type: state.messageType,
      onDismiss: () => {
        state.message = "";
        state.messageType = "success";
      },
    });
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
    container.innerHTML = `
      <section class="empty-rides">
        <h2>No rides found</h2>
        <p>${emptyRidesMessage()}</p>
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
  const destinationStateRow = document.querySelector(".destination-state-row");

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
    const isSelected = rideType.value !== "";
    const formRows = document.querySelectorAll(
      "#rideForm .form-row:not(.ride-type-selector):not(.destination-state-row):not(.offer-only-fields), #rideForm .flexible-row, #rideForm button[type='submit']"
    );

    formRows.forEach((el) => {
      el.style.display = isSelected ? "" : "none";
    });

    if (destinationStateRow) {
      destinationStateRow.style.display = isSelected ? "" : "none";
      destinationStateRow.classList.toggle("state-only", isSelected && !isOffer);
    }

    offerFields.forEach((fieldGroup) => {
      const isFormRow = fieldGroup.classList.contains("form-row");
      fieldGroup.style.display = isOffer ? (isFormRow ? "grid" : "block") : "none";
      fieldGroup.querySelectorAll("input, select").forEach((field) => {
        field.disabled = !isOffer;
        field.required = isOffer;
      });
    });
  }

  document.querySelectorAll(".ride-type-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".ride-type-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      rideType.value = card.dataset.type;
      updateOfferFields();
    });
  });

  tripType.addEventListener("change", updateEndDateField);
  updateEndDateField();
  updateOfferFields();

  // Date input: auto-format as user types (YYYY-MM-DD)
  document.querySelectorAll(".date-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      let val = e.target.value.replace(/[^\d]/g, "");
      if (val.length > 4) val = val.slice(0, 4) + "-" + val.slice(4);
      if (val.length > 7) val = val.slice(0, 7) + "-" + val.slice(7);
      if (val.length > 10) val = val.slice(0, 10);
      e.target.value = val;
    });
  });
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
      destinationState: formData.get("destinationState"),
      seats: formData.get("seats"),
      rideCost: formData.get("rideCost"),
      genderPreference: formData.get("genderPreference"),
      flexible: formData.get("flexible") === "1",
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
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
    if (!u().isAbleDriver(state.profile)) {
      state.hideRequestRides = true;
      checkbox.checked = true;
      u().saveHideRequestRidesPreference(true);
      render();
      return;
    }
    state.hideRequestRides = checkbox.checked;
    u().saveHideRequestRidesPreference(state.hideRequestRides);
    render();
  });
}

function bindSameGenderFilter() {
  const genderFilter = document.getElementById("same-gender-only-filter");
  if (!genderFilter) {
    return;
  }

  const checkbox = genderFilter.querySelector('input[type="checkbox"]');
  if (!checkbox) {
    return;
  }

  checkbox.addEventListener("change", () => {
    state.sameGenderOnly = checkbox.checked;
    u().saveSameGenderOnlyPreference(state.sameGenderOnly);
    render();
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
          const joinDetails = await u().promptJoinPartySize(button.dataset.remainingSeats);
          if (!joinDetails) {
            return;
          }
          await ShareTripApi.apiFetch(`/api/rides/${rideId}/join`, {
            method: "POST",
            body: JSON.stringify(joinDetails),
          });
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
  bindSameGenderFilter();

  const profile = await ShareTripAuth.requireProfile();
  if (!profile) {
    return;
  }

  state.profile = profile;
  state.hideRequestRides = u().loadHideRequestRidesPreference(profile);
  state.sameGenderOnly = u().loadSameGenderOnlyPreference();
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
