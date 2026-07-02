import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import './index.css';

const updateSW = registerSW({
  immediate: true,

  onNeedRefresh() {
    if (
      confirm(
        'Versi terbaru Mahya Apparel Finance tersedia.\n\nPerbarui sekarang?'
      )
    ) {
      updateSW(true);
    }
  },

  onOfflineReady() {
    console.log('Aplikasi siap digunakan secara offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);