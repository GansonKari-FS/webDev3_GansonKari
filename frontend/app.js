const API_URL = "http://127.0.0.1:3001";

/*
======================================================
PAGE ELEMENTS
======================================================
*/

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");

const loginButton = document.getElementById("spotifyLoginBtn");
const logoutButton = document.getElementById("logoutBtn");

const authStatus = document.getElementById("loginStatus");
const displayName = document.getElementById("displayName");
const sidebarDisplayName = document.getElementById("sidebarDisplayName");
const profileDisplayName = document.getElementById("profileDisplayName");

const dashboardStatus = document.getElementById("dashboardStatus");

const dashboardSection = document.getElementById("dashboardSection");
const searchSection = document.getElementById("searchSection");
const dashboardSearchBtn = document.getElementById("dashboardSearchBtn");

const navLinks = document.querySelectorAll(".nav-link");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const results = document.getElementById("results");

/*
======================================================
CURRENT USER
======================================================
*/

let currentUserId = null;

/*
======================================================
SHOW LOGIN SCREEN
======================================================
*/

function showLogin(message = "") {
  if (loginPage) {
    loginPage.classList.remove("hidden");
  }

  if (appPage) {
    appPage.classList.add("hidden");
  }

  if (authStatus) {
    authStatus.textContent = message;
  }
}

/*
======================================================
SHOW MAIN APPLICATION
======================================================
*/

function showApp(user) {
  if (loginPage) {
    loginPage.classList.add("hidden");
  }

  if (appPage) {
    appPage.classList.remove("hidden");
  }

  const userName = user?.displayName || "Spotify User";

  if (displayName) {
    displayName.textContent = userName;
  }

  if (sidebarDisplayName) {
    sidebarDisplayName.textContent = userName;
  }

  if (profileDisplayName) {
    profileDisplayName.textContent = userName;
  }

  showDashboard();
}

/*
======================================================
DASHBOARD STATUS
======================================================
*/

function showDashboardStatus(message, type = "loading") {
  if (!dashboardStatus) {
    return;
  }

  dashboardStatus.textContent = message;
  dashboardStatus.className = `dashboard-status ${type}`;
}

function hideDashboardStatus() {
  if (!dashboardStatus) {
    return;
  }

  dashboardStatus.textContent = "";
  dashboardStatus.className = "dashboard-status hidden";
}

/*
======================================================
DASHBOARD NAVIGATION
======================================================
*/

function setActiveNavigation(sectionName) {
  navLinks.forEach((link) => {
    const isActive = link.dataset.section === sectionName;
    link.classList.toggle("active", isActive);
  });
}

function showDashboard() {
  if (dashboardSection) {
    dashboardSection.classList.remove("hidden");
  }

  if (searchSection) {
    searchSection.classList.add("hidden");
  }

  setActiveNavigation("dashboard");
}

function showSearch() {
  if (dashboardSection) {
    dashboardSection.classList.add("hidden");
  }

  if (searchSection) {
    searchSection.classList.remove("hidden");
  }

  setActiveNavigation("search");

  if (searchInput) {
    searchInput.focus();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const section = link.dataset.section;

    if (section === "dashboard") {
      showDashboard();
    }

    if (section === "search") {
      showSearch();
    }
  });
});

if (dashboardSearchBtn) {
  dashboardSearchBtn.addEventListener("click", () => {
    showSearch();
  });
}

/*
======================================================
GET USER ID
======================================================
*/

function getUserId() {
  const params = new URLSearchParams(window.location.search);
  const urlUserId = params.get("userId");

  if (urlUserId) {
    localStorage.setItem("spotifyUserId", urlUserId);

    window.history.replaceState({}, document.title, window.location.pathname);

    return urlUserId;
  }

  return localStorage.getItem("spotifyUserId");
}

/*
======================================================
CHECK AUTHENTICATION
======================================================
*/

async function checkAuthentication() {
  currentUserId = getUserId();

  if (!currentUserId) {
    showLogin();
    return;
  }

  try {
    if (authStatus) {
      authStatus.textContent = "Checking authentication...";
    }

    showDashboardStatus("Loading your Spotify dashboard...", "loading");

    const response = await fetch(
      `${API_URL}/auth/status/${encodeURIComponent(currentUserId)}`,
      {
        method: "GET",
      },
    );

    const data = await response.json();

    if (response.ok && data.authenticated === true) {
      showApp(data.user);
      hideDashboardStatus();
      return;
    }

    localStorage.removeItem("spotifyUserId");
    currentUserId = null;

    hideDashboardStatus();

    showLogin("Your session has expired. Please log in again.");
  } catch (error) {
    console.error("Authentication check failed:", error);

    currentUserId = null;

    hideDashboardStatus();

    showLogin(
      "Unable to verify authentication. Make sure the server is running.",
    );
  }
}

