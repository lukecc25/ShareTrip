function u() {
  return window.ShareTripUtils;
}

const POLL_INTERVAL_MS = 5000;

let state = {
  rideId: null,
  ride: null,
  viewer: null,
  passengers: [],
  messages: [],
  pollTimer: null,
  editingDetails: false,
  guestLinks: [],
};

function renderMessageBubble(message) {
  const { escapeHtml } = u();
  const sentAt = new Date(message.created_at);
  const timeLabel = Number.isNaN(sentAt.getTime())
    ? ""
    : sentAt.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  const displayName = message.is_guest
    ? `${escapeHtml(message.fname)} (guest)`
    : escapeHtml(message.fname);

  return `
    <div class="chat-message${message.is_own ? " own" : ""}">
      ${message.is_own ? "" : `<div class="chat-message-author">${displayName}</div>`}
      <div class="chat-message-bubble">${escapeHtml(message.body)}</div>
      <div class="chat-message-time">${escapeHtml(timeLabel)}</div>
    </div>`;
}

function renderPassengerRow(p, isDriver) {
  const { escapeHtml } = u();
  const initials =
    `${(p.fname || "").charAt(0)}${(p.lname || "").charAt(0)}`.toUpperCase() || "?";
  const canEdit = isDriver || p.is_own;

  return `
    <div class="pickup-row" data-user-id="${escapeHtml(p.user_id)}">
      <div class="pickup-avatar">${escapeHtml(initials)}</div>
      <div class="pickup-info">
        <p class="pickup-name">${escapeHtml(p.fname)} ${escapeHtml(p.lname)}${p.is_own ? " (you)" : ""}</p>
        ${
          state.editingDetails && canEdit
            ? `<input class="pickup-spot-input" type="text" maxlength="200"
                placeholder="Enter pickup spot…"
                value="${escapeHtml(p.pickup_spot || "")}"
                data-user-id="${escapeHtml(p.user_id)}">`
            : `<p class="pickup-spot">${p.pickup_spot ? escapeHtml(p.pickup_spot) : '<span class="pickup-empty">Not set yet</span>'}</p>`
        }
      </div>
    </div>`;
}

// Guest link panel — visible to any participant who has guests.
// Shows one copy-link button per guest that was added at join time.
function renderGuestPanel() {
  const { escapeHtml } = u();

  if (!state.guestLinks.length) {
    return "";
  }

  const linkItems = state.guestLinks.map((g) => {
    const url = `${window.location.origin}/guest-chat.html?token=${encodeURIComponent(g.token)}`;
    const isExpired = g.expires_at && new Date(g.expires_at) < new Date();
    return `
      <div class="guest-link-row">
        <div class="guest-link-info">
          <strong>${escapeHtml(g.guest_name)}</strong>
          ${g.guest_phone ? `<span>${escapeHtml(g.guest_phone)}</span>` : ""}
          ${isExpired ? '<span class="guest-link-expired">Expired</span>' : ""}
        </div>
        ${
          isExpired
            ? `<button type="button" class="secondary-button guest-renew-btn" data-token-id="${escapeHtml(g.id)}">Renew link</button>`
            : `<button type="button" class="secondary-button guest-copy-btn" data-url="${escapeHtml(url)}">Copy link</button>`
        }
      </div>`;
  }).join("");

  return `
    <div class="guest-panel">
      <p class="ride-details-label"><i class="ti ti-link" aria-hidden="true"></i> Guest links — share these with your guests</p>
      <div class="guest-link-list">${linkItems}</div>
    </div>`;
}

