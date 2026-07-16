function u() {
  return window.ShareTripUtils;
}

let detail = null;
let message = "";
let messageType = "success";
let isAuthenticated = false;
let showDriverDetailsForm = false;

function genderClass(gender) {
  return String(gender || "").toLowerCase() === "female" ? "female" : "male";
}

function ratingOptions(selected) {
  let html = '<option value="">Rating</option>';
  for (let value = 5; value >= 1; value -= 1) {
    html += `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${value}</option>`;
  }
  return html;
}

function renderRatingForm(rideId, person, role) {
  const { escapeHtml, fullName } = u();
  const userId = person.user_id;
  const currentRating = person.current_user_rating;
  const currentComment = person.current_user_rating_comment || "";

  return `
    <form class="rating-form" data-rating-form data-ride-id="${rideId}" data-user-id="${escapeHtml(userId)}" data-role="${role}">
      <label>Rate ${escapeHtml(fullName(person))}</label>
      <div class="rating-row">
        <select name="rating" required>${ratingOptions(currentRating)}</select>
        <input type="text" name="ratingComment" maxlength="500" value="${escapeHtml(currentComment)}" placeholder="Optional note">
        <button type="submit">Save</button>
      </div>
    </form>
    ${
      currentRating
        ? `<button type="button" class="delete-rating-btn secondary-button" data-action="delete-rating" data-ride-id="${rideId}" data-rated-user-id="${escapeHtml(userId)}">Remove rating</button>`
        : ""
    }
  `;
}

function renderRequestDriverActions(ride, currentUserId) {
  const isDriverDetailsPending = u().isRequestDriverDetailsPending(ride);
  if (ride.is_owner) {
    return isDriverDetailsPending
      ? '<span class="ride-status pending-badge">Waiting for driver details</span>'
      : "";
  }
  if (ride.has_assigned_driver) {
    // If the current user is the assigned driver, show resign button.
    if (ride.assigned_driver_id === currentUserId) {
      const completeButton = isDriverDetailsPending
        ? `<button type="button" class="primary-small-button" data-action="show-driver-details" data-ride-id="${ride.id}">Complete trip details</button>`
        : "";
      return `
        <div class="request-driver-action-row">
          <span class="ride-status">Accepted as driver</span>
          <div class="request-driver-action-buttons">
            ${completeButton}
            <button type="button" class="danger-button" data-action="resign-driver" data-ride-id="${ride.id}">Resign as driver</button>
          </div>
        </div>`;
    }
    return '<span class="ride-status">Driver assigned</span>';
  }
  const status = ride.my_driver_offer_status;
  if (status === "pending") {
    return `<button type="button" class="secondary-button" data-action="cancel-driver-offer" data-ride-id="${ride.id}" data-offer-id="${ride.my_driver_offer_id}">Cancel pending</button>`;
  }
  if (status === "accepted") {
    return '<span class="ride-status">Accepted as driver</span>';
  }
  return `<button type="button" class="primary-small-button" data-action="become-driver" data-ride-id="${ride.id}">Become Driver</button>`;
}

function renderDriverOffersPanel(detail) {
  const { escapeHtml, fullName } = u();
  const offers = detail.pending_driver_offers || [];
  if (!detail.ride.is_owner || detail.ride.ride_type !== "request" || offers.length === 0) {
    return "";
  }

  const cards = offers
    .map(
      (offer) => `
    <div class="driver-offer-card">
      <strong>${escapeHtml(fullName(offer))}</strong>
      <div class="driver-offer-actions">
        <button type="button" class="primary-small-button" data-action="accept-offer" data-ride-id="${detail.ride.id}" data-offer-id="${offer.id}">Accept</button>
        <button type="button" class="secondary-button" data-action="decline-offer" data-ride-id="${detail.ride.id}" data-offer-id="${offer.id}">Decline</button>
      </div>
    </div>`
    )
    .join("");

  return `
    <section class="detail-card detail-section" id="driver-offers">
      <div class="section-heading">
        <h2>Driver offers</h2>
        <span>${offers.length} pending</span>
      </div>
      <div class="driver-offers-panel">${cards}</div>
    </section>`;
}

