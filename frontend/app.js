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
const topTracksSection = document.getElementById("topTracksSection");
const recentlyPlayedSection = document.getElementById("recentlyPlayedSection");

const dashboardSearchBtn = document.getElementById("dashboardSearchBtn");

const topTracksStatus = document.getElementById("topTracksStatus");
const topTracksResults = document.getElementById("topTracksResults");

const recentlyPlayedStatus = document.getElementById("recentlyPlayedStatus");

const recentlyPlayedResults = document.getElementById("recentlyPlayedResults");

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
LOGIN SCREEN
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
MAIN APPLICATION
======================================================
*/

function showApp(user) {
  if (loginPage) {
    loginPage.classList.add("hidden");
  }

  if (appPage) {
    appPage.classList.remove("hidden");
  }

  const userName =
    user?.displayName || user?.display_name || user?.name || "Spotify User";

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
NAVIGATION
======================================================
*/

function setActiveNavigation(sectionName) {
  navLinks.forEach((link) => {
    const isActive = link.dataset.section === sectionName;

    link.classList.toggle("active", isActive);
  });
}

function hideAllSections() {
  if (dashboardSection) {
    dashboardSection.classList.add("hidden");
  }

  if (searchSection) {
    searchSection.classList.add("hidden");
  }

  if (topTracksSection) {
    topTracksSection.classList.add("hidden");
  }

  if (recentlyPlayedSection) {
    recentlyPlayedSection.classList.add("hidden");
  }
}

/*
======================================================
SHOW DASHBOARD
======================================================
*/

function showDashboard() {
  hideAllSections();

  if (dashboardSection) {
    dashboardSection.classList.remove("hidden");
  }

  setActiveNavigation("dashboard");

  hideDashboardStatus();
}

/*
======================================================
SHOW SEARCH
======================================================
*/

function showSearch() {
  hideAllSections();

  if (searchSection) {
    searchSection.classList.remove("hidden");
  }

  setActiveNavigation("search");

  hideDashboardStatus();

  if (searchInput) {
    searchInput.focus();
  }
}

/*
======================================================
SHOW TOP TRACKS
======================================================
*/

function showTopTracks() {
  hideAllSections();

  if (topTracksSection) {
    topTracksSection.classList.remove("hidden");
  }

  setActiveNavigation("topTracks");

  hideDashboardStatus();

  loadTopTracks();
}

/*
======================================================
SHOW RECENTLY PLAYED
======================================================
*/

function showRecentlyPlayed() {
  hideAllSections();

  if (recentlyPlayedSection) {
    recentlyPlayedSection.classList.remove("hidden");
  }

  setActiveNavigation("recentlyPlayed");

  hideDashboardStatus();

  loadRecentlyPlayed();
}

/*
======================================================
SIDEBAR NAVIGATION
======================================================
*/

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const section = link.dataset.section;

    if (section === "dashboard") {
      showDashboard();
      return;
    }

    if (section === "search") {
      showSearch();
      return;
    }

    if (section === "topTracks") {
      showTopTracks();
      return;
    }

    if (section === "recentlyPlayed") {
      showRecentlyPlayed();
    }
  });
});

/*
======================================================
DASHBOARD SEARCH BUTTON
======================================================
*/

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

  /*
  If Spotify redirected back with a userId,
  save it so the user remains logged in.
  */

  if (urlUserId) {
    localStorage.setItem("spotifyUserId", urlUserId);

    window.history.replaceState({}, document.title, window.location.pathname);

    return urlUserId;
  }

  /*
  Otherwise use the saved userId.
  */

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

    const response = await fetch(
      `${API_URL}/auth/status/${encodeURIComponent(currentUserId)}`,
      {
        method: "GET",
      },
    );

    const data = await response.json();

    if (response.ok && data.authenticated === true) {
      showApp(data.user);

      return;
    }

    localStorage.removeItem("spotifyUserId");

    currentUserId = null;

    showLogin("Your session has expired. Please log in again.");
  } catch (error) {
    console.error("Authentication check failed:", error);

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

    if (topTracksResults) {
      topTracksResults.innerHTML = `
        <p class="welcome-message">
          Select Top Tracks to load your favorite music.
        </p>
      `;
    }

    if (recentlyPlayedResults) {
      recentlyPlayedResults.innerHTML = `
        <p class="welcome-message">
          Select Recently Played to load your listening history.
        </p>
      `;
    }

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
      results.innerHTML = `
        <p class="welcome-message">
          Please log in with Spotify first.
        </p>
      `;

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

      results.innerHTML = buildTrackGrid(tracks);
    } catch (error) {
      console.error("Spotify search failed:", error);

      results.innerHTML = `
        <p class="welcome-message">
          Unable to search Spotify:
          ${escapeHTML(error.message)}
        </p>
      `;
    }
  });
}

/*
======================================================
LOAD TOP TRACKS
======================================================
*/

