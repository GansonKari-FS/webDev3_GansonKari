const express = require("express");

const app = express();
const PORT = 3001;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Spotify Music Search API is running!",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
