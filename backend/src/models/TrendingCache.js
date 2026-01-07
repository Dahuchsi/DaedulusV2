const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TrendingCache = sequelize.define('TrendingCache', {
    key: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    data: {
      type: DataTypes.JSON, // Stores the API response
      allowNull: false
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'trending_cache',
    timestamps: true
  });

  return TrendingCache;
};
