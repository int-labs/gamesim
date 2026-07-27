import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GamesimProvider } from './gamesim/GamesimProvider';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GamesimProvider>
      <App />
    </GamesimProvider>
  </StrictMode>,
);
