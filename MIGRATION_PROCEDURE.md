# PostgreSQL Migration Procedure

This document outlines the step-by-step procedure for migrating EMRsim-chat from SQLite to PostgreSQL.

## Prerequisites

- Production database backup
- Staging environment configured with PostgreSQL
- Minimum downtime window of 1-2 hours
- Team members available during migration
- Rollback plan prepared and tested

## Pre-Migration Tasks

### 1. Test Migration in Staging Environment

Run the comprehensive test harness to verify data integrity and performance improvements:

```bash
# Install test dependencies
npm install ora chalk cli-table3 yargs

# Run test harness with production data backup
node scripts/postgres-test-harness.js --mode all

# If issues are detected, fix them before proceeding
```

### 2. Configure PostgreSQL for Production

Ensure the production PostgreSQL instance is properly configured:

```sql
-- Set appropriate connection limits
ALTER SYSTEM SET max_connections = '100';

-- Optimize for application workload
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';

-- Set appropriate WAL level for data safety
ALTER SYSTEM SET wal_level = 'replica';

-- Enable connection pooling
ALTER SYSTEM SET max_prepared_transactions = '150';

-- Apply changes
SELECT pg_reload_conf();
```

### 3. Prepare Migration Script

Update configuration values in the migration script:

```bash
# Edit migration script with production credentials
vi src/server/utils/postgresMigration.js

# Test the script with a production backup
node src/server/utils/postgresMigration.js --dry-run
```

### 4. Prepare Application for Feature Flag

Ensure the application can toggle between SQLite and PostgreSQL:

1. Verify database abstraction layer works correctly
2. Set up environment variable `DB_TYPE=sqlite` in current production
3. Test toggling between databases in staging environment

### 5. Verify Backup Procedures

```bash
# Test PostgreSQL backup and restore procedures
pg_dump -U postgres -d emrsim > pg_backup_test.sql
createdb -U postgres emrsim_restore_test
psql -U postgres -d emrsim_restore_test < pg_backup_test.sql

# Verify the restored database works with application
DB_TYPE=postgres PG_DATABASE=emrsim_restore_test npm run start:test
```

## Migration Day Tasks

### 1. Preparation (T-2 Hours)

- [ ] Notify all users of scheduled maintenance
- [ ] Disable new user registrations
- [ ] Set application to read-only mode
- [ ] Take final SQLite backup

```bash
# Take application backup
npm run backup:full

# Verify backup integrity
sqlite3 backup/database_YYYYMMDD.sqlite "PRAGMA integrity_check;"
```

### 2. Migration Execution (T-0)

- [ ] Stop the application

```bash
# Stop all application instances
pm2 stop emrsim-chat
```

- [ ] Run the migration script

```bash
# Execute migration to PostgreSQL
NODE_ENV=production node src/server/utils/postgresMigration.js
```

- [ ] Verify data integrity

```bash
# Run integrity check script
node scripts/postgres-test-harness.js --mode integrity
```

- [ ] Update environment configuration

```bash
# Update environment variable to use PostgreSQL
echo "DB_TYPE=postgres" >> .env
```

### 3. Application Restart and Verification (T+1 Hour)

- [ ] Start application with reduced instance count

```bash
# Start one instance first
pm2 start emrsim-chat --only instance-1
```

- [ ] Verify core functionality
  - [ ] Login
  - [ ] Data retrieval
  - [ ] New conversation creation
  - [ ] Message sending/receiving
  - [ ] Profile updates

- [ ] Start remaining instances

```bash
# Start all remaining instances
pm2 start emrsim-chat
```

- [ ] Disable read-only mode
- [ ] Re-enable user registrations
- [ ] Monitor application for 1 hour

### 4. Post-Migration Verification (T+2 Hours)

- [ ] Run performance tests
- [ ] Verify socket connection reliability
- [ ] Check error rates in monitoring dashboard
- [ ] Notify users that maintenance is complete

## Rollback Procedure

If any critical issues are encountered during migration:

### 1. Stop All Application Instances

```bash
pm2 stop emrsim-chat
```

### 2. Revert Environment Configuration

```bash
# Update environment variable to use SQLite
echo "DB_TYPE=sqlite" >> .env
```

### 3. Restart Application

```bash
pm2 start emrsim-chat
```

### 4. Notify Users of Status

Send notification that the migration has been rolled back and the system is using the previous database.

## Post-Migration Tasks

### 1. Monitor Application Performance

- Track query performance metrics
- Monitor CPU and memory usage
- Check connection pool utilization

### 2. Optimize PostgreSQL Configuration

After 1 week of production usage, analyze and optimize PostgreSQL configuration based on observed usage patterns:

```sql
-- Analyze the database
ANALYZE VERBOSE;

-- Identify slow queries
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 3. Set Up Regular PostgreSQL Backups

```bash
# Add to crontab
crontab -e

# Daily backup at 2:00 AM
0 2 * * * pg_dump -U postgres -d emrsim > /backup/emrsim_$(date +\%Y\%m\%d).sql

# Weekly backup on Sunday
0 3 * * 0 pg_dump -U postgres -Fc -d emrsim > /backup/emrsim_$(date +\%Y\%m\%d).dump
```

### 4. Document Lessons Learned

Schedule a retrospective meeting to discuss:
- What went well during migration
- What challenges were encountered
- How to improve future migrations
- Update documentation with findings

## Success Criteria Checklist

- [ ] Zero data loss during migration
- [ ] Application fully functional with PostgreSQL
- [ ] Query performance meets or exceeds SQLite
- [ ] Multiple application instances running concurrently
- [ ] Backup and recovery procedures verified
- [ ] Monitoring showing normal error rates
- [ ] Users able to access all system features
