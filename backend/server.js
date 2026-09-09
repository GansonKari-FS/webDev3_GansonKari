require("dotenv").config();

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const sequelize = require("./database/database");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3001;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// Temporary storage for OAuth state values.
// This helps protect the Spotify login flow.
const oauthStates = new Set();

app.use(express.json());

// HOME ROUTE
app.get("/", (req, res) => {
  res.json({
    message: "Spotify Music Search API is running!",
  });
});

// ======================================================
// SPOTIFY AUTHENTICATION ROUTES
// ======================================================

// STEP 1: Redirect user to Spotify login
app.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  oauthStates.add(state);

  const scope = ["user-read-private", "user-read-email"].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: state,
  });

  const spotifyAuthorizationUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

  res.redirect(spotifyAuthorizationUrl);
});

// STEP 2: Spotify sends user back here
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;

  if (error) {
    return res.status(400).json({
      message: "Spotify authorization failed",
      error: error,
    });
  }

  if (!code) {
    return res.status(400).json({
      message: "Authorization code was not provided.",
    });
  }

  if (!state || !oauthStates.has(state)) {
    return res.status(400).json({
      message: "Invalid OAuth state.",
    });
  }

  oauthStates.delete(state);

  try {
    const authHeader = Buffer.from(
      `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
    ).toString("base64");

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    });

    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      tokenBody.toString(),
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;
    const expiresIn = tokenResponse.data.expires_in;

    // Get the authenticated Spotify user's profile
    const profileResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const spotifyUser = profileResponse.data;

    // For Issue #15 we confirm OAuth works.
    // In Issue #16 we will store authentication/JWT data
    // in the database instead of returning sensitive tokens.

    res.status(200).json({
      message: "Spotify authentication successful!",
      user: {
        spotifyId: spotifyUser.id,
        displayName: spotifyUser.display_name,
        email: spotifyUser.email,
      },
      tokenInfo: {
        expiresIn: expiresIn,
        refreshTokenReceived: Boolean(refreshToken),
      },
    });
  } catch (error) {
    console.error(
      "Spotify authentication error:",
      error.response?.data || error.message,
    );

    res.status(500).json({
      message: "Spotify authentication failed.",
      error: error.response?.data || error.message,
    });
  }
});

// ======================================================
// USER CRUD ROUTES
// ======================================================

// CREATE a user
app.post("/users", async (req, res) => {
  try {
    const user = await User.create(req.body);

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// READ all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.findAll();

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// READ one user
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// UPDATE a user
app.put("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await user.update(req.body);

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// DELETE a user
app.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await user.destroy();

    res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection successful!");

    await sequelize.sync();
    console.log("Database synchronized!");

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Spotify login available at http://127.0.0.1:${PORT}/login`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
  }
};

startServer();
