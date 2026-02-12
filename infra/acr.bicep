@description('Azure Container Registry name. Use 5-50 characters, lowercase letters and numbers only.')
param acrName string

@description('Azure region for the registry.')
param location string = resourceGroup().location

@allowed([
  'Basic'
  'Standard'
  'Premium'
])
@description('ACR SKU. Basic is usually enough for development.')
param sku string = 'Basic'

@description('Tags to apply to the registry.')
param tags object = {
  project: 'polimoney-hub'
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: sku
  }
  tags: tags
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: {
      retentionPolicy: {
        status: 'enabled'
        days: 7
      }
    }
  }
}

output acrLoginServer string = acr.properties.loginServer
output acrResourceId string = acr.id
