// C:\Projects\Daedulus\backend\src\models\User.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
      validate: {
        len: [3, 50],
        is: /^[a-zA-Z0-9_]+$/
      }
    },
    email: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    display_phrase: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'users'
  });

  // Define associations
  User.associate = (models) => {
    // A User can send many Messages
    User.hasMany(models.Message, {
      foreignKey: 'sender_id',
      as: 'sentMessages',
      onDelete: 'CASCADE',
    });

    // A User can receive many Messages
    User.hasMany(models.Message, {
      foreignKey: 'recipient_id',
      as: 'receivedMessages',
      onDelete: 'CASCADE',
    });

    // A User can have many Friendships (as a user)
    User.hasMany(models.Friendship, {
      foreignKey: 'user_id',
      as: 'friendshipsAsUser',
      onDelete: 'CASCADE',
    });

    // A User can have many Friendships (as a friend)
    User.hasMany(models.Friendship, {
      foreignKey: 'friend_id',
      as: 'friendshipsAsFriend',
      onDelete: 'CASCADE',
    });

    // A User can have many Downloads
    User.hasMany(models.Download, {
      foreignKey: 'user_id',
      as: 'downloads',
      onDelete: 'CASCADE',
    });

    // A User can make many Requests
    User.hasMany(models.Request, {
      foreignKey: 'user_id',
      as: 'requests',
      onDelete: 'CASCADE',
    });

    // A User can have many Watchlists
    User.hasMany(models.Watchlist, {
      foreignKey: 'user_id',
      as: 'watchlists',
      onDelete: 'CASCADE',
    });
  };

  return User;
};