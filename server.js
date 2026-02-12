require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

app.get("/auth", (req, res) => {
  const redirect = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`;
  res.redirect(redirect);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code
      },
      {
        headers: { Accept: "application/json" }
      }
    );

    const access_token = response.data.access_token;

    res.redirect(
      `https://coxusw.github.io/CrestedCritters/admin/#access_token=${access_token}`
    );
  } catch (error) {
    res.status(500).send("Authentication failed");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("OAuth proxy running");
});
