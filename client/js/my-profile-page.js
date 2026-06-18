function u() {
  return window.ShareTripUtils;
}

let state = {
  data: null,
  notifications: [],
  editing: false,
  editProfilePicture: undefined,
  profilePhotoSource: null,
  photoEditorSettings: null,
  viewingUserId: null,
  isOwnProfile: true,
};

const PHOTO_EDITOR = {
  viewportSize: 280,
  outputSize: 256,
  minZoom: 1,
  maxZoom: 3,
  zoomStep: 0.08,
};

let photoEditor = null;
let photoEditorBound = false;

function currentProfilePicture(profile) {
  if (state.editProfilePicture !== undefined) {
    return state.editProfilePicture;
  }
  return profile.profile_picture_url || null;
}

function renderAvatarContent(profile) {
  const picture = currentProfilePicture(profile);
  if (picture) {
    return `<img src="${u().escapeHtml(picture)}" alt="">`;
  }
  return u().escapeHtml(initials(profile));
}

function renderAvatar(profile, { editable = false } = {}) {
  const picture = currentProfilePicture(profile);
  const avatarClass = `profile-avatar ${genderClass(profile.gender)}${picture ? " has-photo" : ""}`;

  if (!editable) {
    return `<div class="${avatarClass}" aria-hidden="true">${renderAvatarContent(profile)}</div>`;
  }

  return `
    <div class="profile-avatar-wrap">
      <div class="${avatarClass}" id="profile-avatar-preview" aria-hidden="true">${renderAvatarContent(profile)}</div>
      <label class="profile-photo-upload">
        <input type="file" id="edit-profile-photo" accept="image/jpeg,image/png,image/webp">
        Change photo
      </label>
      ${
        state.profilePhotoSource
          ? '<button type="button" class="profile-photo-adjust" data-action="adjust-photo">Adjust photo</button>'
          : ""
      }
      ${
        picture
          ? '<button type="button" class="profile-photo-remove" data-action="remove-photo">Remove photo</button>'
          : ""
      }
    </div>`;
}

function validateProfilePictureFile(file) {
  if (!file) {
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5 MB or smaller.");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the selected image."));
    image.src = dataUrl;
  });
}

function createPhotoEditorState(image, savedSettings) {
  const viewportSize = PHOTO_EDITOR.viewportSize;
  const baseScale = Math.max(viewportSize / image.width, viewportSize / image.height);

  return {
    image,
    viewportSize,
    baseScale,
    zoom: savedSettings?.zoom ?? 1,
    offsetX: savedSettings?.offsetX ?? 0,
    offsetY: savedSettings?.offsetY ?? 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0,
  };
}

function getPhotoEditorScale(editor) {
  return editor.baseScale * editor.zoom;
}

function clampPhotoEditorOffset(editor) {
  const size = editor.viewportSize;
  const scale = getPhotoEditorScale(editor);
  const drawWidth = editor.image.width * scale;
  const drawHeight = editor.image.height * scale;
  const maxOffsetX = Math.max(0, (drawWidth - size) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - size) / 2);
  editor.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, editor.offsetX));
  editor.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, editor.offsetY));
}

function drawPhotoEditor(canvas, editor) {
  const ctx = canvas.getContext("2d");
  const size = editor.viewportSize;
  canvas.width = size;
  canvas.height = size;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, 0, size, size);

  const scale = getPhotoEditorScale(editor);
  const drawWidth = editor.image.width * scale;
  const drawHeight = editor.image.height * scale;
  const x = (size - drawWidth) / 2 + editor.offsetX;
  const y = (size - drawHeight) / 2 + editor.offsetY;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(editor.image, x, y, drawWidth, drawHeight);
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
  ctx.stroke();
}

function exportPhotoEditor(editor) {
  const outputSize = PHOTO_EDITOR.outputSize;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");

  const viewportSize = editor.viewportSize;
  const scaleFactor = outputSize / viewportSize;
  const scale = getPhotoEditorScale(editor);
  const drawWidth = editor.image.width * scale * scaleFactor;
  const drawHeight = editor.image.height * scale * scaleFactor;
  const x = ((viewportSize - editor.image.width * scale) / 2 + editor.offsetX) * scaleFactor;
  const y = ((viewportSize - editor.image.height * scale) / 2 + editor.offsetY) * scaleFactor;

  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(editor.image, x, y, drawWidth, drawHeight);

  return canvas.toDataURL("image/jpeg", 0.85);
}

