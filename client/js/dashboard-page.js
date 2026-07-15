function u() {
  return window.ShareTripUtils;
}

const MESSAGES = {
  created: "Your ride has been posted.",
  updated: "Your ride has been updated.",
  published: "Your offer has been published on the ride board.",
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
  isAuthenticated: false,
  sameGenderOnly: false,
  offersOnly: false,
  requestsOnly: false,
  showFull: false,
  stateFilter: "",
  dateFrom: "",
  dateTo: "",
  filtersVisible: false,
  message: "",
  messageType: "success",
  ridePage: 1,
};

const RIDES_PER_PAGE = 9;

const IDAHO_ADJACENT_STATES = [
  "Idaho",
  "Montana",
  "Wyoming",
  "Utah",
  "Nevada",
  "Oregon",
  "Washington",
];

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
  if (query.has("published")) showMessage("published");
  if (query.has("joined")) showMessage("joined");
  if (query.has("left")) showMessage("left");
  if (query.has("canceled")) showMessage("canceled");
  if (query.has("commented")) showMessage("commented");

  u().stripFlashQueryParams();
}

function showGuestReadOnlyMessage(action) {
  state.message =
    action === "create"
      ? "Sign in with an existing account to create a ride."
      : "Sign in with an existing account to join rides or make driver offers.";
  state.messageType = "error";
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

function timeInputValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const twentyFourHour = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) {
    return `${twentyFourHour[1].padStart(2, "0")}:${twentyFourHour[2]}`;
  }

  const twelveHour = text.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!twelveHour) {
    return "";
  }

  let hour = Number(twelveHour[1]);
  const minute = twelveHour[2];
  const period = twelveHour[3].toUpperCase();
  if (period === "AM" && hour === 12) {
    hour = 0;
  } else if (period === "PM" && hour < 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
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

// Maps state names to their common abbreviations so "Provo, UT" matches "Utah".
const STATE_ABBREVIATIONS = {
  Idaho: ["ID"],
  Montana: ["MT"],
  Wyoming: ["WY"],
  Utah: ["UT"],
  Nevada: ["NV"],
  Oregon: ["OR"],
  Washington: ["WA"],
};

function rideDestinationMatchesState(ride, stateName) {
  const abbrevs = STATE_ABBREVIATIONS[stateName] || [];
  // Only match against destination fields, not origin.
  const fields = [
    String(ride.destination_state || "").trim(),
    String(ride.destination || "").trim(),
  ].map((f) => f.toLowerCase());

  const stateNameLower = stateName.toLowerCase();
  const abbrevPatterns = abbrevs.map((a) => a.toLowerCase());

  return fields.some((field) => {
    if (field === stateNameLower) return true;
    if (field.includes(stateNameLower)) return true;
    // Match ", UT" or " UT" or "(UT)" style abbreviations
    return abbrevPatterns.some(
      (abbrev) =>
        field === abbrev ||
        field.endsWith(`, ${abbrev}`) ||
        field.endsWith(` ${abbrev}`) ||
        field.includes(`, ${abbrev} `) ||
        field.includes(`(${abbrev})`)
    );
  });
}

function matchesStateFilter(ride) {
  if (!state.stateFilter) return true;
  if (state.stateFilter === "Other") {
    // Show rides that don't match any of the listed states.
    return !IDAHO_ADJACENT_STATES.some((s) =>
      rideDestinationMatchesState(ride, s)
    );
  }
  return rideDestinationMatchesState(ride, state.stateFilter);
}

function isFullOfferRide(ride) {
  // An offer ride counts as "full" (0 seats left) unless the viewer owns it or already joined it.
  if (String(ride.ride_type || "").toLowerCase() !== "offer") {
    return false;
  }
  return !(ride.seats > 0 || ride.is_owner === 1 || ride.current_user_joined === 1);
}

function ridesBeforeFullFilter() {
  let rides = state.rides;

  if (state.scope === "all") {
    if (state.offersOnly) {
      rides = rides.filter(isOfferRide);
    }
    if (state.requestsOnly) {
      rides = rides.filter((r) => !isOfferRide(r));
    }
    if (state.sameGenderOnly) {
      rides = rides.filter(matchesSameGenderFilter);
    }
    if (state.stateFilter) {
      rides = rides.filter(matchesStateFilter);
    }
    if (state.dateFrom.trim()) {
      rides = rides.filter((r) => r.start_date >= state.dateFrom.trim());
    }
    if (state.dateTo.trim()) {
      rides = rides.filter((r) => r.start_date <= state.dateTo.trim());
    }
  }

  return rides;
}

function visibleRides() {
  const rides = ridesBeforeFullFilter();
  if (state.scope === "all" && !state.showFull) {
    return rides.filter((r) => !isFullOfferRide(r));
  }
  return rides;
}

function resetRidePage() {
  state.ridePage = 1;
}

function getRidePagination(rides) {
  const totalRides = rides.length;
  const totalPages = Math.max(1, Math.ceil(totalRides / RIDES_PER_PAGE));
  const page = Math.min(Math.max(1, state.ridePage), totalPages);
  state.ridePage = page;
  const start = (page - 1) * RIDES_PER_PAGE;

  return {
    pageRides: rides.slice(start, start + RIDES_PER_PAGE),
    page,
    totalPages,
    totalRides,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

function renderRidePagination(pagination) {
  if (pagination.totalRides <= RIDES_PER_PAGE) {
    return "";
  }

  return `
    <nav class="ride-board-pagination" aria-label="Ride board pages">
      <button type="button" class="secondary-button ride-board-page-btn ride-board-page-btn--icon" data-action="ride-page-first" aria-label="First page"${pagination.page > 1 ? "" : " disabled"}>«</button>
      <button type="button" class="secondary-button ride-board-page-btn ride-board-page-btn--icon" data-action="ride-page-prev" aria-label="Previous page"${pagination.hasPrev ? "" : " disabled"}>‹</button>
      <label class="ride-board-page-status">
        Page
        <input
          type="number"
          class="ride-board-page-input"
          min="1"
          max="${pagination.totalPages}"
          value="${pagination.page}"
          aria-label="Current page"
        >
        of ${pagination.totalPages}
      </label>
      <button type="button" class="secondary-button ride-board-page-btn ride-board-page-btn--icon" data-action="ride-page-next" aria-label="Next page"${pagination.hasNext ? "" : " disabled"}>›</button>
      <button type="button" class="secondary-button ride-board-page-btn ride-board-page-btn--icon" data-action="ride-page-last" aria-label="Last page"${pagination.page < pagination.totalPages ? "" : " disabled"}>»</button>
    </nav>`;
}

function goToRidePage(page) {
  const pageInput = document.querySelector(".ride-board-page-input");
  const max = Number(pageInput?.max) || 1;
  state.ridePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), max);
  renderRides();
  document.getElementById("rides-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindRidePagination() {
  document
    .querySelectorAll(
      "[data-action='ride-page-first'], [data-action='ride-page-prev'], [data-action='ride-page-next'], [data-action='ride-page-last']"
    )
    .forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) {
          return;
        }
        const pageInput = document.querySelector(".ride-board-page-input");
        const max = Number(pageInput?.max) || 1;
        switch (button.dataset.action) {
          case "ride-page-first":
            goToRidePage(1);
            break;
          case "ride-page-prev":
            goToRidePage(state.ridePage - 1);
            break;
          case "ride-page-next":
            goToRidePage(state.ridePage + 1);
            break;
          case "ride-page-last":
            goToRidePage(max);
            break;
          default:
            break;
        }
      });
    });

  const pageInput = document.querySelector(".ride-board-page-input");
  if (pageInput) {
    pageInput.addEventListener("change", () => {
      goToRidePage(pageInput.value);
    });
    pageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        pageInput.blur();
      }
    });
  }
}

