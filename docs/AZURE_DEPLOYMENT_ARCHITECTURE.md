# EMRsim-chat Azure Deployment Architecture

This document outlines the architecture for deploying EMRsim-chat to Azure cloud services.

## Architecture Overview

![Azure Architecture Diagram](../assets/azure-architecture.png)

EMRsim-chat will be deployed using a modern cloud-native architecture with these key components:

- **Frontend**: Azure Static Web Apps
- **Backend API**: Azure App Service with WebSocket support
- **Database**: Azure Database for PostgreSQL
- **Caching**: Azure Cache for Redis
- **Monitoring**: Application Insights + Azure Monitor
- **CI/CD**: GitHub Actions + Azure DevOps

## Component Details

### Frontend (Azure Static Web Apps)

The React frontend will be hosted on Azure Static Web Apps, which provides:
- Global CDN distribution
- Built-in CI/CD from GitHub
- Free SSL certificates
- Authentication/authorization

**Configuration:**
- SKU: Standard
- Location: East US (primary)
- Linked to GitHub repository

### Backend API (Azure App Service)

The Node.js backend will run on Azure App Service:
- WebSockets enabled for real-time communication
- Autoscaling based on CPU and memory metrics
- Multiple deployment slots for zero-downtime updates

**Configuration:**
- SKU: Premium v2 P2v2 (2 cores, 7 GB RAM)
- Instances: 2 (min) to 5 (max)
- Always On: Enabled
- WebSockets: Enabled
- Health check path: /api/health
- CORS: Configured for frontend domain

### Database (Azure Database for PostgreSQL)

A fully managed PostgreSQL database:
- High availability with 99.99% SLA
- Automatic backups and point-in-time restore
- VNet integration for enhanced security

**Configuration:**
- SKU: General Purpose, 2 cores, 8 GB RAM
- Storage: 100 GB with autogrow enabled
- Backup retention: 14 days
- PostgreSQL version: 13
- Connection pooling: Enabled
- Private VNet integration: Enabled

### Caching Layer (Azure Cache for Redis)

Redis will be used for session management and caching:
- Improves performance by caching frequent database queries
- Enables session persistence across backend instances

**Configuration:**
- SKU: Standard C1 (1 GB, moderate throughput)
- Clustering: Disabled
- Non-TLS port: Disabled
- Redis version: 6.0
- Persistence: RDB

### Monitoring (Application Insights + Azure Monitor)

Comprehensive monitoring of application and infrastructure:
- Real-time telemetry
- Custom dashboards
- Alerts and notifications
- Performance profiling

**Configuration:**
- Application Insights: Enabled for both frontend and backend
- Daily data cap: 5 GB
- Data retention: 90 days
- Availability tests: Configured for critical endpoints
- Alerts: Set up for core metrics and error rates

## Network Architecture

- **Virtual Network**: All services are secured within a Virtual Network
- **Network Security Groups**: Control inbound/outbound traffic
- **Private Endpoints**: For database connections
- **Application Gateway**: For additional security (WAF)

## Security Architecture

- **Authentication**: Azure AD B2C for user management
- **SSL/TLS**: Enforced for all endpoints
- **Data Encryption**: At-rest and in-transit
- **Key Management**: Azure Key Vault
- **Identity Management**: Managed identities for service-to-service authentication

## Disaster Recovery Strategy

- **Database**: Geo-redundant backups with 14-day retention
- **Deployment Regions**: East US (primary), West US (secondary)
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 5 minutes

## Cost Estimates

| Service | Configuration | Estimated Monthly Cost (USD) |
|---------|---------------|------------------------------|
| Azure Static Web Apps | Standard tier | $19 |
| App Service | Premium v2 P2v2, 2 instances | $292 |
| Azure Database for PostgreSQL | General Purpose, 2 cores | $219 |
| Azure Cache for Redis | Standard C1 | $102 |
| Application Insights | 5 GB daily cap | $150 |
| Key Vault | Standard tier | $3 |
| Azure AD B2C | Per authentication | $10 |
| Other services (Storage, etc.) | - | $30 |
| **Total** | | **~$825/month** |

## Scaling Strategy

### Horizontal Scaling
- App Service: Auto-scale based on CPU utilization (>70%) and memory pressure
- PostgreSQL: Scale read workloads with read replicas

### Vertical Scaling
- Upgrade App Service plan as needed
- Upgrade PostgreSQL compute resources for write-heavy workloads

## Deployment Process Overview

1. Infrastructure provisioning through ARM templates (IaC)
2. Database migration and verification
3. Backend API deployment
4. Frontend deployment
5. Smoke tests and validation
6. Traffic routing

Detailed deployment steps are outlined in [DEPLOYMENT_PROCEDURE.md](./DEPLOYMENT_PROCEDURE.md).
