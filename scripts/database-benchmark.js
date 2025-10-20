/**
 * Database Performance Benchmark
 * 
 * This script compares SQLite vs PostgreSQL performance for common operations
 * used in the EMRsim-chat application.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const chalk = require('chalk');
const Table = require('cli-table3');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { performance } = require('perf_hooks');

// Process command line arguments
const argv = yargs(hideBin(process.argv))
  .option('iterations', {
    alias: 'i',
    describe: 'Number of iterations for each test',
    type: 'number',
    default: 100
  })
  .option('concurrency', {
    alias: 'c',
    describe: 'Max concurrent operations',
    type: 'number',
    default: 10
  })
  .option('output', {
    alias: 'o',
    describe: 'Output file for results (JSON)',
    type: 'string',
    default: '../reports/database-benchmark-results.json'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Database configuration
const config = {
  sqlite: {
    path: process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/database.sqlite')
  },
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'emrsim',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
  }
};

// Benchmark scenarios
const scenarios = [
  {
    name: 'Simple Select',
    sqlite: 'SELECT id, email, name, role FROM users LIMIT 10',
    postgres: 'SELECT id, email, name, role FROM users LIMIT 10',
    category: 'read'
  },
  {
    name: 'Count All Records',
    sqlite: 'SELECT COUNT(*) FROM conversations',
    postgres: 'SELECT COUNT(*) FROM conversations',
    category: 'read'
  },
  {
    name: 'Join Query',
    sqlite: `
      SELECT c.id, c.title, u.name as username
      FROM conversations c
      JOIN users u ON c.user_id = u.id
      LIMIT 20
    `,
    postgres: `
      SELECT c.id, c.title, u.name as username
      FROM conversations c
      JOIN users u ON c.user_id = u.id
      LIMIT 20
    `,
    category: 'read'
  },
  {
    name: 'Filtered Query',
    sqlite: `
      SELECT * FROM messages 
      WHERE conversation_id = (SELECT id FROM conversations LIMIT 1)
      ORDER BY created_at DESC
      LIMIT 50
    `,
    postgres: `
      SELECT * FROM messages 
      WHERE conversation_id = (SELECT id FROM conversations LIMIT 1)
      ORDER BY created_at DESC
      LIMIT 50
    `,
    category: 'read'
  },
  {
    name: 'Insert Operation',
    sqlite: `
      INSERT INTO performance_metrics (name, value, tags, timestamp)
      VALUES ('test_metric', 123.45, '{}', datetime('now'))
    `,
    postgres: `
      INSERT INTO performance_metrics (name, value, tags, timestamp)
      VALUES ('test_metric', 123.45, '{}', NOW())
    `,
    category: 'write'
  },
  {
    name: 'Update Operation',
    sqlite: `
      UPDATE performance_metrics 
      SET value = value + 1 
      WHERE name = 'test_metric' 
      AND id IN (SELECT id FROM performance_metrics WHERE name = 'test_metric' LIMIT 1)
    `,
    postgres: `
      UPDATE performance_metrics 
      SET value = value + 1 
      WHERE name = 'test_metric' 
      AND id IN (SELECT id FROM performance_metrics WHERE name = 'test_metric' LIMIT 1)
    `,
    category: 'write'
  },
  {
    name: 'Transaction - Multiple Operations',
    sqlite: async (db) => {
      await db.run('BEGIN TRANSACTION');
      try {
        await db.run(`
          INSERT INTO performance_metrics (name, value, tags, timestamp)
          VALUES ('tx_metric', 100, '{}', datetime('now'))
        `);
        await db.run(`
          UPDATE performance_metrics 
          SET value = value + 10 
          WHERE name = 'tx_metric'
          AND id IN (SELECT id FROM performance_metrics WHERE name = 'tx_metric' LIMIT 1)
        `);
        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }
    },
    postgres: async (client) => {
      await client.query('BEGIN');
      try {
        await client.query(`
          INSERT INTO performance_metrics (name, value, tags, timestamp)
          VALUES ('tx_metric', 100, '{}', NOW())
        `);
        await client.query(`
          UPDATE performance_metrics 
          SET value = value + 10 
          WHERE name = 'tx_metric'
          AND id IN (SELECT id FROM performance_metrics WHERE name = 'tx_metric' LIMIT 1)
        `);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    },
    category: 'transaction'
  },
  {
    name: 'Aggregate Query',
    sqlite: `
      SELECT 
        strftime('%Y-%m-%d', created_at) as day,
        COUNT(*) as message_count,
        AVG(LENGTH(message)) as avg_message_length
      FROM messages
      GROUP BY strftime('%Y-%m-%d', created_at)
      ORDER BY day DESC
      LIMIT 10
    `,
    postgres: `
      SELECT 
        date_trunc('day', created_at)::date as day,
        COUNT(*) as message_count,
        AVG(LENGTH(message)) as avg_message_length
      FROM messages
      GROUP BY date_trunc('day', created_at)
      ORDER BY day DESC
      LIMIT 10
    `,
    category: 'read'
  }
];

// Database connections
let sqliteDb;
let pgPool;

/**
 * Initialize database connections
 */
