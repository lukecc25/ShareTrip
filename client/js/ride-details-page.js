function u() {
  return window.ShareTripUtils;
}

let detail = null;
let message = "";
let messageType = "success";

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
  `;
}

function renderRequestDriverActions(ride) {
  if (ride.is_owner) {
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

function renderPersonCard(person, ride, role) {
  const { escapeHtml, formatRatingValue, fullName } = u();
  const isDriver = role === "driver";
  const userId = person.user_id || person.id || (isDriver ? ride.owner_id : null);
  const canRate = ride.ride_completed && userId !== ride.current_user_id;

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
          : userId !== ride.current_user_id
            ? '<p class="rating-unavailable">Ratings open after the ride is completed.</p>'
            : ""
      }
    </article>
  `;
}

function render() {
  const root = document.getElementById("ride-detail-root");
  if (!root || !detail) {
    return;
  }

  const {
    escapeHtml,
    formatDateValue,
    formatCommentDate,
    rideTypeLabel,
    fullName,
    routeIconSvg,
  } = u();

  const ride = detail.ride;
  const typeLabel = rideTypeLabel(ride.ride_type);
  const typeClass = typeLabel === "Request" ? "request" : "offer";
  const isOffer = typeLabel === "Offer";
  const isOwner = ride.is_owner === 1;
  const hasJoined = ride.current_user_joined === 1;
  const remainingSeats = ride.seats;
  const totalSeats = ride.total_seats;
  const splitCost = ride.split_cost;
  const passengerCount = ride.passenger_count ?? detail.people.length;

  // --- FIX APPLIED HERE ---
  const rawFirstName = ride.driver_fname || ride.owner_fname || ride.fname || "";
  const rawLastName = ride.driver_lname || ride.owner_lname || ride.lname || "";
  const resolvedFullName = `${rawFirstName} ${rawLastName}`.trim();

  const driverName = isOwner ? "You" : (resolvedFullName || ride.driver_name || ride.owner_name || "Unknown Driver");

  const driver = {
    fname: rawFirstName || (isOwner ? "You" : driverName.split(" ")[0]),
    lname: rawLastName || (isOwner ? "" : driverName.split(" ").slice(1).join(" ")),
    gender: ride.driver_gender,
    user_id: ride.owner_id,
  };
  // ------------------------

  let actions = "";
  if (isOffer) {
    if (isOwner) {
      actions = '<span class="ride-status">Your ride</span>';
    } else if (hasJoined) {
      actions = '<span class="ride-status">Joined</span>';
    } else if (remainingSeats > 0) {
      actions = `<button type="button" class="primary-small-button" data-action="join" data-ride-id="${ride.id}">Join Ride</button>`;
    } else {
      actions = '<span class="ride-status full">Full</span>';
    }
  } else if (!isOwner) {
    actions = renderRequestDriverActions(ride);
  }

  const assignedDriverHtml =
    !isOffer && detail.assigned_driver
      ? `<div><span>Assigned driver</span><strong>${escapeHtml(fullName(detail.assigned_driver))}</strong></div>`
      : "";

  const commentsHtml =
    detail.comments.length > 0
      ? detail.comments
          .map(
            (comment) => `
        <article class="comment-item">
          <div class="comment-meta">
            <strong>${escapeHtml(fullName(comment))}</strong>
            <span>${escapeHtml(formatCommentDate(comment.created_at))}</span>
          </div>
          <p>${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p>
        </article>`
          )
          .join("")
      : '<p class="no-comments">No comments yet.</p>';

  root.innerHTML = `
    <main class="ride-detail-page">
      <a href="/dashboard.html" class="back-link">Back to Ride Board</a>
      ${
        message
          ? `<div class="dashboard-message ${messageType === "error" ? "error" : ""}">${escapeHtml(message)}</div>`
          : ""
      }
      <article class="detail-card">
        <div class="ride-card-top">
          <span class="ride-type ${typeClass}">${escapeHtml(typeLabel)}</span>
          ${
            isOffer
              ? `<span class="ride-price"><strong>$${Number(splitCost).toFixed(2)}</strong><small>$${Number(ride.ride_cost).toFixed(2)} total</small></span>`
              : ""
          }
        </div>
        <h1 class="route-title detail-route">
          <span>${escapeHtml(ride.origin)}</span>
          <span class="route-icon" aria-hidden="true">${routeIconSvg(Boolean(ride.roundtrip))}</span>
          <span>${escapeHtml(ride.destination)}</span>
        </h1>
        <div class="detail-summary-grid">
          <div><span>Posted by</span><strong>${escapeHtml(driverName)}</strong></div>
          <div><span>Start</span><strong>${escapeHtml(formatDateValue(ride.start_date))}</strong></div>
          <div><span>End</span><strong>${escapeHtml(formatDateValue(ride.end_date))}</strong></div>
          <div><span>Trip</span><strong>${ride.roundtrip ? "Round trip" : "One way"}</strong></div>
          ${
            isOffer
              ? `<div><span>Passenger Seats</span><strong>${remainingSeats}/${totalSeats}</strong></div>
                 <div><span>Split cost</span><strong>$${Number(splitCost).toFixed(2)} each</strong></div>`
              : ""
          }
          <div><span>Preference</span><strong>${escapeHtml(ride.gender_preference)}</strong></div>
          ${assignedDriverHtml}
        </div>
        ${actions ? `<div class="detail-actions">${actions}</div>` : ""}
      </article>
      ${renderDriverOffersPanel(detail)}
      ${
        isOffer
          ? `<section class="detail-card detail-section" id="people">
              <div class="section-heading">
                <h2>People Involved</h2>
                <span>${passengerCount} passenger${passengerCount === 1 ? "" : "s"}</span>
              </div>
              <div class="people-list">
                ${renderPersonCard(driver, ride, "driver")}
                ${detail.people.map((person) => renderPersonCard(person, ride, "passenger")).join("")}
              </div>
            </section>`
          : ""
      }
      <section class="detail-card detail-section ride-comments" id="comments">
        <div class="section-heading"><h2>Comments</h2><span>${detail.comments.length}</span></div>
        <div class="comment-list">${commentsHtml}</div>
        <form class="comment-form" id="commentForm">
          <label for="commentBody">Add a comment</label>
          <textarea id="commentBody" name="commentBody" maxlength="500" rows="3" required></textarea>
          <button type="submit">Post</button>
        </form>
      </section>
    </main>
  `;

  bindEvents(ride.id);
}

