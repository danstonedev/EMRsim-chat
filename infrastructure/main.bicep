@description('The environment name (staging, production)')
param environment string = 'staging'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Administrator login for PostgreSQL server')
@secure()
param administratorLogin string

@description('Administrator password for PostgreSQL server')
@secure()
param administratorLoginPassword string

// Define variables
var appServicePlanName = 'plan-emrsim-${environment}'
var webAppName = 'app-emrsim-${environment}'
var staticWebAppName = 'stapp-emrsim-${environment}'
var postgreSQLServerName = 'psql-emrsim-${environment}'
var postgreSQLDatabaseName = 'emrsimdb'
var redisCacheName = 'redis-emrsim-${environment}'
var appInsightsName = 'ai-emrsim-${environment}'
var logAnalyticsName = 'log-emrsim-${environment}'
var keyVaultName = 'kv-emrsim-${environment}'

// Create Log Analytics workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Create Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
}

// Create App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: environment == 'production' ? 'P2v2' : 'P1v2'
    tier: 'PremiumV2'
    size: environment == 'production' ? 'P2v2' : 'P1v2'
    family: 'Pv2'
    capacity: environment == 'production' ? 2 : 1
  }
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
      linuxFxVersion: 'NODE|16-lts'
      webSocketsEnabled: true
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~16'
        }
        {
          name: 'DB_TYPE'
          value: 'postgres'
        }
        {
          name: 'PG_HOST'
          value: '${postgreSQLServer.name}.postgres.database.azure.com'
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
          value: '${administratorLogin}@${postgreSQLServer.name}'
        }
        {
          name: 'PG_PASSWORD'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVault.name}.vault.azure.net/secrets/pg-password/)'
        }
        {
          name: 'REDIS_HOST'
          value: '${redisCache.name}.redis.cache.windows.net'
        }
        {
          name: 'REDIS_PORT'
          value: '6380'
        }
        {
          name: 'REDIS_PASSWORD'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVault.name}.vault.azure.net/secrets/redis-password/)'
        }
        {
          name: 'NODE_ENV'
          value: environment
        }
      ]
      healthCheckPath: '/api/health'
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Create staging deployment slot
resource stagingSlot 'Microsoft.Web/sites/slots@2022-03-01' = {
  parent: webApp
  name: 'staging'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|16-lts'
      webSocketsEnabled: true
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~16'
        }
        {
          name: 'DB_TYPE'
          value: 'postgres'
        }
        {
          name: 'PG_HOST'
          value: '${postgreSQLServer.name}.postgres.database.azure.com'
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
          value: '${administratorLogin}@${postgreSQLServer.name}'
        }
        {
          name: 'PG_PASSWORD'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVault.name}.vault.azure.net/secrets/pg-password/)'
        }
        {
          name: 'REDIS_HOST'
          value: '${redisCache.name}.redis.cache.windows.net'
        }
        {
          name: 'REDIS_PORT'
          value: '6380'
        }
        {
          name: 'REDIS_PASSWORD'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVault.name}.vault.azure.net/secrets/redis-password/)'
        }
        {
          name: 'NODE_ENV'
          value: 'staging'
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Create Static Web App for frontend
resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    provider: 'GitHub'
    repositoryUrl: 'https://github.com/yourusername/EMRsim-chat'
    branch: 'main'
    buildProperties: {
      appLocation: '/'
      apiLocation: ''
      outputLocation: 'dist/client'
    }
  }
}

// Create PostgreSQL server
resource postgreSQLServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-01-20-preview' = {
  name: postgreSQLServerName
  location: location
  sku: {
    name: 'Standard_D2s_v3'
    tier: 'GeneralPurpose'
  }
  properties: {
    version: '13'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 100
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: environment == 'production' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: environment == 'production' ? 'ZoneRedundant' : 'Disabled'
    }
  }
}

// Create PostgreSQL database
resource postgreSQLDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-01-20-preview' = {
  parent: postgreSQLServer
  name: postgreSQLDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.UTF8'
  }
}

// Create Redis Cache
resource redisCache 'Microsoft.Cache/redis@2022-06-01' = {
  name: redisCacheName
  location: location
  properties: {
    sku: {
      name: environment == 'production' ? 'Standard' : 'Basic'
      family: 'C'
      capacity: environment == 'production' ? 1 : 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// Create Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: []
    enabledForTemplateDeployment: true
    enableRbacAuthorization: true
  }
}

// Create Key Vault secrets
resource pgPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'pg-password'
  properties: {
    value: administratorLoginPassword
  }
}

resource redisPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'redis-password'
  properties: {
    value: redisCache.listKeys().primaryKey
  }
}

// Grant the Web App access to Key Vault
resource webAppKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webApp.id, keyVault.id, 'Secret Reader')
  scope: keyVault
  properties: {
    principalId: webApp.identity.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalType: 'ServicePrincipal'
  }
}

resource stagingSlotKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(stagingSlot.id, keyVault.id, 'Secret Reader')
  scope: keyVault
  properties: {
    principalId: stagingSlot.identity.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalType: 'ServicePrincipal'
  }
}

// Define outputs for CI/CD
output webAppName string = webApp.name
output staticWebAppName string = staticWebApp.name
output postgresServerName string = postgreSQLServer.name
output appInsightsKey string = appInsights.properties.InstrumentationKey