async function initializeDatabases() {
  console.log(chalk.blue('Initializing database connections...'));
  
  try {
    // SQLite connection
    sqliteDb = await open({
      filename: config.sqlite.path,
      driver: sqlite3.Database
    });
    
    // Enable WAL mode for better concurrent performance
    await sqliteDb.run('PRAGMA journal_mode = WAL');
    
    // PostgreSQL connection
    pgPool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      max: 20 // connection pool size
    });
    
    console.log(chalk.green('✓ Database connections initialized'));
    
    // Create test tables if they don't exist
    await ensureTestTablesExist();
  } catch (err) {
    console.error(chalk.red('✗ Failed to initialize databases:'), err);
    throw err;
  }
}

/**
 * Create test tables if they don't exist
 */
async function ensureTestTablesExist() {
  console.log(chalk.blue('Ensuring test tables exist...'));
  
  // Create performance metrics table in SQLite if it doesn't exist
  await sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value REAL NOT NULL,
      tags TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create performance metrics table in PostgreSQL if it doesn't exist
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      value REAL NOT NULL,
      tags JSONB,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  
  console.log(chalk.green('✓ Test tables verified'));
}

/**
 * Close database connections
 */
async function closeDatabases() {
  console.log(chalk.blue('Closing database connections...'));
  
  if (sqliteDb) {
    await sqliteDb.close();
  }
  
  if (pgPool) {
    await pgPool.end();
  }
  
  console.log(chalk.green('✓ Database connections closed'));
}

/**
 * Run a single test scenario
 */
async function runScenario(scenario, db, type) {
  const results = [];
  const iterations = argv.iterations;
  
  console.log(chalk.yellow(`Running ${type} scenario: ${scenario.name} (${iterations} iterations)`));
  
  // Sequential execution
  if (typeof scenario[type] === 'string') {
    const query = scenario[type];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      if (type === 'sqlite') {
        await sqliteDb.all(query);
      } else {
        await pgPool.query(query);
      }
      
      const duration = performance.now() - start;
      results.push(duration);
      
      if (i % 10 === 0) {
        process.stdout.write('.');
      }
    }
  }
  // Function-based execution for complex scenarios
  else if (typeof scenario[type] === 'function') {
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      if (type === 'sqlite') {
        await scenario[type](sqliteDb);
      } else {
        const client = await pgPool.connect();
        try {
          await scenario[type](client);
        } finally {
          client.release();
        }
      }
      
      const duration = performance.now() - start;
      results.push(duration);
      
      if (i % 10 === 0) {
        process.stdout.write('.');
      }
    }
  }
  
  console.log(' Done');
  
  // Calculate statistics
  const total = results.reduce((sum, time) => sum + time, 0);
  const avg = total / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  
  // Calculate percentiles
  results.sort((a, b) => a - b);
  const p50 = results[Math.floor(results.length * 0.5)];
  const p90 = results[Math.floor(results.length * 0.9)];
  const p95 = results[Math.floor(results.length * 0.95)];
  const p99 = results[Math.floor(results.length * 0.99)];
  
  return {
    total,
    avg,
    min,
    max,
    p50,
    p90,
    p95,
    p99,
    raw: results
  };
}

