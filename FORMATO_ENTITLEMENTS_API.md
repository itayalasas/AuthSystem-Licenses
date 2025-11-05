# Nuevo Formato de Entitlements en API de Validación

## Cambios Implementados

### 1. Estructura de Entitlements Enriquecida

Las funcionalidades ahora se devuelven con información completa del catálogo:

```json
{
  "entitlements": {
    "features": [
      {
        "code": "max_users",
        "name": "Máximo de Usuarios",
        "description": "Número máximo de usuarios que pueden registrarse en la aplicación",
        "value": "50",
        "value_type": "number",
        "unit": "usuarios",
        "category": "limits"
      },
      {
        "code": "api_access",
        "name": "Acceso a API",
        "description": "Habilita acceso completo a la API REST",
        "value": "true",
        "value_type": "boolean",
        "unit": null,
        "category": "features"
      },
      {
        "code": "max_storage_gb",
        "name": "Almacenamiento Máximo",
        "description": "Capacidad máxima de almacenamiento disponible",
        "value": "100",
        "value_type": "number",
        "unit": "GB",
        "category": "limits"
      }
    ]
  }
}
```

### 2. Campos de Cada Funcionalidad

- **code**: Código único de la funcionalidad (usado internamente)
- **name**: Nombre descriptivo legible para mostrar al usuario
- **description**: Descripción detallada de la funcionalidad
- **value**: Valor configurado en el plan (string, puede ser número o booleano)
- **value_type**: Tipo de dato ('number', 'boolean', 'text')
- **unit**: Unidad de medida (ej: 'usuarios', 'GB', 'llamadas/día')
- **category**: Categoría (ej: 'limits', 'features', 'security', 'support')

### 3. Endpoints Afectados

#### POST /validate-user

**Respuesta anterior:**
```json
{
  "subscription": {
    "entitlements": {
      "features": {
        "api_access": false,
        "advanced_reports": false
      },
      "max_users": 3,
      "max_storage_gb": 5
    }
  }
}
```

**Respuesta nueva:**
```json
{
  "subscription": {
    "entitlements": {
      "features": [
        {
          "code": "api_access",
          "name": "Acceso a API",
          "description": "Habilita acceso completo a la API REST",
          "value": "false",
          "value_type": "boolean",
          "unit": null,
          "category": "features"
        },
        {
          "code": "max_users",
          "name": "Máximo de Usuarios",
          "description": "Número máximo de usuarios que pueden registrarse",
          "value": "3",
          "value_type": "number",
          "unit": "usuarios",
          "category": "limits"
        },
        {
          "code": "max_storage_gb",
          "name": "Almacenamiento Máximo",
          "description": "Capacidad máxima de almacenamiento disponible",
          "value": "5",
          "value_type": "number",
          "unit": "GB",
          "category": "limits"
        }
      ]
    }
  },
  "license": {
    "entitlements": {
      "features": [
        // ... mismo formato
      ]
    }
  }
}
```

#### POST /validate-license

Ahora retorna entitlements enriquecidos con la misma estructura.

#### GET /check-feature

**Respuesta anterior:**
```json
{
  "success": true,
  "enabled": true,
  "entitlements": { /* formato antiguo */ }
}
```

**Respuesta nueva:**
```json
{
  "success": true,
  "enabled": true,
  "feature": {
    "code": "api_access",
    "name": "Acceso a API",
    "description": "Habilita acceso completo a la API REST",
    "value": "true",
    "value_type": "boolean",
    "unit": null,
    "category": "features"
  },
  "entitlements": {
    "features": [ /* todas las features */ ]
  }
}
```

## Ventajas del Nuevo Formato

1. **Nombres Descriptivos**: Puedes mostrar nombres legibles al usuario sin necesidad de mapeos manuales
2. **Información Contextual**: Cada funcionalidad incluye su descripción completa
3. **Unidades de Medida**: Sabes si un valor es en GB, usuarios, llamadas, etc.
4. **Categorización**: Puedes agrupar funcionalidades por categoría (límites, características, seguridad, etc.)
5. **Tipo de Dato**: Sabes si debes tratar el valor como número, booleano o texto
6. **Consolidación**: Todas las funcionalidades están en `features`, incluyendo lo que antes era `max_users` y `max_storage_gb`

## Migración desde el Formato Antiguo

Si tu aplicación actualmente usa el formato antiguo, necesitas actualizar tu código:

### Antes:
```javascript
const maxUsers = subscription.entitlements.max_users;
const hasApiAccess = subscription.entitlements.features.api_access;
```

### Ahora:
```javascript
const features = subscription.entitlements.features;

// Buscar por código
const maxUsersFeature = features.find(f => f.code === 'max_users');
const maxUsers = parseInt(maxUsersFeature.value);

const apiAccessFeature = features.find(f => f.code === 'api_access');
const hasApiAccess = apiAccessFeature.value === 'true';
```

### Helper Functions (recomendado):
```javascript
function getFeatureValue(entitlements, code) {
  const feature = entitlements.features.find(f => f.code === code);
  if (!feature) return null;

  switch (feature.value_type) {
    case 'number':
      return parseInt(feature.value) || 0;
    case 'boolean':
      return feature.value === 'true';
    case 'text':
      return feature.value;
    default:
      return feature.value;
  }
}

// Uso
const maxUsers = getFeatureValue(subscription.entitlements, 'max_users');
const hasApiAccess = getFeatureValue(subscription.entitlements, 'api_access');
const storageLimitGB = getFeatureValue(subscription.entitlements, 'max_storage_gb');
```

## Asignación Automática de Plan

Ahora cuando creas un plan, se asigna automáticamente a la aplicación:

1. Creas el plan desde el Dashboard
2. Seleccionas la aplicación
3. El plan se asigna automáticamente
4. El selector de plan en Aplicaciones muestra el plan asignado (solo lectura)
5. Para cambiar el plan, debes editar el plan mismo

Esto garantiza consistencia y evita desincronización entre planes y aplicaciones.