function renderDriverDetailsModal(ride) {
  const { escapeHtml } = u();
  const isAssignedDriver =
    ride.assigned_driver_id && ride.assigned_driver_id === ride.current_user_id;
  if (!isAssignedDriver || !u().isRequestDriverDetailsPending(ride) || !showDriverDetailsForm) {
    return "";
  }

  return `
    <div class="driver-details-modal-backdrop" data-action="hide-driver-details" role="presentation">
      <section class="ride-form-panel driver-details-modal" id="complete-driver-details" role="dialog" aria-modal="true" aria-labelledby="driver-details-title">
        <div class="form-panel-header">
          <div>
            <h2 id="driver-details-title">Complete Trip Details</h2>
            <p>Add the available seats, shared cost, and pickup details before this ride is ready for passengers.</p>
          </div>
          <button type="button" class="cancel-form-link driver-details-cancel-link" data-action="hide-driver-details">Cancel</button>
        </div>
        <form class="ride-form driver-details-form" id="driverDetailsForm">
          <div class="form-row">
            <div>
              <label for="driver-detail-seats">Available passenger seats</label>
              <input id="driver-detail-seats" name="seats" type="number" min="0" step="1" value="${escapeHtml(ride.seats ?? 0)}" required>
            </div>
            <div>
              <label for="driver-detail-cost">Total ride cost</label>
              <div class="input-with-prefix">
                <span class="input-prefix">$</span>
                <input id="driver-detail-cost" name="rideCost" type="number" min="0" step="0.01" value="${escapeHtml(ride.ride_cost ?? 0)}" required>
              </div>
              <p class="field-hint">Enter the total shared ride cost, not the per-person amount.</p>
            </div>
          </div>
          <div class="form-row">
            <div>
              <label for="driver-detail-time">Departure time</label>
              <input id="driver-detail-time" name="departureTime" type="text" maxlength="50" value="${escapeHtml(ride.departure_time || "")}" placeholder="e.g. 8:30 AM">
            </div>
          </div>
          <div class="form-row single-column">
            <div>
              <label for="driver-detail-notes">Notes</label>
              <textarea id="driver-detail-notes" name="rideNotes" maxlength="500" rows="3" placeholder="Pickup spot, luggage space, payment notes">${escapeHtml(ride.ride_notes || "")}</textarea>
            </div>
          </div>
          <button type="submit">Save Trip Details</button>
        </form>
      </section>
    </div>`;
}

function profilePageUrl(userId) {
  if (!userId) return "";
  return `/my-profile.html?user=${encodeURIComponent(userId)}`;
}

function renderViewProfileLink(userId) {
  if (!userId) return "";
  return `<a href="${profilePageUrl(userId)}" class="view-profile-link secondary-button">View profile</a>`;
}

