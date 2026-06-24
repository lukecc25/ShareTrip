function u() {
  return window.ShareTripUtils;
}

const POLL_INTERVAL_MS = 5000;

let state = {
  token: null,
  ride: null,
  guest: null,
  messages: [],
  pollTimer: null,
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

  const displayName = message.lname
    ? `${message.fname} ${message.lname}`
    : message.fname;

  return `
    <div class="chat-message${message.is_own ? " own" : ""}">
      ${message.is_own ? "" : `<div class="chat-message-author">${escapeHtml(displayName)}</div>`}
      <div class="chat-message-bubble">${escapeHtml(message.body)}</div>
      <div class="chat-message-time">${escapeHtml(timeLabel)}</div>
    </div>`;
}

function render() {
  const root = document.getElementById("guest-chat-root");
  if (!root || !state.ride) return;

  const { escapeHtml, formatDateValue, formatDestination } = u();
  const ride = state.ride;

  const messageHtml = state.messages.length
    ? state.messages.map(renderMessageBubble).join("")
    : '<div class="chat-empty-state">No messages yet. Say hi!</div>';

  root.innerHTML = `
    <div class="chat-header">
      <h1>${escapeHtml(ride.origin)} → ${escapeHtml(formatDestination(ride))}</h1>
      <p>${escapeHtml(formatDateValue(ride.start_date))}${ride.departure_time ? ` · ${escapeHtml(ride.departure_time)}` : ""}</p>
      <p class="guest-name-badge">Joining as: <strong>${escapeHtml(state.guest.name)}</strong></p>
    </div>
    <div class="chat-thread" id="chat-thread">
      ${messageHtml}
    </div>
    <form class="chat-composer" id="guest-chat-form">
      <textarea id="chat-input" placeholder="Write a message…" maxlength="1000" required></textarea>
      <button type="submit" class="primary-small-button">Send</button>
    </form>`;

  bindEvents();
}

function renderMessages() {
  const thread = document.getElementById("chat-thread");
  if (!thread) return;
  const messageHtml = state.messages.length
    ? state.messages.map(renderMessageBubble).join("")
    : '<div class="chat-empty-state">No messages yet. Say hi!</div>';
  thread.innerHTML = messageHtml;
}

function showMessage(text, type = "error") {
  const el = document.getElementById("chat-message");
  u().renderSiteAlert(el, text, { type });
}

function bindEvents() {
  const form = document.getElementById("guest-chat-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textarea = document.getElementById("chat-input");
    const body = textarea?.value.trim();
    if (!body) return;

    textarea.disabled = true;
    try {
      await ShareTripApi.apiFetch("/api/guest-chat/messages", {
        method: "POST",
        body: JSON.stringify({ token: state.token, body }),
      });
      await loadChat();
      renderMessages();
      textarea.value = "";
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

async function loadChat() {
  const result = await ShareTripApi.apiFetch(
    `/api/guest-chat?token=${encodeURIComponent(state.token)}`
  );
  state.ride = result.ride;
  state.guest = result.guest;
  state.messages = result.messages || [];
}

function startPolling() {
  state.pollTimer = setInterval(async () => {
    try {
      await loadChat();
      renderMessages();
    } catch (error) {
      // Ignore polling errors silently.
    }
  }, POLL_INTERVAL_MS);
}

async function initGuestChatPage() {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    document.getElementById("guest-chat-root").innerHTML = `
      <p style="color:#b91c1c;padding:24px 0;">Invalid link. Please ask your driver for a new one.</p>`;
    return;
  }
  state.token = token;

  await ShareTripNavbar.renderNavbar("");
  document.title = "Guest Chat | ShareTrip";

  try {
    await loadChat();
    render();
    startPolling();
  } catch (error) {
    document.getElementById("guest-chat-root").innerHTML = `
      <p style="color:#b91c1c;padding:24px 0;">${u().escapeHtml(error.message || "Unable to load chat.")}</p>`;
  }
}

window.addEventListener("beforeunload", () => {
  if (state.pollTimer) clearInterval(state.pollTimer);
});

document.addEventListener("DOMContentLoaded", () => {
  initGuestChatPage().catch((error) => console.error(error));
});