function hiddenFullRidesCount() {
  if (state.scope !== "all" || state.showFull) {
    return 0;
  }
  return ridesBeforeFullFilter().filter(isFullOfferRide).length;
}

function emptyRidesMessage() {
  if (state.scope !== "all" || state.rides.length === 0) {
    return "Try changing the ride view or search terms.";
  }

  const parts = [];
  if (state.offersOnly) {
    parts.push("driver requests are hidden");
  }
  if (state.requestsOnly) {
    parts.push("ride offers are hidden");
  }
  if (state.sameGenderOnly) {
    parts.push("only rides posted by people with the same gender as you are shown");
  }
  if (state.dateFrom.trim() || state.dateTo.trim()) {
    const from = state.dateFrom.trim();
    const to = state.dateTo.trim();
    if (from && to) parts.push(`date between ${from} and ${to}`);
    else if (from) parts.push(`date from ${from}`);
    else parts.push(`date until ${to}`);
  }

  if (parts.length === 0) {
    return "Try changing the ride view or search terms.";
  }

  return `Some rides are hidden (${parts.join("; ")}). Turn off the filters above to see them.`;
}

function renderRequestDriverActions(ride) {
  if (!state.isAuthenticated) {
    return "";
  }

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
    return `<button type="button" class="secondary-button cancel-pending-offer" data-action="cancel-driver-offer" data-ride-id="${ride.id}" data-offer-id="${ride.my_driver_offer_id}">Cancel pending</button>`;
  }
  if (status === "accepted") {
    return '<span class="ride-status">Accepted as driver</span>';
  }

  return `<button type="button" class="primary-small-button" data-action="become-driver" data-ride-id="${ride.id}">Become Driver</button>`;
}