function renderPersonCard(person, ride, role) {
  const { escapeHtml, formatRatingValue, fullName } = u();
  const isDriver = role === "driver";
  const userId = person.user_id || person.id || null;
  const canRate = isAuthenticated && ride.ride_completed && userId !== ride.current_user_id;

  const drivenCount = isDriver
    ? (ride.driver_driven_count ?? person.driven_count ?? 0)
    : (person.driven_count ?? 0);
  const passengerTrips = isDriver
    ? (ride.driver_passenger_trips ?? person.passenger_count ?? 0)
    : (person.passenger_count ?? 0);
  const ratingAverage = isDriver
    ? (ride.driver_rating_average ?? person.rating_average)
    : person.rating_average;
  const ratingCount = isDriver
    ? (ride.driver_rating_count ?? person.rating_count ?? 0)
    : (person.rating_count ?? 0);

  const guestList =
    !isDriver && Array.isArray(person.guest_details) && person.guest_details.length
      ? `<ul class="passenger-guest-list">${person.guest_details
          .map(
            (guest) =>
              `<li><strong>${escapeHtml(guest.name)}</strong>${
                guest.phone ? ` · ${escapeHtml(guest.phone)}` : ""
              }</li>`
          )
          .join("")}</ul>`
      : "";

  return `
    <article class="person-card">
      <div class="person-row ${isDriver ? "driver" : ""}">
        <span class="${isDriver ? "driver-icon" : "person-icon"} ${genderClass(person.gender)}" aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            ${
              isDriver
                ? '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 14v8"></path><path d="m19 9-5 3"></path><path d="m5 9 5 3"></path>'
                : '<path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle>'
            }
          </svg>
        </span>
        <span class="person-name">
          <span>${escapeHtml(fullName(person))}</span>
          <span class="rating-pill">${escapeHtml(formatRatingValue(ratingAverage))} star${ratingCount == 1 ? "" : "s"}</span>
          <small>${isDriver ? "Driver" : "Passenger"}</small>
        </span>
      </div>
      <div class="person-stats">
        <span>${escapeHtml(drivenCount)} driven</span>
        <span>${escapeHtml(passengerTrips)} passenger</span>
        <span>${escapeHtml(ratingCount)} rating${ratingCount == 1 ? "" : "s"}</span>
      </div>
      <div class="person-actions">
        ${renderViewProfileLink(userId)}
      </div>
      ${guestList}
      ${
        canRate
          ? renderRatingForm(
              ride.id,
              {
                ...person,
                current_user_rating: isDriver
                  ? ride.current_user_driver_rating
                  : person.current_user_rating,
                current_user_rating_comment: isDriver
                  ? ride.current_user_driver_rating_comment
                  : person.current_user_rating_comment,
              },
              role
            )
          : isAuthenticated && userId !== ride.current_user_id
            ? '<p class="rating-unavailable">Ratings open after the ride is completed.</p>'
            : ""
      }
    </article>
  `;
}

function renderComment(comment, rideId) {
  const { escapeHtml, formatCommentDate, fullName } = u();
  const isOwn = comment.is_own === 1;

  return `
    <article class="comment-item" id="comment-${comment.id}">
      <div class="comment-meta">
        <strong>${escapeHtml(fullName(comment))}</strong>
        <span>${escapeHtml(formatCommentDate(comment.created_at))}${comment.updated_at ? " (edited)" : ""}</span>
      </div>
      <p class="comment-body">${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p>
      ${
        isOwn
          ? `<div class="comment-own-actions">
              <button type="button" class="secondary-button" data-action="edit-comment" data-comment-id="${comment.id}" data-ride-id="${rideId}">Edit</button>
              <button type="button" class="danger-button" data-action="delete-comment" data-comment-id="${comment.id}" data-ride-id="${rideId}">Delete</button>
            </div>`
          : ""
      }
    </article>`;
}

function renderEditCommentForm(comment, rideId) {
  const { escapeHtml } = u();
  return `
    <article class="comment-item editing" id="comment-${comment.id}">
      <form class="comment-edit-form" data-comment-id="${comment.id}" data-ride-id="${rideId}">
        <textarea name="commentBody" maxlength="500" rows="3" required>${escapeHtml(comment.body)}</textarea>
        <div class="comment-edit-actions">
          <button type="submit" class="primary-small-button">Save</button>
          <button type="button" class="secondary-button" data-action="cancel-edit-comment" data-comment-id="${comment.id}" data-ride-id="${rideId}">Cancel</button>
        </div>
      </form>
    </article>`;
}

function updatePageMessage() {
  const messageEl = document.getElementById("page-message");
  u().renderSiteAlert(messageEl, message, {
    type: messageType,
    onDismiss: () => {
      message = "";
      messageType = "success";
    },
  });
}

