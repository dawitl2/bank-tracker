import React, { lazy, Suspense, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';

const receiptPath = `${process.env.PUBLIC_URL || ''}/slip`;
const isReceipt = window.location.pathname.replace(/\/$/, '') === receiptPath;
const Page = isReceipt ? lazy(() => import('./BoaReceiptViewer')) : lazy(() => import('./App'));

function Startup() {
  useEffect(() => {
    // Keep the launch mark until the chosen page has committed. No artificial
    // minimum delay: a fast launch should get straight into the app.
    const splash = document.getElementById('app-launch');
    if (!splash) return;
    splash.classList.add('is-ready');
    const timer = setTimeout(() => splash.remove(), 220);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <Page />
      <Startup />
    </Suspense>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
