import { useEffect, useState } from 'react';
import { AuthService } from '../lib/auth';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function AuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando autenticación...');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const tokens = AuthService.parseTokenFromUrl();

      if (!tokens) {
        setStatus('error');
        setMessage('No se recibieron credenciales de autenticación');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      const user = AuthService.decodeToken(tokens.token);

      if (!user) {
        setStatus('error');
        setMessage('Token inválido');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      AuthService.saveTokens({ ...tokens, user });

      setStatus('success');
      setMessage(`¡Bienvenido, ${user.name}!`);

      const isNewUser = new URLSearchParams(window.location.search).get('new_user') === 'true';

      if (isNewUser) {
        await onboardNewUser(user);
      } else {
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      }
    } catch (error) {
      console.error('Error in callback:', error);
      setStatus('error');
      setMessage('Error procesando la autenticación');
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }
  }

  async function onboardNewUser(user: any) {
    try {
      setMessage('Configurando tu cuenta...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tenant-onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            application_id: import.meta.env.VITE_AUTH_APP_ID,
            user_id: user.sub,
            email: user.email,
            name: user.name,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setMessage('¡Cuenta configurada exitosamente!');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        throw new Error(result.error || 'Error en onboarding');
      }
    } catch (error) {
      console.error('Error en onboarding:', error);
      setMessage('Cuenta creada, pero hubo un problema con la configuración. Contacta a soporte.');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            {status === 'loading' && (
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
            )}
            {status === 'success' && (
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
            )}
            {status === 'error' && <XCircle className="w-16 h-16 text-red-600 mx-auto" />}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'loading' && 'Procesando...'}
            {status === 'success' && '¡Éxito!'}
            {status === 'error' && 'Error'}
          </h2>

          <p className="text-gray-600">{message}</p>

          {status === 'loading' && (
            <div className="mt-6">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 animate-pulse w-3/4"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
