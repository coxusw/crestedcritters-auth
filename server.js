require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// IMPORTANT: Your public Render URL (no trailing slash)
const BASE_URL = "https://crestedcritters-auth.onrender.com";

// IMPORTANT: Your GitHub Pages origin (no repo path)
const SITE_ORIGIN = "https://coxusw.github.io";

app.get("/", (req, res) => {
  res.send("Crested Critters OAuth Proxy is running");
});

app.get("/auth", (req, res) => {
  const scope = req.query.scope || "repo";
  const state = crypto.randomBytes(16).toString("hex");

  // Force the redirect URI to match what’s in your GitHub OAuth App
  const redirectUri = `${BASE_URL}/auth/callback`;

  const url =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
      { headers: { Accept: "application/json" } }
    );

    const access_token = response.data.access_token;
    if (!access_token) return res.status(500).send("Failed to get access token");

    const payload = JSON.stringify({ token: access_token, provider: "github" });

    res.setHeader("Content-Type", "text/html");
    res.send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Authorizing…</title></head>
  <body>
    <script>
      (function () {
        var msg = 'authorization:github:success:${payload.replace(/'/g, "\\'")}';
        if (window.opener) {
          window.opener.postMessage(msg, '${SITE_ORIGIN}');
          window.close();
        } else {
          document.body.innerText = 'Authorized, but no opener window found.';
        }
      })();
    </script>
  </body>
</html>`);
  } catch (err) {
    console.error("Auth callback error:", err?.response?.data || err);
    res.status(500).send("Authentication failed");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`OAuth proxy running on port ${PORT}`));
