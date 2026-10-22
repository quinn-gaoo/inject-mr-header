import React from 'react';
import ReactDOM from 'react-dom/client';
import 'tippy.js/dist/tippy.css';
import '@/styles/theme.css';
import '@/styles/tippy-theme.css';
import './popup.css';
import Popup from './Popup';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
