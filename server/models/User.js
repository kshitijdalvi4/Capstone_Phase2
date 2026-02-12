import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false }, // Changed to false for social login compatibility
  googleId: { type: String }, 
  githubId: { type: String }, 
  avatar: { type: String },
  experience: { type: String, default: 'beginner' },
  solvedProblems: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: true },
}, { timestamps: true }); // Adding timestamps helps track when users joined

const User = mongoose.model('User', userSchema);

export default User;