function bindEvents(rideId) {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      const offerId = button.dataset.offerId;
      const targetRideId = button.dataset.rideId || rideId;

      try {
        if (action === "become-driver") {
          await ShareTripApi.apiFetch(`/api/rides/${targetRideId}/become-driver`, {
            method: "POST",
          });
          window.location.href = `/ride-details.html?ride=${targetRideId}&driver_pending=1`;
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
          await ShareTripApi.apiFetch(`/api/rides/${targetRideId}/join`, {
            method: "POST",
          });
          window.location.reload();
        }
      } catch (error) {
        message = error.message;
        messageType = "error";
        render();
      }
    });
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
}

function showDetailError(text) {
  const { escapeHtml } = u();
  document.getElementById("ride-detail-root").innerHTML = `
    <main class="ride-detail-page">
      <a href="/dashboard.html" class="back-link">Back to Ride Board</a>
      <div class="dashboard-message error">${escapeHtml(text)}</div>
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

  if (!(await ShareTripAuth.requireProfile())) {
    return;
  }

  await ShareTripNavbar.renderNavbar("dashboard");

  if (query.has("commented")) {
    message = "Your comment has been posted.";
  }
  if (query.has("driver_pending")) {
    message = "Your driver offer is pending approval.";
    messageType = "success";
  }
  if (query.has("offer_responded")) {
    message = "Driver offer updated.";
    messageType = "success";
  }

  try {
    const session = await ShareTripAuth.getSession();
    detail = await ShareTripApi.apiFetch(`/api/rides/${rideId}/detail`);
    detail.ride.current_user_id = session.userId;
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
