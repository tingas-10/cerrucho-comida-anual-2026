import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { DataProvider } from './data/DataContext'
import { MembersProvider } from './data/hooks'
import './index.css'
import { applyTheme } from './ui/theme'
import { ToastProvider } from './ui/toast'

try {
  const saved = localStorage.getItem('cerrucho-theme')
  applyTheme(saved === 'dark' || saved === 'light' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
} catch {
  applyTheme('light')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <DataProvider>
          <MembersProvider>
            <App />
          </MembersProvider>
        </DataProvider>
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
)
