@description('The environment name')
param environment string = 'production'

@description('Location for most resources')
param location string = 'westus2'

@description('Administrator login for MySQL server')
@secure()
param administratorLogin string

@description('Administrator password for MySQL server')
@secure()
param administratorLoginPassword string

// Define variables (shorter names for Container Apps 32-char limit)
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var containerAppEnvName = 'emrsim-env-${uniqueSuffix}'
var containerAppName = 'emrsim-api-${uniqueSuffix}'
var staticWebAppName = 'emrsim-web-${environment}-${uniqueString(resourceGroup().id)}'
var mySQLServerName = 'emrsim-mysql-${environment}-${uniqueString(resourceGroup().id)}'
var mySQLDatabaseName = 'emrsimdb'
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

// Create MySQL Flexible Server
resource mySQLServer 'Microsoft.DBforMySQL/flexibleServers@2023-06-30' = {
  name: mySQLServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    version: '8.0.21'
    storage: {
      storageSizeGB: 20
      autoGrow: 'Enabled'
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

// Create MySQL Database
resource mySQLDatabase 'Microsoft.DBforMySQL/flexibleServers/databases@2023-06-30' = {
  parent: mySQLServer
  name: mySQLDatabaseName
  properties: {
    charset: 'utf8mb4'
    collation: 'utf8mb4_unicode_ci'
  }
}

// Create MySQL Firewall Rule for Azure Services
resource mySQLFirewallRuleAzure 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2023-06-30' = {
  parent: mySQLServer
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Create MySQL Firewall Rule for all IPs (for development)
resource mySQLFirewallRuleAll 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2023-06-30' = {
  parent: mySQLServer
  name: 'AllowAllIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

// Use existing Redis Cache
resource redisCache 'Microsoft.Cache/Redis@2023-04-01' existing = {
  name: 'emrsim-redis-production-uat6lbqwl5n7w'
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
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' // Placeholder
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
              value: 'mysql://${administratorLogin}:${administratorLoginPassword}@${mySQLServer.properties.fullyQualifiedDomainName}:3306/${mySQLDatabaseName}?ssl=true'
            }
            {
              name: 'DB_TYPE'
              value: 'mysql'
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

// Use existing Static Web App
resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' existing = {
  name: 'emrsim-web-production-uat6lbqwl5n7w'
}

// Output important values
output containerAppUrl string = containerApp.properties.configuration.ingress.fqdn
output staticWebAppUrl string = staticWebApp.properties.defaultHostname
output mySQLServerName string = mySQLServer.name
output mySQLDatabaseName string = mySQLDatabaseName
output redisCacheName string = redisCache.name
output containerAppName string = containerApp.name
output logAnalyticsName string = logAnalytics.name
