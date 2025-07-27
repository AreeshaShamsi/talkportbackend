import express from "express";
import passport from "passport";

const router = express.Router();

router.get("/google", passport.authenticate("google", { scope: ["profile", "email", "https://www.googleapis.com/auth/gmail.readonly"], accessType: 'offline', prompt: 'consent' }));

router.get("/google/callback", passport.authenticate("google", {
  failureRedirect: "/login",
  successRedirect: "/api/profile",
}));

router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

router.get("/profile", (req, res) => {
  if (!req.user) return res.status(401).send("Unauthorized");
  res.send(req.user);
});

export default router;
