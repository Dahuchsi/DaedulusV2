// C:\Projects\Daedulus\backend\src\scripts\createDatabase.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Client } = require('pg');

async function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const postgresAdminPassword = process.env.POSTGRES_ADMIN_PASSWORD;
  if (!postgresAdminPassword) {
    console.error('ERROR: POSTGRES_ADMIN_PASSWORD not found in your .env file.');
    console.error('Please add POSTGRES_ADMIN_PASSWORD=your_postgres_password to your .env file.');
    process.exit(1);
  }

  const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    console.error('Invalid DATABASE_URL format');
    process.exit(1);
  }

  const [, user, password, host, port, database] = match;

  const adminClient = new Client({
    host,
    port: parseInt(port),
    user: 'postgres',
    password: postgresAdminPassword,
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL as admin');

    // Check if database exists
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database]
    );

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      await adminClient.query(`CREATE DATABASE "${database}"`);
      console.log(`Database "${database}" created successfully`);
    } else {
      console.log(`Database "${database}" already exists`);
    }

    // Create user if it doesn't exist
    const userResult = await adminClient.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [user]
    );

    if (userResult.rows.length === 0) {
      await adminClient.query(`CREATE USER "${user}" WITH PASSWORD '${password}'`);
      console.log(`User "${user}" created successfully`);
    } else {
      console.log(`User "${user}" already exists`);
    }

    // Grant privileges
    await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE "${database}" TO "${user}"`);
    console.log(`Privileges granted to user "${user}" on database "${database}"`);

  } catch (error) {
    console.error('Error creating database:', error);
    process.exit(1);
  } finally {
    await adminClient.end();
    console.log('Database setup completed');
  }
}

createDatabase();