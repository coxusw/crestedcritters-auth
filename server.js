require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

// Health check route (helps confirm the service is up)
app.get("/", (req, res) => {
  res.send("Crested Critters OAuth Proxy is running");
});

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn("Missing CLIENT_ID or CLIENT_SECRET env vars.");
}

// Start GitHub OAuth flow
// Decap may call this with extra query params; we can ignore them safely.
app.get("/auth", (req, res) => {
  const redirect = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`;
  res.redirect(redirect);
});

// GitHub OAuth callback
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("No code provided");
  }

  try {
    // Exchange the code for an access token
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const access_token = response.data.access_token;

    if (!access_token) {
      console.error("No access_token returned:", response.data);
      return res.status(500).send("Failed to get access token");
    }

    // IMPORTANT:
    // Decap expects the token in the hash like: #access_token=...
    // NOT: #/access_token=...
    res.redirect(
      `https://coxusw.github.io/CrestedCritters/admin/#access_token=${access_token}`
    );
  } catch (error) {
    console.error("Auth callback error:", error?.response?.data || error);
    res.status(500).send("Authentication failed");
  }
});

// Listen on the port Render provides
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`OAuth proxy running on port ${PORT}`);
});
