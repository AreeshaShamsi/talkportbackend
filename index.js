import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { google } from "googleapis";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// 🔄 Use this in /auth/google route instead of here
// const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:5000/api/auth/google/callback";

let connectedAccounts = []; // Array of { email, messages }

app.use(cors({
  origin: [
    "http://localhost:5173",             
    "http://localhost:3000",             
    "https://talkportfrontend.vercel.app"
  ],
  credentials: true
}));

// 🌐 Root
app.get("/", (req, res) => {
  res.send("📡 API is running 🚀");
});

// 🔐 Google OAuth Login
app.get("/api/auth/google", (req, res) => {
  const redirectUri =
    req.hostname === "localhost"
      ? "http://localhost:5000/api/auth/google/callback"
      : "https://talkportbackend.vercel.app/api/auth/google/callback";

  const scope = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send"
  ].join(" ");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(
    scope
  )}&access_type=offline&prompt=consent`;

  res.redirect(authUrl);
});

// 🔄 Google OAuth Callback
app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }

  const redirectUri =
    req.hostname === "localhost"
      ? "http://localhost:5000/api/auth/google/callback"
      : "https://talkportbackend.vercel.app/api/auth/google/callback";

  try {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    const email = userInfo.email;

    const messages = await fetchEmails(oauth2Client);

    if (!connectedAccounts.find(acc => acc.email === email)) {
      connectedAccounts.push({ email, messages });
    }

    const frontendRedirect =
      req.hostname === "localhost"
        ? "http://localhost:5173/inbox"
        : "https://talkportfrontend.vercel.app/inbox";

    res.redirect(frontendRedirect);
  } catch (err) {
    console.error("❌ Google OAuth error:", err.message);
    res.status(500).send("Authentication failed.");
  }
});

// 📩 Get all connected emails
app.get("/api/emails", (req, res) => {
  res.json(
    connectedAccounts.map(account => ({
      email: account.email,
      messages: account.messages || []
    }))
  );
});

// ❌ Delete an email account
app.delete("/api/emails/:email", (req, res) => {
  const emailToDelete = req.params.email;
  connectedAccounts = connectedAccounts.filter(acc => acc.email !== emailToDelete);
  res.json({ success: true });
});

// 📬 Fetch recent emails
async function fetchEmails(oauth2Client) {
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 20
  });

  if (!res.data.messages) return [];

  const messages = await Promise.all(
    res.data.messages.map(async msg => {
      const msgDetail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id
      });

      const headers = msgDetail.data.payload.headers || [];

      const getHeader = name =>
        headers.find(h => h.name === name)?.value || "";

      return {
        subject: getHeader("Subject") || "(No Subject)",
        from: getHeader("From"),
        date: getHeader("Date"),
        snippet: msgDetail.data.snippet || ""
      };
    })
  );

  return messages;
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