function renderDriverSection(detail, ride) {
  if (!detail.driver) {
    return "";
  }

  return `
    <section class="detail-card detail-section" id="driver">
      <div class="section-heading">
        <h2>Driver</h2>
      </div>
      <div class="people-list">
        ${renderPersonCard(detail.driver, ride, "driver")}
      </div>
    </section>`;
}

function renderPassengersSection(detail, ride, passengerCount) {
  return `
    <section class="detail-card detail-section" id="people">
      <div class="section-heading">
        <h2>Passengers</h2>
        <span>${passengerCount} passenger${passengerCount === 1 ? "" : "s"}</span>
      </div>
      <div class="people-list">
        ${
          detail.people.length
            ? detail.people.map((person) => renderPersonCard(person, ride, "passenger")).join("")
            : '<p class="no-comments">No passengers yet.</p>'
        }
      </div>
    </section>`;
}

function renderVehicleSection(detail) {
  const vehicle = detail.driver_vehicle;
  if (!vehicle || vehicle.status === "unavailable") {
    return "";
  }

  if (vehicle.status === "pending") {
    return `
      <section class="detail-card detail-section vehicle-section">
        <div class="section-heading"><h2>Vehicle details</h2></div>
        <p class="vehicle-pending-note">Vehicle details will appear here once the ride day arrives.</p>
      </section>`;
  }

  const { escapeHtml } = u();
  const info = vehicle.info || {};
  const rows = [];

  if (info.car_make_model) {
    rows.push(`<div><span>Make &amp; model</span><strong>${escapeHtml(info.car_make_model)}</strong></div>`);
  }
  if (info.car_color) {
    rows.push(`<div><span>Color</span><strong>${escapeHtml(info.car_color)}</strong></div>`);
  }
  if (info.car_seat_capacity) {
    rows.push(`<div><span>Seat capacity</span><strong>${escapeHtml(info.car_seat_capacity)}</strong></div>`);
  }
  if (info.license_plate_partial) {
    rows.push(`<div><span>Plate ends with</span><strong>${escapeHtml(info.license_plate_partial)}</strong></div>`);
  }

  if (!rows.length) {
    return "";
  }

  return `
    <section class="detail-card detail-section vehicle-section">
      <div class="section-heading"><h2>Vehicle details</h2></div>
      <div class="vehicle-details-grid">${rows.join("")}</div>
    </section>`;
}

