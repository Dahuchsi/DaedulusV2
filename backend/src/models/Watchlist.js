// src/models/Watchlist.js
module.exports = (sequelize, DataTypes) => {
  const Watchlist = sequelize.define('Watchlist', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    items: {
      type: DataTypes.JSONB,
      defaultValue: []
    }
  }, {
    timestamps: true,
    underscored: true,
    tableName: 'watchlists'
  });

  Watchlist.associate = (models) => {
    Watchlist.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return Watchlist;
};