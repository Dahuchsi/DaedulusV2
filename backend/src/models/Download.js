// models/Download.js
const { DataTypes } = require('sequelize'); // Make sure DataTypes is imported

module.exports = (sequelize) => {
  const Download = sequelize.define('Download', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.UUID, // Changed from INTEGER to UUID to match User.id
      allowNull: false,
    },
    torrent_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    magnet_link: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    quality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'queued',
    },
    debriding_progress: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    transfer_progress: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    download_speed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    alldebrid_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    error: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'downloads',
    timestamps: true,
    underscored: true,
  });

  Download.associate = function(models) {
    Download.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' }); // ADDED: as: 'user'
  };

  return Download;
};