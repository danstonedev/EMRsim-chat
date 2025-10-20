# PostgreSQL Migration Plan for EMRsim-chat

This document outlines the detailed strategy for migrating the EMRsim-chat database from SQLite to PostgreSQL to support horizontal scaling and improved concurrency.

## 1. Current Database Assessment

### Current SQLite Schema

We need to analyze the current SQLite schema to identify any SQLite-specific features that might need adaptation for PostgreSQL:

```sql
-- Run this to extract current schema information
.output schema_dump.sql
.schema
```

### Data Volume Analysis

- Estimated total database size: [size]
- Largest tables and record counts:
  - conversations: ~[count] records
  - patient_records: ~[count] records
  - user_sessions: ~[count] records

### Identifying Critical Tables

The following tables require special attention during migration due to their size or complexity:
- `conversations`: Contains chat history and simulation data
- `patient_records`: Contains medical record simulations
- `user_sessions`: Contains active session data

## 2. PostgreSQL Schema Design

### Schema Creation Script

```sql
-- Base tables (adapt based on your actual schema)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'active'
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

### PostgreSQL-Specific Optimizations

1. **Use UUIDs for Primary Keys**: Better for distributed systems and future sharding
2. **JSONB for Flexible Schema**: Use JSONB for metadata and flexible attributes
3. **Proper Indexing**: B-tree indexes for equality comparisons, GIN for JSONB fields
4. **Timestamp with Timezone**: Ensures consistency across timezones

### Table Partitioning Strategy

For large tables like `messages` and `conversation_history`, implement table partitioning:

```sql
-- Example partitioning for messages table by creation date
CREATE TABLE messages (
    id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    sender VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
) PARTITION BY RANGE (created_at);

-- Create partitions by month
CREATE TABLE messages_y2023m01 PARTITION OF messages
    FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');
    
CREATE TABLE messages_y2023m02 PARTITION OF messages
    FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');

-- Create partition for current month dynamically
```

## 3. Data Migration Strategy

### Migration Tool Selection

We'll use a combination of:
- `pg_dump` and `pg_restore` for schema transfer
- Custom Node.js scripts for data transformation and loading

### Migration Process Steps

1. **Freeze Application (Maintenance Mode)**:
   - Put application in read-only mode
   - Display maintenance banner to users

2. **Export SQLite Data**:
   ```bash
   sqlite3 database.sqlite .dump > sqlite_dump.sql
   ```

3. **Transform Data**:
   ```javascript
   // Create a Node.js script for data transformation
   const transformData = async () => {
     // Connect to SQLite
     // Read data in batches (e.g., 1000 records)
     // Transform data format as needed
     // Write to CSV files for PostgreSQL COPY
   };
   ```

4. **Load Data into PostgreSQL**:
   ```bash
   # Use COPY command for fast data loading
   psql -c "\COPY users FROM 'users.csv' WITH CSV HEADER"
   psql -c "\COPY conversations FROM 'conversations.csv' WITH CSV HEADER"
   ```

5. **Verify Data Integrity**:
   ```javascript
   // Validation script
   const validateMigration = async () => {
     // Compare record counts
     // Validate sample records
     // Check foreign key integrity
   };
   ```

### Migration Timing and Requirements

- **Estimated Downtime**: 1-2 hours (based on current data volume)
- **Disk Space Requirements**: 3x current database size
- **Pre-migration Testing**: Run on snapshot of production data

## 4. Application Changes

### Database Connection Configuration

Update the application to use PostgreSQL instead of SQLite:

```javascript
// Before: SQLite configuration
const db = new sqlite3.Database('./database.sqlite');

// After: PostgreSQL configuration
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'emrsim',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Query Updates

Identify and update SQLite-specific queries:

1. **Replace SQLite `AUTOINCREMENT` with PostgreSQL Sequences**
2. **Update Text Pattern Matching**:
   - SQLite: `LIKE '%term%'`
   - PostgreSQL: Consider using `ILIKE` or `text_pattern_ops` indexes
3. **Update Date/Time Functions**:
   - SQLite: `strftime()`
   - PostgreSQL: Use `to_char()`, `date_trunc()`, etc.

### ORM Configuration Updates

If using an ORM like Sequelize or TypeORM, update the dialect and connection settings:

```javascript
// TypeORM example
const connection = await createConnection({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [...],
  synchronize: false,
});
```

## 5. Testing Strategy

### Pre-Migration Testing

1. **Setup Test Environment**:
   - Clone production schema to test PostgreSQL instance
   - Load sample data from production

2. **Unit Tests**:
   ```bash
   # Run database-specific unit tests
   npm run test:database
   ```

3. **Performance Testing**:
   - Benchmark common queries
   - Test under concurrent load
   - Compare with SQLite performance

### Migration Dry Run

1. Perform complete migration on a copy of production data
2. Measure migration time
3. Validate data integrity
4. Test application functionality

## 6. Rollback Strategy

### Rollback Triggers

Rollback will be initiated if any of these occur:
- Data integrity validation fails
- Application fails critical functionality tests
- Migration exceeds maximum allowed downtime (2 hours)

### Rollback Process

1. **Keep SQLite Database**:
   - Do not delete the original SQLite database
   - Keep backups of all export/import files

2. **Restore Application Configuration**:
   - Revert database configuration to use SQLite
   - Deploy previous version of the application code

3. **Communicate Status**:
   - Notify users of the status
   - Document issues for future migration attempt

## 7. Post-Migration Tasks

### Performance Optimization

1. **Run ANALYZE to Update Statistics**:
   ```sql
   ANALYZE VERBOSE;
   ```

2. **Review and Optimize Indexes**:
   - Use `pg_stat_statements` to identify slow queries
   - Add indexes as needed

3. **Configure Autovacuum**:
   ```sql
   ALTER TABLE messages SET (
     autovacuum_vacuum_threshold = 1000,
     autovacuum_analyze_threshold = 1000
   );
   ```

### Monitoring and Maintenance

1. **Set Up Health Checks**:
   - Database connectivity
   - Query performance
   - Connection pool usage

2. **Configure Backup Strategy**:
   - Daily full backups
   - Point-in-time recovery with WAL archiving
   - Test restoration procedures

## 8. Implementation Schedule

| Phase | Timeframe | Key Activities |
|-------|-----------|---------------|
| Planning | Week 1 | Finalize schema design, identify query changes |
| Development | Weeks 2-3 | Create migration scripts, update application code |
| Testing | Week 4 | Test migration process on copy of production data |
| Execution | Week 5 | Execute migration during maintenance window |
| Verification | Week 5-6 | Monitor application performance, fix issues |

## 9. Resources Required

- Database Administrator: 1 person
- Backend Developer: 1-2 people
- DevOps Engineer: 1 person
- Testing Team: 1-2 people

## 10. Success Criteria

- Zero data loss during migration
- Application functions correctly with new database
- Query performance meets or exceeds previous metrics
- Database can handle 3x current user load
- Horizontal scaling capability demonstrated
