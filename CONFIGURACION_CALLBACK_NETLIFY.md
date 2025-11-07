# Configuración de Callback en Netlify

## Problema Actual

La URL de callback está redirigiendo a la misma aplicación de autenticación en lugar de tu aplicación admin:
```
https://auth-license.netlify.app/callback?code=...
```

Debería redirigir a:
```
https://TU-APP-ADMIN.netlify.app/callback?code=...
```

## Solución

### 1. Desplegar tu Aplicación Admin en Netlify

Primero, necesitas desplegar esta aplicación (admin panel) en Netlify:

1. Ve a [Netlify](https://app.netlify.com/)
2. Haz clic en "Add new site" → "Import an existing project"
3. Conecta tu repositorio
4. Configura el build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Despliega el sitio

Netlify te asignará una URL como: `https://tu-admin-panel-123.netlify.app`

### 2. Actualizar la URL de Callback en la Base de Datos

Una vez desplegado, actualiza la variable `VITE_REDIRECT_URI` en la base de datos:

```sql
UPDATE app_config
SET variables = jsonb_set(
  variables,
  '{VITE_REDIRECT_URI}',
  '"https://tu-admin-panel-123.netlify.app/callback"'
);
```

### 3. Configurar la Aplicación en el Sistema de Autenticación

En tu sistema de autenticación (auth-licenses.netlify.app), debes:

1. Ir a la configuración de la aplicación `app_bcc65e74-308`
2. Actualizar la URL de callback permitida a: `https://tu-admin-panel-123.netlify.app/callback`
3. Guardar los cambios

### 4. Archivos de Configuración de Netlify

Ya están creados y listos:

**netlify.toml**
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
```

**public/_redirects**
```
/* /index.html 200
```

Estos archivos aseguran que las rutas como `/callback` funcionen correctamente en Netlify.

## Flujo Correcto

1. Usuario hace login en: `https://auth-licenses.netlify.app/login`
2. Después de autenticarse, redirige a: `https://tu-admin-panel-123.netlify.app/callback?code=...`
3. Tu aplicación admin procesa el código y obtiene los tokens
4. Usuario es redirigido al dashboard

## Variables de Entorno en Netlify

En tu sitio de Netlify, no necesitas configurar variables de entorno porque todo se carga dinámicamente desde la API `/get-env`.

Sin embargo, asegúrate de que estas variables existan en `app_config`:

```json
{
  "VITE_AUTH_URL": "https://auth-licenses.netlify.app",
  "VITE_AUTH_APP_ID": "app_bcc65e74-308",
  "VITE_REDIRECT_URI": "https://tu-admin-panel-123.netlify.app/callback",
  "AUTH_VALIDATE_TOKEN": "https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/auth-exchange-code"
}
```

## Dominio Personalizado (Opcional)

Si quieres usar un dominio personalizado:

1. En Netlify, ve a "Domain settings"
2. Agrega tu dominio personalizado (ej: `admin.tu-dominio.com`)
3. Actualiza todas las URLs de callback para usar el nuevo dominio

## Probar Localmente

Para probar localmente (desarrollo):

1. Usa un túnel como ngrok: `ngrok http 5173`
2. Obtendrás una URL pública temporal: `https://abc123.ngrok.io`
3. Actualiza temporalmente `VITE_REDIRECT_URI` a: `https://abc123.ngrok.io/callback`
4. Configura esta URL en el sistema de autenticación como callback permitido

## Troubleshooting

### Error 404 en /callback

- Verifica que `_redirects` esté en el directorio `dist` después del build
- Verifica que `netlify.toml` esté en la raíz del proyecto

### Error "Invalid redirect_uri"

- Asegúrate de que la URL de callback en `app_config` coincida exactamente con la configurada en el sistema de autenticación
- Incluye `https://` al inicio
- No incluyas barra final `/` al final de la URL (a menos que esté también en la configuración del sistema de auth)

### Código no válido

- Los códigos de autorización expiran rápidamente (usualmente 10 minutos)
- No puedes reutilizar un código - cada login genera un nuevo código
