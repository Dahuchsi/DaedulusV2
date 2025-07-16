const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Friendship, Message } = require('../models'); // Import from models/index.js
const { JWT_SECRET, JWT_EXPIRES_IN, ADMIN_USERNAME } = require('../config/constants');

const authController = {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await User.create({
        username,
        email,
        password_hash: passwordHash
      });

      // Auto-friend with admin
      const adminUser = await User.findOne({ where: { username: ADMIN_USERNAME } });
      if (adminUser) {
        await Friendship.create({
          user_id: user.id,
          friend_id: adminUser.id,
          status: 'accepted'
        });

        await Friendship.create({
          user_id: adminUser.id,
          friend_id: user.id,
          status: 'accepted'
        });

        // Send welcome message from admin
        await Message.create({
          sender_id: adminUser.id,
          recipient_id: user.id,
          content: `Welcome to Daedulus, ${username}! Feel free to reach out if you need any help or have requests.`,
          message_type: 'text'
        });
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, username: user.username, isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: user.is_admin
        },
        token
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: error.message || 'Registration failed' });
    }
  },

  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({ where: { username } });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, username: user.username, isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: user.is_admin,
          avatar_url: user.avatar_url,
          bio: user.bio,
          display_phrase: user.display_phrase
        },
        token
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message || 'Login failed' });
    }
  }
};

module.exports = authController;