function render() {
  const root = document.getElementById("ride-detail-root");
  if (!root || !detail) {
    return;
  }
  document.body.classList.toggle("modal-open", showDriverDetailsForm);

  const { escapeHtml, formatDateValue, rideTypeLabel, fullName, routeIconSvg } = u();

  const ride = detail.ride;
  const currentUserId = ride.current_user_id;
  const isOfferPending = u().isOfferPendingRide(ride);
  const isRequestDetailsPending = u().isRequestDriverDetailsPending(ride);
  const typeLabel = rideTypeLabel(ride.ride_type, ride);
  const typeClass = isOfferPending || isRequestDetailsPending
    ? "offer-pending"
    : typeLabel === "Request"
      ? "request"
      : "offer";
  const isOffer = String(ride.ride_type || "").toLowerCase() === "offer";
  const isCompletedRequest = !isOffer && ride.has_assigned_driver && !isRequestDetailsPending;
  const isOwner = ride.is_owner === 1;
  const hasJoined = ride.current_user_joined === 1;
  const remainingSeats = ride.seats;
  const totalSeats = ride.total_seats;
  const splitCost = ride.split_cost;
  const passengerCount = ride.passenger_count ?? detail.people.length;

  const rawFirstName = ride.driver_fname || ride.assigned_driver_fname || ride.owner_fname || ride.fname || "";
  const rawLastName = ride.driver_lname || ride.assigned_driver_lname || ride.owner_lname || ride.lname || "";
  const resolvedFullName = `${rawFirstName} ${rawLastName}`.trim();
  const driverName = isOffer && isOwner ? "You" : (resolvedFullName || ride.driver_name || ride.owner_name || "Unknown Driver");

  let actions = "";
  if (isOffer) {
    if (isOwner && isOfferPending) {
      actions = `<a href="/dashboard.html?edit=${ride.id}&showForm=1&scope=my#createRideForm" class="primary-small-button">Complete offer</a>`;
    } else if (isOwner) {
      actions = '<span class="ride-status">Your ride</span>';
    } else if (hasJoined) {
      actions = isOfferPending
        ? '<span class="ride-status pending-badge">Offer pending</span>'
        : '<span class="ride-status">Joined</span>';
    } else if (!isAuthenticated) {
      actions = "";
    } else if (!isOfferPending && remainingSeats > 0) {
      actions = `<button type="button" class="primary-small-button" data-action="join" data-ride-id="${ride.id}" data-remaining-seats="${remainingSeats}">Join Ride</button>`;
    } else if (!isOfferPending) {
      actions = '<span class="ride-status full">Full</span>';
    }
  } else {
    // Request ride: show resign/remove-driver buttons where applicable.
    const driverActions = renderRequestDriverActions(ride, currentUserId);

    // Owner with an assigned driver: add "Remove driver" button.
    const removeDriverBtn =
      isOwner && ride.has_assigned_driver
        ? `<button type="button" class="danger-button" data-action="remove-driver" data-ride-id="${ride.id}">Remove driver</button>`
        : "";

    actions = [driverActions, removeDriverBtn].filter(Boolean).join(" ");
  }

  const assignedDriverHtml =
    !isOffer && detail.assigned_driver
      ? `<div class="assigned-driver-row"><span>Assigned driver</span><div><strong>${escapeHtml(fullName(detail.assigned_driver))}</strong>${renderViewProfileLink(detail.assigned_driver.id)}</div></div>`
      : "";
  const pendingDriverOfferHtml =
    !isOffer && ride.pending_driver_offer_count > 0 && !ride.has_assigned_driver
      ? `<div><span>Status</span><strong>Driver offer pending</strong></div>`
      : "";
  const requestDetailsPendingHtml =
    isRequestDetailsPending
      ? `<div><span>Status</span><strong>Waiting for driver details</strong></div>`
      : "";

  const commentsHtml =
    detail.comments.length > 0
      ? detail.comments.map((c) => renderComment(c, ride.id)).join("")
      : '<p class="no-comments">No comments yet.</p>';

  root.innerHTML = `
    <main class="ride-detail-page">
      <a href="/dashboard.html" class="back-link">Back to Ride Board</a>
      <article class="detail-card">
        <div class="ride-card-top">
          <span class="ride-type ${typeClass}">${escapeHtml(typeLabel)}</span>
          ${
            isOffer && !isOfferPending
              ? `<span class="ride-price"><strong>$${Number(splitCost).toFixed(2)}</strong><small>$${Number(ride.ride_cost).toFixed(2)} total</small></span>`
              : ""
          }
        </div>
        <h1 class="route-title detail-route">
          <span>${escapeHtml(ride.origin)}</span>
          <span class="route-icon" aria-hidden="true">${routeIconSvg(Boolean(ride.roundtrip))}</span>
          <span>${escapeHtml(u().formatDestination(ride))}</span>
        </h1>
        <div class="detail-summary-grid">
          <div class="posted-by-row"><span>Posted by</span><div><strong>${escapeHtml(driverName)}</strong>${!isOwner ? renderViewProfileLink(ride.owner_id) : ""}</div></div>
          <div><span>Start</span><strong>${escapeHtml(formatDateValue(ride.start_date))}</strong></div>
          <div><span>End</span><strong>${escapeHtml(formatDateValue(ride.end_date))}</strong></div>
          ${ride.departure_time ? `<div><span>Departure time</span><strong>${escapeHtml(ride.departure_time)}</strong></div>` : ""}
          <div><span>Trip</span><strong>${ride.roundtrip ? "Round trip" : "One way"}</strong></div>
          ${pendingDriverOfferHtml}
          ${requestDetailsPendingHtml}
          ${
            isOffer && !isOfferPending
              ? `<div><span>Passenger Seats</span><strong>${remainingSeats}/${totalSeats}</strong></div>
                 <div><span>Split cost</span><strong>$${Number(splitCost).toFixed(2)} each</strong></div>`
              : isOfferPending
                ? `<div><span>Status</span><strong>Driver completing offer details</strong></div>`
                : isCompletedRequest
                  ? `<div><span>Passenger Seats</span><strong>${remainingSeats}/${totalSeats}</strong></div>
                     <div><span>Split cost</span><strong>$${Number(splitCost).toFixed(2)} each</strong></div>`
                  : ""
          }
          <div><span>Preference</span><strong>${escapeHtml(ride.gender_preference)}</strong></div>
          ${assignedDriverHtml}
        </div>
        ${actions ? `<div class="detail-actions">${actions}</div>` : ""}
      </article>
      ${renderVehicleSection(detail)}
      ${renderDriverOffersPanel(detail)}
      ${renderDriverSection(detail, ride)}
      ${isOffer || ride.has_assigned_driver ? renderPassengersSection(detail, ride, passengerCount) : ""}
      <section class="detail-card detail-section ride-comments" id="comments">
        <div class="section-heading"><h2>Comments</h2><span>${detail.comments.length}</span></div>
        <div class="comment-list" id="comment-list">${commentsHtml}</div>
        ${
          isAuthenticated
            ? `<form class="comment-form" id="commentForm">
                <label for="commentBody">Add a comment</label>
                <textarea id="commentBody" name="commentBody" maxlength="500" rows="3" required></textarea>
                <button type="submit">Post</button>
              </form>`
            : '<p class="no-comments">Sign in with an existing account to comment or join this ride.</p>'
        }
      </section>
      ${renderDriverDetailsModal(ride)}
    </main>
  `;

  bindEvents(ride.id);
  updatePageMessage();
}

