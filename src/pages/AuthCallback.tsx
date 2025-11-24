import { useEffect, useState } from 'react';
import { AuthService } from '../lib/auth';
import { ConfigService } from '../lib/config';
import { AuthProgress } from '../components/AuthProgress';

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
}

export function AuthCallback() {
  const [steps, setSteps] = useState<Step[]>([
    { id: 'validate', label: 'Validando código de autorización', status: 'pending' },
    { id: 'config', label: 'Cargando configuración', status: 'pending' },
    { id: 'exchange', label: 'Intercambiando código por tokens', status: 'pending' },
    { id: 'save', label: 'Guardando sesión', status: 'pending' },
    { id: 'redirect', label: 'Redirigiendo al dashboard', status: 'pending' },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    handleCallback();
  }, []);

  function updateStep(stepId: string, status: Step['status']) {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  }

  function moveToNextStep() {
    setCurrentStep((prev) => prev + 1);
  }

  async function handleCallback() {
    try {
      updateStep('validate', 'loading');

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (!code) {
        updateStep('validate', 'error');
        setError('No se recibió el código de autorización');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      updateStep('validate', 'success');
      moveToNextStep();

      updateStep('config', 'loading');
      await ConfigService.getConfig();
      updateStep('config', 'success');
      moveToNextStep();

      updateStep('exchange', 'loading');

      const authValidateTokenUrl = ConfigService.getVariable('AUTH_VALIDATE_TOKEN');
      const applicationId = ConfigService.getVariable('VITE_AUTH_APP_ID');

      if (!authValidateTokenUrl || !applicationId) {
        updateStep('exchange', 'error');
        setError('Configuración de autenticación no disponible');
        console.error('Missing config:', {
          authValidateTokenUrl,
          applicationId,
          allVars: ConfigService.getAllVariables(),
        });
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      const response = await fetch(authValidateTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          application_id: applicationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Error intercambiando código');
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error en la respuesta del servidor');
      }

      const {
        access_token,
        refresh_token,
        user,
        tenant,
        has_access,
        available_plans
      } = result.data;

      updateStep('exchange', 'success');
      moveToNextStep();

      updateStep('save', 'loading');

      const tokens = {
        token: access_token,
        refreshToken: refresh_token,
        user: {
          sub: user.id,
          email: user.email,
          name: user.name,
          app_id: result.data.application?.id || '',
          role: user.role,
          permissions: user.permissions,
          iat: 0,
          exp: 0,
          iss: '',
          aud: '',
          metadata: user.metadata || {},
        },
      };

      AuthService.saveTokens(tokens);

      if (tenant) {
        localStorage.setItem('tenant_info', JSON.stringify(tenant));
      }

      if (typeof has_access !== 'undefined') {
        localStorage.setItem('has_access', JSON.stringify(has_access));
      }

      if (available_plans) {
        localStorage.setItem('available_plans', JSON.stringify(available_plans));
      }

      updateStep('save', 'success');
      moveToNextStep();

      updateStep('redirect', 'loading');

      setTimeout(() => {
        updateStep('redirect', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      }, 500);
    } catch (err) {
      console.error('Error in callback:', err);
      const currentStepData = steps[currentStep];
      if (currentStepData) {
        updateStep(currentStepData.id, 'error');
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Error procesando la autenticación'
      );
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }
  }

  return <AuthProgress steps={steps} currentStep={currentStep} error={error} />;
}
