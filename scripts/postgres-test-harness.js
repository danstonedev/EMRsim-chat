/**
 * PostgreSQL Test Harness
 * 
 * This script tests the PostgreSQL migration with production-like data to ensure:
 * 1. Data integrity across all tables
 * 2. Performance under load
 * 3. Concurrency capabilities
 * 4. Query compatibility
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const ora = require('ora');
const chalk = require('chalk');
const Table = require('cli-table3');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Process command line arguments
const argv = yargs(hideBin(process.argv))
  .option('mode', {
    alias: 'm',
    describe: 'Test mode',
    choices: ['integrity', 'performance', 'concurrency', 'all'],
    default: 'all'
  })
  .option('sample', {
    alias: 's',
    describe: 'Use sample data instead of production data',
    type: 'boolean',
    default: false
  })
  .option('verbose', {
    alias: 'v',
    describe: 'Run with verbose logging',
    type: 'boolean',
    default: false
  })
  .option('threads', {
    alias: 't',
    describe: 'Number of concurrent threads for concurrency testing',
    type: 'number',
    default: 10
  })
  .help()
  .alias('help', 'h')
  .argv;

// Configuration
const config = {
  sqlite: {
    production: path.resolve(__dirname, '../data/database.sqlite'),
    sample: path.resolve(__dirname, '../data/sample_database.sqlite')
  },
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'emrsim_test',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
  },
  testTables: ['users', 'conversations', 'messages', 'simulations', 'patient_records'],
  querySamples: [
    {
      name: 'Simple Select',
      sqlite: 'SELECT * FROM users LIMIT 10',
      postgres: 'SELECT * FROM users LIMIT 10',
      repeat: 10
    },
    {
      name: 'Join Query',
      sqlite: `
        SELECT c.id, c.title, u.name as username, COUNT(m.id) as message_count
        FROM conversations c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY c.id, c.title, u.name
        LIMIT 20
      `,
      postgres: `
        SELECT c.id, c.title, u.name as username, COUNT(m.id) as message_count
        FROM conversations c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY c.id, c.title, u.name
        LIMIT 20
      `,
      repeat: 5
    },
    {
      name: 'Complex Query',
      sqlite: `
        SELECT 
          u.name,
          COUNT(DISTINCT c.id) as total_conversations,
          SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_conversations,
          AVG(LENGTH(m.message)) as avg_message_length
        FROM users u
        LEFT JOIN conversations c ON u.id = c.user_id
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY u.id
        ORDER BY total_conversations DESC
        LIMIT 10
      `,
      postgres: `
        SELECT 
          u.name,
          COUNT(DISTINCT c.id) as total_conversations,
          SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_conversations,
          AVG(LENGTH(m.message)) as avg_message_length
        FROM users u
        LEFT JOIN conversations c ON u.id = c.user_id
        LEFT JOIN messages m ON c.id = m.conversation_id
        GROUP BY u.id
        ORDER BY total_conversations DESC
        LIMIT 10
      `,
      repeat: 3
    }
  ]
};

// Database connection instances
let sqliteDb;
let pgPool;

/**
 * Initialize database connections
 */
