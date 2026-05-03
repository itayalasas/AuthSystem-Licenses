import { useState } from 'react';
import { Book, Code, Copy, ChevronDown, ChevronRight, Check, Settings, AlertTriangle, Shield, Key, Globe, RefreshCw, CreditCard, Zap } from 'lucide-react';

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
  response?: any;
}

interface ApiSection {
  title: string;
  description: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
}

const BASE_URL = 'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleW10aHVmbWZxaHh4eHpmbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjY2MjUsImV4cCI6MjA3NzgwMjYyNX0.jAhRpp4ulEUuhTqEdMrcI2xhaMOJYA1RPnd-BDs2YIo';

const API_SECTIONS: ApiSection[] = [
  {
    title: 'Validation API',
    description: 'Valida usuarios, licencias y verifica acceso a la aplicación',
    baseUrl: `${BASE_URL}/validation-api`,
    endpoints: [
      {
        method: 'POST',
        path: '/validate-user',
        description: 'Valida si un usuario tiene acceso a la aplicación',
        headers: {
          'X-API-Key': 'ak_6f446cec54594865b7f8df385bbb903b',
          'Content-Type': 'application/json'
        },
        body: {
          external_user_id: '09be8acd-6d9a-43b4-9748-a0db3bc678b2'
        },
        response: {
          success: true,
          has_access: true,
          tenant: { id: '...', name: '...' },
          subscription: { status: 'trialing', plan: { name: 'Starter' } },
          license: { jti: '...', expires_at: '...' }
        }
      },
      {
        method: 'POST',
        path: '/validate-license',
        description: 'Valida un token de licencia por JTI',
        headers: {
          'X-API-Key': 'ak_6f446cec54594865b7f8df385bbb903b',
          'Content-Type': 'application/json'
        },
        body: {
          jti: 'license-jti-uuid'
        },
        response: {
          success: true,
          valid: true,
          license: { jti: '...', entitlements: {} }
        }
      },
      {
        method: 'GET',
        path: '/check-feature',
        description: 'Verifica si una característica está habilitada',
        headers: {
          'X-API-Key': 'ak_6f446cec54594865b7f8df385bbb903b'
        },
        params: {
          jti: 'license-jti-uuid',
          feature: 'advanced_analytics'
        },
        response: {
          success: true,
          enabled: true,
          entitlements: {}
        }
      },
      {
        method: 'POST',
        path: '/record-usage',
        description: 'Registra una métrica de uso',
        headers: {
          'X-API-Key': 'ak_6f446cec54594865b7f8df385bbb903b',
          'Content-Type': 'application/json'
        },
        body: {
          tenant_id: 'tenant-uuid',
          metric: 'api_calls',
          value: 1,
          metadata: {}
        },
        response: {
          success: true,
          data: { id: '...', metric: 'api_calls' }
        }
      }
    ]
  },
  {
    title: 'Planes por Aplicación',
    description: 'Consulta los planes activos de una aplicación. Ideal para asignar un plan por defecto en sistemas externos.',
    baseUrl: `${BASE_URL}/validation-api`,
    endpoints: [
      {
        method: 'GET',
        path: '/plans',
        description: 'Retorna todos los planes activos de una aplicación, incluyendo id, precio, entitlements, datos de MercadoPago y referencia externa. Ordenados por sort_order y precio.',
        params: {
          external_app_id: '3acde27f-74d3-465e-aaec-94ad46faa881',
        },
        response: {
          success: true,
          application: {
            id: 'uuid-interno',
            name: 'Mi Aplicación',
            slug: 'mi-app',
            external_app_id: '3acde27f-74d3-465e-aaec-94ad46faa881',
          },
          count: 2,
          plans: [
            {
              id: 'plan-uuid-1',
              name: 'Starter',
              description: 'Plan inicial',
              price: '15.00',
              currency: 'UYU',
              billing_cycle: 'monthly',
              trial_days: 14,
              entitlements: { features: [{ code: 'api_calls', name: 'API Calls', value: 1000 }] },
              is_active: true,
              sort_order: 0,
              billing_day: null,
              external_reference: null,
              mercadopago: {
                preapproval_plan_id: 'mp_plan_id',
                status: 'active',
                init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=...',
                back_url: 'https://tu-app.com',
              },
              created_at: '2025-11-01T00:00:00Z',
              updated_at: '2025-11-01T00:00:00Z',
            },
          ],
        },
      },
    ],
  },
  {
    title: 'Tenant Onboarding',
    description: 'Registra nuevos tenants/usuarios en el sistema',
    baseUrl: `${BASE_URL}/tenant-onboarding`,
    endpoints: [
      {
        method: 'POST',
        path: '/',
        description: 'Crea un nuevo tenant con trial automático',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: {
          external_app_id: '3acde27f-74d3-465e-aaec-94ad46faa881',
          user_id: 'user-uuid',
          email: 'usuario@ejemplo.com',
          name: 'Usuario Demo',
          company_name: 'Empresa Demo',
          start_trial: true
        },
        response: {
          success: true,
          message: 'Tenant creado exitosamente',
          tenant: { id: '...', name: '...' },
          subscription: { status: 'trialing', trial_end: '...' },
          is_new: true
        }
      }
    ]
  },
  {
    title: 'Payment Processor',
    description: 'Consulta estado de suscripciones y pagos',
    baseUrl: `${BASE_URL}/payment-processor`,
    endpoints: [
      {
        method: 'GET',
        path: '/subscription/by-user',
        description: 'Obtiene suscripción por external_app_id y user_id',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`
        },
        params: {
          external_app_id: '3acde27f-74d3-465e-aaec-94ad46faa881',
          user_id: '09be8acd-6d9a-43b4-9748-a0db3bc678b2'
        },
        response: {
          success: true,
          data: {
            subscription_id: '...',
            status: 'trialing',
            is_in_trial: true,
            trial_days_remaining: 13,
            needs_payment: false,
            plan: { name: 'Starter', price: '15.00' }
          }
        }
      },
      {
        method: 'GET',
        path: '/subscription/:id/status',
        description: 'Obtiene el estado detallado de una suscripción',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`
        },
        response: {
          success: true,
          data: {
            subscription_id: '...',
            status: 'active',
            days_until_expiry: 25,
            last_payment: { amount: '15.00', status: 'completed' }
          }
        }
      },
      {
        method: 'GET',
        path: '/pending-payments',
        description: 'Lista todos los pagos pendientes',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`
        },
        response: {
          success: true,
          count: 5,
          data: []
        }
      }
    ]
  },
  {
    title: 'Payment Manager',
    description: 'Gestiona creación y actualización de pagos',
    baseUrl: `${BASE_URL}/payment-manager`,
    endpoints: [
      {
        method: 'POST',
        path: '/payments/by-user',
        description: 'Crea un pago para un usuario',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: {
          external_app_id: '3acde27f-74d3-465e-aaec-94ad46faa881',
          user_id: '09be8acd-6d9a-43b4-9748-a0db3bc678b2',
          payment_provider: 'mercadopago',
          payment_method: 'credit_card'
        },
        response: {
          success: true,
          data: {
            id: '...',
            amount: '15.00',
            status: 'pending'
          }
        }
      },
      {
        method: 'PUT',
        path: '/payments/:id/complete',
        description: 'Marca un pago como completado',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: {
          provider_transaction_id: 'txn_123',
          paid_at: '2025-11-05T10:00:00Z'
        },
        response: {
          success: true,
          message: 'Payment completed successfully'
        }
      },
      {
        method: 'PUT',
        path: '/payments/:id/fail',
        description: 'Marca un pago como fallido',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: {
          failure_reason: 'Insufficient funds'
        },
        response: {
          success: true,
          data: { status: 'failed' }
        }
      },
      {
        method: 'GET',
        path: '/payments/tenant/:tenant_id',
        description: 'Lista pagos de un tenant',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`
        },
        response: {
          success: true,
          data: []
        }
      }
    ]
  },
  {
    title: 'Admin API',
    description: 'API administrativa para gestión de tenants, aplicaciones y planes',
    baseUrl: `${BASE_URL}/admin-api`,
    endpoints: [
      {
        method: 'GET',
        path: '/stats',
        description: 'Obtiene estadísticas del sistema',
        headers: {
          'X-Admin-Token': 'admin_001'
        },
        response: {
          success: true,
          data: {
            tenants_count: 10,
            active_subscriptions: 8,
            applications_count: 3
          }
        }
      },
      {
        method: 'GET',
        path: '/applications',
        description: 'Lista todas las aplicaciones',
        headers: {
          'X-Admin-Token': 'admin_001'
        },
        response: {
          success: true,
          data: []
        }
      },
      {
        method: 'POST',
        path: '/applications',
        description: 'Crea una nueva aplicación',
        headers: {
          'X-Admin-Token': 'admin_001',
          'Content-Type': 'application/json'
        },
        body: {
          name: 'Mi App',
          slug: 'mi-app',
          external_app_id: 'app-uuid'
        },
        response: {
          success: true,
          data: { id: '...', api_key: 'ak_...' }
        }
      },
      {
        method: 'GET',
        path: '/tenants',
        description: 'Lista todos los tenants',
        headers: {
          'X-Admin-Token': 'admin_001'
        },
        response: {
          success: true,
          data: []
        }
      },
      {
        method: 'POST',
        path: '/tenants/:id/grant-access',
        description: 'Otorga acceso a una aplicación',
        headers: {
          'X-Admin-Token': 'admin_001',
          'Content-Type': 'application/json'
        },
        body: {
          application_id: 'app-uuid',
          plan_id: 'plan-uuid',
          start_trial: true
        },
        response: {
          success: true,
          data: {}
        }
      }
    ]
  }
];

