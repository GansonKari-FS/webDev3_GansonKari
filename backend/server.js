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

/*
======================================================
MIDDLEWARE
======================================================
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow frontend running through VS Code Live Server
app.use((req, res, next) => {
  const allowedOrigins = ["http://127.0.0.1:5500", "http://localhost:5500"];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/*
======================================================
HOME ROUTE
======================================================
*/

app.get("/", (req, res) => {
  res.json({
    message: "Spotify Music Search API is running!",
  });
});

/*
======================================================
SPOTIFY AUTHENTICATION ROUTES
======================================================
*/

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

/*
======================================================
SPOTIFY CALLBACK
======================================================
*/

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
    /*
    --------------------------------------------------
    CREATE BASIC AUTHORIZATION HEADER
    --------------------------------------------------
    */

    const authHeader = Buffer.from(
      `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
    ).toString("base64");

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    });

    /*
    --------------------------------------------------
    EXCHANGE AUTHORIZATION CODE FOR SPOTIFY TOKENS
    --------------------------------------------------
    */

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

    /*
    --------------------------------------------------
    GET SPOTIFY USER PROFILE
    --------------------------------------------------
    */

    const profileResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const spotifyUser = profileResponse.data;

    /*
    --------------------------------------------------
    CALCULATE ACCESS TOKEN EXPIRATION
    --------------------------------------------------
    */

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    /*
    --------------------------------------------------
    FIND EXISTING USER
    --------------------------------------------------
    */

    let user = await User.findOne({
      where: {
        spotifyId: spotifyUser.id,
      },
    });

    /*
    --------------------------------------------------
    CREATE OR UPDATE USER
    --------------------------------------------------
    */

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
      await user.update({
        displayName: spotifyUser.display_name || user.displayName,

        email: spotifyUser.email || user.email,

        accessToken: accessToken,

        refreshToken: refreshToken || user.refreshToken,

        tokenExpiresAt: tokenExpiresAt,
      });
    }

    /*
    --------------------------------------------------
    CREATE APPLICATION JWT
    --------------------------------------------------
    */

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

    /*
    --------------------------------------------------
    SAVE APPLICATION JWT
    --------------------------------------------------
    */

    await user.update({
      jwtToken: appJwt,
    });

    /*
    --------------------------------------------------
    SUCCESSFUL LOGIN
    REDIRECT BACK TO FRONTEND
    --------------------------------------------------
    */

    console.log(`Spotify authentication successful for user ${user.id}`);

    return res.redirect(
      `http://127.0.0.1:5500/frontend/?userId=${encodeURIComponent(user.id)}`,
    );
  } catch (error) {
    console.error(
      "Spotify authentication error:",
      error.response?.data || error.message,
    );

    return res.status(500).json({
      message: "Spotify authentication failed.",
      error: error.response?.data || error.message,
    });
  }
});

/*
======================================================
SPOTIFY TOKEN REFRESH
======================================================
*/

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

/*
======================================================
GET VALID SPOTIFY ACCESS TOKEN
======================================================
*/

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

/*
======================================================
USER CRUD ROUTES
======================================================
*/

/*
------------------------------------------------------
CREATE USER
------------------------------------------------------
*/

app.post("/users", async (req, res) => {
  try {
    const user = await User.create(req.body);

    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

/*
------------------------------------------------------
READ ALL USERS
------------------------------------------------------
*/

app.get("/users", async (req, res) => {
  try {
    const users = await User.findAll();

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

/*
------------------------------------------------------
READ ONE USER
------------------------------------------------------
*/

app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

/*
------------------------------------------------------
UPDATE USER
------------------------------------------------------
*/

app.put("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await user.update(req.body);

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

/*
------------------------------------------------------
DELETE USER
------------------------------------------------------
*/

app.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await user.destroy();

    return res.status(200).json({
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("Delete user error:", error.message);

    return res.status(500).json({
      message: "Unable to delete user.",
      error: error.message,
    });
  }
});

/*
======================================================
CUSTOM SPOTIFY API ROUTES
======================================================
*/

/*
------------------------------------------------------
GET SPOTIFY PROFILE FOR SAVED USER
------------------------------------------------------
*/

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

    return res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Spotify profile error:",
      error.response?.data || error.message,
    );

    return res.status(error.response?.status || 500).json({
      message: "Unable to retrieve Spotify profile.",

      error: error.response?.data || error.message,
    });
  }
});

/*
------------------------------------------------------
GET USER'S TOP SPOTIFY TRACKS
------------------------------------------------------
*/

app.get("/api/spotify/top-tracks/:userId", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "Spotify user not found.",
      });
    }

    const accessToken = await getValidSpotifyAccessToken(user);

    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    /*
      Spotify supports three time ranges:
      medium_term
      short_term
      long_term

      Try each one before deciding that
      Spotify has no Top Tracks data.
      */

    const timeRanges = ["medium_term", "short_term", "long_term"];

    for (const timeRange of timeRanges) {
      const response = await axios.get(
        "https://api.spotify.com/v1/me/top/tracks",
        {
          headers: headers,

          params: {
            limit: 10,
            time_range: timeRange,
          },
        },
      );

      if (
        Array.isArray(response.data?.items) &&
        response.data.items.length > 0
      ) {
        console.log(`Top Tracks loaded from Spotify using ${timeRange}.`);

        return res.status(200).json({
          ...response.data,
          source: "spotify_top_tracks",
          timeRange: timeRange,
        });
      }
    }

    /*
      FALLBACK

      If Spotify has not generated
      personalized Top Tracks yet,
      use actual Recently Played data.

      We count repeated songs and
      return the most frequently played
      recent tracks.
      */

    console.log(
      "Spotify returned no Top Tracks. Trying Recently Played fallback...",
    );

    const recentResponse = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played",
      {
        headers: headers,

        params: {
          limit: 50,
        },
      },
    );

    const recentItems = Array.isArray(recentResponse.data?.items)
      ? recentResponse.data.items
      : [];

    const trackCounts = new Map();

    for (const item of recentItems) {
      const track = item?.track;

      if (!track?.id) {
        continue;
      }

      const existing = trackCounts.get(track.id);

      if (existing) {
        existing.count += 1;
      } else {
        trackCounts.set(track.id, {
          track: track,
          count: 1,
        });
      }
    }

    const fallbackTracks = Array.from(trackCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((entry) => entry.track);

    console.log(
      `Top Tracks fallback returned ${fallbackTracks.length} track(s).`,
    );

    return res.status(200).json({
      items: fallbackTracks,
      total: fallbackTracks.length,
      limit: 10,
      offset: 0,
      next: null,
      previous: null,
      href: null,
      source: "recently_played_fallback",
      timeRange: null,
    });
  } catch (error) {
    console.error(
      "Spotify top tracks error:",
      error.response?.data || error.message,
    );

    return res.status(error.response?.status || 500).json({
      message: "Unable to retrieve top Spotify tracks.",

      error: error.response?.data || error.message,
    });
  }
});

