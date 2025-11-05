import { useEffect, useState } from 'react';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { ApiDocs } from './pages/ApiDocs';
import { AuthService } from './lib/auth';
import { ConfigLoader } from './components/ConfigLoader';

function AppRoutes() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath === '/callback') {
    return <AuthCallback />;
  }

  if (currentPath === '/api-docs') {
    return <ApiDocs />;
  }

  if (currentPath === '/dashboard') {
    return <Dashboard />;
  }

  if (currentPath === '/' || currentPath === '/login') {
    return <Login />;
  }

  if (AuthService.isAuthenticated()) {
    window.location.href = '/dashboard';
  } else {
    window.location.href = '/';
  }

  return null;
}

function App() {
  return (
    <ConfigLoader>
      <AppRoutes />
    </ConfigLoader>
  );
}

export default App;
