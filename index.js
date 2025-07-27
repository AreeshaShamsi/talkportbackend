import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { google } from "googleapis";

dotenv.config();
const app = express();
const PORT = 5000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://talkportbackend.vercel.app/api/auth/google/callback";


// 🔄 Use let instead of const
let connectedAccounts = []; // Array of { email, messages }

app.use(cors({
  origin: "https://talkportfrontend.vercel.app",
  credentials: true
}));


// Google OAuth login URL
app.get("/api/auth/google", (req, res) => {
  const scope = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
  ].join(" ");

  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${encodeURIComponent(
    scope
  )}&access_type=offline&prompt=consent`;

  res.redirect(redirectUrl);
});

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// Google OAuth Callback — handles login and stores multiple accounts
app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const email = userInfo.email;
    const messages = await fetchEmails(oauth2Client);

    if (!connectedAccounts.find(acc => acc.email === email)) {
      connectedAccounts.push({ email, messages });
      console.log("✅ Connected Account Added:", email, "Messages:", messages.length);
    } else {
      console.log("ℹ️ Account already connected:", email);
    }

    res.redirect("https://talkportfrontend.vercel.app/dashboard");
  } catch (err) {
    console.error("❌ Auth error:", err.response?.data || err.message);
    res.status(500).send("Authentication or Gmail access failed.");
  }
});

// API to get all connected email accounts
app.get("/api/emails", (req, res) => {
  console.log("📤 Returning accounts:", connectedAccounts.length);
  res.json(
    connectedAccounts.map(account => ({
      email: account.email,
      messages: account.messages || [],
    }))
  );
});

// Optional: Delete an account by email
app.delete("/api/emails/:email", (req, res) => {
  const emailToDelete = req.params.email;
  connectedAccounts = connectedAccounts.filter(acc => acc.email !== emailToDelete);
  console.log("🗑️ Deleted:", emailToDelete);
  res.json({ success: true, accounts: connectedAccounts });
});

// Fetch last 5 messages from Gmail
async function fetchEmails(oauth2Client) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 20,
  });

  if (!res.data.messages) return [];

  const messages = await Promise.all(
    res.data.messages.map(async (msg) => {
      const msgDetail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
      });

      const headers = msgDetail.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const snippet = msgDetail.data.snippet;
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';

      return { subject, snippet, date, from };
    })
  );

  return messages;
}

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
