/**
 * PostgreSQL Migration Script
 * 
 * This script handles the data migration from SQLite to PostgreSQL
 * It performs extraction, transformation, and loading of the data
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const ora = require('ora');
const chalk = require('chalk');

// Configuration
const config = {
  sqlite: {
    path: process.env.SQLITE_DB_PATH || path.join(__dirname, '../../../data/database.sqlite')
  },
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'emrsim',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
  },
  batchSize: 1000,
  exportDir: path.join(__dirname, '../../../migration_data')
};

// Create PostgreSQL connection pool
const pgPool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password
});

// Promisified file operations
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

/**
 * Initialize migration environment
 */
async function initMigration() {
  const spinner = ora('Initializing migration environment').start();
  
  try {
    // Ensure export directory exists
    if (!(await exists(config.exportDir))) {
      await mkdir(config.exportDir, { recursive: true });
    }
    
    spinner.succeed('Migration environment initialized');
    return true;
  } catch (err) {
    spinner.fail(`Failed to initialize migration environment: ${err.message}`);
    throw err;
  }
}

/**
 * Get all table names from SQLite database
 */
async function getSQLiteTables() {
  const spinner = ora('Getting SQLite tables').start();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(config.sqlite.path, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        spinner.fail(`Failed to open SQLite database: ${err.message}`);
        return reject(err);
      }
    });
    
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", (err, tables) => {
      if (err) {
        spinner.fail(`Failed to get tables: ${err.message}`);
        db.close();
        return reject(err);
      }
      
      const tableNames = tables.map(t => t.name);
      spinner.succeed(`Found ${tableNames.length} tables in SQLite database`);
      db.close();
      resolve(tableNames);
    });
  });
}

/**
 * Get table schema from SQLite database
 */
async function getTableSchema(tableName) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(config.sqlite.path, sqlite3.OPEN_READONLY);
    
    db.all(`PRAGMA table_info(${tableName});`, (err, columns) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      db.close();
      resolve(columns);
    });
  });
}

/**
 * Convert SQLite data type to PostgreSQL data type
 */
function mapDataType(sqliteType) {
  const typeMap = {
    'INTEGER': 'integer',
    'REAL': 'double precision',
    'TEXT': 'text',
    'BLOB': 'bytea',
    'BOOLEAN': 'boolean'
  };
  
  // Extract base type (removing constraints)
  const baseType = sqliteType.split('(')[0].toUpperCase();
  
  return typeMap[baseType] || 'text';
}

/**
 * Generate PostgreSQL schema creation script
 */
async function generatePgSchema(tables) {
  const spinner = ora('Generating PostgreSQL schema').start();
  let schemaScript = '';
  
  try {
    for (const tableName of tables) {
      const columns = await getTableSchema(tableName);
      
      // Start table creation
      schemaScript += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
      
      // Add columns
      const columnDefs = columns.map(col => {
        const pgType = mapDataType(col.type);
        const nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
        const defaultVal = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
        
        return `  ${col.name} ${pgType} ${nullable} ${defaultVal}`.trim();
      });
      
      // Add primary key constraint
      const pkColumns = columns
        .filter(col => col.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map(col => col.name);
      
      if (pkColumns.length > 0) {
        columnDefs.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
      }
      
      schemaScript += columnDefs.join(',\n');
      schemaScript += '\n);\n\n';
    }
    
    // Save schema to file
    const schemaPath = path.join(config.exportDir, 'pg_schema.sql');
    await writeFile(schemaPath, schemaScript);
    
    spinner.succeed(`PostgreSQL schema generated: ${schemaPath}`);
    return schemaPath;
  } catch (err) {
    spinner.fail(`Failed to generate schema: ${err.message}`);
    throw err;
  }
}

/**
 * Extract data from SQLite table
 */
async function extractTableData(tableName) {
  const spinner = ora(`Extracting data from table: ${tableName}`).start();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(config.sqlite.path, sqlite3.OPEN_READONLY);
    
    db.all(`SELECT * FROM ${tableName};`, (err, rows) => {
      if (err) {
        spinner.fail(`Failed to extract data from ${tableName}: ${err.message}`);
        db.close();
        return reject(err);
      }
      
      spinner.succeed(`Extracted ${rows.length} rows from ${tableName}`);
      db.close();
      resolve(rows);
    });
  });
}

/**
 * Transform data for PostgreSQL compatibility
 */
function transformData(rows, tableName) {
  const spinner = ora(`Transforming data for table: ${tableName}`).start();
  
  try {
    // Handle specific transformations based on table
    const transformed = rows.map(row => {
      const newRow = { ...row };
      
      // Convert SQLite timestamps to PostgreSQL format if needed
      for (const key in newRow) {
        // Handle date strings
        if (typeof newRow[key] === 'string' && 
            /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(newRow[key])) {
          try {
            // Ensure proper ISO format
            const date = new Date(newRow[key]);
            newRow[key] = date.toISOString();
          } catch (e) {
            // Keep original if parsing fails
          }
        }
        
        // Convert null to empty string for CSV compatibility
        if (newRow[key] === null) {
          newRow[key] = '';
        }
        
        // Handle JSON data
        if (typeof newRow[key] === 'object') {
          newRow[key] = JSON.stringify(newRow[key]);
        }
      }
      
      return newRow;
    });
    
    spinner.succeed(`Transformed ${rows.length} rows for ${tableName}`);
    return transformed;
  } catch (err) {
    spinner.fail(`Failed to transform data for ${tableName}: ${err.message}`);
    throw err;
  }
}

/**
 * Save data to CSV file for PostgreSQL COPY command
 */
