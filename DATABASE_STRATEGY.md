# Database Strategy for EMRsim-chat

This document outlines our short-term and long-term database strategy for EMRsim-chat, addressing the current limitations of SQLite and planning for future scaling.

## Current State: SQLite

EMRsim-chat currently uses SQLite as its primary database. While SQLite is excellent for development and testing, it has limitations in a production environment:

- Limited concurrency due to file locking
- No built-in replication or high availability
- Scaling challenges in multi-instance deployments
- Backup complexity

## Short-Term Strategy: Optimized SQLite

### 1. Automated Backup Implementation

We will implement an automated backup solution for SQLite with the following features:

```javascript
// Automated backup script structure
const backupDatabase = async () => {
  // Create backup with date stamp
  // Verify backup integrity
  // Rotate old backups (keep 7 daily, 4 weekly, 3 monthly)
  // Log backup success/failure
};
```

#### Backup Schedule
- Daily backups at 2:00 AM
- Weekly backups stored for 1 month
- Monthly backups stored for 6 months

### 2. Recovery Procedures

1. Stop the application
2. Copy the backup file to replace the corrupted database
3. Verify database integrity
4. Restart the application
5. Validate application functionality

### 3. Connection Pooling Optimization

Implement proper connection pooling to minimize file locking issues:

```javascript
// Connection pool configuration
const pool = {
  max: 10,           // Maximum connections
  min: 2,            // Minimum connections
  idle: 10000,       // Max idle time (ms)
  acquire: 30000,    // Max acquire time (ms)
  evict: 60000,      // Time between eviction runs
};
```

## Long-Term Strategy: PostgreSQL Migration

### 1. Migration Plan

| Phase | Timeline | Description |
|-------|----------|-------------|
| Design | Weeks 1-2 | Schema design, migration strategy |
| Development | Weeks 3-4 | Create migration scripts, update ORM models |
| Testing | Weeks 5-6 | Validate with production-like data volume |
| Deployment | Week 7 | Scheduled migration with downtime window |

### 2. Schema Design Considerations

- Map SQLite types to PostgreSQL types
- Design indexes for query optimization
- Implement proper foreign key constraints
- Consider partitioning for large tables

### 3. Migration Script Approach

```javascript
// High-level migration approach
const migrateToPostgres = async () => {
  // 1. Set up PostgreSQL schema
  // 2. Extract data from SQLite
  // 3. Transform data as needed
  // 4. Load into PostgreSQL
  // 5. Validate record counts and integrity
  // 6. Switch application to new database
};
```

### 4. Deployment Strategy

- Schedule maintenance window
- Perform final SQLite backup
- Execute migration script
- Validate data integrity
- Update application configuration
- Monitor application performance

## Horizontal Scaling Strategy

With PostgreSQL, we'll implement the following scaling approach:

1. Read replicas for read-heavy operations
2. Connection pooling with PgBouncer
3. Query optimization and indexing
4. Consider managed PostgreSQL services (AWS RDS, Azure Database for PostgreSQL)

## Success Metrics

- Zero data loss during migration
- Automated daily backups with verification
- Successful recovery test from backup
- Query performance improvement of 30%+
- Support for 2+ application instances