function ensurePhotoEditorModal() {
  let modal = document.getElementById("profile-photo-editor");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "profile-photo-editor";
  modal.className = "profile-photo-editor";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="profile-photo-editor-backdrop" data-action="cancel-photo"></div>
    <div class="profile-photo-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-photo-editor-title">
      <h3 id="profile-photo-editor-title">Adjust profile photo</h3>
      <p class="profile-photo-editor-help">Drag the photo to reposition it. Zoom in or out before saving.</p>
      <div class="profile-photo-editor-viewport">
        <canvas id="profile-photo-editor-canvas"></canvas>
      </div>
      <div class="profile-photo-editor-zoom">
        <button type="button" class="secondary-button" data-action="zoom-out" aria-label="Zoom out">−</button>
        <label for="profile-photo-editor-zoom">
          <span>Zoom</span>
          <input type="range" id="profile-photo-editor-zoom" min="${PHOTO_EDITOR.minZoom}" max="${PHOTO_EDITOR.maxZoom}" step="0.01" value="1">
        </label>
        <button type="button" class="secondary-button" data-action="zoom-in" aria-label="Zoom in">+</button>
      </div>
      <div class="profile-photo-editor-actions">
        <button type="button" class="primary-small-button" data-action="apply-photo">Use photo</button>
        <button type="button" class="secondary-button" data-action="cancel-photo">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function renderPhotoEditor() {
  if (!photoEditor) {
    return;
  }

  const canvas = document.getElementById("profile-photo-editor-canvas");
  const zoomInput = document.getElementById("profile-photo-editor-zoom");
  if (!canvas || !zoomInput) {
    return;
  }

  clampPhotoEditorOffset(photoEditor);
  drawPhotoEditor(canvas, photoEditor);
  zoomInput.value = String(photoEditor.zoom);
  state.photoEditorSettings = {
    zoom: photoEditor.zoom,
    offsetX: photoEditor.offsetX,
    offsetY: photoEditor.offsetY,
  };
}

function closeProfilePhotoEditor() {
  const modal = document.getElementById("profile-photo-editor");
  if (modal) {
    modal.hidden = true;
  }
  photoEditor = null;
}

function bindPhotoEditorModal(onApply) {
  if (photoEditorBound) {
    return;
  }
  photoEditorBound = true;

  const modal = ensurePhotoEditorModal();
  const canvas = modal.querySelector("#profile-photo-editor-canvas");
  const zoomInput = modal.querySelector("#profile-photo-editor-zoom");

  function setZoom(nextZoom) {
    if (!photoEditor) {
      return;
    }
    photoEditor.zoom = Math.min(
      PHOTO_EDITOR.maxZoom,
      Math.max(PHOTO_EDITOR.minZoom, nextZoom)
    );
    renderPhotoEditor();
  }

  modal.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "cancel-photo") {
      closeProfilePhotoEditor();
      return;
    }
    if (action === "apply-photo" && photoEditor) {
      onApply(exportPhotoEditor(photoEditor));
      closeProfilePhotoEditor();
      return;
    }
    if (action === "zoom-in") {
      setZoom(photoEditor ? photoEditor.zoom + PHOTO_EDITOR.zoomStep : 1);
      return;
    }
    if (action === "zoom-out") {
      setZoom(photoEditor ? photoEditor.zoom - PHOTO_EDITOR.zoomStep : 1);
    }
  });

  zoomInput.addEventListener("input", () => {
    setZoom(Number(zoomInput.value));
  });

  function startDrag(clientX, clientY) {
    if (!photoEditor) {
      return;
    }
    photoEditor.dragging = true;
    photoEditor.dragStartX = clientX;
    photoEditor.dragStartY = clientY;
    photoEditor.dragOriginX = photoEditor.offsetX;
    photoEditor.dragOriginY = photoEditor.offsetY;
  }

  function moveDrag(clientX, clientY) {
    if (!photoEditor?.dragging) {
      return;
    }
    photoEditor.offsetX = photoEditor.dragOriginX + (clientX - photoEditor.dragStartX);
    photoEditor.offsetY = photoEditor.dragOriginY + (clientY - photoEditor.dragStartY);
    renderPhotoEditor();
  }

  function endDrag() {
    if (photoEditor) {
      photoEditor.dragging = false;
    }
  }

  canvas.addEventListener("mousedown", (event) => {
    event.preventDefault();
    startDrag(event.clientX, event.clientY);
  });
  window.addEventListener("mousemove", (event) => moveDrag(event.clientX, event.clientY));
  window.addEventListener("mouseup", endDrag);

  canvas.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      startDrag(touch.clientX, touch.clientY);
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      moveDrag(touch.clientX, touch.clientY);
    },
    { passive: true }
  );
  window.addEventListener("touchend", endDrag);
}

