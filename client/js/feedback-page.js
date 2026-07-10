function showFeedbackMessage(text, type = "success") {
  const message = document.getElementById("feedback-message");
  window.ShareTripUtils.renderSiteAlert(message, text, { type });
}

async function initFeedbackPage() {
  await window.ShareTripNavbar.renderNavbar();

  const pageInput = document.getElementById("feedback-page-source");
  if (pageInput) {
    pageInput.value = document.referrer || window.location.href;
  }

  const form = document.getElementById("feedbackForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    try {
      await window.ShareTripApi.apiFetch("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          type: formData.get("type"),
          message: formData.get("message"),
          email: formData.get("email"),
          page: formData.get("page"),
        }),
      });
      form.reset();
      if (pageInput) {
        pageInput.value = document.referrer || window.location.href;
      }
      showFeedbackMessage("Thanks. Your feedback has been sent.");
    } catch (error) {
      showFeedbackMessage(error.message || "Unable to send feedback.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Send Feedback";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initFeedbackPage().catch((error) => {
    console.error(error);
    showFeedbackMessage(error.message || "Unable to load feedback form.", "error");
  });
});