function MethodBadge({ method }: { method: string }) {
  const colors = {
    GET: 'bg-blue-600',
    POST: 'bg-green-600',
    PUT: 'bg-yellow-600',
    DELETE: 'bg-red-600'
  };

  return (
    <span className={`${colors[method as keyof typeof colors]} text-white px-2 py-1 rounded text-xs font-semibold`}>
      {method}
    </span>
  );
}

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
      <pre className="bg-slate-900 text-slate-100 p-4 rounded overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ endpoint, baseUrl }: { endpoint: ApiEndpoint; baseUrl: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const buildCurlCommand = () => {
    let curl = `curl -X ${endpoint.method} \\\n  '${baseUrl}${endpoint.path}`;

    if (endpoint.params) {
      const params = new URLSearchParams(endpoint.params).toString();
      curl += `?${params}`;
    }

    curl += `'`;

    if (endpoint.headers) {
      Object.entries(endpoint.headers).forEach(([key, value]) => {
        curl += ` \\\n  -H '${key}: ${value}'`;
      });
    }

    if (endpoint.body) {
      curl += ` \\\n  -d '${JSON.stringify(endpoint.body, null, 2)}'`;
    }

    return curl;
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-mono">{endpoint.path}</code>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {isExpanded && (
        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <p className="text-slate-700 mb-4">{endpoint.description}</p>

          {endpoint.headers && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Headers</h4>
              <div className="bg-white rounded p-3 border border-slate-200">
                {Object.entries(endpoint.headers).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-sm font-mono mb-1">
                    <span className="text-blue-600">{key}:</span>
                    <span className="text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.params && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Query Parameters</h4>
              <div className="bg-white rounded p-3 border border-slate-200">
                {Object.entries(endpoint.params).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-sm font-mono mb-1">
                    <span className="text-purple-600">{key}:</span>
                    <span className="text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.body && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Request Body</h4>
              <CodeBlock code={JSON.stringify(endpoint.body, null, 2)} />
            </div>
          )}

          {endpoint.response && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Response Example</h4>
              <CodeBlock code={JSON.stringify(endpoint.response, null, 2)} />
            </div>
          )}

          <div className="mb-4">
            <h4 className="font-semibold text-sm text-slate-700 mb-2">cURL Example</h4>
            <CodeBlock code={buildCurlCommand()} language="bash" />
          </div>
        </div>
      )}
    </div>
  );
}

