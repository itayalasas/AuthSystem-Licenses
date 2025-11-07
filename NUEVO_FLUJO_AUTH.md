# Nuevo Flujo de Autenticación con Código de Autorización

## Descripción General

El sistema ahora utiliza el flujo de autenticación OAuth 2.0 con código de autorización, que es más seguro que el flujo anterior.

## Flujo de Autenticación

### 1. Inicio de Sesión

El usuario hace clic en "Iniciar Sesión" y es redirigido a:
```
https://auth-licenses.netlify.app/login
```

Con los parámetros:
- `redirect_uri`: URL de callback de la aplicación
- `app_id`: ID de la aplicación

### 2. Callback con Código

Después de autenticarse, el usuario es redirigido de vuelta a:
```
https://tu-app.com/callback?code=442867fb-58e9-4dd3-8db1-dbd075345376&state=authenticated
```

### 3. Intercambio de Código por Tokens

La aplicación automáticamente:

1. Extrae el parámetro `code` de la URL
2. Obtiene la URL del endpoint de validación desde la API de configuración:
   - Variable: `AUTH_VALIDA_TOKEN`
   - Valor: `https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/auth-exchange-code`

3. Hace una petición POST al endpoint con:
```json
{
  "code": "442867fb-58e9-4dd3-8db1-dbd075345376",
  "application_id": "app_bcc65e74-308"
}
```

### 4. Respuesta del Servidor

El servidor responde con los tokens y datos del usuario:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "f09d5b26-25a6-4c75-8923-49e6477e66ee",
      "email": "payalaortiz@gmail.com",
      "name": "Pedro Ayala",
      "role": "administrador",
      "permissions": {
        "dashboard": ["create", "delete", "read", "update"],
        "templates": ["create", "delete", "read", "update"],
        "statistics": ["create", "delete", "read", "update"],
        "documentation": ["create", "delete", "read", "update"],
        "settings": ["create", "delete", "read", "update"]
      },
      "metadata": {},
      "created_at": "2025-11-03T20:08:20.423798+00:00"
    },
    "application": {
      "id": "app_bcc65e74-308"
    },
    "tenant": {
      "id": "9fed307b-5753-4204-b6c8-1504b251ad55",
      "name": "Pedro Ayala",
      "owner_user_id": "f09d5b26-25a6-4c75-8923-49e6477e66ee",
      "owner_email": "payalaortiz@gmail.com",
      "organization_name": "Pedro Ayala Org",
      "status": "active"
    },
    "has_access": false,
    "available_plans": []
  }
}
```

### 5. Almacenamiento y Redirección

La aplicación:
1. Guarda los tokens en `localStorage`
2. Guarda la información del usuario
3. Redirige al dashboard

## Configuración Requerida

### Variables de Configuración (en `app_config`)

```json
{
  "AUTH_VALIDA_TOKEN": "https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/auth-exchange-code",
  "VITE_AUTH_APP_ID": "app_bcc65e74-308",
  "VITE_AUTH_URL": "https://auth-licenses.netlify.app",
  "VITE_REDIRECT_URI": "https://tu-app.com/callback"
}
```

**Nota:** La variable se llama `AUTH_VALIDA_TOKEN` (no AUTH_VALIDATE_TOKEN). Esta variable se obtiene automáticamente desde la API externa `/get-env`.

## Beneficios de este Flujo

1. **Mayor Seguridad**: Los tokens nunca se exponen en la URL
2. **Código de un Solo Uso**: El código de autorización solo se puede usar una vez
3. **Tiempo Limitado**: Los códigos expiran rápidamente
4. **Validación del Servidor**: El servidor valida el código antes de emitir tokens
5. **Compatibilidad OAuth 2.0**: Sigue el estándar de la industria

## Manejo de Errores

El sistema maneja los siguientes errores:

- **Sin código**: "No se recibió el código de autorización"
- **Configuración faltante**: "Configuración de autenticación no disponible"
- **Código inválido**: "Error intercambiando código"
- **Error de servidor**: "Error procesando la autenticación"

Todos los errores redirigen automáticamente a la página de inicio después de 3 segundos.

## Refresh Token

El sistema incluye un `refresh_token` que puede usarse para obtener nuevos `access_token` sin requerir que el usuario vuelva a iniciar sesión.

**Duración de tokens:**
- `access_token`: 86400 segundos (24 horas)
- `refresh_token`: 2592000 segundos (30 días)
