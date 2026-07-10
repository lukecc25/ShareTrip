const NOTIFICATION_AUTO_DISMISS_MS = 5000;
const notificationItemTimers = new WeakMap();

async function loadNotifications() {
  try {
    return await ShareTripApi.apiFetch("/api/notifications");
  } catch {
    return [];
  }
}

function syncSiteHeaderOffset() {
  window.ShareTripUtils?.syncSiteHeaderOffset?.();
}

function clearNotificationItemTimer(itemEl) {
  const timer = notificationItemTimers.get(itemEl);
  if (timer) {
    clearTimeout(timer);
    notificationItemTimers.delete(itemEl);
  }
}

async function dismissNotificationItem(container, itemEl, { markRead = false } = {}) {
  if (!itemEl || itemEl.classList.contains("is-fading")) {
    return;
  }

  clearNotificationItemTimer(itemEl);

  const { fadeOutElement } = window.ShareTripUtils;
  fadeOutElement(itemEl, async () => {
    const id = Number(itemEl.dataset.id);
    if (markRead) {
      try {
        await ShareTripApi.apiFetch("/api/notifications/read", {
          method: "POST",
          body: JSON.stringify({ ids: [id] }),
        });
      } catch {
        // Still remove the banner item if marking read fails.
      }
    }

    itemEl.remove();
    if (!container.querySelector(".notification-item")) {
      container.hidden = true;
    }
    syncSiteHeaderOffset();
    window.ShareTripNavbar?.updateNavNotificationBadge?.();
  });
}

function renderNotificationBanner(container, notifications) {
  if (!container || !notifications.length) {
    if (container) {
      container.hidden = true;
      container.innerHTML = "";
      syncSiteHeaderOffset();
    }
    return;
  }

  const { escapeHtml } = window.ShareTripUtils;
  const items = notifications
    .map(
      (item) => `
    <div class="notification-item ${item.kind === "driver_offer_accepted" || item.kind === "ride_joined" ? "success" : item.kind === "driver_offer_declined" ? "error" : item.kind === "driver_offer_cancelled" ? "pending" : item.kind === "driver_offer_pending" || item.kind === "driver_offer_waiting" ? "pending" : ""}" data-id="${item.id}">
      <p>${escapeHtml(item.message)}</p>
      ${
        item.ride_origin || item.ride_destination
          ? `<p class="profile-notification-route">${escapeHtml(item.ride_origin || "Start")} → ${escapeHtml(item.ride_destination || "Destination")}</p>`
          : ""
      }
      ${
        item.can_respond
          ? `<div class="profile-notification-actions-row">
              <a href="/my-profile.html#profile-notifications" class="profile-notification-link">Review offer on profile</a>
            </div>`
          : ""
      }
      <button type="button" class="notification-dismiss" data-dismiss-id="${item.id}" aria-label="Dismiss notification">&times;</button>
    </div>`
    )
    .join("");

  container.hidden = false;
  container.innerHTML = items;
  syncSiteHeaderOffset();

  container.querySelectorAll(".notification-item").forEach((itemEl) => {
    const dismissButton = itemEl.querySelector("[data-dismiss-id]");
    dismissButton?.addEventListener("click", () => {
      dismissNotificationItem(container, itemEl, { markRead: true });
    });

    notificationItemTimers.set(
      itemEl,
      setTimeout(() => {
        dismissNotificationItem(container, itemEl);
      }, NOTIFICATION_AUTO_DISMISS_MS)
    );
  });
}

async function showNotificationBanner() {
  const container = document.getElementById("notification-banner");
  if (!container) {
    return;
  }
  const notifications = await loadNotifications();
  renderNotificationBanner(container, notifications);
  window.ShareTripNavbar?.updateNavNotificationBadge?.();
}

window.addEventListener("resize", () => {
  syncSiteHeaderOffset();
});

window.ShareTripNotifications = {
  loadNotifications,
  showNotificationBanner,
  renderNotificationBanner,
  syncSiteHeaderOffset,
};