function renderRideCard(ride) {
  const { escapeHtml, formatDateValue, rideTypeLabel, routeIconSvg } = u();
  const isOfferPending = u().isOfferPendingRide(ride);
  const typeLabel = rideTypeLabel(ride.ride_type, ride);
  const typeClass = isOfferPending
    ? "offer-pending"
    : typeLabel === "Request"
      ? "request"
      : "offer";
  const isOffer = String(ride.ride_type || "").toLowerCase() === "offer";
  const isOwner = ride.is_owner === 1;
  const hasJoined = ride.current_user_joined === 1;
  const remainingSeats = ride.seats;
  const totalSeats = ride.total_seats;
  const splitCost = ride.split_cost;
  const commentCount = ride.comment_count;

  let driverNameDisplay = "";
  if (isOffer) {
    if (isOwner) {
      driverNameDisplay = "You";
    } else {
      const firstName = ride.driver_fname || ride.owner_fname || ride.user?.fname || "";
      const lastName = ride.driver_lname || ride.owner_lname || ride.user?.lname || "";
      const fullName = `${firstName} ${lastName}`.trim();
      driverNameDisplay = fullName || ride.driver_name || ride.owner_name || "Unknown Member";
    }
  } else {
    if (ride.has_assigned_driver) {
      const assignedFirstName = ride.assigned_driver_fname || ride.assigned_driver?.fname || "";
      const assignedLastName = ride.assigned_driver_lname || ride.assigned_driver?.lname || "";
      const assignedFullName = `${assignedFirstName} ${assignedLastName}`.trim();
      driverNameDisplay = assignedFullName || ride.assigned_driver_name || "Assigned Driver";
    } else {
      driverNameDisplay = "No driver assigned yet";
    }
  }

  let footerActions = "";

  if (!state.isAuthenticated) {
    if (isOffer && !isOfferPending && remainingSeats <= 0) {
      footerActions = '<span class="ride-status full">Full</span>';
    }
  } else if (isOwner) {
    const editLabel = isOfferPending ? "Complete offer" : "Edit";
    footerActions = `
      <div class="ride-owner-actions">
        <a href="/dashboard.html?edit=${ride.id}&showForm=1&scope=${state.scope}#createRideForm" class="edit-ride-link">${editLabel}</a>
        <button type="button" class="danger-button" data-action="cancel" data-ride-id="${ride.id}">Cancel Ride</button>
      </div>`;
    if (isOfferPending) {
      footerActions += '<span class="ride-status pending-badge">Awaiting driver details</span>';
    }
  } else if (isOffer && hasJoined) {
    footerActions = `
      <div class="ride-owner-actions">
        ${isOfferPending ? '<span class="ride-status pending-badge">Offer pending</span>' : '<span class="ride-status">Joined</span>'}
        <button type="button" class="secondary-button" data-action="leave" data-ride-id="${ride.id}">Leave Ride</button>
      </div>`;
  } else if (isOffer && !isOfferPending && remainingSeats > 0) {
    footerActions = `<button type="button" class="primary-small-button" data-action="join" data-ride-id="${ride.id}" data-remaining-seats="${remainingSeats}">Join Ride</button>`;
  } else if (isOffer) {
    footerActions = '<span class="ride-status full">Full</span>';
  } else if (!isOffer) {
    footerActions = renderRequestDriverActions(ride);
  }

  const footer = `
    <a href="/ride-details.html?ride=${ride.id}" class="details-link">Details${
      commentCount > 0 ? ` (${commentCount})` : ""
    }</a>
    <div class="ride-card-footer-actions">${footerActions}</div>`;

  const flexibleBadge = ride.flexible
    ? '<span class="flexible-badge">Flexible</span>'
    : "";
  const pendingDriverOfferBadge =
    !isOffer && ride.pending_driver_offer_count > 0 && !ride.has_assigned_driver
      ? '<span class="ride-status pending-badge">Driver offer pending</span>'
      : "";

  const offerDetails =
    isOffer && !isOfferPending
      ? `
      <div>
        <span>Passenger Seats</span>
        <strong>${escapeHtml(remainingSeats)}/${escapeHtml(totalSeats)} Seats Available</strong>
      </div>
      <div>
        <span>Cost</span>
        <strong>$${Number(splitCost).toFixed(2)} each</strong>
      </div>`
      : isOfferPending
        ? `<div><span>Status</span><strong>Driver completing offer details</strong></div>`
        : "";

  const priceBlock =
    isOffer && !isOfferPending
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
          ${flexibleBadge}
          ${pendingDriverOfferBadge}
        </div>
        ${priceBlock}
      </div>

      <div class="ride-driver-info">
        <span>Driver:</span> <strong>${escapeHtml(driverNameDisplay)}</strong>
      </div>

      <h2 class="route-title">
        <span>${escapeHtml(ride.origin)}</span>
        <span class="route-icon" aria-hidden="true">${routeIconSvg(ride.roundtrip)}</span>
        <span>${escapeHtml(u().formatDestination(ride))}</span>
      </h2>
      <div class="ride-details">
        <div><span>Start</span><strong>${escapeHtml(formatDateValue(ride.start_date))}</strong></div>
        <div><span>End</span><strong>${escapeHtml(formatDateValue(ride.end_date))}</strong></div>
        ${ride.departure_time ? `<div><span>Departure time</span><strong>${escapeHtml(ride.departure_time)}</strong></div>` : ""}
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
  const isPendingOffer = u().isOfferPendingRide(ride);

  return `
    <section class="ride-form-panel" id="createRideForm">
      <div class="form-panel-header">
        <div>
          <h2>${isPendingOffer ? "Complete Your Offer" : isEdit ? "Edit Ride" : "Create a Ride"}</h2>
          <p>${
            isPendingOffer
              ? "Add seats, cost, and any other trip details. Saving will publish this offer on the ride board."
              : isEdit
                ? "Update the details for your posted ride."
                : "Post a new ride offer or request for other members to find."
          }</p>
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
            <input type="time" name="departureTime" value="${escapeHtml(timeInputValue(ride?.departure_time))}">
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
        <button type="submit">${
          isPendingOffer ? "Publish Offer" : isEdit ? "Save Changes" : "Post Ride"
        }</button>
      </form>
    </section>
  `;
}

