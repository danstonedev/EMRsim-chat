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

// Define variables (shorter names for Container Apps 32-char limit)
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var containerAppEnvName = 'emrsim-env-${uniqueSuffix}'
var containerAppName = 'emrsim-api-${uniqueSuffix}'
var staticWebAppName = 'emrsim-web-${environment}-${uniqueString(resourceGroup().id)}'
var postgreSQLServerName = 'emrsim-db-${environment}-${uniqueString(resourceGroup().id)}'
var postgreSQLDatabaseName = 'emrsimdb'
var redisCacheName = 'emrsim-redis-${environment}-${uniqueString(resourceGroup().id)}'
var logAnalyticsName = 'emrsim-logs-${uniqueSuffix}'

// Create Log Analytics Workspace (required for Container Apps)
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Create Container Apps Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Create Container App for backend API
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'db-password'
          value: administratorLoginPassword
        }
        {
          name: 'redis-password'
          value: redisCache.listKeys().primaryKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'emrsim-backend'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' // Placeholder - we'll update this
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'DATABASE_URL'
              value: 'postgresql://${administratorLogin}@${postgreSQLServer.name}:${administratorLoginPassword}@${postgreSQLServer.properties.fullyQualifiedDomainName}:5432/${postgreSQLDatabaseName}?sslmode=require'
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
              secretRef: 'redis-password'
            }
            {
              name: 'REDIS_TLS'
              value: 'true'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// Create Static Web App for frontend (already working)
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

// Use existing Redis Cache (already deployed)
resource redisCache 'Microsoft.Cache/Redis@2023-04-01' existing = {
  name: 'emrsim-redis-production-uat6lbqwl5n7w'
}

// Output important values
output containerAppUrl string = containerApp.properties.configuration.ingress.fqdn
output staticWebAppUrl string = staticWebApp.properties.defaultHostname
output postgreSQLServerName string = postgreSQLServer.name
output postgreSQLDatabaseName string = postgreSQLDatabaseName
output redisCacheName string = redisCache.name
output containerAppName string = containerApp.name
