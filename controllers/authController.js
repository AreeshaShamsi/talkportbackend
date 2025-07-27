import User from "../models/User.js";
import { google } from "googleapis";

export const getAllEmails = async (req, res) => {
  try {
    const users = await User.find();

    const emailsList = [];

    for (const user of users) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: user.accessToken });

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const gmailRes = await gmail.users.messages.list({ userId: "me", maxResults: 1 });

      const latestMsgId = gmailRes.data.messages?.[0]?.id;

      let snippet = "No messages";
      if (latestMsgId) {
        const msg = await gmail.users.messages.get({ userId: "me", id: latestMsgId });
        snippet = msg.data.snippet;
      }

      emailsList.push({
        name: user.name,
        email: user.email,
        snippet,
      });
    }

    res.json(emailsList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch emails." });
  }
};