/**
 * Run concurrent test for a scenario
 */
async function runConcurrentScenario(scenario, type) {
  const concurrency = argv.concurrency;
  const iterationsPerWorker = Math.ceil(argv.iterations / concurrency);
  
  console.log(chalk.yellow(`Running ${type} concurrent scenario: ${scenario.name} (${concurrency} workers, ${iterationsPerWorker} iterations each)`));
  
  // Function to create a worker
  const createWorker = async (workerId) => {
    const results = [];
    
    if (type === 'sqlite') {
      // For SQLite, we need to create separate connections for concurrent testing
      const db = await open({
        filename: config.sqlite.path,
        driver: sqlite3.Database
      });
      
      try {
        for (let i = 0; i < iterationsPerWorker; i++) {
          const start = performance.now();
          
          if (typeof scenario.sqlite === 'string') {
            await db.all(scenario.sqlite);
          } else {
            await scenario.sqlite(db);
          }
          
          const duration = performance.now() - start;
          results.push(duration);
        }
      } finally {
        await db.close();
      }
    } else {
      // For PostgreSQL, use the connection pool
      for (let i = 0; i < iterationsPerWorker; i++) {
        const start = performance.now();
        
        if (typeof scenario.postgres === 'string') {
          await pgPool.query(scenario.postgres);
        } else {
          const client = await pgPool.connect();
          try {
            await scenario.postgres(client);
          } finally {
            client.release();
          }
        }
        
        const duration = performance.now() - start;
        results.push(duration);
      }
    }
    
    process.stdout.write('.');
    return results;
  };
  
  // Create and run workers
  const workers = Array.from({ length: concurrency }, (_, i) => createWorker(i));
  const workerResults = await Promise.all(workers);
  
  // Combine results
  const results = workerResults.flat();
  console.log(' Done');
  
  // Calculate statistics
  const total = results.reduce((sum, time) => sum + time, 0);
  const avg = total / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  
  // Calculate percentiles
  results.sort((a, b) => a - b);
  const p50 = results[Math.floor(results.length * 0.5)];
  const p90 = results[Math.floor(results.length * 0.9)];
  const p95 = results[Math.floor(results.length * 0.95)];
  const p99 = results[Math.floor(results.length * 0.99)];
  
  return {
    total,
    avg,
    min,
    max,
    p50,
    p90,
    p95,
    p99,
    raw: results,
    concurrency
  };
}

/**
 * Format milliseconds for display
 */
function formatMs(ms) {
  return `${ms.toFixed(2)}ms`;
}

/**
 * Run the benchmark
 */
async function runBenchmark() {
  console.log(chalk.blue.bold('=== Database Performance Benchmark ==='));
  console.log(`Iterations: ${argv.iterations}, Concurrency: ${argv.concurrency}\n`);
  
  try {
    await initializeDatabases();
    
    const results = [];
    
    // Sequential tests
    console.log(chalk.blue.bold('\n=== Sequential Tests ===\n'));
    
    for (const scenario of scenarios) {
      // Run SQLite test
      const sqliteResults = await runScenario(scenario, sqliteDb, 'sqlite');
      
      // Run PostgreSQL test
      const pgResults = await runScenario(scenario, pgPool, 'postgres');
      
      // Calculate improvement
      const improvement = ((sqliteResults.avg - pgResults.avg) / sqliteResults.avg) * 100;
      
      results.push({
        name: scenario.name,
        category: scenario.category,
        mode: 'sequential',
        sqlite: sqliteResults,
        postgres: pgResults,
        improvement
      });
    }
    
    // Concurrent tests
    console.log(chalk.blue.bold('\n=== Concurrent Tests ===\n'));
    
    for (const scenario of scenarios) {
      // Run SQLite concurrent test
      const sqliteConcurrentResults = await runConcurrentScenario(scenario, 'sqlite');
      
      // Run PostgreSQL concurrent test
      const pgConcurrentResults = await runConcurrentScenario(scenario, 'postgres');
      
      // Calculate improvement
      const improvement = (
        (sqliteConcurrentResults.avg - pgConcurrentResults.avg) / sqliteConcurrentResults.avg
      ) * 100;
      
      results.push({
        name: scenario.name,
        category: scenario.category,
        mode: 'concurrent',
        sqlite: sqliteConcurrentResults,
        postgres: pgConcurrentResults,
        improvement
      });
    }
    
    // Display results
    displayResults(results);
    
    // Save results to file
    saveResults(results);
  } finally {
    await closeDatabases();
  }
}

