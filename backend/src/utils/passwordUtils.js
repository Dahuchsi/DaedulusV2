// backend/src/utils/passwordUtils.js
const bcrypt = require('bcrypt');

const HASH_SALT_ROUNDS = 10; // Or whatever your existing salt rounds are (e.g., from .env)

async function hashPassword(password) {
  if (!password) {
    throw new Error('Password cannot be empty');
  }
  return bcrypt.hash(password, HASH_SALT_ROUNDS);
}

module.exports = {
  hashPassword,
};