function bindEvents(rideId) {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const action = button.dataset.action;
      const offerId = button.dataset.offerId;
      const targetRideId = button.dataset.rideId || rideId;
      const commentId = button.dataset.commentId;

      try {
        if (action === "become-driver") {
          await ShareTripApi.apiFetch(`/api/rides/${targetRideId}/become-driver`, { method: "POST" });
          window.location.href = `/ride-details.html?ride=${targetRideId}&driver_pending=1`;
          return;
        }

        if (action === "show-driver-details") {
          showDriverDetailsForm = true;
          render();
          document.getElementById("driver-detail-seats")?.focus();
          return;
        }

        if (action === "hide-driver-details") {
          if (button.classList.contains("driver-details-modal-backdrop") && event.target !== button) {
            return;
          }
          showDriverDetailsForm = false;
          render();
          return;
        }

        if (action === "cancel-driver-offer") {
          if (!window.confirm("Cancel your pending driver offer?")) return;
          await ShareTripApi.apiFetch(`/api/rides/${targetRideId}/cancel-driver-offer`, { method: "POST" });
          window.location.href = `/ride-details.html?ride=${targetRideId}&driver_offer_cancelled=1`;
          return;
        }

        if (action === "resign-driver") {
          if (!window.confirm("Are you sure you want to resign as driver? The ride owner will be notified.")) return;
          await ShareTripApi.apiFetch(`/api/rides/${targetRideId}/resign-driver`, { method: "POST" });
          window.location.href = `/ride-details.html?ride=${targetRideId}&resigned=1`;
          return;
        }

        if (action === "remove-driver") {
          if (!window.confirm("Remove the assigned driver? They will be notified and the ride will be open for new offers.")) return;
          await ShareTripApi.apiFetch(`/api/rides/${targetRideId}/remove-driver`, { method: "POST" });
          window.location.href = `/ride-details.html?ride=${targetRideId}&driver_removed=1`;
          return;
        }

        if (action === "accept-offer") {
          await ShareTripApi.apiFetch(
            `/api/rides/${targetRideId}/driver-offers/${offerId}/accept`,
            { method: "POST" }
          );
          window.location.href = `/ride-details.html?ride=${targetRideId}&offer_responded=1`;
          return;
        }

        if (action === "decline-offer") {
          await ShareTripApi.apiFetch(
            `/api/rides/${targetRideId}/driver-offers/${offerId}/decline`,
            { method: "POST" }
          );
          window.location.reload();
          return;
        }

        if (action === "join") {
          const joinDetails = await u().promptJoinPartySize(button.dataset.remainingSeats);
          if (!joinDetails) return;
          await ShareTripApi.apiFetch(`/api/rides/${targetRideId}/join`, {
            method: "POST",
            body: JSON.stringify(joinDetails),
          });
          window.location.reload();
          return;
        }

        if (action === "delete-comment") {
          if (!window.confirm("Do you want to delete this comment?")) return;
          await ShareTripApi.apiFetch(
            `/api/rides/${targetRideId}/comments/${commentId}`,
            { method: "DELETE" }
          );
          const el = document.getElementById(`comment-${commentId}`);
          if (el) el.remove();
          const badge = document.querySelector(".ride-comments .section-heading span");
          if (badge) {
            badge.textContent = String(document.querySelectorAll(".comment-list .comment-item").length);
          }
          return;
        }

        if (action === "edit-comment") {
          const commentEl = document.getElementById(`comment-${commentId}`);
          if (!commentEl) return;
          const commentData = detail.comments.find((c) => Number(c.id) === Number(commentId));
          if (!commentData) return;
          commentEl.outerHTML = renderEditCommentForm(commentData, targetRideId);
          bindCommentEditForm();
          return;
        }

        if (action === "cancel-edit-comment") {
          const commentData = detail.comments.find((c) => Number(c.id) === Number(commentId));
          if (!commentData) return;
          const editEl = document.getElementById(`comment-${commentId}`);
          if (editEl) editEl.outerHTML = renderComment(commentData, targetRideId);
          bindEvents(rideId);
          return;
        }

        if (action === "delete-rating") {
          if (!window.confirm("Do you want to delete this rating?")) return;
          const ratedUserId = button.dataset.ratedUserId;
          await ShareTripApi.apiFetch(
            `/api/rides/${targetRideId}/ratings/${ratedUserId}`,
            { method: "DELETE" }
          );
          window.location.href = `/ride-details.html?ride=${targetRideId}#people`;
          return;
        }

      } catch (error) {
        message = error.message;
        messageType = "error";
        render();
      }
    });
  });

  document.getElementById("driverDetailsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      await ShareTripApi.apiFetch(`/api/rides/${rideId}/driver-details`, {
        method: "PUT",
        body: JSON.stringify({
          seats: formData.get("seats"),
          rideCost: formData.get("rideCost"),
          departureTime: formData.get("departureTime"),
          rideNotes: formData.get("rideNotes"),
        }),
      });
      window.location.href = `/ride-details.html?ride=${rideId}&driver_details_saved=1#people`;
    } catch (error) {
      message = error.message || "Unable to save trip details.";
      messageType = "error";
      updatePageMessage();
    }
  });

  document.getElementById("commentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      await ShareTripApi.apiFetch(`/api/rides/${rideId}/comments`, {
        method: "POST",
        body: JSON.stringify({ commentBody: formData.get("commentBody") }),
      });
      window.location.href = `/ride-details.html?ride=${rideId}&commented=1#comments`;
    } catch (error) {
      message = error.message;
      messageType = "error";
      render();
    }
  });

  document.querySelectorAll("[data-rating-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      try {
        await ShareTripApi.apiFetch(`/api/rides/${rideId}/ratings`, {
          method: "POST",
          body: JSON.stringify({
            ratedUserId: form.dataset.userId,
            rating: Number(formData.get("rating")),
            ratingComment: formData.get("ratingComment"),
            role: form.dataset.role,
          }),
        });
        window.location.href = `/ride-details.html?ride=${rideId}#people`;
      } catch (error) {
        message = error.message;
        messageType = "error";
        render();
      }
    });
  });

  bindCommentEditForm();
}

