import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConfigService } from './lib/config';

const accessKey = import.meta.env.VITE_CONFIG_ACCESS_KEY;

async function initializeApp() {
  if (accessKey) {
    try {
      ConfigService.setAccessKey(accessKey);
      await ConfigService.initialize();
      console.log('✅ Configuration loaded from API');
    } catch (error) {
      console.warn('⚠️ Failed to load remote config, using local env variables', error);
    }
  } else {
    console.log('ℹ️ No access key found, using local env variables');
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

initializeApp();
