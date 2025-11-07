# AuthSystem-Licenses - Panel de Administración

Panel de administración para gestionar aplicaciones, planes, suscripciones y usuarios del sistema de autenticación y licencias.

## 🚀 Características

- ✅ Gestión de Aplicaciones Multi-tenant
- ✅ Planes de Suscripción con MercadoPago
- ✅ Sistema de Licencias
- ✅ Dashboard con Estadísticas
- ✅ Autenticación OAuth 2.0 con Código de Autorización
- ✅ Configuración Dinámica desde API
- ✅ Diseño Responsive (Móvil, Tablet, Desktop)

## 📋 Requisitos

- Node.js 18+
- npm o yarn
- Cuenta de Supabase
- Sistema de Autenticación desplegado (auth-licenses.netlify.app)

## 🛠️ Instalación Local

```bash
# Clonar el repositorio
git clone [tu-repositorio]

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## 🌐 Despliegue en Netlify

### Paso 1: Preparar el Proyecto

El proyecto ya incluye la configuración necesaria:
- `netlify.toml` - Configuración de redirects
- `public/_redirects` - Backup de redirects
- Build command: `npm run build`
- Publish directory: `dist`

### Paso 2: Desplegar en Netlify

1. Ve a [Netlify](https://app.netlify.com/)
2. Clic en "Add new site" → "Import an existing project"
3. Conecta tu repositorio (GitHub, GitLab, etc.)
4. Configura:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Clic en "Deploy site"

Netlify te asignará una URL como: `https://tu-admin-panel-123.netlify.app`

### Paso 3: Configurar URLs de Callback

Actualiza la variable `VITE_REDIRECT_URI` en tu base de datos:

```sql
UPDATE app_config
SET variables = jsonb_set(
  variables,
  '{VITE_REDIRECT_URI}',
  '"https://tu-admin-panel-123.netlify.app/callback"'
);
```

### Paso 4: Configurar en Sistema de Autenticación

En tu sistema de autenticación (auth-licenses.netlify.app):
1. Ve a la configuración de tu aplicación
2. Agrega la URL de callback: `https://tu-admin-panel-123.netlify.app/callback`
3. Guarda los cambios

## 🔧 Configuración

Todas las variables se cargan dinámicamente desde la tabla `app_config` vía la API `/get-env`.

Variables requeridas en `app_config`:

```json
{
  "VITE_AUTH_URL": "https://auth-licenses.netlify.app",
  "VITE_AUTH_APP_ID": "app_bcc65e74-308",
  "VITE_REDIRECT_URI": "https://tu-admin-panel-123.netlify.app/callback",
  "AUTH_VALIDATE_TOKEN": "https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/auth-exchange-code",
  "MERCADOPAGO_ACCESS_TOKEN": "TEST-...",
  "MERCADOPAGO_API_URL": "https://api.mercadopago.com/preapproval_plan"
}
```

## 📱 Responsive Design

La aplicación está completamente optimizada para:

- 📱 **Móviles** (< 640px): Menú hamburguesa, layout vertical
- 📱 **Tablets** (640px - 1024px): Grid adaptativo, controles optimizados
- 💻 **Desktop** (> 1024px): Sidebar fijo, máxima productividad

## 🔐 Flujo de Autenticación

1. Usuario hace clic en "Iniciar Sesión"
2. Redirige a `https://auth-licenses.netlify.app/login`
3. Después de autenticarse, redirige a: `https://tu-app/callback?code=...`
4. App intercambia el código por tokens usando `AUTH_VALIDATE_TOKEN`
5. Tokens guardados y usuario redirigido al dashboard

Ver [NUEVO_FLUJO_AUTH.md](./NUEVO_FLUJO_AUTH.md) para más detalles.

## 📚 Documentación

- [Nuevo Flujo de Autenticación](./NUEVO_FLUJO_AUTH.md)
- [Configuración de Callback en Netlify](./CONFIGURACION_CALLBACK_NETLIFY.md)
- [Configuración de MercadoPago](./CONFIGURACION_MERCADOPAGO.md)
- [Manual de Uso](./MANUAL_DE_USO.md)

## 🏗️ Estructura del Proyecto

```
src/
├── components/       # Componentes reutilizables
├── hooks/           # Custom hooks
├── lib/             # Servicios y utilidades
├── pages/           # Páginas principales
│   ├── Login.tsx
│   ├── AuthCallback.tsx
│   └── Dashboard.tsx
└── index.css        # Estilos globales

supabase/
├── functions/       # Edge Functions
└── migrations/      # Migraciones de BD
```

## 🧪 Testing

```bash
# Build de producción
npm run build

# Preview de build
npm run preview

# Lint
npm run lint

# Type check
npm run typecheck
```

## 🐛 Troubleshooting

### Error 404 en /callback

Verifica que el archivo `_redirects` esté en `dist/` después del build:
```bash
npm run build
ls dist/_redirects
```

### "Configuración no disponible"

Asegúrate de que todas las variables requeridas estén en `app_config`:
```sql
SELECT variables FROM app_config;
```

### Error de CORS

Verifica que los headers CORS estén configurados en tus Edge Functions.

## 📄 Licencia

Propietario: Sistema AuthSystem-Licenses
