async function initProfilePage() {
  if (!(await ShareTripAuth.requireSignedIn())) {
    return;
  }

  await ShareTripNavbar.renderNavbar();

  let profile;
  try {
    const data = await ShareTripApi.apiFetch("/api/users/me/profile");
    profile = data.profile;
  } catch (error) {
    document.getElementById("profile-message").textContent = error.message;
    document.getElementById("profile-message").className = "message error";
    document.getElementById("profile-message").hidden = false;
    return;
  }

  if (!profile) {
    window.location.href = "/sign-up.html";
    return;
  }

  const form = document.getElementById("profileForm");
  form.fname.value = profile.fname || "";
  form.lname.value = profile.lname || "";
  form.email.value = profile.email || "";
  form.phone.value = profile.phone || "";
  form.gender.value = profile.gender || "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const message = document.getElementById("profile-message");

    try {
      await ShareTripApi.apiFetch("/api/users/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          fname: formData.get("fname"),
          lname: formData.get("lname"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          gender: formData.get("gender"),
        }),
      });
      window.location.href = "/dashboard.html";
    } catch (error) {
      message.textContent = error.message;
      message.className = "message error";
      message.hidden = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initProfilePage().catch((error) => console.error(error));
});