function renderRideDetails() {
  const { escapeHtml, formatDateValue, formatDestination } = u();
  const ride = state.ride;
  const isDriver = state.viewer?.is_driver ?? false;
  const passengerCount = state.passengers.length;
  const passengerLabel = passengerCount === 1 ? "1 passenger" : `${passengerCount} passengers`;

  return `
    <div class="ride-detail-card">
      <div class="ride-detail-card-header">
        <div>
          <p class="ride-detail-route">${escapeHtml(ride.origin)} → ${escapeHtml(formatDestination(ride))}</p>
          <div class="ride-detail-meta">
            <span>${escapeHtml(formatDateValue(ride.start_date))}</span>
            <span class="passenger-count-pill">${passengerLabel}</span>
          </div>
        </div>
        <button class="secondary-button ride-details-edit-btn" data-action="toggle-edit">
          ${state.editingDetails ? "Save" : "Edit"}
        </button>
      </div>

      <div class="ride-details-grid">
        <div class="ride-details-cell">
          <p class="ride-details-label"><i class="ti ti-clock" aria-hidden="true"></i> Departure time</p>
          ${
            state.editingDetails && isDriver
              ? `<input class="ride-details-input" id="departure-time-input" type="text" maxlength="50"
                  placeholder="e.g. 8:30 AM"
                  value="${escapeHtml(ride.departure_time || "")}">`
              : `<p class="ride-details-value">${ride.departure_time ? escapeHtml(ride.departure_time) : '<span class="ride-details-empty">Not set</span>'}</p>`
          }
        </div>
        <div class="ride-details-cell">
          <p class="ride-details-label"><i class="ti ti-notes" aria-hidden="true"></i> Notes</p>
          ${
            state.editingDetails && isDriver
              ? `<textarea class="ride-details-input" id="ride-notes-input" maxlength="500"
                  placeholder="e.g. Call me if you can't find me">${escapeHtml(ride.ride_notes || "")}</textarea>`
              : `<p class="ride-details-value">${ride.ride_notes ? escapeHtml(ride.ride_notes) : '<span class="ride-details-empty">None</span>'}</p>`
          }
        </div>
        <div class="ride-details-cell ride-details-cell-full">
          <p class="ride-details-label"><i class="ti ti-users" aria-hidden="true"></i> Pickup spots</p>
          <div class="pickup-list">
            ${state.passengers.map((p) => renderPassengerRow(p, isDriver)).join("")}
          </div>
        </div>
        ${renderGuestPanel() ? `<div class="ride-details-cell ride-details-cell-full">${renderGuestPanel()}</div>` : ""}
      </div>
    </div>`;
}

function isScrolledNearBottom() {
  const thread = document.getElementById("chat-thread");
  if (!thread) return true;
  return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
}

