// The page around the browser build (not used on iPhone or Android).
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const BASE = process.env.EXPO_BASE_URL || '';

// Where the host can't send the headers the database needs (GitHub Pages), a small service worker adds them;
// the page reloads once when it takes over. Guarded so a browser without support never loops.
const isolate = `
if (!window.crossOriginIsolated && 'serviceWorker' in navigator && !sessionStorage.getItem('coi-reloaded')) {
  navigator.serviceWorker.register('${BASE}/coi-sw.js', { scope: '${BASE}/' }).then(function (reg) {
    function reload() { sessionStorage.setItem('coi-reloaded', '1'); location.reload(); }
    if (navigator.serviceWorker.controller) reload();
    else navigator.serviceWorker.addEventListener('controllerchange', reload);
  });
}`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0B0C0E" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Recomp β" />
        <link rel="apple-touch-icon" href={`${BASE}/apple-touch-icon.png`} />
        <script dangerouslySetInnerHTML={{ __html: isolate }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#0B0C0E}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
