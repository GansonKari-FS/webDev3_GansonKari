const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const results = document.getElementById("results");

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
    <div class="track-card">
      <h3>Search: ${searchTerm}</h3>
      <p>Your Spotify search is ready to be connected to the API.</p>
    </div>
  `;
});