/*
======================================================
SPOTIFY LOGIN
======================================================
*/

if (loginButton) {
  loginButton.addEventListener("click", () => {
    if (authStatus) {
      authStatus.textContent = "Redirecting to Spotify...";
    }

    window.location.href = `${API_URL}/login`;
  });
}

/*
======================================================
LOGOUT
======================================================
*/

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("spotifyUserId");

    currentUserId = null;

    if (displayName) {
      displayName.textContent = "Spotify User";
    }

    if (sidebarDisplayName) {
      sidebarDisplayName.textContent = "Spotify User";
    }

    if (profileDisplayName) {
      profileDisplayName.textContent = "Spotify User";
    }

    if (searchInput) {
      searchInput.value = "";
    }

    if (results) {
      results.innerHTML = `
        <p class="welcome-message">
          Search for music to get started.
        </p>
      `;
    }

    showDashboard();
    showLogin("You have been logged out.");
  });
}

/*
======================================================
SPOTIFY SEARCH
======================================================
*/

if (searchForm) {
  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const searchTerm = searchInput.value.trim();

    if (!searchTerm) {
      results.innerHTML = `
        <p class="welcome-message">
          Please enter an artist, song, or album.
        </p>
      `;

      return;
    }

    if (!currentUserId) {
      showLogin("Please log in with Spotify first.");
      return;
    }

    results.innerHTML = `
      <p class="welcome-message">
        Searching Spotify...
      </p>
    `;

    try {
      const response = await fetch(
        `${API_URL}/api/spotify/search/${encodeURIComponent(
          currentUserId,
        )}?q=${encodeURIComponent(searchTerm)}`,
      );

      const data = await response.json();

      if (!response.ok) {
        /*
        If authentication expired while searching,
        force the user back to the login screen.
        */

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("spotifyUserId");
          currentUserId = null;

          showLogin("Your Spotify session has expired. Please log in again.");

          return;
        }

        throw new Error(data.message || "Spotify search failed.");
      }

      const tracks = data.tracks?.items || [];

      if (tracks.length === 0) {
        results.innerHTML = `
          <p class="welcome-message">
            No songs found for "${escapeHTML(searchTerm)}".
          </p>
        `;

        return;
      }

      results.innerHTML = `
        <div class="track-grid">
          ${tracks
            .map((track) => {
              const image = track.album?.images?.[0]?.url || "";

              const artists =
                track.artists?.map((artist) => artist.name).join(", ") ||
                "Unknown Artist";

              const albumName = track.album?.name || "Unknown Album";

              const spotifyURL = track.external_urls?.spotify || "";

              return `
                <article class="track-card">
                  ${
                    image
                      ? `
                        <img
                          src="${escapeHTML(image)}"
                          alt="${escapeHTML(track.name)} album cover"
                          class="track-image"
                        />
                      `
                      : `
                        <div class="track-image-placeholder">
                          ♫
                        </div>
                      `
                  }

                  <div class="track-info">
                    <h3>${escapeHTML(track.name)}</h3>

                    <p>
                      <strong>Artist:</strong>
                      ${escapeHTML(artists)}
                    </p>

                    <p>
                      <strong>Album:</strong>
                      ${escapeHTML(albumName)}
                    </p>

                    ${
                      spotifyURL
                        ? `
                          <a
                            href="${escapeHTML(spotifyURL)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="spotify-link"
                          >
                            Open in Spotify
                          </a>
                        `
                        : ""
                    }
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    } catch (error) {
      console.error("Spotify search failed:", error);

      results.innerHTML = `
        <p class="welcome-message error-message">
          Unable to search Spotify:
          ${escapeHTML(error.message)}
        </p>
      `;
    }
  });
}

/*
======================================================
ESCAPE HTML
======================================================
*/

function escapeHTML(value) {
  const element = document.createElement("div");

  element.textContent = String(value ?? "");

  return element.innerHTML;
}

/*
======================================================
START APPLICATION
======================================================
*/

checkAuthentication();
