async function getSession() {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });
  return response.json();
}

async function requireSignedIn(redirectTo = "/sign-in.html") {
  const session = await getSession();
  if (!session.isAuthenticated) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

async function requireProfile(redirectTo = "/sign-in.html") {
  const signedIn = await requireSignedIn(redirectTo);
  if (!signedIn) {
    return false;
  }

  try {
    const data = await ShareTripApi.apiFetch("/api/users/me/profile");
    if (!data.profile) {
      window.location.href = "/sign-in.html";
      return false;
    }
    return data.profile;
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "/sign-in.html";
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
  logout,
};