function scrollToBottom() {
  const thread = document.getElementById("chat-thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function renderMessages() {
  const thread = document.getElementById("chat-thread");
  if (!thread) return;
  const wasNearBottom = isScrolledNearBottom();
  const messageHtml = state.messages.length
    ? state.messages.map(renderMessageBubble).join("")
    : '<div class="chat-empty-state">No messages yet. Say hi!</div>';
  thread.innerHTML = messageHtml;
  if (wasNearBottom) scrollToBottom();
}

function render() {
  const root = document.getElementById("chat-root");
  if (!root) return;

  const messageHtml = state.messages.length
    ? state.messages.map(renderMessageBubble).join("")
    : '<div class="chat-empty-state">No messages yet. Say hi!</div>';

  root.innerHTML = `
    <a href="/messages.html" class="back-link">Back to messages</a>
    ${state.ride ? renderRideDetails() : ""}
    <div class="chat-thread" id="chat-thread">
      ${messageHtml}
    </div>
    <form class="chat-composer" id="chat-composer">
      <textarea id="chat-input" placeholder="Write a message…" maxlength="1000" required></textarea>
      <button type="submit" class="primary-small-button">Send</button>
    </form>`;

  bindEvents();
  scrollToBottom();
}

function showMessage(text, type = "error") {
  const el = document.getElementById("chat-message");
  u().renderSiteAlert(el, text, { type });
}

async function saveDetails() {
  const isDriver = state.viewer?.is_driver ?? false;
  try {
    if (isDriver) {
      const departureTime = document.getElementById("departure-time-input")?.value.trim() ?? null;
      const rideNotes = document.getElementById("ride-notes-input")?.value.trim() ?? null;
      await ShareTripApi.apiFetch(`/api/rides/${state.rideId}/ride-details`, {
        method: "PUT",
        body: JSON.stringify({ departure_time: departureTime, ride_notes: rideNotes }),
      });
    }

    const pickupInputs = document.querySelectorAll(".pickup-spot-input");
    for (const input of pickupInputs) {
      const passengerUserId = input.dataset.userId;
      const pickupSpot = input.value.trim() || null;
      await ShareTripApi.apiFetch(
        `/api/rides/${state.rideId}/passengers/${encodeURIComponent(passengerUserId)}/pickup-spot`,
        {
          method: "PUT",
          body: JSON.stringify({ pickup_spot: pickupSpot }),
        }
      );
    }

    state.editingDetails = false;
    await loadMessages();
    render();
    showMessage("Details saved.", "success");
  } catch (error) {
    showMessage(error.message || "Unable to save details.");
  }
}

function bindEvents() {
  const form = document.getElementById("chat-composer");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const textarea = document.getElementById("chat-input");
      const body = textarea?.value.trim();
      if (!body) return;
      textarea.disabled = true;
      try {
        await ShareTripApi.apiFetch(`/api/rides/${state.rideId}/messages`, {
          method: "POST",
          body: JSON.stringify({ body }),
        });
        await loadMessages();
        render();
        scrollToBottom();
      } catch (error) {
        showMessage(error.message || "Unable to send message.");
      } finally {
        const newTextarea = document.getElementById("chat-input");
        if (newTextarea) {
          newTextarea.disabled = false;
          newTextarea.focus();
        }
      }
    });
  }

  const editBtn = document.querySelector('[data-action="toggle-edit"]');
  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      if (state.editingDetails) {
        await saveDetails();
      } else {
        state.editingDetails = true;
        render();
      }
    });
  }

  // Copy link buttons
  document.querySelectorAll(".guest-copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy link"; }, 2000);
      } catch {
        // Fallback for browsers that block clipboard
        prompt("Copy this link and send it to your passenger:", url);
      }
    });
  });

    // Renew (expired) link buttons
  document.querySelectorAll(".guest-renew-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await ShareTripApi.apiFetch(
          `/api/guest-chat/rides/${state.rideId}/tokens/${btn.dataset.tokenId}/renew`,
          { method: "POST" }
        );
        await loadMessages();
        render();
      } catch (error) {
        btn.disabled = false;
        showMessage(error.message);
      }
    });
  });
}

async function loadMessages() {
  const result = await ShareTripApi.apiFetch(`/api/rides/${state.rideId}/messages`);
  state.ride = result.ride;
  state.viewer = result.viewer;
  state.passengers = result.passengers || [];
  state.messages = result.messages || [];
  state.guestLinks = result.my_guest_tokens || [];
}

function startPolling() {
  state.pollTimer = setInterval(async () => {
    try {
      await loadMessages();
      renderMessages();
    } catch {
      // Ignore polling errors silently.
    }
  }, POLL_INTERVAL_MS);
}

async function initMessageThreadPage() {
  if (!(await ShareTripAuth.requireSignedIn())) return;
  await ShareTripAuth.requireProfile();
  await ShareTripNavbar.renderNavbar("messages");

  const rideId = u().readQuery().get("ride");
  if (!rideId) {
    showMessage("No conversation was specified.");
    return;
  }
  state.rideId = rideId;
  document.title = "Messages | ShareTrip";

  try {
    await loadMessages();
    render();
    startPolling();
  } catch (error) {
    showMessage(error.message || "Unable to load this conversation.");
  }
}

window.addEventListener("beforeunload", () => {
  if (state.pollTimer) clearInterval(state.pollTimer);
});

document.addEventListener("DOMContentLoaded", () => {
  initMessageThreadPage().catch((error) => console.error(error));
});