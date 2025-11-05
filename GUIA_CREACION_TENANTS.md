# Guía de Creación de Tenants

## Descripción General

Un **tenant** representa una organización o empresa en el sistema multi-tenant. Cada tenant puede tener múltiples usuarios, suscripciones y licencias.

## Métodos de Creación de Tenants

### 1. Creación Automática (Desde Aplicación Externa)

Cuando un usuario se registra desde una aplicación externa integrada, el tenant se crea automáticamente mediante el endpoint:

**Endpoint:** `POST /tenant-onboarding`

**Payload:**
```json
{
  "external_app_id": "app_id_de_tu_aplicacion",
  "user_id": "user_123",
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "company_name": "Mi Empresa",
  "subdomain": "mi-empresa",
  "plan_id": "plan_uuid",
  "start_trial": true
}
```

**Qué se crea automáticamente:**
- ✅ Tenant con información del usuario
- ✅ Suscripción al plan especificado (o plan "Starter" por defecto)
- ✅ Licencia activa (trial o paid según el plan)
- ✅ Registro en `tenant_applications`
- ✅ Subdominio generado automáticamente si no se especifica

**Proceso:**
1. Valida que la aplicación externa exista y esté activa
2. Verifica si el usuario ya tiene un tenant para esa aplicación
3. Si no existe, crea el tenant con información del usuario
4. Asigna el plan especificado o el plan "Starter" por defecto
5. Crea la suscripción con período de prueba si aplica
6. Genera la licencia inicial
7. Vincula el tenant con la aplicación

### 2. Creación Manual (Desde Panel de Administración)

Los administradores pueden crear manualmente un tenant para usuarios que ya están registrados en una aplicación pero no tienen tenant asociado.

**Ubicación:** Dashboard > Aplicaciones > [Ver Usuarios] > Usuario sin tenant > "Crear Tenant"

**Cuándo usar:**
- Usuario registrado en la aplicación pero sin tenant
- Migración de usuarios existentes
- Corrección de datos incompletos
- Testing y desarrollo

**Qué se crea:**
- ✅ Tenant básico con información del usuario
- ⚠️ NO crea suscripción automáticamente
- ⚠️ NO crea licencia automáticamente

**Proceso:**
1. El administrador hace clic en "Crear Tenant" para un usuario sin tenant
2. Se crea el tenant usando la información del usuario (nombre, email, user_id externo)
3. El usuario queda vinculado al tenant
4. El administrador puede entonces asignar un plan manualmente

## Flujo Completo: Usuario Sin Tenant → Usuario Con Licencia

### Desde el Panel de Administración:

1. **Ver usuarios sin tenant:**
   - Dashboard → Aplicaciones → [Seleccionar app] → "Usuarios" (icono de usuarios)
   - Se muestran todos los usuarios de la aplicación
   - Los usuarios sin tenant muestran un mensaje de advertencia

2. **Crear tenant:**
   - Click en botón "Crear Tenant" para el usuario
   - El sistema crea automáticamente el tenant usando:
     - Nombre del usuario
     - Email del usuario
     - ID externo del usuario
   - El tenant queda activo inmediatamente

3. **Asignar plan:**
   - Una vez creado el tenant, aparecen los planes disponibles
   - Seleccionar un plan de la lista
   - El sistema crea automáticamente:
     - Suscripción al plan seleccionado
     - Licencia activa
     - Relación tenant-application
   - Respeta el período de prueba configurado en el plan

## Diferencias Entre Creación Automática y Manual

| Característica | Automática (API) | Manual (Admin Panel) |
|----------------|------------------|---------------------|
| **Trigger** | Registro en app externa | Admin hace clic |
| **Tenant** | ✅ Creado con metadatos completos | ✅ Creado con datos básicos |
| **Suscripción** | ✅ Creada automáticamente | ❌ Requiere asignación manual |
| **Licencia** | ✅ Generada automáticamente | ❌ Se genera al asignar plan |
| **Subdominio** | ✅ Generado/especificado | ❌ No aplica |
| **Plan** | Plan especificado o Starter | El admin lo selecciona |
| **Trial** | Configurable en request | Respeta config del plan |

## Estados del Usuario en el Sistema

