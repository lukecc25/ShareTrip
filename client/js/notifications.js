async function loadNotifications() {
  try {
    return await ShareTripApi.apiFetch("/api/notifications");
  } catch {
    return [];
  }
}

function syncHeaderOffset(container) {
  const bannerHeight =
    container && !container.hidden && container.querySelector(".notification-item")
      ? container.offsetHeight
      : 0;
  document.documentElement.style.setProperty(
    "--notification-banner-height",
    `${bannerHeight}px`
  );
}

function renderNotificationBanner(container, notifications) {
  if (!container || !notifications.length) {
    if (container) {
      container.hidden = true;
      container.innerHTML = "";
      syncHeaderOffset(container);
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
  syncHeaderOffset(container);

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
      syncHeaderOffset(container);
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

window.addEventListener("resize", () => {
  syncHeaderOffset(document.getElementById("notification-banner"));
});

window.ShareTripNotifications = {
  loadNotifications,
  showNotificationBanner,
  renderNotificationBanner,
};
