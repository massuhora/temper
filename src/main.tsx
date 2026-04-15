import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/i18n'
import App from './App.tsx'

try {
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js')
    console.log('SW registered')
  }
} catch {
  // PWA registration failed, app still works
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
