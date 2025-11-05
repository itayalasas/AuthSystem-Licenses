import { useState } from 'react';
import { Book, Code, Copy, ChevronDown, ChevronRight, Check } from 'lucide-react';

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

export function ApiDocs() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-3 mb-4">
            <Book className="w-10 h-10" />
            <h1 className="text-4xl font-bold">API Documentation</h1>
          </div>
          <p className="text-blue-100 text-lg">
            Documentación completa de todas las APIs del sistema de suscripciones
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
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
              <h3 className="font-semibold text-green-900 mb-1">✨ Sistema de Licencias Actualizado</h3>
              <p className="text-green-800 text-sm mb-2">
                Ahora los usuarios reciben automáticamente una licencia de prueba con el plan <strong>Starter</strong> al registrarse.
                El endpoint de usuarios también incluye información completa de licencias y suscripciones.
              </p>
              <p className="text-green-800 text-sm">
                📖 Ver documentación detallada en: <code className="bg-green-100 px-2 py-0.5 rounded">GUIA_API_LICENCIAS.md</code>
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
            <div className="flex gap-3">
              <code className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono">200</code>
              <span className="text-slate-700">Operación exitosa</span>
            </div>
            <div className="flex gap-3">
              <code className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono">201</code>
              <span className="text-slate-700">Recurso creado exitosamente</span>
            </div>
            <div className="flex gap-3">
              <code className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-mono">400</code>
              <span className="text-slate-700">Error en la solicitud</span>
            </div>
            <div className="flex gap-3">
              <code className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-mono">401</code>
              <span className="text-slate-700">No autorizado</span>
            </div>
            <div className="flex gap-3">
              <code className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-mono">404</code>
              <span className="text-slate-700">Recurso no encontrado</span>
            </div>
            <div className="flex gap-3">
              <code className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono">500</code>
              <span className="text-slate-700">Error interno del servidor</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
