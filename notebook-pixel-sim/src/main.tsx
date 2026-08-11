import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GamesimProvider } from './gamesim/GamesimProvider';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* OUTSIDE the provider, not inside it. The provider owns login, the
        bootstrap chain and a 20s poll, so it is itself a plausible source of a
        render error — wrapping only <App /> would let a provider crash through
        to a blank white page, which is what a student would see mid-class. */}
    <ErrorBoundary>
      <GamesimProvider>
        <App />
      </GamesimProvider>
    </ErrorBoundary>
  </StrictMode>,
);
