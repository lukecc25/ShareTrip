function u() {
  return window.ShareTripUtils;
}

let state = {
  data: null,
  editing: false,
};

function genderClass(gender) {
  return String(gender || "").toLowerCase() === "female" ? "female" : "male";
}

function initials(person) {
  const first = String(person?.fname || "").trim().charAt(0);
  const last = String(person?.lname || "").trim().charAt(0);
  const value = `${first}${last}`.toUpperCase();
  return value || "?";
}

function renderStars(rating) {
  const filled = Math.round(Number(rating));
  let html = "";
  for (let i = 1; i <= 5; i += 1) {
    html += i <= filled ? "★" : "☆";
  }
  return html;
}

function roleLabel(role) {
  if (role === "driver") {
    return "Driver";
  }
  if (role === "owner") {
    return "Ride owner";
  }
  return "Passenger";
}

function renderReviewCard(review) {
  const { escapeHtml, formatDateValue, fullName } = u();
  const rater = {
    fname: review.rater_fname,
    lname: review.rater_lname,
  };
  const route = `${review.ride_origin} → ${review.ride_destination}`;

  return `
    <article class="review-card">
      <div class="review-card-top">
        <strong>${escapeHtml(fullName(rater))}</strong>
        <span class="review-stars" aria-label="${review.rating} out of 5 stars">${renderStars(review.rating)}</span>
      </div>
      <div class="review-meta">
        Rated you as ${escapeHtml(roleLabel(review.role))} · ${escapeHtml(formatDateValue(review.ride_start_date))}
      </div>
      ${
        review.comment
          ? `<p class="review-comment">${escapeHtml(review.comment)}</p>`
          : '<p class="review-comment profile-empty">No written comment.</p>'
      }
      <a class="review-ride-link" href="/ride-details.html?ride=${review.ride_id}">${escapeHtml(route)}</a>
    </article>`;
}

function renderTripCard(ride) {
  const { escapeHtml, formatDateValue, rideTypeLabel, routeIconSvg } = u();
  const typeLabel = rideTypeLabel(ride.ride_type);
  const typeClass = typeLabel === "Request" ? "request" : "offer";

  return `
    <article class="ride-card">
      <div class="ride-card-top">
        <div class="ride-card-badges">
          <span class="ride-type ${typeClass}">${escapeHtml(typeLabel)}</span>
          <span class="trip-role-badge">${escapeHtml(roleLabel(ride.user_role))}</span>
          <span class="ride-time-status">Past</span>
        </div>
      </div>
      <h2 class="route-title">
        <span>${escapeHtml(ride.origin)}</span>
        <span class="route-icon" aria-hidden="true">${routeIconSvg(ride.roundtrip)}</span>
        <span>${escapeHtml(ride.destination)}</span>
      </h2>
      <div class="ride-details">
        <div><span>Start</span><strong>${escapeHtml(formatDateValue(ride.start_date))}</strong></div>
        <div><span>End</span><strong>${escapeHtml(formatDateValue(ride.end_date))}</strong></div>
        <div><span>Preference</span><strong>${escapeHtml(ride.gender_preference)}</strong></div>
      </div>
      <footer>
        <a href="/ride-details.html?ride=${ride.id}" class="details-link">View details</a>
      </footer>
    </article>`;
}

function renderProfileHero(data) {
  const { escapeHtml, formatRatingValue, ableDriverClass, isAbleDriver } = u();
  const { profile, stats } = data;
  const ableDriver = isAbleDriver(profile);
  const ratingText = formatRatingValue(stats.rating_average);
  const reviewCount = stats.rating_count || 0;
  const reviewLabel = reviewCount === 1 ? "review" : "reviews";

  return `
    <section class="profile-hero">
      <div class="profile-avatar ${genderClass(profile.gender)}" aria-hidden="true">
        ${escapeHtml(initials(profile))}
      </div>
      <div class="profile-hero-info">
        <p class="eyebrow">My Profile</p>
        <h1>${escapeHtml(profile.fname)} ${escapeHtml(profile.lname)}</h1>
        <div class="profile-rating-summary">
          <strong>${escapeHtml(ratingText)}</strong>
          <span class="profile-rating-stars" aria-hidden="true">${stats.rating_average ? renderStars(stats.rating_average) : "☆☆☆☆☆"}</span>
          <span>${reviewCount} ${reviewLabel}</span>
        </div>
        <div class="profile-stats">
          <span>${stats.driven_count} ride${stats.driven_count === 1 ? "" : "s"} driven</span>
          <span>${stats.passenger_count} trip${stats.passenger_count === 1 ? "" : "s"} as passenger</span>
          <span class="able-driver-status ${ableDriverClass(ableDriver)}">
            ${ableDriver ? "Available to drive" : "Not available to drive"}
          </span>
        </div>
      </div>
      <div class="profile-hero-actions">
        <label class="able-driver-toggle">
          <input type="checkbox" data-action="toggle-able-driver" ${ableDriver ? "checked" : ""}>
          Available to drive
        </label>
        <button type="button" class="secondary-button" data-action="edit-profile">Edit profile</button>
      </div>
    </section>`;
}