async function initDatabases() {
  const spinner = ora('Initializing database connections').start();
  
  try {
    // SQLite connection
    const sqlitePath = argv.sample ? config.sqlite.sample : config.sqlite.production;
    
    if (!fs.existsSync(sqlitePath)) {
      spinner.fail(`SQLite database not found at: ${sqlitePath}`);
      process.exit(1);
    }
    
    sqliteDb = await open({
      filename: sqlitePath,
      driver: sqlite3.Database
    });
    
    // PostgreSQL connection
    pgPool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      max: 20 // connection pool size
    });
    
    // Test connections
    await sqliteDb.get('SELECT 1');
    await pgPool.query('SELECT 1');
    
    spinner.succeed('Database connections initialized successfully');
  } catch (err) {
    spinner.fail(`Failed to initialize databases: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

/**
 * Close database connections
 */
async function closeDatabases() {
  const spinner = ora('Closing database connections').start();
  
  try {
    if (sqliteDb) {
      await sqliteDb.close();
    }
    
    if (pgPool) {
      await pgPool.end();
    }
    
    spinner.succeed('Database connections closed');
  } catch (err) {
    spinner.fail(`Failed to close database connections: ${err.message}`);
    console.error(err);
  }
}

/**
 * Test data integrity between SQLite and PostgreSQL
 */
async function testDataIntegrity() {
  console.log(chalk.blue.bold('\n=== Data Integrity Test ===\n'));
  
  const results = [];
  
  for (const table of config.testTables) {
    const spinner = ora(`Testing ${table} table integrity`).start();
    
    try {
      // Get record counts from both databases
      const sqliteCount = (await sqliteDb.get(`SELECT COUNT(*) as count FROM ${table}`)).count;
      const pgResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      
      // Get a sample record from each database for comparison
      const sqliteSample = await sqliteDb.get(`SELECT * FROM ${table} LIMIT 1`);
      const pgSample = (await pgPool.query(`SELECT * FROM ${table} LIMIT 1`)).rows[0];
      
      // Compare column counts
      const sqliteColumns = Object.keys(sqliteSample || {}).length;
      const pgColumns = Object.keys(pgSample || {}).length;
      
      // Determine if the data looks consistent
      const countMatch = sqliteCount === pgCount;
      const structureMatch = sqliteColumns === pgColumns;
      const status = countMatch && structureMatch ? 'PASS' : 'FAIL';
      
      // Save results
      results.push({
        table,
        sqliteCount,
        pgCount,
        countDiff: pgCount - sqliteCount,
        sqliteColumns,
        pgColumns,
        status
      });
      
      if (status === 'PASS') {
        spinner.succeed(`${table}: Data integrity verified (${sqliteCount} records)`);
      } else {
        spinner.fail(`${table}: Data integrity issues detected`);
        if (argv.verbose) {
          console.log(chalk.yellow('SQLite Sample:'), sqliteSample);
          console.log(chalk.yellow('PostgreSQL Sample:'), pgSample);
        }
      }
    } catch (err) {
      spinner.fail(`Failed to test ${table} integrity: ${err.message}`);
      results.push({
        table,
        status: 'ERROR',
        error: err.message
      });
    }
  }
  
  // Display results in a table
  const resultsTable = new Table({
    head: ['Table', 'SQLite Count', 'PG Count', 'Diff', 'SQLite Cols', 'PG Cols', 'Status'],
    colWidths: [20, 15, 15, 10, 15, 15, 10]
  });
  
  results.forEach(result => {
    resultsTable.push([
      result.table,
      result.sqliteCount !== undefined ? result.sqliteCount : '-',
      result.pgCount !== undefined ? result.pgCount : '-',
      result.countDiff !== undefined ? result.countDiff : '-',
      result.sqliteColumns !== undefined ? result.sqliteColumns : '-',
      result.pgColumns !== undefined ? result.pgColumns : '-',
      result.status === 'PASS' 
        ? chalk.green(result.status) 
        : chalk.red(result.status)
    ]);
  });
  
  console.log(resultsTable.toString());
  
  // Return overall result
  return results.every(r => r.status === 'PASS');
}

/**
 * Test performance comparison between SQLite and PostgreSQL
 */
async function testPerformance() {
  console.log(chalk.blue.bold('\n=== Performance Comparison ===\n'));
  
  const results = [];
  
  for (const query of config.querySamples) {
    const spinner = ora(`Testing query: ${query.name}`).start();
    
    try {
      // SQLite performance
      const sqliteResults = [];
      const sqliteStart = Date.now();
      
      for (let i = 0; i < query.repeat; i++) {
        const iterationStart = Date.now();
        await sqliteDb.all(query.sqlite);
        sqliteResults.push(Date.now() - iterationStart);
      }
      
      const sqliteTotal = Date.now() - sqliteStart;
      const sqliteAvg = sqliteResults.reduce((sum, time) => sum + time, 0) / query.repeat;
      
      // PostgreSQL performance
      const pgResults = [];
      const pgStart = Date.now();
      
      for (let i = 0; i < query.repeat; i++) {
        const iterationStart = Date.now();
        await pgPool.query(query.postgres);
        pgResults.push(Date.now() - iterationStart);
      }
      
      const pgTotal = Date.now() - pgStart;
      const pgAvg = pgResults.reduce((sum, time) => sum + time, 0) / query.repeat;
      
      // Calculate improvement percentage
      const improvement = ((sqliteAvg - pgAvg) / sqliteAvg) * 100;
      
      // Save results
      results.push({
        name: query.name,
        sqliteAvg: Math.round(sqliteAvg),
        pgAvg: Math.round(pgAvg),
        improvement: improvement.toFixed(2),
        sqliteMin: Math.min(...sqliteResults),
        sqliteMax: Math.max(...sqliteResults),
        pgMin: Math.min(...pgResults),
        pgMax: Math.max(...pgResults)
      });
      
      spinner.succeed(`${query.name}: SQLite ${Math.round(sqliteAvg)}ms, PostgreSQL ${Math.round(pgAvg)}ms (${improvement.toFixed(2)}% ${improvement >= 0 ? 'faster' : 'slower'})`);
    } catch (err) {
      spinner.fail(`Failed to test ${query.name} performance: ${err.message}`);
      results.push({
        name: query.name,
        status: 'ERROR',
        error: err.message
      });
    }
  }
  
  // Display results in a table
  const resultsTable = new Table({
    head: ['Query', 'SQLite Avg (ms)', 'PG Avg (ms)', 'Improvement', 'SQLite Min/Max', 'PG Min/Max'],
    colWidths: [20, 15, 15, 15, 20, 20]
  });
  
  results.forEach(result => {
    if (result.status === 'ERROR') {
      resultsTable.push([
        result.name,
        chalk.red('ERROR'),
        chalk.red('ERROR'),
        chalk.red('ERROR'),
        chalk.red('ERROR'),
        chalk.red('ERROR')
      ]);
      return;
    }
    
    resultsTable.push([
      result.name,
      result.sqliteAvg,
      result.pgAvg,
      parseFloat(result.improvement) >= 0 
        ? chalk.green(`${result.improvement}%`) 
        : chalk.red(`${result.improvement}%`),
      `${result.sqliteMin}/${result.sqliteMax}`,
      `${result.pgMin}/${result.pgMax}`
    ]);
  });
  
  console.log(resultsTable.toString());
  
  // Calculate overall improvement
  const validResults = results.filter(r => !r.status);
  const overallImprovement = validResults.reduce((sum, result) => sum + parseFloat(result.improvement), 0) / validResults.length;
  
  console.log(chalk.bold(`\nOverall Performance ${overallImprovement >= 0 ? 'Improvement' : 'Reduction'}: ${Math.abs(overallImprovement).toFixed(2)}%`));
  
  // Return overall result
  return overallImprovement >= 0;
}

/**
 * Test concurrency capabilities
 */
async function testConcurrency() {
  console.log(chalk.blue.bold('\n=== Concurrency Capability Test ===\n'));
  
  const numThreads = argv.threads;
  const iterations = 5;
  
  console.log(`Testing with ${numThreads} concurrent connections, ${iterations} iterations each`);
  
  try {
    // SQLite concurrency test
    console.log(chalk.yellow('\nSQLite Concurrency Test'));
    const sqliteStart = Date.now();
    
    // SQLite has limited concurrency, so we run queries sequentially
    for (let t = 0; t < numThreads; t++) {
      for (let i = 0; i < iterations; i++) {
        await sqliteDb.all('SELECT COUNT(*) FROM users');
        await sqliteDb.all('SELECT COUNT(*) FROM conversations');
        process.stdout.write('.');
      }
    }
    
    const sqliteTime = Date.now() - sqliteStart;
    console.log(`\nSQLite completed in: ${sqliteTime}ms`);
    
    // PostgreSQL concurrency test
    console.log(chalk.yellow('\nPostgreSQL Concurrency Test'));
    const pgStart = Date.now();
    
    // Create client connections for concurrent tests
    const clients = [];
    for (let t = 0; t < numThreads; t++) {
      clients.push(pgPool.connect());
    }
    
    // Resolve all client promises
    const resolvedClients = await Promise.all(clients);
    
    // Run concurrent queries
    const tasks = [];
    for (let t = 0; t < numThreads; t++) {
      const client = resolvedClients[t];
      
      tasks.push((async () => {
        try {
          for (let i = 0; i < iterations; i++) {
            await client.query('SELECT COUNT(*) FROM users');
            await client.query('SELECT COUNT(*) FROM conversations');
            process.stdout.write('.');
          }
        } finally {
          client.release();
        }
      })());
    }
    
    // Wait for all tasks to complete
    await Promise.all(tasks);
    
    const pgTime = Date.now() - pgStart;
    console.log(`\nPostgreSQL completed in: ${pgTime}ms`);
    
    // Calculate improvement
    const improvement = ((sqliteTime - pgTime) / sqliteTime) * 100;
    
    console.log(chalk.bold(`\nConcurrency Performance ${improvement >= 0 ? 'Improvement' : 'Reduction'}: ${Math.abs(improvement).toFixed(2)}%`));
    
    return improvement >= 0;
  } catch (err) {
    console.error(chalk.red('Concurrency test failed:'), err);
    return false;
  }
}

/**
 * Run all tests and summarize results
 */
async function runAllTests() {
  const results = {
    integrity: false,
    performance: false,
    concurrency: false
  };
  
  console.log(chalk.blue.bold('=== PostgreSQL Migration Test Harness ==='));
  console.log(chalk.gray(`Mode: ${argv.mode}, Using ${argv.sample ? 'sample' : 'production'} data`));
  
  try {
    // Initialize database connections
    await initDatabases();
    
    // Run selected tests
    if (argv.mode === 'all' || argv.mode === 'integrity') {
      results.integrity = await testDataIntegrity();
    }
    
    if (argv.mode === 'all' || argv.mode === 'performance') {
      results.performance = await testPerformance();
    }
    
    if (argv.mode === 'all' || argv.mode === 'concurrency') {
      results.concurrency = await testConcurrency();
    }
    
    // Print summary
    console.log(chalk.blue.bold('\n=== Test Summary ===\n'));
    
    console.log(`Data Integrity: ${results.integrity 
      ? chalk.green('PASSED') 
      : results.integrity === false ? chalk.red('FAILED') : chalk.gray('NOT RUN')}`);
      
    console.log(`Performance: ${results.performance 
      ? chalk.green('PASSED') 
      : results.performance === false ? chalk.red('FAILED') : chalk.gray('NOT RUN')}`);
      
    console.log(`Concurrency: ${results.concurrency 
      ? chalk.green('PASSED') 
      : results.concurrency === false ? chalk.red('FAILED') : chalk.gray('NOT RUN')}`);
    
    const overallPass = Object.values(results).every(r => r === true);
    console.log(chalk.bold(`\nOverall Result: ${overallPass ? chalk.green('PASSED') : chalk.red('FAILED')}`));
    
    // Generate report file
    const reportData = {
      timestamp: new Date().toISOString(),
      mode: argv.mode,
      dataSource: argv.sample ? 'sample' : 'production',
      results,
      overallPass
    };
    
    const reportPath = path.join(__dirname, '../reports/postgres-test-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(`\nReport saved to: ${reportPath}`);
  } catch (err) {
    console.error(chalk.red('\nTest execution failed:'), err);
  } finally {
    // Close database connections
    await closeDatabases();
  }
}

// Execute main function
runAllTests().catch(err => {
  console.error(chalk.red('Unhandled error:'), err);
  process.exit(1);
});
