# EMRsim-chat Database Recovery Procedures

This document outlines the step-by-step procedures for recovering the EMRsim-chat database in case of data corruption or failure. It covers both SQLite (current) and PostgreSQL (planned) recovery procedures.

## SQLite Recovery Procedures

### 1. Diagnosing SQLite Database Issues

Before attempting recovery, verify if the database is actually corrupted:

```bash
# Check database integrity
sqlite3 database.sqlite "PRAGMA integrity_check;"

# Check for database lock
lsof | grep database.sqlite
```

Common issues include:
- File corruption due to system crash
- Database lock issues
- Journal file corruption

### 2. Standard Recovery Procedure

#### Step 1: Stop the application

```bash
# If running with PM2
pm2 stop emrsim-chat

# If running with systemd
sudo systemctl stop emrsim-chat
```

#### Step 2: Backup the corrupted database

```bash
cp database.sqlite database.sqlite.corrupted
```

#### Step 3: Restore from the most recent backup

```bash
# Find the most recent backup
ls -la backups/daily/

# Copy the backup to the database location
cp backups/daily/backup_YYYYMMDD_HHMM.sqlite database.sqlite

# Verify file permissions
chown node:node database.sqlite
chmod 644 database.sqlite
```

#### Step 4: Verify database integrity

```bash
sqlite3 database.sqlite "PRAGMA integrity_check;"
```

#### Step 5: Restart the application

```bash
# If using PM2
pm2 start emrsim-chat

# If using systemd
sudo systemctl start emrsim-chat
```

#### Step 6: Verify application functionality

1. Check the application logs for any database-related errors
2. Verify that users can login and access data
3. Check that recent data is accessible (if applicable)

### 3. Point-in-Time Recovery

If you need to recover to a specific point in time:

#### Step 1: Identify the appropriate backup

```bash
# List all available backups
ls -la backups/daily/ backups/weekly/ backups/monthly/
```

#### Step 2: Restore the backup from before the data loss/corruption

Follow steps 1-6 from the Standard Recovery Procedure using the identified backup.

#### Step 3: Apply WAL (Write-Ahead Log) if available

```bash
# Check if WAL files exist for the period
ls -la database.sqlite-wal*

# Apply WAL if it exists and is valid (this happens automatically when opening the database)
sqlite3 database.sqlite "SELECT count(*) FROM users;"
```

### 4. Recovering from Journal Corruption

If the database is locked due to a corrupted journal file:

```bash
# Remove journal files
rm database.sqlite-journal
rm database.sqlite-wal
rm database.sqlite-shm

# Check database integrity
sqlite3 database.sqlite "PRAGMA integrity_check;"
```

**Warning:** This may result in loss of recent transactions that haven't been committed to the main database file.

## PostgreSQL Recovery Procedures (After Migration)

### 1. Diagnosing PostgreSQL Database Issues

```bash
# Connect to PostgreSQL
psql -U postgres -d emrsim

# Check table sizes and health
SELECT pg_size_pretty(pg_total_relation_size('table_name')) AS total_size,
       pg_size_pretty(pg_relation_size('table_name')) AS table_size,
       pg_size_pretty(pg_total_relation_size('table_name') - pg_relation_size('table_name')) AS index_size
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('table_name') DESC;
```

### 2. Standard Recovery Procedure

#### Step 1: Stop the application

```bash
pm2 stop emrsim-chat
# or
sudo systemctl stop emrsim-chat
```

#### Step 2: Identify appropriate backup

```bash
# List available backups
ls -la /path/to/pg_backups/
```

#### Step 3: Restore the database

```bash
# Drop and recreate the database
psql -U postgres -c "DROP DATABASE emrsim;"
psql -U postgres -c "CREATE DATABASE emrsim WITH OWNER emrsim_user;"

# Restore from backup
pg_restore -U postgres -d emrsim /path/to/pg_backups/emrsim_YYYYMMDD.dump
```

#### Step 4: Verify database integrity

```bash
psql -U postgres -d emrsim -c "SELECT count(*) FROM users;"
```

#### Step 5: Restart the application

```bash
pm2 start emrsim-chat
# or
sudo systemctl start emrsim-chat
```

### 3. Point-in-Time Recovery (PITR)

PostgreSQL supports Point-in-Time Recovery using WAL (Write-Ahead Log) archiving:

#### Step 1: Create recovery configuration

```bash
# Create recovery.conf in PostgreSQL data directory
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /path/to/wal_archive/%f %p'
recovery_target_time = '2023-06-15 14:30:00'
EOF
```

#### Step 2: Restore the base backup before the target time

```bash
pg_restore -U postgres -d emrsim /path/to/pg_backups/emrsim_base.dump
```

#### Step 3: Start PostgreSQL in recovery mode

```bash
sudo systemctl start postgresql
```

PostgreSQL will apply WAL files until it reaches the specified time.

#### Step 4: Complete recovery

```bash
psql -U postgres -c "SELECT pg_wal_replay_resume();"
```

### 4. Automated Daily Backup Procedure for PostgreSQL

```bash
#!/bin/bash
# PostgreSQL backup script

BACKUP_DIR="/path/to/pg_backups"
DATE=$(date +"%Y%m%d_%H%M")
DB_NAME="emrsim"
DB_USER="postgres"

# Create backup
pg_dump -Fc -U $DB_USER $DB_NAME > $BACKUP_DIR/${DB_NAME}_${DATE}.dump

# Verify backup
if pg_restore -l $BACKUP_DIR/${DB_NAME}_${DATE}.dump > /dev/null; then
  echo "Backup created successfully: ${DB_NAME}_${DATE}.dump"
else
  echo "Backup verification failed!"
  exit 1
fi

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "${DB_NAME}_*.dump" -mtime +7 -delete
```

## Monitoring and Prevention

### 1. Database Health Monitoring

Set up monitoring for:
- Disk usage
- Database size
- Query performance
- Connection count
- Lock contention

### 2. Preventive Measures

1. **Regular Integrity Checks**

   ```bash
   # For SQLite
   sqlite3 database.sqlite "PRAGMA integrity_check;"
   
   # For PostgreSQL
   psql -U postgres -d emrsim -c "VACUUM ANALYZE;"
   ```

2. **Database Maintenance**

   ```bash
   # For PostgreSQL
   psql -U postgres -d emrsim -c "VACUUM FULL ANALYZE;"
   ```

3. **Automated Alerts**

   Configure alerts for:
   - Failed backups
   - Database size exceeding thresholds
   - Long-running queries
   - High CPU/memory usage

## Emergency Contact Information

In case of critical database issues:

- Primary DBA: [Name] - [Contact Information]
- Secondary DBA: [Name] - [Contact Information]
- System Administrator: [Name] - [Contact Information]