function renderProfileEditForm(profile) {
  const { escapeHtml } = u();

  return `
    <section class="profile-hero profile-hero-edit">
      <div class="profile-avatar ${genderClass(profile.gender)}" aria-hidden="true">
        ${escapeHtml(initials(profile))}
      </div>
      <form class="profile-edit-form" id="profileEditForm">
        <div class="profile-edit-header">
          <div>
            <p class="eyebrow">My Profile</p>
            <h2>Edit your details</h2>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label for="edit-fname">First Name</label>
            <input id="edit-fname" name="fname" type="text" value="${escapeHtml(profile.fname || "")}" required>
          </div>
          <div>
            <label for="edit-lname">Last Name</label>
            <input id="edit-lname" name="lname" type="text" value="${escapeHtml(profile.lname || "")}" required>
          </div>
        </div>
        <label for="edit-phone">Phone</label>
        <input id="edit-phone" name="phone" type="tel" value="${escapeHtml(profile.phone || "")}" required>
        <label for="edit-email">Email</label>
        <input id="edit-email" name="email" type="email" value="${escapeHtml(profile.email || "")}" required>
        <label for="edit-gender">Gender</label>
        <select id="edit-gender" name="gender" required>
          <option value="">Select Gender</option>
          <option value="Male" ${profile.gender === "Male" ? "selected" : ""}>Male</option>
          <option value="Female" ${profile.gender === "Female" ? "selected" : ""}>Female</option>
        </select>
        <label class="able-driver-toggle profile-edit-toggle">
          <input type="checkbox" name="able_driver" ${u().isAbleDriver(profile) ? "checked" : ""}>
          Available to drive
        </label>
        <div class="profile-edit-actions">
          <button type="submit" class="primary-small-button">Save changes</button>
          <button type="button" class="secondary-button" data-action="cancel-edit">Cancel</button>
        </div>
      </form>
    </section>`;
}

function renderProfilePage(data) {
  const { reviews, trip_history: tripHistory } = data;

  const reviewsHtml = reviews.length
    ? `<div class="review-list">${reviews.map(renderReviewCard).join("")}</div>`
    : '<p class="profile-empty">No reviews yet. Complete rides to start receiving ratings from other members.</p>';

  const tripsHtml = tripHistory.length
    ? `<div class="trip-history-grid">${tripHistory.map(renderTripCard).join("")}</div>`
    : '<p class="profile-empty">No past trips yet. Your completed rides will show up here.</p>';

  const heroHtml = state.editing
    ? renderProfileEditForm(data.profile)
    : renderProfileHero(data);

  return `
    ${heroHtml}
    <section class="profile-section">
      <div class="profile-section-header">
        <h2>Reviews about you</h2>
        <span>${reviews.length}</span>
      </div>
      ${reviewsHtml}
    </section>
    <section class="profile-section">
      <div class="profile-section-header">
        <h2>Trip history</h2>
        <span>${tripHistory.length}</span>
      </div>
      ${tripsHtml}
    </section>`;
}

function showMessage(text, type = "success") {
  const message = document.getElementById("profile-message");
  message.textContent = text;
  message.className = `dashboard-message${type === "error" ? " error" : ""}`;
  message.hidden = !text;
}

function render() {
  const root = document.getElementById("profile-root");
  if (!state.data) {
    return;
  }
  root.innerHTML = renderProfilePage(state.data);
  bindProfileEvents();
}

function bindProfileEvents() {
  const root = document.getElementById("profile-root");

  const editBtn = root.querySelector('[data-action="edit-profile"]');
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      state.editing = true;
      showMessage("");
      render();
    });
  }

  const cancelBtn = root.querySelector('[data-action="cancel-edit"]');
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      state.editing = false;
      showMessage("");
      render();
    });
  }

  const ableDriverToggle = root.querySelector('[data-action="toggle-able-driver"]');
  if (ableDriverToggle) {
    ableDriverToggle.addEventListener("change", async () => {
      try {
        const updated = await ShareTripApi.apiFetch("/api/users/me/profile", {
          method: "PUT",
          body: JSON.stringify({
            ...state.data.profile,
            able_driver: ableDriverToggle.checked,
          }),
        });
        state.data.profile = updated;
        state.data.stats.able_driver = u().isAbleDriver(updated);
        showMessage(
          updated.able_driver
            ? "You are marked as available to drive."
            : "You are marked as not available to drive. Driver requests are hidden on the ride board."
        );
        render();
      } catch (error) {
        ableDriverToggle.checked = !ableDriverToggle.checked;
        showMessage(error.message || "Unable to update driver status.", "error");
      }
    });
  }

  const form = document.getElementById("profileEditForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      try {
        const updated = await ShareTripApi.apiFetch("/api/users/me/profile", {
          method: "PUT",
          body: JSON.stringify({
            fname: formData.get("fname"),
            lname: formData.get("lname"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            gender: formData.get("gender"),
            able_driver: formData.get("able_driver") === "on",
          }),
        });
        state.data.profile = updated;
        state.data.stats.able_driver = u().isAbleDriver(updated);
        state.editing = false;
        showMessage("Profile updated.");
        render();
      } catch (error) {
        showMessage(error.message || "Unable to save profile.", "error");
      }
    });
  }
}

async function loadProfileOverview() {
  state.data = await ShareTripApi.apiFetch("/api/users/me/overview");
}

async function initMyProfilePage() {
  const profile = await ShareTripAuth.requireProfile();
  if (!profile) {
    return;
  }

  await ShareTripNavbar.renderNavbar("profile");

  try {
    await loadProfileOverview();
    render();
  } catch (error) {
    showMessage(error.message || "Unable to load your profile.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMyProfilePage().catch((error) => console.error(error));
});