async function loadTopTracks() {
  if (!topTracksResults) {
    return;
  }

  if (!currentUserId) {
    topTracksResults.innerHTML = `
      <p class="welcome-message">
        Please log in with Spotify first.
      </p>
    `;

    return;
  }

  if (topTracksStatus) {
    topTracksStatus.textContent = "Loading your top tracks...";

    topTracksStatus.className = "feature-status";
  }

  topTracksResults.innerHTML = `
    <p class="welcome-message">
      Loading your top tracks...
    </p>
  `;

  try {
    const response = await fetch(
      `${API_URL}/api/spotify/top-tracks/${encodeURIComponent(currentUserId)}`,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load your top tracks.");
    }

    /*
    Support either:
    { items: [...] }

    or:

    { tracks: { items: [...] } }

    or:

    { tracks: [...] }
    */

    const tracks = data.items || data.tracks?.items || data.tracks || [];

    if (topTracksStatus) {
      topTracksStatus.textContent = "";

      topTracksStatus.className = "feature-status hidden";
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      topTracksResults.innerHTML = `
        <p class="welcome-message">
          No top tracks are available for this Spotify account yet.
        </p>
      `;

      return;
    }

    topTracksResults.innerHTML = buildTrackGrid(tracks);
  } catch (error) {
    console.error("Top tracks request failed:", error);

    if (topTracksStatus) {
      topTracksStatus.textContent = "";

      topTracksStatus.className = "feature-status hidden";
    }

    topTracksResults.innerHTML = `
      <p class="welcome-message">
        Unable to load Top Tracks:
        ${escapeHTML(error.message)}
      </p>
    `;
  }
}

/*
======================================================
LOAD RECENTLY PLAYED
======================================================
*/

async function loadRecentlyPlayed() {
  if (!recentlyPlayedResults) {
    return;
  }

  if (!currentUserId) {
    recentlyPlayedResults.innerHTML = `
      <p class="welcome-message">
        Please log in with Spotify first.
      </p>
    `;

    return;
  }

  if (recentlyPlayedStatus) {
    recentlyPlayedStatus.textContent = "Loading recently played tracks...";

    recentlyPlayedStatus.className = "feature-status";
  }

  recentlyPlayedResults.innerHTML = `
    <p class="welcome-message">
      Loading your recently played tracks...
    </p>
  `;

  try {
    const response = await fetch(
      `${API_URL}/api/spotify/recently-played/${encodeURIComponent(
        currentUserId,
      )}`,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load recently played tracks.");
    }

    /*
    Spotify's recently-played endpoint normally returns:

    {
      items: [
        {
          track: {...},
          played_at: "..."
        }
      ]
    }

    Convert those objects into regular track objects so the
    same reusable card component can display them.
    */

    const rawItems = data.items || data.tracks?.items || data.tracks || [];

    const tracks = Array.isArray(rawItems)
      ? rawItems.map((item) => item.track || item).filter(Boolean)
      : [];

    if (recentlyPlayedStatus) {
      recentlyPlayedStatus.textContent = "";

      recentlyPlayedStatus.className = "feature-status hidden";
    }

    if (tracks.length === 0) {
      recentlyPlayedResults.innerHTML = `
        <p class="welcome-message">
          No recently played tracks are available yet.
        </p>
      `;

      return;
    }

    recentlyPlayedResults.innerHTML = buildTrackGrid(tracks);
  } catch (error) {
    console.error("Recently played request failed:", error);

    if (recentlyPlayedStatus) {
      recentlyPlayedStatus.textContent = "";

      recentlyPlayedStatus.className = "feature-status hidden";
    }

    recentlyPlayedResults.innerHTML = `
      <p class="welcome-message">
        Unable to load Recently Played:
        ${escapeHTML(error.message)}
      </p>
    `;
  }
}

/*
======================================================
REUSABLE TRACK GRID
======================================================
*/

function buildTrackGrid(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return `
      <p class="welcome-message">
        No tracks are available.
      </p>
    `;
  }

  return `
    <div class="track-grid">

      ${tracks
        .map((track) => {
          const trackName = track?.name || "Unknown Track";

          const image = track?.album?.images?.[0]?.url || "";

          const artists =
            track?.artists?.map((artist) => artist.name).join(", ") ||
            "Unknown Artist";

          const albumName = track?.album?.name || "Unknown Album";

          const spotifyURL = track?.external_urls?.spotify || "";

          return `
            <article class="track-card">

              ${
                image
                  ? `
                    <img
                      src="${escapeHTML(image)}"
                      alt="${escapeHTML(trackName)} album cover"
                      class="track-image"
                    />
                  `
                  : `
                    <div class="track-image track-image-placeholder">
                      ♫
                    </div>
                  `
              }

              <div class="track-info">

                <h3>
                  ${escapeHTML(trackName)}
                </h3>

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
