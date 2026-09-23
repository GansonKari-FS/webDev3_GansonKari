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

  if (displayName && user && user.displayName) {
    displayName.textContent = user.displayName;
  }
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
  If Spotify redirected us back with a userId,
  save it so the user stays logged in after refresh.
  */

  if (urlUserId) {
    localStorage.setItem("spotifyUserId", urlUserId);

    /*
    Remove ?userId=1 from the browser address
    after we have saved it.
    */

    window.history.replaceState({}, document.title, window.location.pathname);

    return urlUserId;
  }

  /*
  Otherwise use the userId that was already saved.
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

  /*
  If there is no userId yet, the user needs
  to log in with Spotify.
  */

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

    /*
    If the JWT is missing, invalid, or expired,
    remove the saved user and return to login.
    */

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

    /*
      Make sure something was entered.
      */

    if (!searchTerm) {
      results.innerHTML = `
          <p class="welcome-message">
            Please enter an artist, song, or album.
          </p>
        `;

      return;
    }

    /*
      Make sure the user is logged in.
      */

    if (!currentUserId) {
      results.innerHTML = `
          <p class="welcome-message">
            Please log in with Spotify first.
          </p>
        `;

      return;
    }

    /*
      Display loading message while waiting
      for Spotify to return results.
      */

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

      /*
        Get the track results returned by Spotify.
        */

      const tracks = data.tracks?.items || [];

      if (tracks.length === 0) {
        results.innerHTML = `
            <p class="welcome-message">
              No songs found for
              "${escapeHTML(searchTerm)}".
            </p>
          `;

        return;
      }

      /*
        Build the search result cards.
        */

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
                        : ""
                    }

                    <div class="track-info">

                      <h3>
                        ${escapeHTML(track.name)}
                      </h3>

                      <p>
                        <strong>
                          Artist:
                        </strong>
                        ${escapeHTML(artists)}
                      </p>

                      <p>
                        <strong>
                          Album:
                        </strong>
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
