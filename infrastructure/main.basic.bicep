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

// Create App Service Plan with BASIC tier (uses Standard VM quota)
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
  properties: {
    reserved: false // Windows
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
      alwaysOn: true // Available on Basic tier
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'DATABASE_URL'
          value: 'postgresql://${administratorLogin}:${administratorLoginPassword}@${postgreSQLServer.properties.fullyQualifiedDomainName}:5432/${postgreSQLDatabaseName}?sslmode=require'
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
      ]
    }
  }
}

// Create Static Web App for frontend
resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/yourusername/emrsim-chat'
    branch: 'main'
    buildProperties: {
      appLocation: '/frontend'
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}

// Create PostgreSQL Flexible Server
resource postgreSQLServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: postgreSQLServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    version: '14'
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

// Create PostgreSQL Database
resource postgreSQLDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgreSQLServer
  name: postgreSQLDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Create PostgreSQL Firewall Rule for Azure Services
resource postgreSQLFirewallRuleAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgreSQLServer
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Create PostgreSQL Firewall Rule for all IPs (for development)
resource postgreSQLFirewallRuleAll 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgreSQLServer
  name: 'AllowAllIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

// Create Redis Cache
resource redisCache 'Microsoft.Cache/Redis@2023-04-01' = {
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

// Output important values
output webAppUrl string = webApp.properties.defaultHostName
output staticWebAppUrl string = staticWebApp.properties.defaultHostname
output postgreSQLServerName string = postgreSQLServer.name
output postgreSQLDatabaseName string = postgreSQLDatabaseName
output redisCacheName string = redisCache.name
output webAppName string = webApp.name
