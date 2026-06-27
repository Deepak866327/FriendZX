import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';   // Tailwind + glass design system (new)
import './App.css';             // legacy styles — kept during migration, removed in Phase 10
import 'leaflet/dist/leaflet.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