function openProfilePhotoEditor(image) {
  bindPhotoEditorModal((dataUrl) => {
    state.editProfilePicture = dataUrl;
    showMessage("");
    render();
  });

  photoEditor = createPhotoEditorState(image, state.photoEditorSettings);
  const modal = ensurePhotoEditorModal();
  modal.hidden = false;
  renderPhotoEditor();
}

async function prepareProfilePhotoSource(file) {
  validateProfilePictureFile(file);
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);
  state.profilePhotoSource = image;
  state.photoEditorSettings = null;
  return image;
}

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
  const typeLabel = rideTypeLabel(ride.ride_type, ride);
  const typeClass = u().isOfferPendingRide(ride)
      ? "offer-pending"
      : typeLabel === "Request"
        ? "request"
        : "offer";

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
        <span>${escapeHtml(u().formatDestination(ride))}</span>
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
      ${renderAvatar(profile)}
      <div class="profile-hero-info">
        <div class="profile-eyebrow-row">
          <p class="eyebrow">${state.isOwnProfile ? "My Profile" : "Member Profile"}</p>
          <span class="profile-gender">${escapeHtml(profile.gender || "")}</span>
        </div>
        <h1 class="profile-name">${escapeHtml(profile.fname)} ${escapeHtml(profile.lname)}</h1>
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
      ${
        state.isOwnProfile
          ? `<div class="profile-hero-actions">
        <label class="able-driver-toggle">
          <input type="checkbox" data-action="toggle-able-driver" ${ableDriver ? "checked" : ""}>
          Available to drive
        </label>
        <button type="button" class="secondary-button" data-action="edit-profile">Edit profile</button>
      </div>`
          : ""
      }
    </section>`;
}

function renderProfileEditForm(profile) {
  const { escapeHtml } = u();

  return `
    <section class="profile-hero profile-hero-edit">
      ${renderAvatar(profile, { editable: true })}
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
        <label class="able-driver-toggle profile-edit-toggle">
          <input type="checkbox" name="able_driver" ${u().isAbleDriver(profile) ? "checked" : ""}>
          <span>Available to drive</span>
        </label>
        <div class="profile-edit-actions">
          <button type="submit" class="primary-small-button">Save changes</button>
          <button type="button" class="secondary-button" data-action="cancel-edit">Cancel</button>
        </div>
      </form>
    </section>`;
}

function renderProfileNotification(item) {
  const { escapeHtml, formatCommentDate } = u();
  const typeClass =
    item.kind === "driver_offer_accepted" || item.kind === "ride_joined"
      ? "success"
      : item.kind === "driver_offer_declined"
        ? "error"
        : item.kind === "driver_offer_pending" || item.kind === "driver_offer_waiting" || item.kind === "driver_offer_cancelled"
          ? "pending"
          : "";
  const readClass = item.read_flag ? "is-read" : "";
  const routeLine =
    item.ride_origin || item.ride_destination
      ? `<p class="profile-notification-route">${escapeHtml(item.ride_origin || "Start")} → ${escapeHtml(item.ride_destination || "Destination")}</p>`
      : "";
  const respondActions =
    item.can_respond === 1 || item.can_respond === true
      ? `<div class="profile-notification-actions-row">
          <button type="button" class="primary-small-button" data-action="accept-offer" data-ride-id="${item.ride_id}" data-offer-id="${item.offer_id}">Accept</button>
          <button type="button" class="secondary-button" data-action="decline-offer" data-ride-id="${item.ride_id}" data-offer-id="${item.offer_id}">Decline</button>
        </div>`
      : "";

  return `
    <article class="profile-notification-item notification-item ${typeClass} ${readClass}" data-id="${item.id}">
      <div class="profile-notification-body">
        <p>${escapeHtml(item.message)}</p>
        ${routeLine}
        ${respondActions}
        <div class="profile-notification-meta">
          <span>${escapeHtml(formatCommentDate(item.created_at))}</span>
          ${
            item.ride_id
              ? `<a href="/ride-details.html?ride=${item.ride_id}" class="profile-notification-link">View ride</a>`
              : ""
          }
        </div>
      </div>
      <button type="button" class="notification-dismiss profile-notification-dismiss" data-dismiss-id="${item.id}" aria-label="Dismiss notification">&times;</button>
    </article>`;
}

function renderNotificationsSection() {
  const notifications = state.notifications;
  const unreadCount = notifications.filter((item) => !item.read_flag).length;

  const listHtml = notifications.length
    ? `<div class="profile-notification-list">${notifications.map(renderProfileNotification).join("")}</div>`
    : '<p class="profile-empty">No notifications yet. Ride updates and driver offers will appear here.</p>';

  return `
    <section class="profile-section" id="profile-notifications">
      <div class="profile-section-header">
        <h2>Notifications</h2>
        <span>${notifications.length}</span>
      </div>
      ${
        unreadCount > 0
          ? `<div class="profile-notification-actions">
              <button type="button" class="secondary-button" data-action="mark-all-notifications-read">
                Mark all as read
              </button>
            </div>`
          : ""
      }
      ${listHtml}
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

  const reviewsHeading = state.isOwnProfile ? "Reviews about you" : "Reviews";
  const tripsHeading = state.isOwnProfile ? "Trip history" : "Past trips";
  const notificationsHtml =
    state.isOwnProfile && !state.editing ? renderNotificationsSection() : "";

  return `
    ${heroHtml}
    <section class="profile-section">
      <div class="profile-section-header">
        <h2>${reviewsHeading}</h2>
        <span>${reviews.length}</span>
      </div>
      ${reviewsHtml}
    </section>
    <section class="profile-section">
      <div class="profile-section-header">
        <h2>${tripsHeading}</h2>
        <span>${tripHistory.length}</span>
      </div>
      ${tripsHtml}
    </section>
    ${notificationsHtml}`;
}

