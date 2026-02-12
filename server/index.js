import dns from 'node:dns/promises';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from './models/User.js';
import nodemailer from 'nodemailer';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'your-very-secret-key';

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(session({ secret: SECRET_KEY, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// --- Google OAuth Strategy ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ email: profile.emails[0].value });
      if (!user) {
        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          avatar: profile.photos[0].value,
        });
        await user.save();
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Find user by email (GitHub doesn't always provide public email, check profile.emails)
      let email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
      let user = await User.findOne({ email });

      if (!user) {
        user = new User({
          name: profile.displayName || profile.username,
          email: email,
          githubId: profile.id,
          avatar: profile._json.avatar_url,
          isVerified: true
        });
        await user.save();
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// --- Email Transporter ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const otpStore = new Map();
const tempUserStore = new Map();

// --- Auth Routes ---

// Google OAuth Trigger
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback
app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login' }),
  (req, res) => {
    // Generate token for the Google user
    const token = jwt.sign({ id: req.user._id }, SECRET_KEY, { expiresIn: '1h' });
    // Redirect to frontend with token (or handle via cookies/session)
    res.redirect(`http://localhost:5173/dashboard?token=${token}`);
  }
);

app.get('/api/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/api/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: 'http://localhost:5173/login' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, SECRET_KEY, { expiresIn: '1h' });
    res.redirect(`http://localhost:5173/dashboard?token=${token}`);
  }
);

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  // 1. Validate all fields are present
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  try {
    // 2. Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // 3. Hash the password for security
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create and save the new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    });

    await newUser.save();

    // 5. Generate a JWT token so they are logged in immediately
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email }, 
      SECRET_KEY, 
      { expiresIn: '1h' }
    );

    res.status(201).json({ token, user: newUser });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: 'Server error during sign up.' });
  }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const storedOtp = otpStore.get(email);
  const userData = tempUserStore.get(email);

  if (storedOtp === otp && userData) {
    const newUser = new User({ ...userData, avatar: `https://i.pravatar.cc/150?u=${email}` });
    await newUser.save();
    
    otpStore.delete(email);
    tempUserStore.delete(email);

    const token = jwt.sign({ id: newUser._id }, SECRET_KEY, { expiresIn: '1h' });
    res.status(201).json({ token, user: newUser });
  } else {
    res.status(400).json({ message: 'Invalid or expired OTP' });
  }
});

// Standard Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: '1h' });
    return res.json({ token, user });
  }
  res.status(400).json({ message: 'Invalid credentials' });
});

const PORT = 5001;
app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));