### Usuario Registrado (Sin Tenant)
```
✅ Existe en application_users
❌ No tiene tenant
❌ No tiene suscripción
❌ No tiene licencia
🔴 No puede usar la aplicación
```

### Usuario Con Tenant (Sin Plan)
```
✅ Existe en application_users
✅ Tiene tenant
❌ No tiene suscripción
❌ No tiene licencia
🟡 Puede prepararse para asignación de plan
```

### Usuario Con Suscripción Activa
```
✅ Existe en application_users
✅ Tiene tenant
✅ Tiene suscripción activa
✅ Tiene licencia activa
🟢 Puede usar la aplicación completa
```

## API de Admin para Tenants

### Crear Tenant Manualmente

**Endpoint:** `POST /admin-api/tenants`

**Headers:**
```
X-Admin-Token: admin_001
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Nombre de la Organización",
  "owner_user_id": "external_user_id",
  "external_tenant_id": "optional_external_id",
  "plan_id": "optional_plan_uuid",
  "application_id": "app_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tenant_uuid",
    "name": "Nombre de la Organización",
    "owner_user_id": "external_user_id",
    "status": "active",
    "created_at": "2025-11-05T10:00:00Z"
  }
}
```

### Asignar Plan a Usuario

**Endpoint:** `POST /admin-api/users/assign-plan`

**Headers:**
```
X-Admin-Token: admin_001
Content-Type: application/json
```

**Body:**
```json
{
  "external_user_id": "user_external_id",
  "plan_id": "plan_uuid",
  "application_id": "app_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "subscription_uuid",
    "tenant_id": "tenant_uuid",
    "plan_id": "plan_uuid",
    "status": "trialing",
    "period_start": "2025-11-05T10:00:00Z",
    "period_end": "2025-12-05T10:00:00Z",
    "trial_end": "2025-11-19T10:00:00Z"
  }
}
```

## Triggers Automáticos

### Creación Automática de Licencia

Cuando se crea una suscripción (ya sea automática o manual), se dispara un trigger que:

1. Genera una licencia activa
2. Calcula fecha de expiración
3. Copia los entitlements del plan
4. Genera un JTI único (JWT ID)

**Trigger:** `create_license_on_subscription`

**Se ejecuta:** Después de INSERT en `subscriptions`

## Mejores Prácticas

### Para Aplicaciones Externas
✅ Usar `tenant-onboarding` en el flujo de registro
✅ Pasar `company_name` cuando sea posible
✅ Especificar `plan_id` si conoces el plan deseado
✅ Habilitar `start_trial: true` para períodos de prueba

### Para Administradores
✅ Verificar que el usuario existe antes de crear tenant
✅ Crear tenant primero, luego asignar plan
✅ Revisar que el plan tenga las funcionalidades correctas
✅ Verificar que se generó la licencia después de asignar plan

### Para Desarrollo
✅ Usar creación manual para testing rápido
✅ Validar que los triggers funcionan correctamente
✅ Verificar estados de suscripción y licencia
✅ Probar flujo completo desde registro hasta uso

## Troubleshooting

### Usuario no puede asignar plan
**Problema:** Botón "Asignar plan" no aparece
**Solución:** Verificar que el usuario tenga un tenant. Si no, crear tenant primero.

### Tenant creado pero sin suscripción
**Problema:** Usuario tiene tenant pero no aparece plan
**Solución:** Asignar manualmente un plan desde el panel de administración.

### Licencia no se genera
**Problema:** Suscripción creada pero sin licencia
**Solución:** Verificar que el trigger `create_license_on_subscription` esté activo. Puede ejecutarse manualmente:

```sql
SELECT create_license_on_subscription();
```

### Usuario aparece duplicado
**Problema:** Mismo usuario con múltiples tenants
**Solución:** Verificar el `owner_user_id`. Cada usuario debe tener solo un tenant por aplicación.

## Monitoreo y Auditoría

Todas las acciones de creación y modificación de tenants se registran en:

- **Tabla:** `admin_audit_log`
- **Eventos:**
  - `tenant.created`
  - `subscription.created`
  - `license.generated`
  - `plan.assigned`

Para ver el historial:
```sql
SELECT * FROM admin_audit_log
WHERE entity_type = 'tenant'
ORDER BY created_at DESC;
```