interface ConfigVariable {
  name: string;
  currentValue: string;
  description: string;
  location: string;
  priority: 'critical' | 'high' | 'medium';
  type: 'secret' | 'url' | 'token' | 'id';
  howToGet: string;
}

interface ConfigGroup {
  title: string;
  icon: React.ReactNode;
  description: string;
  variables: ConfigVariable[];
}

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: 'API de Configuración (get-env)',
    icon: <Settings className="w-5 h-5" />,
    description: 'La app obtiene toda su configuración desde esta API externa. Es el punto de entrada más importante.',
    variables: [
      {
        name: 'ENV_API_URL',
        currentValue: 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env',
        description: 'URL de la API que provee la configuración dinámica. En producción apunta a tu instancia dedicada.',
        location: 'src/lib/config.ts (línea 1) · supabase/functions/recurring-subscriptions/index.ts (línea 10)',
        priority: 'critical',
        type: 'url',
        howToGet: 'URL de tu función Edge "get-env" en el proyecto Supabase de producción.',
      },
      {
        name: 'ACCESS_KEY',
        currentValue: '033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866',
        description: 'Clave de acceso al archivo .env de producción en la API get-env. Determina qué configuración se devuelve (DEV vs PROD).',
        location: 'src/lib/config.ts (línea 2) · supabase/functions/recurring-subscriptions/index.ts (línea 11)',
        priority: 'critical',
        type: 'secret',
        howToGet: 'Generada automáticamente al crear el archivo .env de producción en la plataforma get-env. Ver el botón "API Key" en cada archivo.',
      },
    ],
  },
  {
    title: 'Supabase — Frontend',
    icon: <Globe className="w-5 h-5" />,
    description: 'Variables que el cliente React usa para conectarse a Supabase. Se leen desde el .env entregado por la API de configuración.',
    variables: [
      {
        name: 'VITE_SUPABASE_URL',
        currentValue: 'https://veymthufmfqhxxxzfmfi.supabase.co',
        description: 'URL del proyecto Supabase. Diferente entre testing y producción.',
        location: '.env · src/lib/admin-api.ts · src/lib/payment-api.ts · src/lib/subscription.ts',
        priority: 'critical',
        type: 'url',
        howToGet: 'Supabase Dashboard → Project Settings → API → Project URL.',
      },
      {
        name: 'VITE_SUPABASE_ANON_KEY',
        currentValue: 'eyJhbGciOi... (JWT de testing)',
        description: 'Clave pública anónima del proyecto Supabase. Se usa en todas las llamadas desde el navegador.',
        location: '.env · src/lib/admin-api.ts · src/lib/payment-api.ts · src/lib/subscription.ts',
        priority: 'critical',
        type: 'token',
        howToGet: 'Supabase Dashboard → Project Settings → API → anon/public key.',
      },
    ],
  },
  {
    title: 'Supabase — Edge Functions (servidor)',
    icon: <Shield className="w-5 h-5" />,
    description: 'Variables disponibles automáticamente en el entorno Deno de las Edge Functions. Supabase las inyecta; no necesitan configuración manual en la mayoría de los casos.',
    variables: [
      {
        name: 'SUPABASE_URL',
        currentValue: '(auto-inyectada por Supabase)',
        description: 'URL del proyecto. Disponible en todas las Edge Functions via Deno.env.get().',
        location: 'Todas las Edge Functions',
        priority: 'medium',
        type: 'url',
        howToGet: 'Inyectada automáticamente por Supabase. Solo cambiarla si usas un proyecto diferente por ambiente.',
      },
      {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        currentValue: '(auto-inyectada por Supabase)',
        description: 'Clave con privilegios de administrador. Usada para operaciones server-side en todas las Edge Functions. NUNCA exponerla en el cliente.',
        location: 'Todas las Edge Functions (admin-api, payment-manager, validation-api, tenant-onboarding, etc.)',
        priority: 'critical',
        type: 'secret',
        howToGet: 'Supabase Dashboard → Project Settings → API → service_role key. Si usas proyecto separado para PROD, configurar en Supabase Secrets.',
      },
    ],
  },
  {
    title: 'Autenticación Externa (CommHub / Auth System)',
    icon: <Key className="w-5 h-5" />,
    description: 'Variables para la integración con el sistema de autenticación externo. Se configuran dentro del archivo .env de la API get-env.',
    variables: [
      {
        name: 'VITE_AUTH_URL',
        currentValue: '(en archivo .env de get-env)',
        description: 'URL base del sistema de autenticación externo. Por ejemplo: https://auth-systemv1.netlify.app',
        location: 'src/lib/auth.ts (línea 31) — leída desde ConfigService',
        priority: 'critical',
        type: 'url',
        howToGet: 'URL de tu instancia del sistema de autenticación en producción.',
      },
      {
        name: 'VITE_AUTH_APP_ID',
        currentValue: '(en archivo .env de get-env)',
        description: 'ID de la aplicación registrada en el sistema de autenticación externo.',
        location: 'src/lib/auth.ts (líneas 35, 179) — leída desde ConfigService',
        priority: 'critical',
        type: 'id',
        howToGet: 'UUID asignado al registrar la aplicación en el sistema de autenticación.',
      },
      {
        name: 'VITE_AUTH_API_KEY',
        currentValue: '(en archivo .env de get-env)',
        description: 'API Key para autenticar contra el sistema de autenticación externo.',
        location: 'src/lib/auth.ts (línea 39) — leída desde ConfigService',
        priority: 'critical',
        type: 'secret',
        howToGet: 'Generada en el panel del sistema de autenticación para tu aplicación.',
      },
      {
        name: 'VITE_REDIRECT_URI',
        currentValue: '(en archivo .env de get-env)',
        description: 'URL de callback OAuth. Debe apuntar a tu dominio de producción: https://tu-dominio.com/callback',
        location: 'src/lib/auth.ts (líneas 43, 50) — leída desde ConfigService',
        priority: 'high',
        type: 'url',
        howToGet: 'Tu dominio de producción + /callback. Ejemplo: https://admin.tuapp.com/callback',
      },
      {
        name: 'AUTH_REFRESH_TOKEN',
        currentValue: '(en archivo .env de get-env)',
        description: 'Endpoint para refrescar tokens de autenticación expirados.',
        location: 'src/lib/auth.ts (línea 178) — leída desde ConfigService',
        priority: 'high',
        type: 'url',
        howToGet: 'URL del endpoint de refresh token de tu sistema de autenticación.',
      },
      {
        name: 'EXTERNAL_AUTH_API_KEY',
        currentValue: '(variable de entorno Deno)',
        description: 'API Key para que la Edge Function sync-applications llame al sistema de autenticación.',
        location: 'supabase/functions/sync-applications/index.ts (línea 85)',
        priority: 'high',
        type: 'secret',
        howToGet: 'Configurar en Supabase Dashboard → Edge Functions → Secrets.',
      },
    ],
  },
  {
    title: 'MercadoPago',
    icon: <CreditCard className="w-5 h-5" />,
    description: 'Credenciales y URLs de MercadoPago para el procesamiento de pagos. Se configuran en el archivo .env de la API get-env.',
    variables: [
      {
        name: 'MERCADOPAGO_ACCESS_TOKEN',
        currentValue: '(en archivo .env de get-env)',
        description: 'Access Token de producción de MercadoPago. Empieza con APP_USR- en producción (en testing empieza con TEST-).',
        location: 'src/lib/config.ts (línea 162) · supabase/functions/admin-api/index.ts (línea 1085) · supabase/functions/recurring-subscriptions/index.ts (línea 149)',
        priority: 'critical',
        type: 'secret',
        howToGet: 'MercadoPago Developers → Tu aplicación → Credenciales de producción → Access Token.',
      },
      {
        name: 'MERCADOPAGO_BACK_URL',
        currentValue: 'https://www.yoursite.com (fallback hardcoded)',
        description: 'URL de retorno después del pago. Debe apuntar a tu dominio de producción.',
        location: 'src/lib/config.ts (línea 167) · supabase/functions/admin-api/index.ts (línea 1086) · supabase/functions/recurring-subscriptions/index.ts (líneas 150, 196)',
        priority: 'high',
        type: 'url',
        howToGet: 'Tu dominio de producción. Ejemplo: https://admin.tuapp.com',
      },
      {
        name: 'MERCADOPAGO_API_URL',
        currentValue: 'https://api.mercadopago.com/preapproval_plan (fallback)',
        description: 'Endpoint de la API de MercadoPago para planes de suscripción. El valor por defecto es correcto; solo cambiar si MercadoPago actualiza sus URLs.',
        location: 'src/lib/config.ts (línea 154) · supabase/functions/admin-api/index.ts (línea 1084)',
        priority: 'medium',
        type: 'url',
        howToGet: 'No requiere cambio. El valor por defecto apunta a la API oficial de MercadoPago.',
      },
    ],
  },
  {
    title: 'Admin Panel',
    icon: <Zap className="w-5 h-5" />,
    description: 'Tokens de administración del panel. Deben ser valores seguros y únicos en producción.',
    variables: [
      {
        name: 'ADMIN_TOKEN',
        currentValue: 'admin_001',
        description: 'Token de autenticación para endpoints del Admin API. El valor actual "admin_001" es solo de testing y debe cambiarse por uno seguro.',
        location: 'supabase/functions/admin-api/index.ts (línea 10) · src/lib/admin-api.ts',
        priority: 'critical',
        type: 'secret',
        howToGet: 'Generar un string aleatorio seguro. Ejemplo: openssl rand -hex 32. Configurar en Supabase Secrets y en tu archivo .env de producción.',
      },
      {
        name: 'CRON_SECRET',
        currentValue: 'default_cron_secret_change_me',
        description: 'Token para proteger los endpoints de cron jobs. El valor por defecto es público y debe cambiarse urgentemente.',
        location: 'supabase/functions/sync-applications/index.ts (línea 57)',
        priority: 'critical',
        type: 'secret',
        howToGet: 'Generar un string aleatorio seguro. Ejemplo: openssl rand -hex 32. Configurar en Supabase Secrets.',
      },
    ],
  },
  {
    title: 'Identificador de Ambiente',
    icon: <RefreshCw className="w-5 h-5" />,
    description: 'Campo en la API get-env que controla qué ambiente se muestra en la UI.',
    variables: [
      {
        name: 'project_name (campo en get-env)',
        currentValue: 'SendCraft-DEV (testing) / SendCraft-PROD (producción)',
        description: 'El campo project_name del archivo .env en la API get-env determina qué badge y banner se muestra en el Admin Panel. Terminar en -DEV, -QA o -PROD.',
        location: 'src/components/EnvironmentBadge.tsx — detectado automáticamente',
        priority: 'high',
        type: 'id',
        howToGet: 'En la API get-env, editar el campo "project_name" del archivo .env de producción para que termine en -PROD. Ej: MiApp-PROD',
      },
    ],
  },
];

