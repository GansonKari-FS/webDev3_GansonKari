const API_URL = "http://127.0.0.1:3001";

/*
=========================================
PAGE ELEMENTS
=========================================
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
=========================================
CURRENT USER
=========================================
*/

let currentUserId = null;

/*
=========================================
SHOW LOGIN SCREEN
=========================================
*/

function showLogin(message = "") {
  loginPage.classList.remove("hidden");
  appPage.classList.add("hidden");

  if (authStatus) {
    authStatus.textContent = message;
  }
}

/*
=========================================
SHOW MAIN APPLICATION
=========================================
*/

function showApp(user) {
  loginPage.classList.add("hidden");
  appPage.classList.remove("hidden");

  if (displayName && user && user.displayName) {
    displayName.textContent = user.displayName;
  }
}

/*
=========================================
GET USER ID
=========================================
*/

function getUserId() {
  /*
  First check the URL.

  After Spotify authentication,
  server.js redirects back to:

  /frontend/?userId=1
  */

  const params = new URLSearchParams(window.location.search);

  const urlUserId = params.get("userId");

  if (urlUserId) {
    localStorage.setItem("spotifyUserId", urlUserId);

    /*
    Remove ?userId=1 from the address
    after saving it.
    */

    window.history.replaceState({}, document.title, window.location.pathname);

    return urlUserId;
  }

  /*
  If there is no ID in the URL,
  check localStorage.
  */

  return localStorage.getItem("spotifyUserId");
}

/*
=========================================
CHECK AUTHENTICATION
=========================================
*/

async function checkAuthentication() {
  currentUserId = getUserId();

  /*
  No saved user means the visitor
  has not logged in yet.
  */

  if (!currentUserId) {
    showLogin();
    return;
  }

  try {
    if (authStatus) {
      authStatus.textContent = "Checking authentication...";
    }

    const response = await fetch(`${API_URL}/auth/status/${currentUserId}`, {
      method: "GET",
    });

    const data = await response.json();

    if (response.ok && data.authenticated === true) {
      showApp(data.user);
      return;
    }

    /*
    JWT is missing, invalid, or expired.
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
=========================================
SPOTIFY LOGIN
=========================================
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
=========================================
LOGOUT
=========================================
*/

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("spotifyUserId");

    currentUserId = null;

    if (displayName) {
      displayName.textContent = "Spotify User";
    }

    showLogin("You have been logged out.");
  });
}

/*
=========================================
SEARCH
=========================================
*/

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
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

    /*
      The actual Spotify search API
      will be connected in the next
      application feature.
      */

    results.innerHTML = `
        <div class="track-grid">

          <article class="track-card">

            <h3>
              Search:
              ${escapeHTML(searchTerm)}
            </h3>

            <p>
              Your Spotify search is ready
              to be connected to the API.
            </p>

          </article>

        </div>
      `;
  });
}

/*
=========================================
BASIC HTML ESCAPING
=========================================
*/

function escapeHTML(value) {
  const element = document.createElement("div");

  element.textContent = value;

  return element.innerHTML;
}

/*
=========================================
START APPLICATION
=========================================
*/

checkAuthentication();