function bindCommentEditForm() {
  document.querySelectorAll(".comment-edit-form").forEach((form) => {
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const commentId = form.dataset.commentId;
      const rideId = form.dataset.rideId;
      const formData = new FormData(form);
      const newBody = formData.get("commentBody");

      try {
        await ShareTripApi.apiFetch(`/api/rides/${rideId}/comments/${commentId}`, {
          method: "PUT",
          body: JSON.stringify({ commentBody: newBody }),
        });
        const idx = detail.comments.findIndex((c) => Number(c.id) === Number(commentId));
        if (idx >= 0) {
          detail.comments[idx] = {
            ...detail.comments[idx],
            body: newBody,
            updated_at: new Date().toISOString(),
          };
        }
        const editEl = document.getElementById(`comment-${commentId}`);
        if (editEl) {
          editEl.outerHTML = renderComment(detail.comments[idx] || { id: commentId, body: newBody }, rideId);
        }
        bindEvents(Number(rideId));
      } catch (error) {
        message = error.message;
        messageType = "error";
        render();
      }
    });
  });
}

function showDetailError(text) {
  message = text;
  messageType = "error";
  updatePageMessage();
  document.getElementById("ride-detail-root").innerHTML = `
    <main class="ride-detail-page">
      <a href="/dashboard.html" class="back-link">Back to Ride Board</a>
      <section class="empty-rides">
        <h2>Could not load ride</h2>
        <p>Return to the ride board and try again.</p>
      </section>
    </main>`;
}

