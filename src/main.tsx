import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/lilita-one/400.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/nunito/900.css'
import './styles/app.css'
import { App } from './ui/App'
import { boot } from './app/store'

createRoot(document.getElementById('root')!).render(<App />)
void boot()
void StrictMode