/*
------------------------------------------------------
GET USER'S RECENTLY PLAYED SPOTIFY TRACKS
------------------------------------------------------
*/

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

    return res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Spotify recently played error:",
      error.response?.data || error.message,
    );

    return res.status(error.response?.status || 500).json({
      message: "Unable to retrieve recently played Spotify tracks.",

      error: error.response?.data || error.message,
    });
  }
});

/*
------------------------------------------------------
SEARCH SPOTIFY
------------------------------------------------------
*/

app.get("/api/spotify/search/:userId", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "Spotify user not found.",
      });
    }

    const searchTerm = req.query.q;

    if (!searchTerm || !searchTerm.trim()) {
      return res.status(400).json({
        message: "Please enter something to search for.",
      });
    }

    const accessToken = await getValidSpotifyAccessToken(user);

    const response = await axios.get("https://api.spotify.com/v1/search", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },

      params: {
        q: searchTerm.trim(),
        type: "track,artist,album",
        limit: 10,
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Spotify search error:",
      error.response?.data || error.message,
    );

    return res.status(error.response?.status || 500).json({
      message: "Unable to search Spotify.",

      error: error.response?.data || error.message,
    });
  }
});

/*
======================================================
JWT AUTHENTICATION STATUS VALIDATION
======================================================
*/

/*
------------------------------------------------------
SHARED AUTH STATUS FUNCTION

This lets the frontend use either:

/auth/status/1

OR

/auth/status?userId=1
------------------------------------------------------
*/

const checkAuthenticationStatus = async (userId, res) => {
  try {
    if (!userId) {
      return res.status(400).json({
        authenticated: false,
        message: "User ID was not provided.",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        authenticated: false,
        message: "User not found.",
      });
    }

    if (!user.jwtToken) {
      return res.status(401).json({
        authenticated: false,
        message: "No JWT token found for this user.",
      });
    }

    try {
      const decoded = jwt.verify(user.jwtToken, JWT_SECRET);

      return res.status(200).json({
        authenticated: true,
        message: "JWT is valid.",

        user: {
          id: user.id,
          spotifyId: user.spotifyId,
          displayName: user.displayName,
          email: user.email,
        },

        token: {
          issuedAt: decoded.iat,
          expiresAt: decoded.exp,
        },
      });
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          authenticated: false,
          message: "JWT has expired.",
        });
      }

      return res.status(401).json({
        authenticated: false,
        message: "JWT is invalid.",
      });
    }
  } catch (error) {
    console.error("JWT status validation error:", error.message);

    return res.status(500).json({
      authenticated: false,
      message: "Unable to validate JWT authentication status.",
      error: error.message,
    });
  }
};

/*
------------------------------------------------------
AUTH STATUS USING URL PARAMETER

Example:
/auth/status/1
------------------------------------------------------
*/

app.get("/auth/status/:userId", async (req, res) => {
  return checkAuthenticationStatus(req.params.userId, res);
});

/*
------------------------------------------------------
AUTH STATUS USING QUERY PARAMETER

Example:
/auth/status?userId=1
------------------------------------------------------
*/

app.get("/auth/status", async (req, res) => {
  return checkAuthenticationStatus(req.query.userId, res);
});

/*
======================================================
404 ROUTE
======================================================
*/

app.use((req, res) => {
  return res.status(404).json({
    message: "Route not found.",
  });
});

/*
======================================================
START SERVER
======================================================
*/

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
