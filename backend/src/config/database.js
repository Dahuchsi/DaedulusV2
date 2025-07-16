// src/config/database.js

require('dotenv').config();
const { Sequelize } = require('sequelize');

// Create Sequelize instance
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test connection (but don't await here to avoid blocking)
sequelize.authenticate()
  .then(() => console.log('✅ Database connected successfully'))
  .catch(err => console.error('❌ Unable to connect to database:', err));

// Export both the sequelize instance and the traditional config format
module.exports = {
  sequelize,
  development: {
    username: "postgres",
    password: "Quakelive01#",
    database: "daedulus",
    host: "localhost",
    port: 5432,
    dialect: "postgres",
    logging: false
  },
  test: {
    username: "postgres",
    password: "Quakelive01#",
    database: "daedulus_test",
    host: "localhost",
    port: 5432,
    dialect: "postgres",
    logging: false
  },
  production: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  }
};