function updateStaticChrome() {
  const welcomeName = state.profile
    ? `${state.profile.fname} ${state.profile.lname}`.trim()
    : "guest";

  document.getElementById("welcome-eyebrow").textContent = `Welcome, ${welcomeName}`;

  const createLink = document.getElementById("create-ride-link");
  if (createLink) {
    createLink.href = `/dashboard.html?showForm=1&scope=${state.scope}#createRideForm`;
    createLink.hidden = !state.isAuthenticated;
  }

  const guestCta = document.getElementById("guest-ride-board-cta");
  if (guestCta) {
    guestCta.hidden = state.isAuthenticated;
  }

  const headerBlurb = document.querySelector(".dashboard-header > div > p:last-of-type");
  if (headerBlurb) {
    headerBlurb.textContent =
      state.showForm || state.editId
        ? "Fill out the form below to post your ride. The board is hidden until you save or cancel."
        : "Browse every ride offer and request currently shared by the community.";
  }

  document.getElementById("filter-all").classList.toggle("active", state.scope === "all");
  const myFilter = document.getElementById("filter-my");
  document.getElementById("filter-my").classList.toggle("active", state.scope === "my");
  document.getElementById("filter-all").href = filterUrl("all", state.search);
  document.getElementById("filter-my").href = filterUrl("my", state.search);
  if (myFilter) {
    myFilter.hidden = !state.isAuthenticated;
  }

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
  const showMemberFilters = showAllFilters && state.isAuthenticated;

  // Toggle filter panel visibility.
  const filterPanel = document.getElementById("advanced-filter-panel");
  if (filterPanel) {
    filterPanel.hidden = !state.filtersVisible || !showAllFilters;
  }

  const ridefilterPanelEl = document.getElementById("ride-filter-panel");
  if (ridefilterPanelEl) {
    ridefilterPanelEl.classList.toggle("filters-open", state.filtersVisible && showAllFilters);
  }

  // Update the toggle button state.
  const filterToggleBtn = document.getElementById("filter-toggle-btn");
  if (filterToggleBtn) {
    filterToggleBtn.hidden = !showAllFilters;
    filterToggleBtn.classList.toggle("active", state.filtersVisible);
    const label = document.getElementById("filter-toggle-label");
    if (label) {
      const activeFilterCount = [
        state.offersOnly,
        state.requestsOnly,
        state.showFull,
        state.sameGenderOnly,
        state.stateFilter,
        state.dateFrom.trim(),
        state.dateTo.trim(),
      ].filter(Boolean).length;
      label.textContent = activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters";
    }
  }

  // Offers-only filter checkbox. Also doubles as "hide driver requests":
  // non-drivers can't act on request rides, so it's forced on and locked
  // for them, same as the old dedicated toggle used to do.
  const offersOnlyFilter = document.getElementById("offers-only-filter");
  if (offersOnlyFilter) {
    if (showAllFilters) {
      const checkbox = offersOnlyFilter.querySelector('input[type="checkbox"]');
      if (checkbox) {
        if (!u().isAbleDriver(state.profile)) {
          state.offersOnly = true;
          u().saveOffersOnlyPreference(true);
        }
        checkbox.checked = state.offersOnly;
        checkbox.disabled = !u().isAbleDriver(state.profile);
      }
    }
  }

  const genderFilter = document.getElementById("same-gender-only-filter");
  if (genderFilter) {
    genderFilter.hidden = !showMemberFilters;
    if (showMemberFilters) {
      const checkbox = genderFilter.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = state.sameGenderOnly;
      }
    }
  }

  // Requests-only filter checkbox. Mutually exclusive with "Offers only"
  // (checking both would always show zero rides). Doesn't make sense for
  // non-drivers, who already have "Offers only" forced on above.
  const requestsOnlyFilter = document.getElementById("requests-only-filter");
  if (requestsOnlyFilter) {
    if (showAllFilters) {
      const checkbox = requestsOnlyFilter.querySelector('input[type="checkbox"]');
      if (checkbox) {
        if (!u().isAbleDriver(state.profile)) {
          state.requestsOnly = false;
        }
        checkbox.checked = state.requestsOnly;
        checkbox.disabled = !u().isAbleDriver(state.profile);
      }
    }
  }

  const showFullFilter = document.getElementById("show-full-filter");
  if (showFullFilter && showAllFilters) {
    const checkbox = showFullFilter.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = state.showFull;
    }
  }

  const stateSelect = document.getElementById("state-filter-select");
  if (stateSelect && showAllFilters) {
    stateSelect.value = state.stateFilter || "";
  }

  // Date filter inputs.
  const dateFromInput = document.getElementById("date-from-input");
  if (dateFromInput) dateFromInput.value = state.dateFrom;
  const dateToInput = document.getElementById("date-to-input");
  if (dateToInput) dateToInput.value = state.dateTo;

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
  const banner = renderFullRidesBanner();
  const pagination = getRidePagination(rides);

  if (rides.length > 0) {
    container.innerHTML = `${banner}<section class="ride-grid">${pagination.pageRides.map(renderRideCard).join("")}</section>${renderRidePagination(pagination)}`;
  } else {
    container.innerHTML = `
      ${banner}
      <section class="empty-rides">
        <h2>No rides found</h2>
        <p>${emptyRidesMessage()}</p>
      </section>`;
  }

  bindRideActions();
  bindFullRidesBanner();
  bindRidePagination();
}

