require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// Your public Render URL (NO trailing slash)
const BASE_URL = "https://crestedcritters-auth.onrender.com";

app.get("/", (req, res) => {
  res.status(200).send("Crested Critters OAuth Proxy is running");
});

// Decap opens /auth in a popup
app.get("/auth", (req, res) => {
  const scope = req.query.scope || "repo";
  const state = crypto.randomBytes(16).toString("hex");

  // MUST match the GitHub OAuth App callback URL exactly
  const redirectUri = `${BASE_URL}/auth/callback`;

  const url =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(url);
});

// GitHub redirects here
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
    if (!access_token) {
      console.error("No access_token returned:", response.data);
      return res.status(500).send("Failed to get access token");
    }

    // Decap expects this exact message format:
    // authorization:<provider>:success:<json payload>
    const payload = JSON.stringify({ token: access_token, provider: "github" });
    const msg = `authorization:github:success:${payload}`;

    // Return HTML that postMessages the token to the opener and closes the popup
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Authorizing…</title></head>
  <body>
    <script>
      (function () {
        var msg = ${JSON.stringify(msg)};
        try {
          if (window.opener && window.opener.postMessage) {
            window.opener.postMessage(msg, '*');
            setTimeout(function(){ window.close(); }, 200);
          } else {
            document.body.innerText = 'Authorized, but no opener window found.';
          }
        } catch (e) {
          document.body.innerText = 'Authorized, but failed to message opener.';
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
