function u() {
  return window.ShareTripUtils;
}

let state = {
  threads: [],
};

function renderThreadAvatar(thread) {
  const { escapeHtml } = u();
  if (thread.driver_profile_picture_url) {
    return `<div class="thread-avatar"><img src="${escapeHtml(thread.driver_profile_picture_url)}" alt=""></div>`;
  }
  const initials =
    `${(thread.driver_fname || "").charAt(0)}${(thread.driver_lname || "").charAt(0)}`.toUpperCase() ||
    "?";
  return `<div class="thread-avatar thread-avatar-fallback">${escapeHtml(initials)}</div>`;
}

function renderThreadRow(thread) {
  const { escapeHtml, fullName, formatDateValue, formatDestination } = u();
  const driverName = fullName({ fname: thread.driver_fname, lname: thread.driver_lname });
  const route = `${escapeHtml(thread.origin)} → ${escapeHtml(formatDestination(thread))}`;
  const preview = thread.last_message
    ? escapeHtml(
        thread.last_message.length > 80 ? `${thread.last_message.slice(0, 80)}…` : thread.last_message
      )
    : '<span class="thread-empty-preview">No messages yet</span>';

  return `
    <a class="thread-row${thread.unread_count > 0 ? " unread" : ""}" href="/message-thread.html?ride=${thread.ride_id}">
      ${renderThreadAvatar(thread)}
      <div class="thread-info">
        <div class="thread-top-row">
          <strong>${escapeHtml(driverName)}</strong>
          <span class="thread-date">${escapeHtml(formatDateValue(thread.start_date))}</span>
        </div>
        <div class="thread-route">${route}</div>
        <div class="thread-preview">${preview}</div>
      </div>
      ${thread.unread_count > 0 ? '<span class="thread-unread-dot" aria-label="Unread messages"></span>' : ""}
    </a>`;
}

function render() {
  const root = document.getElementById("threads-root");
  if (!root) {
    return;
  }

  if (!state.threads.length) {
    root.innerHTML = `
      <div class="empty-rides">
        <h2>No messages yet</h2>
        <p>Once you join a ride or get matched with a driver, your conversations will show up here.</p>
      </div>`;
    return;
  }

  root.innerHTML = `<div class="thread-list">${state.threads.map(renderThreadRow).join("")}</div>`;
}

function showMessage(text, type = "error") {
  const message = document.getElementById("messages-message");
  u().renderSiteAlert(message, text, { type });
}

async function loadThreads() {
  const result = await ShareTripApi.apiFetch("/api/messages/threads");
  state.threads = result.threads || [];
}

async function initMessagesPage() {
  if (!(await ShareTripAuth.requireSignedIn())) {
    return;
  }
  await ShareTripAuth.requireProfile();
  await ShareTripNavbar.renderNavbar("messages");
  document.title = "Messages | ShareTrip";

  try {
    await loadThreads();
    render();
  } catch (error) {
    showMessage(error.message || "Unable to load messages.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMessagesPage().catch((error) => console.error(error));
});