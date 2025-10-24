@description('The environment name (staging, production)')
param environment string = 'production'

@description('Location for all resources - must match available regions')
param location string = 'eastus'

@description('Administrator login for PostgreSQL server')
@secure()
param administratorLogin string

@description('Administrator password for PostgreSQL server')
@secure()
param administratorLoginPassword string

// Define variables with simplified naming
var appServicePlanName = 'emrsim-plan-${environment}'
var webAppName = 'emrsim-api-${environment}'
var staticWebAppName = 'emrsim-web-${environment}'
var postgreSQLServerName = 'emrsim-db-${environment}'
var postgreSQLDatabaseName = 'emrsimdb'
var redisCacheName = 'emrsim-redis-${environment}'

// Create App Service Plan (using lower tier for students)
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux
  }
}

// Create Web App for backend API
resource webApp 'Microsoft.Web/sites@2022-03-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      webSocketsEnabled: true
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '22-lts'
        }
        {
          name: 'DB_TYPE'
          value: 'postgres'
        }
        {
          name: 'PG_HOST'
          value: '${postgreSQLServer.properties.fullyQualifiedDomainName}'
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
          value: '${redisCache.properties.hostName}'
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
      healthCheckPath: '/api/health'
    }
  }
}

// Create Static Web App for frontend (must be in supported region)
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

// Create PostgreSQL Flexible Server
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

// Create Redis Cache (using Basic tier for students)
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
