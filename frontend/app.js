const API_URL = "http://127.0.0.1:3001";

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const authStatus = document.getElementById("authStatus");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const results = document.getElementById("results");

/*
=========================================
SHOW LOGIN SCREEN
=========================================
*/

function showLogin() {
  loginPage.classList.remove("hidden");
  appPage.classList.add("hidden");

  if (authStatus) {
    authStatus.textContent = "";
  }
}

/*
=========================================
SHOW MAIN APPLICATION
=========================================
*/

function showApp() {
  loginPage.classList.add("hidden");
  appPage.classList.remove("hidden");
}

/*
=========================================
CHECK AUTHENTICATION STATUS
=========================================
*/

async function checkAuthentication() {
  try {
    if (authStatus) {
      authStatus.textContent = "Checking authentication...";
    }

    const response = await fetch(`${API_URL}/auth/status`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      showLogin();
      return;
    }

    const data = await response.json();

    if (data.authenticated === true) {
      showApp();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error("Authentication check failed:", error);

    if (authStatus) {
      authStatus.textContent =
        "Unable to verify authentication. Please log in with Spotify.";
    }

    showLogin();
  }
}

/*
=========================================
SPOTIFY LOGIN
=========================================
*/

if (loginButton) {
  loginButton.addEventListener("click", () => {
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
    showLogin();
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

    results.innerHTML = `
      <div class="track-grid">
        <article class="track-card">
          <h3>Search: ${escapeHTML(searchTerm)}</h3>
          <p>Your Spotify search is ready to be connected to the API.</p>
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
