const { User, Watchlist } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const DEFAULT_AVATAR = '/uploads/avatars/default.png';

// Multer config for avatar uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    console.log('Multer destination: Creating upload directory...');
    const uploadPath = path.join(__dirname, '../../uploads/avatars');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      console.log('Multer destination: Upload directory created/exists:', uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      console.error('Multer destination: Failed to create upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    console.log('Multer filename: req.user:', req.user ? req.user.id : 'undefined');
    console.log('Multer filename: file:', file.originalname);
    
    if (!req.user || !req.user.id) {
      console.error('Multer filename: req.user or req.user.id is undefined');
      return cb(new Error('User not authenticated'));
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `avatar-${req.user.id}-${uniqueSuffix}${extension}`;
    console.log('Multer filename: Generated filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    console.log('Multer fileFilter: Checking file type...');
    console.log('Multer fileFilter: File mimetype:', file.mimetype);
    console.log('Multer fileFilter: File originalname:', file.originalname);
    
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    console.log('Multer fileFilter: Extension test:', extname);
    console.log('Multer fileFilter: Mimetype test:', mimetype);
    
    if (mimetype && extname) {
      console.log('Multer fileFilter: File type allowed');
      return cb(null, true);
    } else {
      console.log('Multer fileFilter: File type not allowed');
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
}).single('avatar');

const userController = {
  async getProfile(req, res) {
    try {
      console.log('UserController: getProfile called for user:', req.user.id);
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password_hash'] }
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      // Ensure user has an avatar_url, set default if not
      if (!user.avatar_url) {
        await user.update({ avatar_url: DEFAULT_AVATAR });
        user.avatar_url = DEFAULT_AVATAR;
      }
      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  },

  async updateProfile(req, res) {
    try {
      console.log('UserController: updateProfile called for user:', req.user.id);
      const { bio, display_phrase, avatar_url } = req.body;
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      await user.update({
        bio: bio || '',
        display_phrase: display_phrase || '',
        avatar_url: avatar_url || user.avatar_url || DEFAULT_AVATAR
      });
      const updatedUser = user.toJSON();
      delete updatedUser.password_hash;
      res.json(updatedUser);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  },

  async uploadAvatar(req, res) {
    console.log('=== UPLOAD AVATAR FUNCTION CALLED ===');
    console.log('UserController: req.method:', req.method);
    console.log('UserController: req.url:', req.url);
    console.log('UserController: req.user:', req.user ? { id: req.user.id, username: req.user.username } : 'undefined');
    console.log('UserController: Content-Type:', req.headers['content-type']);
    
    upload(req, res, async (err) => {
      console.log('=== MULTER CALLBACK ===');
      console.log('UserController: Multer error:', err);
      console.log('UserController: req.file:', req.file);
      
      if (err instanceof multer.MulterError) {
        console.error('UserController: Multer error:', err);
        return res.status(400).json({
          error: err.code === 'LIMIT_FILE_SIZE'
            ? 'File size too large (max 5MB)'
            : err.message
        });
      } else if (err) {
        console.error('UserController: Upload error:', err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        console.error('UserController: No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        console.log('UserController: File uploaded successfully:', req.file.filename);

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const user = await User.findByPk(req.user.id);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Delete old avatar file if it exists and is not the default
        if (user.avatar_url && user.avatar_url !== DEFAULT_AVATAR && user.avatar_url.startsWith('/uploads/avatars/')) {
          const oldFilename = path.basename(user.avatar_url);
          const oldFilePath = path.join(__dirname, '../../uploads/avatars', oldFilename);
          try {
            await fs.unlink(oldFilePath);
            console.log('UserController: Deleted old avatar:', oldFilename);
          } catch (deleteError) {
            console.log('UserController: Could not delete old avatar (may not exist):', deleteError.message);
          }
        }

        await user.update({ avatar_url: avatarUrl });

        console.log('UserController: Avatar URL updated in database:', avatarUrl);

        res.json({
          avatar_url: avatarUrl,
          message: 'Avatar uploaded successfully'
        });

      } catch (error) {
        console.error('UserController: Database update error:', error);
        // Clean up uploaded file if database update fails
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('UserController: Failed to clean up uploaded file:', cleanupError);
        }
        res.status(500).json({ error: 'Failed to update avatar in database' });
      }
    });
  },

  async getWatchlists(req, res) {
    try {
      console.log('UserController: getWatchlists called for user:', req.user.id);
      const watchlists = await Watchlist.findAll({
        where: { user_id: req.user.id },
        order: [['created_at', 'DESC']]
      });
      res.json(watchlists);
    } catch (error) {
      console.error('Get watchlists error:', error);
      res.status(500).json({ error: 'Failed to fetch watchlists' });
    }
  },

  async createWatchlist(req, res) {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Watchlist name is required' });
      }
      const watchlist = await Watchlist.create({
        user_id: req.user.id,
        name: name.trim(),
        items: []
      });
      res.status(201).json(watchlist);
    } catch (error) {
      console.error('Create watchlist error:', error);
      res.status(500).json({ error: 'Failed to create watchlist' });
    }
  },

  async addToWatchlist(req, res) {
    try {
      const { watchlistId } = req.params;
      const { item } = req.body;
      const watchlist = await Watchlist.findOne({
        where: {
          id: watchlistId,
          user_id: req.user.id
        }
      });
      if (!watchlist) {
        return res.status(404).json({ error: 'Watchlist not found' });
      }
      const items = watchlist.items || [];
      items.push({
        ...item,
        added_at: new Date()
      });
      await watchlist.update({ items });
      res.json(watchlist);
    } catch (error) {
      console.error('Add to watchlist error:', error);
      res.status(500).json({ error: 'Failed to add to watchlist' });
    }
  },

  async removeFromWatchlist(req, res) {
    try {
      const { watchlistId, itemIndex } = req.params;
      const watchlist = await Watchlist.findOne({
        where: {
          id: watchlistId,
          user_id: req.user.id
        }
      });
      if (!watchlist) {
        return res.status(404).json({ error: 'Watchlist not found' });
      }
      const items = watchlist.items || [];
      items.splice(parseInt(itemIndex), 1);
      await watchlist.update({ items });
      res.json(watchlist);
    } catch (error) {
      console.error('Remove from watchlist error:', error);
      res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
  }
};

module.exports = userController;