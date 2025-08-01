// backend/src/models/MessageLog.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MessageLog = sequelize.define('MessageLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    sender_username: { // Denormalized for easier querying
      type: DataTypes.STRING,
      allowNull: false,
    },
    recipient_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    recipient_username: { // Denormalized for easier querying
      type: DataTypes.STRING,
      allowNull: false,
    },
    message_content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    message_type: {
      type: DataTypes.ENUM('text', 'image', 'file', 'link'),
      allowNull: false,
      defaultValue: 'text',
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    }
  }, {
    tableName: 'message_logs',
    timestamps: false, // We only care about sent_at here
    underscored: true,
  });

  MessageLog.associate = (models) => {
    MessageLog.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
    MessageLog.belongsTo(models.User, { foreignKey: 'recipient_id', as: 'recipient' });
  };

  return MessageLog;
};