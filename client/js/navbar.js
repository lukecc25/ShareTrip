async function renderNavbar(active = "") {
  const host = document.getElementById("navbar-root");
  if (!host) {
    return;
  }

  active = active || getActiveNavFromPath();

  host.innerHTML = `
    <nav class="navbar">
      <a href="/index.html" class="logo-area">
        <img src="/images/sharetrip_logo.webp" alt="ShareTrip Logo">
        <div class="logo-text">Share<span>Trip</span></div>
      </a>
      <div class="nav-mobile-actions">
        <div id="nav-mobile-profile" class="nav-mobile-profile"></div>
        <button id="nav-menu-toggle" class="nav-menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <div id="nav-menu" class="nav-menu">
        <div id="nav-primary" class="nav-primary"></div>
        <div id="nav-account" class="nav-account"></div>
      </div>
    </nav>
  `;

  renderFooter();

  setupMenuToggle();

  const primaryContainer = document.getElementById("nav-primary");
  const accountContainer = document.getElementById("nav-account");
  const mobileProfileContainer = document.getElementById("nav-mobile-profile");
  if (!primaryContainer || !accountContainer || !window.ShareTripAuth) {
    return;
  }

  const session = await ShareTripAuth.getSession();
  primaryContainer.innerHTML = "";
  accountContainer.innerHTML = "";
  if (mobileProfileContainer) {
    mobileProfileContainer.innerHTML = "";
  }

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

    const howItWorksLink = document.createElement("a");
    howItWorksLink.href = "/how-it-works.html";
    howItWorksLink.className = `nav-link${active === "how-it-works" ? " active" : ""}`;
    howItWorksLink.textContent = "How It Works";

    const donationLink = document.createElement("a");
    donationLink.href = "/donations.html";
    donationLink.className = `nav-link${active === "donations" ? " active" : ""}`;
    donationLink.textContent = "Donate";

    const mobileProfileLink = document.createElement("a");
    mobileProfileLink.href = "/my-profile.html";
    mobileProfileLink.className = `nav-link nav-mobile-profile-link${active === "profile" ? " active" : ""}`;
    mobileProfileLink.textContent = "Profile";

    const profileLink = createProfileAvatarLink(profile, active);
    const mobileProfileIconLink = createProfileAvatarLink(profile, active, " nav-mobile-profile-icon");

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "login-btn";
    logoutBtn.textContent = "Logout";
    logoutBtn.addEventListener("click", () => ShareTripAuth.logout());

    primaryContainer.appendChild(howItWorksLink);
    primaryContainer.appendChild(dashboardLink);
    primaryContainer.appendChild(donationLink);
    primaryContainer.appendChild(mobileProfileLink);
    accountContainer.appendChild(profileLink);
    accountContainer.appendChild(logoutBtn);
    if (mobileProfileContainer) {
      mobileProfileContainer.appendChild(mobileProfileIconLink);
    }
    return;
  }

  const loginLink = document.createElement("a");
  loginLink.href = "/sign-in.html";
  loginLink.className = "login-btn";
  loginLink.textContent = "Login / Sign Up";
  accountContainer.appendChild(loginLink);
}

function createProfileAvatarLink(profile, active, extraClass = "") {
  const profileLink = document.createElement("a");
  profileLink.href = "/my-profile.html";
  profileLink.className = `nav-link nav-profile-link${extraClass}${active === "profile" ? " active" : ""}`;

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

  profileLink.appendChild(profileAvatar);
  return profileLink;
}

function setupMenuToggle() {
  const toggle = document.getElementById("nav-menu-toggle");
  const menu = document.getElementById("nav-menu");

  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  });
}

function renderFooter() {
  let footer = document.getElementById("site-footer");
  const year = new Date().getFullYear();

  if (!footer) {
    footer = document.createElement("footer");
    footer.id = "site-footer";
    footer.className = "site-footer";
    document.body.appendChild(footer);
  }

  footer.innerHTML = `<p>&copy; ${year} ShareTrip. All rights reserved.</p>`;
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

function getActiveNavFromPath() {
  const path = window.location.pathname.replace(/\/$/, "");

  if (path === "/dashboard" || path === "/dashboard.html" || path === "/ride-details" || path === "/ride-details.html") {
    return "dashboard";
  }

  if (path === "/donations" || path === "/donations.html") {
    return "donations";
  }

  if (path === "/how-it-works" || path === "/how-it-works.html") {
    return "how-it-works";
  }

  if (path === "/my-profile" || path === "/my-profile.html" || path === "/profile" || path === "/profile.html") {
    return "profile";
  }

  return "";
}