function showMessage(text, type = "success") {
  const message = document.getElementById("profile-message");
  u().renderSiteAlert(message, text, { type });
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
  if (!state.isOwnProfile) {
    return;
  }

  const root = document.getElementById("profile-root");

  root.querySelectorAll("[data-dismiss-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.dismissId);
      try {
        await ShareTripApi.apiFetch("/api/notifications/read", {
          method: "POST",
          body: JSON.stringify({ ids: [id] }),
        });
        state.notifications = state.notifications.map((item) =>
          Number(item.id) === id ? { ...item, read_flag: 1 } : item
        );
        render();
      } catch (error) {
        showMessage(error.message || "Unable to dismiss notification.", "error");
      }
    });
  });

  const markAllBtn = root.querySelector('[data-action="mark-all-notifications-read"]');
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      const unreadIds = state.notifications
        .filter((item) => !item.read_flag)
        .map((item) => item.id);
      if (!unreadIds.length) {
        return;
      }
      try {
        await ShareTripApi.apiFetch("/api/notifications/read", {
          method: "POST",
          body: JSON.stringify({ ids: unreadIds }),
        });
        state.notifications = state.notifications.map((item) => ({
          ...item,
          read_flag: 1,
        }));
        render();
      } catch (error) {
        showMessage(error.message || "Unable to mark notifications as read.", "error");
      }
    });
  }

  root.querySelectorAll('[data-action="accept-offer"], [data-action="decline-offer"]').forEach(
    (button) => {
      button.addEventListener("click", async () => {
        const rideId = button.dataset.rideId;
        const offerId = button.dataset.offerId;
        const accept = button.dataset.action === "accept-offer";
        try {
          await ShareTripApi.apiFetch(
            `/api/rides/${rideId}/driver-offers/${offerId}/${accept ? "accept" : "decline"}`,
            { method: "POST" }
          );
          await loadProfileNotifications();
          showMessage(
            accept
              ? "Driver accepted. The offer is pending until they save trip details."
              : "Driver offer declined."
          );
          render();
        } catch (error) {
          showMessage(error.message || "Unable to update driver offer.", "error");
        }
      });
    }
  );

  const editBtn = root.querySelector('[data-action="edit-profile"]');
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      state.editing = true;
      state.editProfilePicture = undefined;
      state.profilePhotoSource = null;
      state.photoEditorSettings = null;
      showMessage("");
      render();
    });
  }

  const cancelBtn = root.querySelector('[data-action="cancel-edit"]');
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      state.editing = false;
      state.editProfilePicture = undefined;
      state.profilePhotoSource = null;
      state.photoEditorSettings = null;
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
        u().applyHideRequestRidesForDriverStatus(updated);
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

  const photoInput = root.querySelector("#edit-profile-photo");
  if (photoInput) {
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files?.[0];
      if (!file) {
        return;
      }

      try {
        const image = await prepareProfilePhotoSource(file);
        openProfilePhotoEditor(image);
      } catch (error) {
        photoInput.value = "";
        showMessage(error.message || "Unable to load profile picture.", "error");
      }
    });
  }

  const adjustPhotoBtn = root.querySelector('[data-action="adjust-photo"]');
  if (adjustPhotoBtn) {
    adjustPhotoBtn.addEventListener("click", () => {
      if (!state.profilePhotoSource) {
        return;
      }
      openProfilePhotoEditor(state.profilePhotoSource);
    });
  }

  const removePhotoBtn = root.querySelector('[data-action="remove-photo"]');
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener("click", () => {
      state.editProfilePicture = null;
      state.profilePhotoSource = null;
      state.photoEditorSettings = null;
      render();
    });
  }

  const form = document.getElementById("profileEditForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      try {
        const payload = {
          fname: formData.get("fname"),
          lname: formData.get("lname"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          gender: state.data.profile.gender,
          able_driver: formData.get("able_driver") === "on",
        };
        if (state.editProfilePicture !== undefined) {
          payload.profile_picture_url = state.editProfilePicture;
        }

        const updated = await ShareTripApi.apiFetch("/api/users/me/profile", {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        state.data.profile = updated;
        state.data.stats.able_driver = u().isAbleDriver(updated);
        u().applyHideRequestRidesForDriverStatus(updated);
        state.editing = false;
        state.editProfilePicture = undefined;
        state.profilePhotoSource = null;
        state.photoEditorSettings = null;
        showMessage("Profile updated.");
        render();
      } catch (error) {
        showMessage(error.message || "Unable to save profile.", "error");
      }
    });
  }
}

