// C:\Projects\Daedulus\backend\src\models\Message.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    recipient_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    message_type: {
      type: DataTypes.ENUM('text', 'image', 'file', 'link'),
      allowNull: false,
      defaultValue: 'text',
    },
    text: {
      type: DataTypes.STRING,
      allowNull: true, // <--- NEW: for optional text with file/image
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    // Sequelize automatically adds createdAt and updatedAt
  }, {
    tableName: 'messages',
    timestamps: true,
    underscored: true,
  });

  Message.associate = (models) => {
    Message.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
      onDelete: 'CASCADE',
    });
    Message.belongsTo(models.User, {
      foreignKey: 'recipient_id',
      as: 'recipient',
      onDelete: 'CASCADE',
    });
  };

  return Message;
};