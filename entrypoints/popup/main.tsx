import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/theme.css';
import './popup.css';
import Popup from './Popup';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