async function loadProfileNotifications() {
  if (!state.isOwnProfile) {
    state.notifications = [];
    return;
  }

  try {
    state.notifications = await ShareTripApi.apiFetch("/api/notifications?unread=0");
  } catch {
    state.notifications = [];
  }
}

async function loadProfileOverview() {
  if (state.viewingUserId) {
    state.data = await ShareTripApi.apiFetch(
      `/api/users/${encodeURIComponent(state.viewingUserId)}/overview`
    );
    return;
  }
  state.data = await ShareTripApi.apiFetch("/api/users/me/overview");
}

async function initMyProfilePage() {
  if (!(await ShareTripAuth.requireSignedIn())) {
    return;
  }

  const session = await ShareTripAuth.getSession();
  const queryUserId = u().readQuery().get("user")?.trim();
  state.viewingUserId = queryUserId || null;
  state.isOwnProfile = !state.viewingUserId || state.viewingUserId === session.userId;

  if (state.isOwnProfile) {
    const profile = await ShareTripAuth.requireProfile();
    if (!profile) {
      return;
    }
  }

  await ShareTripNavbar.renderNavbar(state.isOwnProfile ? "profile" : "dashboard");
  document.title = state.isOwnProfile
    ? "My Profile | ShareTrip"
    : "Member Profile | ShareTrip";

  try {
    await loadProfileOverview();
    if (state.isOwnProfile) {
      await loadProfileNotifications();
    }
    render();
  } catch (error) {
    showMessage(error.message || "Unable to load profile.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMyProfilePage().catch((error) => console.error(error));
});
