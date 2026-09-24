import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerServiceWorker } from './lib/registerServiceWorker';
import './styles/theme.css';
import './styles/tailwind.css';

document.documentElement.setAttribute('data-theme', localStorage.getItem('tezipos-theme') || 'light');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();
