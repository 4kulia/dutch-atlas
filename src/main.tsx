import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n/LanguageProvider';
import { AuthProvider } from './auth/AuthProvider';
import { AttractionsProvider } from './data/AttractionsProvider';
import { RouteDirectionsProvider } from './agent/routeDirections';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <AttractionsProvider>
          <RouteDirectionsProvider>
            <App />
          </RouteDirectionsProvider>
        </AttractionsProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
);
