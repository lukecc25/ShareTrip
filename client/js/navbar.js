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
    const dashboardLink = document.createElement("a");
    dashboardLink.href = "/dashboard.html";
    dashboardLink.className = `nav-link${active === "dashboard" ? " active" : ""}`;
    dashboardLink.textContent = "Dashboard";

    const profileLink = document.createElement("a");
    profileLink.href = "/my-profile.html";
    profileLink.className = `nav-link${active === "profile" ? " active" : ""}`;
    profileLink.textContent = "Profile";

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "login-btn";
    logoutBtn.textContent = "Logout";
    logoutBtn.addEventListener("click", () => ShareTripAuth.logout());

    container.appendChild(dashboardLink);
    container.appendChild(profileLink);
    container.appendChild(logoutBtn);
    return;
  }

  const loginLink = document.createElement("a");
  loginLink.href = "/sign-in.html";
  loginLink.className = "login-btn";
  loginLink.textContent = "Login / Sign Up";
  container.appendChild(loginLink);
}

window.ShareTripNavbar = { renderNavbar };
