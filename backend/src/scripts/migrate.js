// backend/src/scripts/migrate.js
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// --- New Table Creation Functions ---
async function createSearchLogsTable(queryInterface, sequelize) {
  console.log('🏗️ Creating "search_logs" table structure...');
  await queryInterface.createTable('search_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }, // Foreign key reference
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    username: {
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
      defaultValue: sequelize.literal('NOW()'),
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    result_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'search_logs',
    timestamps: false,
    underscored: true,
  });
  console.log('✅ "search_logs" table created successfully!');
}

async function createMessageLogsTable(queryInterface, sequelize) {
  console.log('🏗️ Creating "message_logs" table structure...');
  await queryInterface.createTable('message_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    sender_username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    recipient_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    recipient_username: {
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
      defaultValue: sequelize.literal('NOW()'),
    },
  }, {
    tableName: 'message_logs',
    timestamps: false,
    underscored: true,
  });
  console.log('✅ "message_logs" table created successfully!');
}

// Ensure createDownloadsTable is also available in this file or imported
async function createDownloadsTable(queryInterface, sequelize) {
  console.log('🏗️ Creating downloads table structure...');

  const tableDefinition = {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }, // Ensure foreign key is here
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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
      defaultValue: sequelize.literal('NOW()'),
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('NOW()'),
    },
  };

  try {
    await queryInterface.createTable('downloads', tableDefinition);
    console.log('✅ "downloads" table created successfully!');
  } catch (createErr) {
    console.error('❌ Failed to create "downloads" table:', createErr.message);
    throw createErr;
  }
}


// Modify the main (async () => { ... })(); block
(async () => {
  try {
    console.log('⏳ Starting database migration...');
    console.log('🔗 Connecting to database...');

    const queryInterface = sequelize.getQueryInterface();

    // Fetch all existing table names upfront
    console.log('🔍 Checking existing tables...');
    const tables = await queryInterface.showAllTables();
    console.log(`📊 Found ${tables.length} tables:`, tables);


    // --- Downloads Table Migration (existing non-destructive logic) ---
    console.log('\n--- Processing "downloads" table ---');
    if (tables.includes('downloads')) {
      try {
        console.log('🔍 Describing downloads table structure...');
        const downloadsColumns = await queryInterface.describeTable('downloads');
        console.log('📝 Current downloads table columns:', Object.keys(downloadsColumns));

        if (!downloadsColumns.error) {
          console.log('➕ Missing "error" column in downloads, adding...');
          await queryInterface.addColumn('downloads', 'error', {
            type: DataTypes.STRING,
            allowNull: true,
          });
          console.log('✅ "error" column added successfully to downloads.');
        } else {
          console.log('✅ "error" column already exists in downloads.');
        }

        if (downloadsColumns.user_id && downloadsColumns.user_id.type && !downloadsColumns.user_id.type.includes('UUID')) {
          console.warn('⚠️ WARNING: "user_id" column type mismatch in downloads (expected UUID, found ' + downloadsColumns.user_id.type + ').');
          console.warn('   This migration script will NOT automatically change this column type to prevent data loss.');
        } else {
          console.log('✅ "user_id" column type verified (or acceptable) in downloads.');
        }
        console.log('✅ Downloads table schema checks completed. Non-destructive updates applied.');
      } catch (err) {
        console.error('❌ Error during schema check or column alteration for "downloads" table:', err.message);
        console.error('⚠️ Please address the error manually.');
        process.exit(1);
      }
    } else {
      console.log('🆕 "downloads" table not found, creating new table...');
      await createDownloadsTable(queryInterface, sequelize);
    }


    // --- New Tables Migration ---
    console.log('\n--- Processing "search_logs" table ---');
    if (!tables.includes('search_logs')) {
      await createSearchLogsTable(queryInterface, sequelize);
    } else {
      console.log('✅ "search_logs" table already exists.');
    }

    console.log('\n--- Processing "message_logs" table ---');
    if (!tables.includes('message_logs')) {
      await createMessageLogsTable(queryInterface, sequelize);
    } else {
      console.log('✅ "message_logs" table already exists.');
    }

    console.log('\n🔍 Verifying final table structures...');
    const finalDownloadsColumns = await queryInterface.describeTable('downloads');
    console.log('📋 Final "downloads" table columns:', Object.keys(finalDownloadsColumns));
    const finalSearchLogsColumns = await queryInterface.describeTable('search_logs');
    console.log('📋 Final "search_logs" table columns:', Object.keys(finalSearchLogsColumns));
    const finalMessageLogsColumns = await queryInterface.describeTable('message_logs');
    console.log('📋 Final "message_logs" table columns:', Object.keys(finalMessageLogsColumns));


    console.log('\n✅ Database migration completed successfully!');
    console.log('🎉 Ready to accept data logs!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    console.error('📋 Error details:', err.message);
    console.error('📋 Stack trace:', err.stack);
    process.exit(1);
  }
})();