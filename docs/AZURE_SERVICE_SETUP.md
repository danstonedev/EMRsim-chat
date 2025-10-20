# Azure Services Setup for EMRsim-chat

This document provides detailed instructions for setting up the necessary Azure services to deploy the EMRsim-chat application.

## Prerequisites

- Azure account with active subscription
- Azure CLI installed
- Owner or Contributor access to an Azure subscription
- Git and GitHub CLI installed

## 1. Initial Azure Setup

### 1.1. Login to Azure

```bash
# Login to your Azure account
az login

# Verify your account and subscription
az account show

# If you have multiple subscriptions, set the active one
az account set --subscription <subscription-id>
```

### 1.2. Create Resource Group

```bash
# Create a resource group for the application
az group create --name emrsim-chat-rg --location eastus

# Verify resource group creation
az group show --name emrsim-chat-rg
```

## 2. Service Principal for GitHub Actions

Create a service principal that GitHub Actions will use to deploy resources:

```bash
# Create service principal with Contributor role
az ad sp create-for-rbac --name "github-emrsim-deploy" \
                         --role contributor \
                         --scopes /subscriptions/<subscription-id>/resourceGroups/emrsim-chat-rg \
                         --sdk-auth
```

Save the JSON output to add as a GitHub secret (`AZURE_CREDENTIALS`).

## 3. Creating Required Azure Resources Manually (Optional)

While our Infrastructure as Code (IaC) setup will create resources automatically, you may want to create some resources manually for testing:

### 3.1. App Service Plan (For Backend API)

```bash
# Create App Service Plan
az appservice plan create --name plan-emrsim-staging \
                         --resource-group emrsim-chat-rg \
                         --sku P1v2 \
                         --is-linux

# Create Web App
az webapp create --name app-emrsim-staging \
                --resource-group emrsim-chat-rg \
                --plan plan-emrsim-staging \
                --runtime "NODE|16-lts"
```

### 3.2. Static Web App (For Frontend)

```bash
# Create Static Web App
az staticwebapp create --name stapp-emrsim-staging \
                       --resource-group emrsim-chat-rg \
                       --location "eastus2" \
                       --sku Standard
```

### 3.3. PostgreSQL Flexible Server

```bash
# Create PostgreSQL server
az postgres flexible-server create \
    --name psql-emrsim-staging \
    --resource-group emrsim-chat-rg \
    --location eastus \
    --admin-user emrsimadmin \
    --admin-password "<secure-password>" \
    --sku-name Standard_D2s_v3 \
    --storage-size 32 \
    --version 13

# Create database
az postgres flexible-server db create \
    --resource-group emrsim-chat-rg \
    --server-name psql-emrsim-staging \
    --database-name emrsim
```

### 3.4. Redis Cache

```bash
# Create Redis Cache
az redis create --name redis-emrsim-staging \
                --resource-group emrsim-chat-rg \
                --location eastus \
                --sku Basic \
                --vm-size C0
```

### 3.5. Key Vault

```bash
# Create Key Vault
az keyvault create --name kv-emrsim-staging \
                  --resource-group emrsim-chat-rg \
                  --location eastus

# Add secrets
az keyvault secret set --vault-name kv-emrsim-staging \
                      --name "pg-password" \
                      --value "<postgresql-password>"

az keyvault secret set --vault-name kv-emrsim-staging \
                      --name "redis-password" \
                      --value "<redis-access-key>"
```

## 4. Configure Web App Settings

