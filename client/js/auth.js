async function getSession() {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });
  return response.json();
}

function currentReturnTo() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function signInRedirectUrl(message = "Sign in to continue.", returnTo = currentReturnTo()) {
  const params = new URLSearchParams();
  params.set("message", message);
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    params.set("returnTo", returnTo);
  }
  return `/sign-in.html?${params.toString()}`;
}

async function requireSignedIn(redirectTo = null) {
  const session = await getSession();
  if (!session.isAuthenticated) {
    window.location.href =
      redirectTo || signInRedirectUrl("Sign in to use that part of ShareTrip.");
    return false;
  }
  return true;
}

async function requireProfile(redirectTo = null) {
  const signedIn = await requireSignedIn(redirectTo);
  if (!signedIn) {
    return false;
  }

  try {
    const data = await ShareTripApi.apiFetch("/api/users/me/profile");
    if (!data.profile) {
      window.location.href = signInRedirectUrl("Sign in to finish setting up your profile.");
      return false;
    }
    return data.profile;
  } catch (error) {
    if (error.status === 401 || error.status === 404) {
      window.location.href = signInRedirectUrl("Sign in to continue.");
      return false;
    }
    throw error;
  }
}

async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/index.html";
}

window.ShareTripAuth = {
  getSession,
  requireSignedIn,
  requireProfile,
  signInRedirectUrl,
  logout,
};
