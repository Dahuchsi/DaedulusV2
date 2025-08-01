// src/scripts/migrate.js

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize'); // Import DataTypes to use correctly

(async () => {
  try {
    console.log('⏳ Starting database migration...');
    console.log('🔗 Connecting to database...');

    const queryInterface = sequelize.getQueryInterface();

    // Check if downloads table exists
    console.log('🔍 Checking existing tables...');
    const tables = await queryInterface.showAllTables();
    console.log(`📊 Found ${tables.length} tables:`, tables);

    if (tables.includes('downloads')) {
      console.log('📋 Downloads table exists, checking schema for non-destructive updates...');

      try {
        console.log('🔍 Describing downloads table structure...');
        const columns = await queryInterface.describeTable('downloads');
        console.log('📝 Current table columns:', Object.keys(columns));

        // Log detailed column info
        console.log('📋 Column details:');
        Object.entries(columns).forEach(([name, details]) => {
          console.log(`  - ${name}: ${details.type} (null: ${details.allowNull})`);
        });

        // --- NON-DESTRUCTIVE SCHEMA UPDATES ---

        // Check for missing 'error' column and add it if it doesn't exist
        if (!columns.error) {
          console.log('➕ Missing "error" column, adding...');
          await queryInterface.addColumn('downloads', 'error', {
            type: DataTypes.STRING,
            allowNull: true,
          });
          console.log('✅ "error" column added successfully.');
        } else {
          console.log('✅ "error" column already exists.');
        }

        // Handle user_id type mismatch:
        // IMPORTANT: Automatically changing a column type (like INTEGER to UUID)
        // on a table with existing data can cause data loss or corruption
        // if not handled very carefully with data transformation.
        // This script will now only warn, not automatically change or drop the table.
        if (columns.user_id && columns.user_id.type && !columns.user_id.type.includes('UUID')) {
          console.warn('⚠️ WARNING: "user_id" column type mismatch detected. Expected UUID, found ' + columns.user_id.type + '.');
          console.warn('   This migration script will NOT automatically change this column type to prevent data loss.');
          console.warn('   If you need to change "user_id" to UUID and have existing data, a manual migration with data transformation is required.');
        } else {
          console.log('✅ "user_id" column type verified (or acceptable).');
        }

        console.log('✅ Database schema checks for "downloads" completed. Non-destructive updates applied.');

      } catch (err) {
        // This catch block will now only execute if there's a genuine error during
        // the schema description or addColumn operation, not from an intentional 'throw'
        // for schema mismatches.
        console.error('❌ Error during schema check or column alteration for "downloads" table:', err.message);
        console.error('⚠️ Automatic table recreation is disabled to preserve data. Please address the error manually.');
        process.exit(1); // Exit on critical error
      }
    } else {
      console.log('🆕 "downloads" table not found, creating new table...');
      await createDownloadsTable(queryInterface, sequelize);
    }

    console.log('🔍 Verifying final table structure...');
    const finalColumns = await queryInterface.describeTable('downloads');
    console.log('📋 Final "downloads" table columns:', Object.keys(finalColumns));

    console.log('✅ Database migration completed successfully!');
    console.log('🎉 Ready to accept downloads!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration process failed:', err);
    console.error('📋 Error details:', err.message);
    console.error('📋 Stack trace:', err.stack);
    process.exit(1);
  }
})();

async function createDownloadsTable(queryInterface, sequelize) {
  console.log('🏗️ Creating "downloads" table structure...');

  const tableDefinition = {
    id: {
      type: DataTypes.INTEGER, // Use DataTypes directly
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID, // Use DataTypes directly. This is the desired UUID type.
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
      type: DataTypes.STRING, // Add this column here for new table creation
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('NOW()'), // Use sequelize.literal for SQL functions
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('NOW()'), // Use sequelize.literal for SQL functions
    },
  };

  console.log('📋 Table definition for creation:');
  Object.entries(tableDefinition).forEach(([name, config]) => {
    console.log(`  - ${name}: ${config.type.key || config.type} (null: ${config.allowNull}, default: ${config.defaultValue || 'none'})`);
  });

  try {
    await queryInterface.createTable('downloads', tableDefinition);
    console.log('✅ "downloads" table created successfully!');

    // Verify the table was created correctly
    console.log('🔍 Verifying table creation...');
    const createdColumns = await queryInterface.describeTable('downloads');
    console.log('✅ Table verification complete.');
    console.log(`📊 Created ${Object.keys(createdColumns).length} columns successfully.`);

  } catch (createErr) {
    console.error('❌ Failed to create "downloads" table:', createErr.message);
    throw createErr;
  }
}