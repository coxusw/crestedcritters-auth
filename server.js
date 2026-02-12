require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// IMPORTANT: This must match your GitHub Pages origin (no repo path)
const SITE_ORIGIN = "https://coxusw.github.io";

// Health check
app.get("/", (req, res) => {
  res.send("Crested Critters OAuth Proxy is running");
});

// Start OAuth (Decap opens this in a popup)
app.get("/auth", (req, res) => {
  const scope = req.query.scope || "repo";
  const state = crypto.randomBytes(16).toString("hex");

  const redirectUri = `${req.protocol}://${req.get("host")}/auth/callback`;

  const url =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(url);
});

// OAuth callback from GitHub
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("No code provided");
  }

  try {
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const access_token = response.data.access_token;

    if (!access_token) {
      console.error("No access_token returned:", response.data);
      return res.status(500).send("Failed to get access token");
    }

    // IMPORTANT: Send token to opener window using the format Decap expects
    const payload = JSON.stringify({ token: access_token, provider: "github" });

    // Return an HTML page that posts the token back to the opener and closes itself
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
          // Fallback: if no opener, show token (rare) so you can debug
          document.body.innerText = 'No opener window found. Token acquired.';
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
app.listen(PORT, () => {
  console.log(`OAuth proxy running on port ${PORT}`);
});
