@description('The environment name')
param environment string = 'production'

@description('Location for most resources')
param location string = 'westus2'

@description('Administrator login for PostgreSQL server')
@secure()
param administratorLogin string

@description('Administrator password for PostgreSQL server')
@secure()
param administratorLoginPassword string

// Define variables
var appServicePlanName = 'emrsim-plan-${environment}'
var webAppName = 'emrsim-api-${environment}-${uniqueString(resourceGroup().id)}'
var staticWebAppName = 'emrsim-web-${environment}-${uniqueString(resourceGroup().id)}'
var postgreSQLServerName = 'emrsim-db-${environment}-${uniqueString(resourceGroup().id)}'
var postgreSQLDatabaseName = 'emrsimdb'
var redisCacheName = 'emrsim-redis-${environment}-${uniqueString(resourceGroup().id)}'

// Create App Service Plan with FREE tier (no quota needed)
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'F1'
    tier: 'Free'
    size: 'F1'
    family: 'F'
    capacity: 1
  }
  properties: {
    reserved: false // Free tier is Windows only
  }
}

// Create Web App for backend API
resource webApp 'Microsoft.Web/sites@2022-03-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      nodeVersion: '~22'
      webSocketsEnabled: true
      alwaysOn: false // Not available on Free tier
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'DB_TYPE'
          value: 'postgres'
        }
        {
          name: 'PG_HOST'
          value: postgreSQLServer.properties.fullyQualifiedDomainName
        }
        {
          name: 'PG_DATABASE'
          value: postgreSQLDatabaseName
        }
        {
          name: 'PG_PORT'
          value: '5432'
        }
        {
          name: 'PG_USER'
          value: administratorLogin
        }
        {
          name: 'PG_PASSWORD'
          value: administratorLoginPassword
        }
        {
          name: 'PG_SSL'
          value: 'true'
        }
        {
          name: 'REDIS_HOST'
          value: redisCache.properties.hostName
        }
        {
          name: 'REDIS_PORT'
          value: '6380'
        }
        {
          name: 'REDIS_PASSWORD'
          value: redisCache.listKeys().primaryKey
        }
        {
          name: 'REDIS_TLS'
          value: 'true'
        }
        {
          name: 'NODE_ENV'
          value: environment
        }
        {
          name: 'PORT'
          value: '8080'
        }
      ]
    }
  }
}

// Create Static Web App (Free tier)
resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/frontend'
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}

// Create PostgreSQL Flexible Server (smallest tier)
resource postgreSQLServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: postgreSQLServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '14'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Configure firewall to allow Azure services
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgreSQLServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Create PostgreSQL database
resource postgreSQLDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgreSQLServer
  name: postgreSQLDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Create Redis Cache (Basic tier - smallest paid tier)
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisCacheName
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// Outputs
output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output postgresServerName string = postgreSQLServer.name
output postgresFQDN string = postgreSQLServer.properties.fullyQualifiedDomainName
output redisHostName string = redisCache.properties.hostName

output deploymentNotes string = '''
IMPORTANT: This deployment uses FREE tier App Service which has limitations:
- No "Always On" (app may sleep after 20 min idle)
- 60 minutes of compute per day
- 1 GB storage
- Windows only (no Linux containers)

For production use, you'll need to request quota increase for Basic VMs or use a paid subscription.
'''