async function initRideDetailsPage() {
  if (!window.ShareTripUtils) {
    showDetailError("Page scripts failed to load. Refresh and try again.");
    return;
  }

  const { readQuery } = u();
  const query = readQuery();
  const rideId = Number(query.get("ride") || 0);
  if (!rideId) {
    window.location.href = "/dashboard.html";
    return;
  }

  if (!(await ShareTripAuth.requireProfile())) return;
  await ShareTripNavbar.renderNavbar("dashboard");

  if (query.has("commented")) {
    message = "Your comment has been posted.";
  }
  if (query.has("driver_pending")) {
    message = "Your driver offer is pending approval.";
    messageType = "success";
  }
  if (query.has("driver_offer_cancelled")) {
    message = "Your pending offer to drive has been cancelled.";
    messageType = "success";
  }
  if (query.has("offer_responded")) {
    message = "Driver accepted. Waiting for the driver to complete trip details.";
    messageType = "success";
  }
  if (query.has("driver_details_saved")) {
    message = "Saved.";
    messageType = "success";
  }
  if (query.has("resigned")) {
    message = "You have resigned as driver. The ride owner has been notified.";
    messageType = "success";
  }
  if (query.has("driver_removed")) {
    message = "The driver has been removed. The ride is now open for new driver offers.";
    messageType = "success";
  }

  u().stripFlashQueryParams();

  try {
    const session = await ShareTripAuth.getSession();
    isAuthenticated = Boolean(session.isAuthenticated);
    detail = await ShareTripApi.apiFetch(`/api/rides/${rideId}/detail`);
    detail.ride.current_user_id = session.userId;
    detail.ride.assigned_driver_id = detail.assigned_driver?.id ?? null;
  } catch (error) {
    showDetailError(error.message || "That ride could not be found.");
    return;
  }

  render();

  if (window.ShareTripNotifications) {
    await ShareTripNotifications.showNotificationBanner();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initRideDetailsPage().catch((error) => {
    console.error(error);
    showDetailError(error.message || "Unexpected error.");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && showDriverDetailsForm) {
    showDriverDetailsForm = false;
    render();
  }
});
