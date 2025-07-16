// src/models/Request.js
module.exports = (sequelize, DataTypes) => {
  const Request = sequelize.define('Request', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    search_query: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    torrent_info: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    status: {
      type: DataTypes.ENUM('pending', 'fulfilled', 'rejected'),
      defaultValue: 'pending'
    }
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'requests'
  });

  Request.associate = (models) => {
    Request.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return Request;
};