function renderFullRidesBanner() {
  const hiddenCount = hiddenFullRidesCount();
  if (hiddenCount === 0) {
    return "";
  }
  const rideWord = hiddenCount === 1 ? "ride is" : "rides are";
  return `
    <div class="full-rides-banner" id="full-rides-banner">
      <span>${hiddenCount} full ${rideWord} hidden.</span>
      <button type="button" id="show-full-rides-btn">Show full rides</button>
    </div>`;
}

function bindFullRidesBanner() {
  const btn = document.getElementById("show-full-rides-btn");
  if (!btn) {
    return;
  }
  btn.addEventListener("click", () => {
    state.showFull = true;
    resetRidePage();
    const checkbox = document.querySelector("#show-full-filter input[type='checkbox']");
    if (checkbox) {
      checkbox.checked = true;
    }
    render();
  });
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

  if (!state.isAuthenticated && (state.showForm || state.editId)) {
    container.innerHTML = "";
    return;
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
    createLink.hidden = composing || !state.isAuthenticated;
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
      departureTime: formData.get("departureTime"),
    };

    try {
      if (rideId) {
        const wasPending = u().isOfferPendingRide(editingRide());
        await ShareTripApi.apiFetch(`/api/rides/${rideId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        window.location.href = wasPending
          ? `/dashboard.html?published=1&scope=${state.scope}`
          : `/dashboard.html?updated=1&scope=${state.scope}`;
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

function bindFilterToggle() {
  const btn = document.getElementById("filter-toggle-btn");
  if (!btn) {
    return;
  }
  btn.addEventListener("click", () => {
    state.filtersVisible = !state.filtersVisible;
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
    resetRidePage();
    render();
  });
}

function bindOffersOnlyFilter() {
  const offersOnlyFilter = document.getElementById("offers-only-filter");
  if (!offersOnlyFilter) {
    return;
  }

  const checkbox = offersOnlyFilter.querySelector('input[type="checkbox"]');
  if (!checkbox) {
    return;
  }

  checkbox.addEventListener("change", () => {
    if (!u().isAbleDriver(state.profile)) {
      state.offersOnly = true;
      checkbox.checked = true;
      u().saveOffersOnlyPreference(true);
      resetRidePage();
      render();
      return;
    }
    state.offersOnly = checkbox.checked;
    if (state.offersOnly) {
      state.requestsOnly = false;
    }
    u().saveOffersOnlyPreference(state.offersOnly);
    resetRidePage();
    render();
  });
}

function bindRequestsOnlyFilter() {
  const requestsOnlyFilter = document.getElementById("requests-only-filter");
  if (!requestsOnlyFilter) {
    return;
  }

  const checkbox = requestsOnlyFilter.querySelector('input[type="checkbox"]');
  if (!checkbox) {
    return;
  }

  checkbox.addEventListener("change", () => {
    state.requestsOnly = checkbox.checked;
    if (state.requestsOnly) {
      state.offersOnly = false;
      u().saveOffersOnlyPreference(false);
    }
    resetRidePage();
    render();
  });
}

function bindShowFullFilter() {
  const filter = document.getElementById("show-full-filter");
  if (!filter) return;
  const checkbox = filter.querySelector('input[type="checkbox"]');
  if (!checkbox) return;
  checkbox.addEventListener("change", () => {
    state.showFull = checkbox.checked;
    resetRidePage();
    render();
  });
}

function bindStateFilter() {
  const select = document.getElementById("state-filter-select");
  if (!select) return;
  select.addEventListener("change", () => {
    state.stateFilter = select.value;
    resetRidePage();
    render();
  });
}

function bindDateFilter() {
  const fromInput = document.getElementById("date-from-input");
  const toInput = document.getElementById("date-to-input");
  const clearBtn = document.getElementById("clear-date-filter");

  if (fromInput) {
    fromInput.addEventListener("input", () => {
    state.dateFrom = fromInput.value;
    resetRidePage();
    render();
  });
  }
  if (toInput) {
    toInput.addEventListener("input", () => {
    state.dateTo = toInput.value;
    resetRidePage();
    render();
  });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      state.dateFrom = "";
      state.dateTo = "";
      state.offersOnly = false;
      state.requestsOnly = false;
      state.stateFilter = "";
      state.showFull = false;
      state.sameGenderOnly = false;
      if (fromInput) fromInput.value = "";
      if (toInput) toInput.value = "";
      const stateSelect = document.getElementById("state-filter-select");
      if (stateSelect) stateSelect.value = "";
      const offersCheckbox = document.querySelector("#offers-only-filter input");
      if (offersCheckbox) offersCheckbox.checked = false;
      const requestsCheckbox = document.querySelector("#requests-only-filter input");
      if (requestsCheckbox) requestsCheckbox.checked = false;
      const showFullCheckbox = document.querySelector("#show-full-filter input");
      if (showFullCheckbox) showFullCheckbox.checked = false;
      const genderCheckbox = document.querySelector("#same-gender-only-filter input");
      if (genderCheckbox) genderCheckbox.checked = false;
      if (!u().isAbleDriver(state.profile)) {
        state.offersOnly = true;
        u().saveOffersOnlyPreference(true);
        if (offersCheckbox) offersCheckbox.checked = true;
      }
      u().saveOffersOnlyPreference(state.offersOnly);
      u().saveSameGenderOnlyPreference(false);
      resetRidePage();
      render();
    });
  }
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
          window.location.href = `/dashboard.html?scope=${state.scope}`;
          return;
        }
        if (action === "cancel-driver-offer") {
          if (!window.confirm("Cancel your pending driver offer?")) {
            return;
          }
          await ShareTripApi.apiFetch(`/api/rides/${rideId}/cancel-driver-offer`, {
            method: "POST",
          });
          window.location.href = `/dashboard.html?scope=${state.scope}`;
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
      <h2>Could not load Ride Board</h2>
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
  bindFilterToggle();
  bindSameGenderFilter();
  bindOffersOnlyFilter();
  bindRequestsOnlyFilter();
  bindShowFullFilter();
  bindStateFilter();
  bindDateFilter();

  const session = await ShareTripAuth.getSession();
  state.isAuthenticated = Boolean(session.isAuthenticated);

  if (!state.isAuthenticated) {
    if (state.scope === "my") {
      state.scope = "all";
    }
    if (state.showForm || state.editId) {
      state.showForm = false;
      state.editId = 0;
      showGuestReadOnlyMessage("create");
    }
  } else {
    const profile = await ShareTripAuth.requireProfile();
    if (!profile) {
      return;
    }

    state.profile = profile;
    state.offersOnly = u().loadOffersOnlyPreference(profile);
    state.sameGenderOnly = u().loadSameGenderOnlyPreference();
  }

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

  if (state.isAuthenticated && window.ShareTripNotifications) {
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