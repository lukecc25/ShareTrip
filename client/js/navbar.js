async function renderNavbar(active = "") {
  const host = document.getElementById("navbar-root");
  if (!host) {
    return;
  }

  host.innerHTML = `
    <nav class="navbar">
      <a href="/index.html" class="logo-area">
        <img src="/images/sharetrip_logo.webp" alt="ShareTrip Logo">
        <div class="logo-text">Share<span>Trip</span></div>
      </a>
      <div id="nav-actions" class="nav-actions"></div>
    </nav>
  `;

  const container = document.getElementById("nav-actions");
  if (!container || !window.ShareTripAuth) {
    return;
  }

  const session = await ShareTripAuth.getSession();
  container.innerHTML = "";

  if (session.isAuthenticated) {
    let profile = null;
    try {
      profile = await ShareTripApi.apiFetch("/api/users/me/profile").then((data) => data.profile);
    } catch (error) {
      profile = null;
    }

    const dashboardLink = document.createElement("a");
    dashboardLink.href = "/dashboard.html";
    dashboardLink.className = `nav-link${active === "dashboard" ? " active" : ""}`;
    dashboardLink.textContent = "Dashboard";

    const donationLink = document.createElement("a");
    donationLink.href = "/donations.html";
    donationLink.className = `nav-link${active === "donations" ? " active" : ""}`;
    donationLink.textContent = "Donate";
    const profileLink = document.createElement("a");
    profileLink.href = "/my-profile.html";
    profileLink.className = `nav-link nav-profile-link${active === "profile" ? " active" : ""}`;

    const profileAvatar = document.createElement("span");
    profileAvatar.className = "nav-profile-avatar";

    if (profile?.profile_picture_url) {
      profileAvatar.classList.add("has-photo");
      const avatarImage = document.createElement("img");
      avatarImage.src = profile.profile_picture_url;
      avatarImage.alt = `${profile.fname || "Profile"} avatar`;
      avatarImage.addEventListener("error", () => {
        showNavInitials(profileAvatar, profile);
      });
      profileAvatar.appendChild(avatarImage);
    } else {
      showNavInitials(profileAvatar, profile);
    }

    const profileLabel = document.createElement("span");
    profileLabel.textContent = "Profile";

    profileLink.appendChild(profileAvatar);
    profileLink.appendChild(profileLabel);

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "login-btn";
    logoutBtn.textContent = "Logout";
    logoutBtn.addEventListener("click", () => ShareTripAuth.logout());

    container.appendChild(dashboardLink);
    container.appendChild(profileLink);
    container.appendChild(donationLink);
    container.appendChild(logoutBtn);
    return;
  }

  const loginLink = document.createElement("a");
  loginLink.href = "/sign-in.html";
  loginLink.className = "login-btn";
  loginLink.textContent = "Login / Sign Up";
  container.appendChild(loginLink);
}

function genderClass(gender) {
  return String(gender || "").toLowerCase() === "female" ? "female" : "male";
}

function showNavInitials(profileAvatar, profile) {
  profileAvatar.innerHTML = "";
  profileAvatar.className = `nav-profile-avatar ${genderClass(profile?.gender)}`;
  profileAvatar.textContent = getProfileInitials(profile);
}

function getProfileInitials(profile) {
  const firstInitial = profile?.fname?.trim()?.[0] || "";
  const lastInitial = profile?.lname?.trim()?.[0] || "";
  const initials = `${firstInitial}${lastInitial}`.trim();
  return initials || "ST";
}

window.ShareTripNavbar = { renderNavbar };
