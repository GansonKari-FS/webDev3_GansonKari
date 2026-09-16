require("dotenv").config();

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const sequelize = require("./database/database");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3001;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// Temporary storage for OAuth state values
const oauthStates = new Set();

app.use(express.json());

// ======================================================
// HOME ROUTE
// ======================================================

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

  const scope = [
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-read-recently-played",
  ].join(" ");

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

// STEP 2: Spotify callback route
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

    // Exchange authorization code for Spotify tokens
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

    // Get Spotify user profile
    const profileResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const spotifyUser = profileResponse.data;

    // Calculate Spotify access token expiration time
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Find existing user by Spotify ID
    let user = await User.findOne({
      where: {
        spotifyId: spotifyUser.id,
      },
    });

    // Create user if they do not exist
    if (!user) {
      user = await User.create({
        spotifyId: spotifyUser.id,
        displayName: spotifyUser.display_name || "Spotify User",
        email: spotifyUser.email || null,
        accessToken: accessToken,
        refreshToken: refreshToken || null,
        tokenExpiresAt: tokenExpiresAt,
      });
    } else {
      // Update existing Spotify authentication data
      await user.update({
        displayName: spotifyUser.display_name || user.displayName,
        email: spotifyUser.email || user.email,
        accessToken: accessToken,
        refreshToken: refreshToken || user.refreshToken,
        tokenExpiresAt: tokenExpiresAt,
      });
    }

    // Create application JWT
    const appJwt = jwt.sign(
      {
        userId: user.id,
        spotifyId: user.spotifyId,
      },
      JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    // Save application JWT in database
    await user.update({
      jwtToken: appJwt,
    });

    res.status(200).json({
      message: "Spotify authentication successful!",
      user: {
        id: user.id,
        spotifyId: user.spotifyId,
        displayName: user.displayName,
        email: user.email,
      },
      jwtCreated: true,
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
// SPOTIFY TOKEN REFRESH
// ======================================================

// Refresh a user's Spotify access token
const refreshSpotifyToken = async (user) => {
  if (!user.refreshToken) {
    throw new Error("No Spotify refresh token is available for this user.");
  }

  const authHeader = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const tokenBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: user.refreshToken,
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

  const newAccessToken = tokenResponse.data.access_token;

  const expiresIn = tokenResponse.data.expires_in;

  const newExpirationTime = new Date(Date.now() + expiresIn * 1000);

  // Spotify may or may not send a new refresh token
  const newRefreshToken = tokenResponse.data.refresh_token || user.refreshToken;

  await user.update({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    tokenExpiresAt: newExpirationTime,
  });

  console.log(`Spotify access token refreshed for user ${user.id}`);

  return newAccessToken;
};

// Check whether a user's Spotify access token needs refreshing
const getValidSpotifyAccessToken = async (user) => {
  if (!user.accessToken) {
    throw new Error("No Spotify access token is available for this user.");
  }

  if (!user.tokenExpiresAt) {
    return user.accessToken;
  }

  const expirationTime = new Date(user.tokenExpiresAt).getTime();

  const currentTime = Date.now();

  // Refresh slightly before expiration
  const refreshBuffer = 60 * 1000;

  if (currentTime >= expirationTime - refreshBuffer) {
    console.log(
      `Spotify access token expired or is about to expire for user ${user.id}.`,
    );

    return await refreshSpotifyToken(user);
  }

  return user.accessToken;
};

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
// CUSTOM SPOTIFY API ROUTES
// ======================================================

// GET Spotify profile for a saved user
app.get("/api/spotify/profile/:userId", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "Spotify user not found.",
      });
    }

    const accessToken = await getValidSpotifyAccessToken(user);

    const response = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Spotify profile error:",
      error.response?.data || error.message,
    );

    res.status(error.response?.status || 500).json({
      message: "Unable to retrieve Spotify profile.",
      error: error.response?.data || error.message,
    });
  }
});

// GET user's top Spotify tracks
app.get("/api/spotify/top-tracks/:userId", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "Spotify user not found.",
      });
    }

    const accessToken = await getValidSpotifyAccessToken(user);

    const response = await axios.get(
      "https://api.spotify.com/v1/me/top/tracks",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          limit: 10,
          time_range: "medium_term",
        },
      },
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Spotify top tracks error:",
      error.response?.data || error.message,
    );

    res.status(error.response?.status || 500).json({
      message: "Unable to retrieve top Spotify tracks.",
      error: error.response?.data || error.message,
    });
  }
});

// GET user's recently played Spotify tracks
app.get("/api/spotify/recently-played/:userId", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "Spotify user not found.",
      });
    }

    const accessToken = await getValidSpotifyAccessToken(user);

    const response = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          limit: 10,
        },
      },
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Spotify recently played error:",
      error.response?.data || error.message,
    );

    res.status(error.response?.status || 500).json({
      message: "Unable to retrieve recently played Spotify tracks.",
      error: error.response?.data || error.message,
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

    await sequelize.sync({
      alter: true,
    });

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