const PRIORITY_META = {
  critical: { label: 'Crítico', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  high:     { label: 'Alto',    bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  medium:   { label: 'Medio',   bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
};

const TYPE_META = {
  secret: { label: 'Secreto', bg: 'bg-red-50', text: 'text-red-600' },
  url:    { label: 'URL',     bg: 'bg-slate-100', text: 'text-slate-600' },
  token:  { label: 'Token',   bg: 'bg-slate-100', text: 'text-slate-600' },
  id:     { label: 'ID',      bg: 'bg-slate-100', text: 'text-slate-600' },
};

function ConfigVariableRow({ variable }: { variable: ConfigVariable }) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_META[variable.priority];
  const type = TYPE_META[variable.type];
  const isSecret = variable.type === 'secret';

  return (
    <div className={`border rounded-lg overflow-hidden ${expanded ? 'border-slate-300' : 'border-slate-200'} transition-all`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${priority.dot}`} />
        <code className="font-mono text-sm font-semibold text-slate-800 flex-1 text-left">{variable.name}</code>
        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priority.bg} ${priority.text} ${priority.border} border`}>
          {priority.label}
        </span>
        <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs ${type.bg} ${type.text}`}>
          {type.label}
        </span>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 space-y-3">
          <p className="text-sm text-slate-700">{variable.description}</p>

          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor actual (testing)</span>
            <div className="mt-1 font-mono text-xs bg-white border border-slate-200 rounded px-3 py-2 break-all text-slate-600">
              {isSecret ? (
                <span className="italic text-slate-400">[secreto — no mostrado]</span>
              ) : (
                variable.currentValue
              )}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ubicación en el código</span>
            <div className="mt-1 text-xs bg-white border border-slate-200 rounded px-3 py-2 text-slate-500 break-all">
              {variable.location}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide block mb-1">Como obtener el valor de producción</span>
            <p className="text-xs text-blue-800">{variable.howToGet}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductionConfig() {
  const criticalCount = CONFIG_GROUPS.reduce(
    (acc, g) => acc + g.variables.filter((v) => v.priority === 'critical').length, 0
  );

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">Checklist de Producción</h2>
            <p className="text-red-100 text-sm leading-relaxed">
              Estas son todas las variables, credenciales y URLs que deben cambiarse antes de ir a producción.
              Se identificaron escaneando todo el código fuente del proyecto.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-300" />
                {criticalCount} variables críticas
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold">
                <Settings className="w-3 h-3" />
                {CONFIG_GROUPS.length} grupos de configuración
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cómo funciona el sistema */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Cómo funciona la configuración dinámica
        </h3>
        <ol className="text-sm text-blue-800 space-y-1.5 list-none">
          <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">1.</span> La app carga al inicio y llama a <code className="bg-blue-100 px-1 rounded">get-env</code> con el <code className="bg-blue-100 px-1 rounded">ACCESS_KEY</code> correspondiente al ambiente.</li>
          <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">2.</span> La API retorna el archivo <code className="bg-blue-100 px-1 rounded">.env</code> completo como JSON, incluyendo <code className="bg-blue-100 px-1 rounded">project_name</code>, <code className="bg-blue-100 px-1 rounded">variables</code>, etc.</li>
          <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">3.</span> La UI detecta el ambiente por el sufijo del <code className="bg-blue-100 px-1 rounded">project_name</code>: <code className="bg-blue-100 px-1 rounded">-DEV</code>, <code className="bg-blue-100 px-1 rounded">-QA</code> o <code className="bg-blue-100 px-1 rounded">-PROD</code>.</li>
          <li className="flex gap-2"><span className="font-bold text-blue-600 flex-shrink-0">4.</span> <strong>Para pasar a producción:</strong> solo cambiás el <code className="bg-blue-100 px-1 rounded">ACCESS_KEY</code> en <code className="bg-blue-100 px-1 rounded">src/lib/config.ts</code> por el de tu archivo .env de producción.</li>
        </ol>
      </div>

      {/* Grupos */}
      <div className="space-y-8">
        {CONFIG_GROUPS.map((group, gi) => (
          <div key={gi}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                {group.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{group.title}</h3>
                <p className="text-xs text-slate-500">{group.description}</p>
              </div>
            </div>
            <div className="space-y-2 ml-0 sm:ml-12">
              {group.variables.map((variable, vi) => (
                <ConfigVariableRow key={vi} variable={variable} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h4 className="font-semibold text-slate-700 mb-3 text-sm">Leyenda de prioridades</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          {Object.entries(PRIORITY_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
              <span className={`px-2 py-0.5 rounded border font-medium ${meta.bg} ${meta.text} ${meta.border}`}>{meta.label}</span>
              <span className="text-slate-500">
                {key === 'critical' && '— Rompe producción si no se configura'}
                {key === 'high' && '— Funcionalidad incompleta sin este valor'}
                {key === 'medium' && '— Tiene valor por defecto razonable'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ApiDocs() {
  const [activeTab, setActiveTab] = useState<'apis' | 'production'>('apis');

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-10">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-3 mb-3">
            <Book className="w-9 h-9" />
            <h1 className="text-3xl font-bold">Documentación</h1>
          </div>
          <p className="text-blue-100 text-base mb-6">
            APIs del sistema de suscripciones · Guía de configuración para producción
          </p>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/10 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('apis')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'apis'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Code className="w-4 h-4" />
              APIs Disponibles
            </button>
            <button
              onClick={() => setActiveTab('production')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'production'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Configuración Producción
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {activeTab === 'production' && <ProductionConfig />}

        {activeTab === 'apis' && (
          <div>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-8">
              <div className="flex items-start gap-3">
                <Code className="w-5 h-5 text-yellow-700 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-1">Información Importante</h3>
                  <p className="text-yellow-800 text-sm">
                    Todas las APIs usan HTTPS. Las credenciales mostradas son de ejemplo.
                    Asegúrate de usar tus propias claves en producción.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-8">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-700 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">Sistema de Licencias Actualizado</h3>
                  <p className="text-green-800 text-sm mb-2">
                    Ahora los usuarios reciben automáticamente una licencia de prueba con el plan <strong>Starter</strong> al registrarse.
                    El endpoint de usuarios también incluye información completa de licencias y suscripciones.
                  </p>
                  <p className="text-green-800 text-sm">
                    Ver documentación detallada en: <code className="bg-green-100 px-2 py-0.5 rounded">GUIA_API_LICENCIAS.md</code>
                  </p>
                </div>
              </div>
            </div>

            {API_SECTIONS.map((section, idx) => (
              <div key={idx} className="mb-12">
                <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{section.title}</h2>
                  <p className="text-slate-600 mb-3">{section.description}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Base URL:</span>
                    <code className="bg-slate-100 px-3 py-1 rounded text-slate-700 font-mono">
                      {section.baseUrl}
                    </code>
                  </div>
                </div>

                <div className="space-y-3">
                  {section.endpoints.map((endpoint, endpointIdx) => (
                    <EndpointCard
                      key={endpointIdx}
                      endpoint={endpoint}
                      baseUrl={section.baseUrl}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
              <h3 className="font-semibold text-blue-900 mb-3">Códigos de Estado HTTP</h3>
              <div className="space-y-2 text-sm">
                {[
                  { code: '200', color: 'green', label: 'Operación exitosa' },
                  { code: '201', color: 'green', label: 'Recurso creado exitosamente' },
                  { code: '400', color: 'yellow', label: 'Error en la solicitud' },
                  { code: '401', color: 'yellow', label: 'No autorizado' },
                  { code: '404', color: 'yellow', label: 'Recurso no encontrado' },
                  { code: '500', color: 'red', label: 'Error interno del servidor' },
                ].map(({ code, color, label }) => (
                  <div key={code} className="flex gap-3">
                    <code className={`bg-${color}-100 text-${color}-800 px-2 py-1 rounded font-mono`}>{code}</code>
                    <span className="text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
