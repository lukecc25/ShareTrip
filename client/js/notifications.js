async function loadNotifications() {
  try {
    return await ShareTripApi.apiFetch("/api/notifications");
  } catch {
    return [];
  }
}

function renderNotificationBanner(container, notifications) {
  if (!container || !notifications.length) {
    if (container) {
      container.hidden = true;
      container.innerHTML = "";
    }
    return;
  }

  const { escapeHtml } = window.ShareTripUtils;
  const items = notifications
    .map(
      (item) => `
    <div class="notification-item ${item.kind === "driver_offer_accepted" ? "success" : item.kind === "driver_offer_declined" ? "error" : ""}" data-id="${item.id}">
      <p>${escapeHtml(item.message)}</p>
      <button type="button" class="notification-dismiss" data-dismiss-id="${item.id}">Dismiss</button>
    </div>`
    )
    .join("");

  container.hidden = false;
  container.innerHTML = items;

  container.querySelectorAll("[data-dismiss-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.dismissId);
      await ShareTripApi.apiFetch("/api/notifications/read", {
        method: "POST",
        body: JSON.stringify({ ids: [id] }),
      });
      button.closest(".notification-item")?.remove();
      if (!container.querySelector(".notification-item")) {
        container.hidden = true;
      }
    });
  });
}

async function showNotificationBanner() {
  const container = document.getElementById("notification-banner");
  if (!container) {
    return;
  }
  const notifications = await loadNotifications();
  renderNotificationBanner(container, notifications);
}

window.ShareTripNotifications = {
  loadNotifications,
  showNotificationBanner,
  renderNotificationBanner,
};