```bash
# Set application settings for the Web App
az webapp config appsettings set --name app-emrsim-staging \
                                --resource-group emrsim-chat-rg \
                                --settings \
                                  WEBSITE_NODE_DEFAULT_VERSION=~16 \
                                  DB_TYPE=postgres \
                                  PG_HOST=psql-emrsim-staging.postgres.database.azure.com \
                                  PG_DATABASE=emrsim \
                                  PG_PORT=5432 \
                                  PG_USER=emrsimadmin@psql-emrsim-staging \
                                  PG_PASSWORD="@Microsoft.KeyVault(SecretUri=https://kv-emrsim-staging.vault.azure.net/secrets/pg-password/)" \
                                  REDIS_HOST=redis-emrsim-staging.redis.cache.windows.net \
                                  REDIS_PORT=6380 \
                                  REDIS_PASSWORD="@Microsoft.KeyVault(SecretUri=https://kv-emrsim-staging.vault.azure.net/secrets/redis-password/)"

# Enable Web Sockets
az webapp config set --name app-emrsim-staging \
                    --resource-group emrsim-chat-rg \
                    --web-sockets-enabled true
```

## 5. Set Up Managed Identity and Key Vault Access

```bash
# Enable system-assigned managed identity for Web App
az webapp identity assign --name app-emrsim-staging --resource-group emrsim-chat-rg

# Get the principal ID of the Web App's managed identity
principalId=$(az webapp identity show --name app-emrsim-staging --resource-group emrsim-chat-rg --query principalId -o tsv)

# Grant Key Vault access to Web App
az keyvault set-policy --name kv-emrsim-staging \
                      --resource-group emrsim-chat-rg \
                      --object-id $principalId \
                      --secret-permissions get list
```

## 6. Set Up Deployment Slots

```bash
# Create staging slot
az webapp deployment slot create --name app-emrsim-staging \
                               --resource-group emrsim-chat-rg \
                               --slot staging
```

## 7. Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create --app ai-emrsim-staging \
                                       --location eastus \
                                       --resource-group emrsim-chat-rg \
                                       --kind web

# Get the instrumentation key
instrumentationKey=$(az monitor app-insights component show --app ai-emrsim-staging \
                                                          --resource-group emrsim-chat-rg \
                                                          --query instrumentationKey -o tsv)

# Add the instrumentation key to Web App settings
az webapp config appsettings set --name app-emrsim-staging \
                                --resource-group emrsim-chat-rg \
                                --slot staging \
                                --settings APPINSIGHTS_INSTRUMENTATIONKEY=$instrumentationKey
```

## 8. Setting up Static Web App with GitHub

If you want to set up the Static Web App to deploy from GitHub:

```bash
# Get the deployment token
deploymentToken=$(az staticwebapp secrets list --name stapp-emrsim-staging \
                                             --resource-group emrsim-chat-rg \
                                             --query properties.apiKey -o tsv)

echo "Save this deployment token as a GitHub secret named STATIC_WEB_APP_TOKEN:"
echo $deploymentToken
```

## 9. Set Up Alerts

```bash
# Create an action group for email notifications
az monitor action-group create --name emrsim-alerts \
                              --resource-group emrsim-chat-rg \
                              --action email email_receiver_name \
                              --email-receiver-name admin \
                              --email-receiver your-email@example.com

# Create CPU alert for Web App
az monitor metrics alert create --name "High CPU Usage" \
                               --resource-group emrsim-chat-rg \
                               --scopes $(az webapp show --name app-emrsim-staging --resource-group emrsim-chat-rg --query id -o tsv) \
                               --condition "avg Percentage CPU > 80" \
                               --window-size 5m \
                               --evaluation-frequency 1m \
                               --action $(az monitor action-group show --name emrsim-alerts --resource-group emrsim-chat-rg --query id -o tsv)
```

## 10. Setup Azure DevOps Integration (Optional)

If you want to use Azure DevOps alongside GitHub:

```bash
# Install Azure DevOps extension
az extension add --name azure-devops

# Login to Azure DevOps
az devops login

# Set default organization and project
az devops configure --defaults organization=https://dev.azure.com/YourOrg/ project=EMRsim-chat
```

## Next Steps

After setting up the Azure services:

1. Configure GitHub repository with necessary secrets
2. Set up GitHub Actions workflows
3. Deploy the infrastructure using the IaC templates
4. Deploy the application to staging environment
5. Validate the deployment
