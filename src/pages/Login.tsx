import { useEffect } from 'react';
import { AuthService } from '../lib/auth';
import { Shield, Lock, UserPlus, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';

export function Login() {
  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      window.location.href = '/dashboard';
    }
  }, []);

  const handleLogin = () => {
    AuthService.redirectToLogin();
  };

  const handleRegister = () => {
    AuthService.redirectToRegister();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">
          <div className="text-white space-y-8">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium">Sistema de Gestión Empresarial</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Gestiona tu negocio con{' '}
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  inteligencia
                </span>
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Plataforma completa para administrar suscripciones, usuarios y aplicaciones desde
                un solo lugar.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-gray-200">Gestión multi-tenant</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-gray-200">Control de suscripciones en tiempo real</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-gray-200">Análisis y reportes detallados</span>
              </div>
            </div>
          </div>

          <div className="lg:pl-8">
            <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-10 border border-gray-100">
              <div className="flex items-center justify-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
              </div>

              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido</h2>
                <p className="text-gray-600">Inicia sesión o crea tu cuenta para continuar</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleLogin}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Lock className="w-5 h-5" />
                  Iniciar Sesión
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">o</span>
                  </div>
                </div>

                <button
                  onClick={handleRegister}
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 transform hover:-translate-y-0.5"
                >
                  <UserPlus className="w-5 h-5" />
                  Crear Cuenta Nueva
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">99.9%</p>
                    <p className="text-xs text-gray-500 mt-1">Uptime</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">24/7</p>
                    <p className="text-xs text-gray-500 mt-1">Soporte</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">SSL</p>
                    <p className="text-xs text-gray-500 mt-1">Seguro</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-gray-400 text-sm mt-6">
              Al continuar, aceptas nuestros{' '}
              <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                Términos de Servicio
              </a>{' '}
              y{' '}
              <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                Política de Privacidad
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
