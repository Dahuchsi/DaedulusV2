// backend/src/models/SearchLog.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SearchLog = sequelize.define('SearchLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    username: { // Denormalized for easier querying
      type: DataTypes.STRING,
      allowNull: false,
    },
    query: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    search_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: { // e.g., 'success', 'no results', 'error', 'invalid_query'
      type: DataTypes.STRING,
      allowNull: true,
    },
    result_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    }
  }, {
    tableName: 'search_logs',
    timestamps: false, // We only care about search_date here
    underscored: true,
  });

  SearchLog.associate = (models) => {
    SearchLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return SearchLog;
};