async function saveToCSV(rows, tableName) {
  const spinner = ora(`Saving ${rows.length} rows to CSV for ${tableName}`).start();
  
  try {
    // Generate CSV data
    const csvData = stringify(rows, {
      header: true,
      columns: Object.keys(rows[0] || {})
    });
    
    // Save to file
    const csvPath = path.join(config.exportDir, `${tableName}.csv`);
    await writeFile(csvPath, csvData);
    
    spinner.succeed(`Data saved to CSV: ${csvPath}`);
    return csvPath;
  } catch (err) {
    spinner.fail(`Failed to save CSV for ${tableName}: ${err.message}`);
    throw err;
  }
}

/**
 * Load data into PostgreSQL
 */
async function loadToPostgres(tableName, csvPath) {
  const spinner = ora(`Loading data into PostgreSQL table: ${tableName}`).start();
  
  try {
    const client = await pgPool.connect();
    
    // Create temporary table without constraints for faster loading
    await client.query(`CREATE TEMP TABLE tmp_${tableName} (LIKE ${tableName})`);
    
    // Use COPY command for fast data loading
    const copyQuery = `COPY tmp_${tableName} FROM STDIN WITH CSV HEADER`;
    const fileStream = fs.createReadStream(csvPath);
    const stream = client.query(copyFrom(copyQuery));
    fileStream.pipe(stream);
    
    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
    });
    
    // Transfer data to actual table
    const { rowCount } = await client.query(`
      INSERT INTO ${tableName} 
      SELECT * FROM tmp_${tableName}
      ON CONFLICT DO NOTHING
    `);
    
    // Clean up
    await client.query(`DROP TABLE tmp_${tableName}`);
    client.release();
    
    spinner.succeed(`Loaded ${rowCount} rows into ${tableName}`);
    return rowCount;
  } catch (err) {
    spinner.fail(`Failed to load data into ${tableName}: ${err.message}`);
    throw err;
  }
}

/**
 * Verify data integrity after migration
 */
async function verifyMigration(tableName) {
  const spinner = ora(`Verifying data integrity for ${tableName}`).start();
  
  try {
    // Count records in SQLite
    const sqliteCount = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(config.sqlite.path, sqlite3.OPEN_READONLY);
      db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    // Count records in PostgreSQL
    const pgRes = await pgPool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const pgCount = parseInt(pgRes.rows[0].count);
    
    // Compare counts
    const success = sqliteCount === pgCount;
    
    if (success) {
      spinner.succeed(`Data integrity verified for ${tableName}: ${pgCount} records`);
    } else {
      spinner.fail(`Data integrity check failed for ${tableName}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
    }
    
    return {
      table: tableName,
      sqliteCount,
      pgCount,
      success
    };
  } catch (err) {
    spinner.fail(`Failed to verify data for ${tableName}: ${err.message}`);
    throw err;
  }
}

/**
 * Run the full migration process
 */
async function runMigration() {
  console.log(chalk.blue.bold('\n=== PostgreSQL Migration Process ===\n'));
  
  try {
    // Initialize migration environment
    await initMigration();
    
    // Get all tables from SQLite
    const tables = await getSQLiteTables();
    
    // Generate PostgreSQL schema
    const schemaPath = await generatePgSchema(tables);
    
    console.log(chalk.yellow.bold('\nCreating PostgreSQL schema...'));
    
    // Create schema in PostgreSQL
    await pgPool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
    const schemaScript = fs.readFileSync(schemaPath, 'utf8');
    await pgPool.query(schemaScript);
    
    console.log(chalk.green('Schema created successfully!'));
    
    const migrationResults = [];
    
    // Process each table
    for (const tableName of tables) {
      console.log(chalk.yellow.bold(`\nProcessing table: ${tableName}`));
      
      // Extract -> Transform -> Load
      const rows = await extractTableData(tableName);
      
      if (rows.length === 0) {
        console.log(chalk.gray(`Table ${tableName} is empty, skipping`));
        continue;
      }
      
      const transformed = transformData(rows, tableName);
      const csvPath = await saveToCSV(transformed, tableName);
      await loadToPostgres(tableName, csvPath);
      
      // Verify migration
      const verificationResult = await verifyMigration(tableName);
      migrationResults.push(verificationResult);
    }
    
    // Generate migration report
    console.log(chalk.blue.bold('\n=== Migration Summary ===\n'));
    
    const successful = migrationResults.filter(r => r.success);
    const failed = migrationResults.filter(r => !r.success);
    
    console.log(chalk.green(`✓ Successfully migrated: ${successful.length} tables`));
    
    if (failed.length > 0) {
      console.log(chalk.red(`✗ Failed migration: ${failed.length} tables`));
      failed.forEach(result => {
        console.log(chalk.red(`  - ${result.table}: SQLite=${result.sqliteCount}, PostgreSQL=${result.pgCount}`));
      });
    }
    
    // Clean up connections
    await pgPool.end();
    
    console.log(chalk.blue.bold('\n=== Migration Process Completed ===\n'));
    
    return {
      success: failed.length === 0,
      tablesProcessed: tables.length,
      tablesSucceeded: successful.length,
      tablesFailed: failed.length,
      failedTables: failed.map(f => f.table)
    };
  } catch (err) {
    console.error(chalk.red(`Migration failed: ${err.message}`));
    console.error(err);
    
    // Clean up connections
    await pgPool.end();
    
    return {
      success: false,
      error: err.message
    };
  }
}

// Helper function for COPY FROM (typically imported from 'pg-copy-streams')
function copyFrom(text) {
  return new stream.Writable({
    write(chunk, encoding, callback) {
      this._client.connection.sendCopyFromChunk(chunk);
      callback();
    }
  });
}

// Export the main function
module.exports = {
  runMigration
};

// Execute if called directly
if (require.main === module) {
  runMigration()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
