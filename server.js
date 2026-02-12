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

// Decap opens this in a popup
app.get("/auth", (req, res) => {
  const scope = req.query.scope || "repo";
  const state = crypto.randomBytes(16).toString("hex");
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

    // Important: include provider inside JSON (many Decap/NetlifyCMS examples do)
    const postMsgContent = { token: access_token, provider: "github" };
    const successMsg = `authorization:github:success:${JSON.stringify(
      postMsgContent
    )}`;

    // Handshake pattern:
    // 1) Popup tells opener "authorizing:github"
    // 2) Opener responds (popup receives event with correct origin)
    // 3) Popup sends success message back to opener using e.origin as targetOrigin
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Authorizing…</title></head>
  <body>
    <p>Authorizing…</p>
    <script>
      (function () {
        function receiveMessage(e) {
          try {
            // send message to main window with the app
            window.opener.postMessage(${JSON.stringify(successMsg)}, e.origin);
            setTimeout(function(){ window.close(); }, 300);
          } catch (err) {
            document.body.innerText = "Authorized, but failed to message opener.";
          }
        }

        window.addEventListener("message", receiveMessage, false);

        // kick off the handshake
        if (window.opener && window.opener.postMessage) {
          window.opener.postMessage("authorizing:github", "*");
        } else {
          document.body.innerText = "Authorized, but no opener window found.";
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