/**
 * Display benchmark results
 */
function displayResults(results) {
  console.log(chalk.blue.bold('\n=== Benchmark Results ===\n'));
  
  // Sequential tests table
  const sequentialResults = results.filter(r => r.mode === 'sequential');
  const sequentialTable = new Table({
    head: ['Scenario', 'Category', 'SQLite Avg', 'PG Avg', 'Improvement', 'PG P95'],
    colWidths: [25, 15, 15, 15, 15, 15]
  });
  
  sequentialResults.forEach(result => {
    sequentialTable.push([
      result.name,
      result.category,
      formatMs(result.sqlite.avg),
      formatMs(result.postgres.avg),
      result.improvement >= 0 
        ? chalk.green(`${result.improvement.toFixed(2)}%`) 
        : chalk.red(`${result.improvement.toFixed(2)}%`),
      formatMs(result.postgres.p95)
    ]);
  });
  
  console.log(chalk.yellow('Sequential Test Results:'));
  console.log(sequentialTable.toString());
  
  // Concurrent tests table
  const concurrentResults = results.filter(r => r.mode === 'concurrent');
  const concurrentTable = new Table({
    head: ['Scenario', 'Category', 'SQLite Avg', 'PG Avg', 'Improvement', 'PG P95'],
    colWidths: [25, 15, 15, 15, 15, 15]
  });
  
  concurrentResults.forEach(result => {
    concurrentTable.push([
      result.name,
      result.category,
      formatMs(result.sqlite.avg),
      formatMs(result.postgres.avg),
      result.improvement >= 0 
        ? chalk.green(`${result.improvement.toFixed(2)}%`) 
        : chalk.red(`${result.improvement.toFixed(2)}%`),
      formatMs(result.postgres.p95)
    ]);
  });
  
  console.log(chalk.yellow('\nConcurrent Test Results:'));
  console.log(concurrentTable.toString());
  
  // Summary
  const overallSeqImprovement = sequentialResults.reduce(
    (sum, result) => sum + result.improvement, 
    0
  ) / sequentialResults.length;
  
  const overallConcImprovement = concurrentResults.reduce(
    (sum, result) => sum + result.improvement, 
    0
  ) / concurrentResults.length;
  
  console.log(chalk.blue.bold('\nOverall Improvement:'));
  console.log(`Sequential: ${overallSeqImprovement >= 0 
    ? chalk.green(`${overallSeqImprovement.toFixed(2)}%`) 
    : chalk.red(`${overallSeqImprovement.toFixed(2)}%`)}`);
    
  console.log(`Concurrent: ${overallConcImprovement >= 0 
    ? chalk.green(`${overallConcImprovement.toFixed(2)}%`) 
    : chalk.red(`${overallConcImprovement.toFixed(2)}%`)}`);
}

/**
 * Save results to file
 */
function saveResults(results) {
  const outputPath = path.resolve(__dirname, argv.output);
  const dir = path.dirname(outputPath);
  
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Save results
  const reportData = {
    timestamp: new Date().toISOString(),
    iterations: argv.iterations,
    concurrency: argv.concurrency,
    results,
    summary: {
      sequentialImprovement: results
        .filter(r => r.mode === 'sequential')
        .reduce((sum, result) => sum + result.improvement, 0) / 
        results.filter(r => r.mode === 'sequential').length,
      concurrentImprovement: results
        .filter(r => r.mode === 'concurrent')
        .reduce((sum, result) => sum + result.improvement, 0) / 
        results.filter(r => r.mode === 'concurrent').length
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
  console.log(chalk.green(`\nResults saved to: ${outputPath}`));
}

// Run the benchmark
runBenchmark().catch(err => {
  console.error(chalk.red('Benchmark failed:'), err);
  process.exit(1);
});
