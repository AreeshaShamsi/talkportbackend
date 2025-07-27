import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: String,
  accessToken: String,
  refreshToken: String
});

export default mongoose.model("User", userSchema);
