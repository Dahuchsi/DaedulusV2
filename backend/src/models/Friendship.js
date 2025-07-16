// src/models/Friendship.js
module.exports = (sequelize, DataTypes) => {
  const Friendship = sequelize.define('Friendship', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    friend_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'blocked'),
      defaultValue: 'accepted'
    }
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'friendships',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'friend_id']
      }
    ]
  });

  Friendship.associate = (models) => {
    Friendship.belongsTo(models.User, { as: 'user', foreignKey: 'user_id', onDelete: 'CASCADE' });
    Friendship.belongsTo(models.User, { as: 'friend', foreignKey: 'friend_id', onDelete: 'CASCADE' });
  };

  return Friendship;
};