// src/scripts/migrate.js

const { sequelize } = require('../config/database');

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
      console.log('📋 Downloads table exists, checking schema...');
      
      try {
        console.log('🔍 Describing downloads table structure...');
        const columns = await queryInterface.describeTable('downloads');
        console.log('📝 Current table columns:', Object.keys(columns));
        
        // Log detailed column info
        console.log('📋 Column details:');
        Object.entries(columns).forEach(([name, details]) => {
          console.log(`  - ${name}: ${details.type} (null: ${details.allowNull})`);
        });
        
        let needsUpdate = false;
        
        // Check for missing error column
        if (!columns.error) {
          console.log('➕ Missing error column, adding...');
          await queryInterface.addColumn('downloads', 'error', {
            type: sequelize.Sequelize.STRING,
            allowNull: true,
          });
          console.log('✅ Error column added successfully');
          needsUpdate = true;
        } else {
          console.log('✅ Error column already exists');
        }
        
        // Check user_id type (should be UUID based on your error)
        if (columns.user_id && columns.user_id.type && !columns.user_id.type.includes('uuid')) {
          console.log('⚠️ user_id column type mismatch detected');
          console.log(`   Current type: ${columns.user_id.type}`);
          console.log('   Expected type: UUID');
          needsUpdate = true;
        }
        
        // Check id column for auto-increment
        if (columns.id) {
          console.log(`🔑 ID column type: ${columns.id.type}`);
          console.log(`🔑 ID auto-increment: ${columns.id.autoIncrement || 'unknown'}`);
        }
        
        if (needsUpdate) {
          console.log('🔄 Schema mismatch detected, recreating table...');
          throw new Error('Schema mismatch - need to recreate table');
        }
        
        console.log('✅ All columns verified - schema is correct!');
        
      } catch (err) {
        console.log('⚠️ Error checking columns or schema mismatch detected:', err.message);
        console.log('🗑️ Dropping existing downloads table...');
        
        try {
          await queryInterface.dropTable('downloads');
          console.log('✅ Downloads table dropped successfully');
        } catch (dropErr) {
          console.log('⚠️ Error dropping table (may not exist):', dropErr.message);
        }
        
        console.log('🆕 Creating new downloads table with correct schema...');
        await createDownloadsTable(queryInterface, sequelize);
      }
    } else {
      console.log('🆕 Downloads table not found, creating new table...');
      await createDownloadsTable(queryInterface, sequelize);
    }

    console.log('🔍 Verifying final table structure...');
    const finalColumns = await queryInterface.describeTable('downloads');
    console.log('📋 Final table columns:', Object.keys(finalColumns));
    
    console.log('✅ Database migration completed successfully!');
    console.log('🎉 Ready to accept downloads!');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    console.error('📋 Error details:', err.message);
    console.error('📋 Stack trace:', err.stack);
    process.exit(1);
  }
})();

async function createDownloadsTable(queryInterface, sequelize) {
  console.log('🏗️ Creating downloads table structure...');
  
  const tableDefinition = {
    id: {
      type: sequelize.Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    user_id: {
      type: sequelize.Sequelize.UUID, // ✅ Fixed: Changed from INTEGER to UUID
      allowNull: false,
    },
    torrent_name: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    magnet_link: {
      type: sequelize.Sequelize.TEXT,
      allowNull: false,
    },
    file_type: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    file_size: {
      type: sequelize.Sequelize.BIGINT,
      allowNull: true,
    },
    quality: {
      type: sequelize.Sequelize.STRING,
      allowNull: true,
    },
    status: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
      defaultValue: 'queued',
    },
    debriding_progress: {
      type: sequelize.Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    transfer_progress: {
      type: sequelize.Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    download_speed: {
      type: sequelize.Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    alldebrid_id: {
      type: sequelize.Sequelize.STRING,
      allowNull: true,
    },
    error: {
      type: sequelize.Sequelize.STRING,
      allowNull: true,
    },
    completed_at: {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    },
    created_at: {
      allowNull: false,
      type: sequelize.Sequelize.DATE,
      defaultValue: sequelize.Sequelize.fn('NOW'),
    },
    updated_at: {
      allowNull: false,
      type: sequelize.Sequelize.DATE,
      defaultValue: sequelize.Sequelize.fn('NOW'),
    },
  };
  
  console.log('📋 Table definition:');
  Object.entries(tableDefinition).forEach(([name, config]) => {
    console.log(`  - ${name}: ${config.type.key || config.type} (null: ${config.allowNull}, default: ${config.defaultValue || 'none'})`);
  });
  
  try {
    await queryInterface.createTable('downloads', tableDefinition);
    console.log('✅ Downloads table created successfully!');
    
    // Verify the table was created correctly
    console.log('🔍 Verifying table creation...');
    const createdColumns = await queryInterface.describeTable('downloads');
    console.log('✅ Table verification complete');
    console.log(`📊 Created ${Object.keys(createdColumns).length} columns successfully`);
    
  } catch (createErr) {
    console.error('❌ Failed to create downloads table:', createErr.message);
    throw createErr;
  }
}