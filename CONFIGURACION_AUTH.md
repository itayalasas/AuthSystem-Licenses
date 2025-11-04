# Configuración del Sistema de Autenticación

## Variables de Entorno Requeridas

Configura estas variables en tu archivo `.env`:

```bash
# Supabase (Base de datos)
VITE_SUPABASE_URL=https://veymthufmfqhxxxzfmfi.supabase.co
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key

# Sistema de Autenticación Externo
VITE_AUTH_URL=https://auth-licenses.netlify.app
VITE_AUTH_APP_ID=app_bcc65e74-308
VITE_AUTH_API_KEY=ak_production_0ec4bda83ca0d5c8bfea1bd31763e7d1

# URL de Callback (IMPORTANTE)
VITE_REDIRECT_URI=http://localhost:5173/callback
```

## 📌 VITE_REDIRECT_URI

Esta variable **debe cambiar según el ambiente**:

### Desarrollo Local
```bash
VITE_REDIRECT_URI=http://localhost:5173/callback
```

### Staging/Testing
```bash
VITE_REDIRECT_URI=https://staging.tu-app.netlify.app/callback
```

### Producción
```bash
VITE_REDIRECT_URI=https://tu-app.netlify.app/callback
```

### Con Dominio Personalizado
```bash
VITE_REDIRECT_URI=https://app.tudominio.com/callback
```

---

## 🔗 URLs Generadas por el Sistema

El sistema construye automáticamente las URLs de autenticación usando las variables de entorno.

### Login URL
```
https://auth-licenses.netlify.app/login?app_id=app_bcc65e74-308&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fcallback&api_key=ak_production_0ec4bda83ca0d5c8bfea1bd31763e7d1
```

**Parámetros:**
- `app_id`: ID de tu aplicación registrada
- `redirect_uri`: URL donde recibirás los tokens (URL encoded)
- `api_key`: API key de tu aplicación

### Register URL
```
https://auth-licenses.netlify.app/register?app_id=app_bcc65e74-308&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fcallback&api_key=ak_production_0ec4bda83ca0d5c8bfea1bd31763e7d1
```

**Parámetros:** (iguales al login)

---

## 🔄 Flujo de Autenticación Completo

### 1. Usuario hace click en "Iniciar Sesión"
```javascript
// La app ejecuta:
AuthService.redirectToLogin();

// Construye y redirige a:
// https://auth-licenses.netlify.app/login?app_id=...&redirect_uri=...&api_key=...
```

### 2. Usuario completa el login en el auth system externo

### 3. Auth system redirige de vuelta con tokens
```
http://localhost:5173/callback?token=eyJ0eXAiOiJKV1QiLCJhbGc...&refresh_token=eyJ0eXAiOiJKV1Q...&user_id=ee53617f-09f2-4e54-ba41-7c3e3496aa84&state=authenticated
```

**Parámetros recibidos:**
- `token`: JWT con datos del usuario (expira en 24h)
- `refresh_token`: Token para renovar sesión (expira en 30 días)
- `user_id`: ID único del usuario
- `state`: Estado de la autenticación

### 4. Tu app procesa el callback
```javascript
// /pages/AuthCallback.tsx procesa los tokens
const tokens = AuthService.parseTokenFromUrl();
const user = AuthService.decodeToken(tokens.token);
AuthService.saveTokens(tokens);

// Si es usuario nuevo, crea el tenant automáticamente
if (isNewUser) {
  await onboardNewUser(user);
}

// Redirige al dashboard
window.location.href = '/dashboard';
```

---

## 🎯 Ejemplo de Token Decodificado

Cuando decodificas el JWT token, obtienes:

```json
{
  "sub": "ee53617f-09f2-4e54-ba41-7c3e3496aa84",
  "email": "payalaortiz@gmail.com",
  "name": "Pedro Ayala Ortiz",
  "app_id": "app_bcc65e74-308",
  "role": "administrador",
  "permissions": {
    "inicio": ["read"],
    "clientes": ["create", "read", "update", "delete"],
    "aplicaciones": ["create", "read", "update", "delete"],
    "suscripciones": ["create", "read", "update", "delete"],
    "planes": ["create", "read", "update", "delete"],
    "licencias": ["read", "update", "delete"],
    "uso": ["read"],
    "auditoria": ["read"],
    "configuracion": ["read", "update"]
  },
  "iat": 1762199505,
  "exp": 1762285905,
  "iss": "AuthSystem",
  "aud": "https://tu-app.netlify.app"
}
```

---

## 🔧 Configuración en Netlify

### Variables de Entorno en Netlify

1. Ve a tu proyecto en Netlify
2. **Site settings** → **Environment variables**
3. Agrega las siguientes variables:

```
VITE_SUPABASE_URL = https://veymthufmfqhxxxzfmfi.supabase.co
VITE_SUPABASE_ANON_KEY = tu_key_aqui
VITE_AUTH_URL = https://auth-licenses.netlify.app
VITE_AUTH_APP_ID = app_bcc65e74-308
VITE_AUTH_API_KEY = ak_production_0ec4bda83ca0d5c8bfea1bd31763e7d1
VITE_REDIRECT_URI = https://tu-app.netlify.app/callback
```

### Deploy Contexts (Opcional)

Puedes tener diferentes URLs de callback por ambiente:

**Production:**
```
VITE_REDIRECT_URI = https://tu-app.netlify.app/callback
```

**Deploy Previews:**
```
VITE_REDIRECT_URI = https://deploy-preview-123--tu-app.netlify.app/callback
```

**Branch Deploys:**
```
VITE_REDIRECT_URI = https://dev--tu-app.netlify.app/callback
```

---

## 🧪 Testing Local

### Con localhost
```bash
VITE_REDIRECT_URI=http://localhost:5173/callback
```

### Con ngrok (para testing externo)
```bash
ngrok http 5173
# Copia la URL generada: https://abc123.ngrok.io

VITE_REDIRECT_URI=https://abc123.ngrok.io/callback
```

---

## ✅ Checklist de Configuración

- [ ] Variables de entorno configuradas en `.env`
- [ ] `VITE_REDIRECT_URI` apunta a tu dominio correcto
- [ ] La URL `/callback` existe en tu app
- [ ] El auth system tiene tu redirect_uri en whitelist
- [ ] Las variables están configuradas en Netlify
- [ ] Has probado login y register
- [ ] Los tokens se guardan correctamente
- [ ] El dashboard carga después del login

---

## 🐛 Troubleshooting

### Error: "Invalid redirect_uri"
- Verifica que `VITE_REDIRECT_URI` esté correctamente configurada
- Confirma que el auth system tiene tu URL en la whitelist
- Asegúrate de que la URL incluya `/callback` al final

### Error: "No se recibieron credenciales"
- Verifica que el auth system esté devolviendo `token`, `refresh_token` y `user_id`
- Revisa la consola del navegador para ver los parámetros recibidos

### Token expirado inmediatamente
- Revisa que las fechas `iat` y `exp` del token sean correctas
- Verifica que tu reloj del sistema esté sincronizado

### Redirect loop infinito
- Asegúrate de que `/callback` NO requiera autenticación
- Verifica que el AuthService.isAuthenticated() funcione correctamente

---

## 📞 Soporte

Si tienes problemas con la configuración del auth system externo, contacta al equipo de soporte con:
- Tu `VITE_AUTH_APP_ID`
- La URL de callback que estás usando
- El error específico que recibes
