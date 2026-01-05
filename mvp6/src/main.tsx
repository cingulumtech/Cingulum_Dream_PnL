import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { palette, typography, radii, shadow, blur } from './brand/tokens'

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized
  const int = parseInt(value, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function applyDesignTokens() {
  const root = document.documentElement
  const setRgb = (name: string, hex: string) => root.style.setProperty(name, hexToRgb(hex).join(' '))

  setRgb('--color-canvas', palette.neutral.canvas)
  setRgb('--color-surface', palette.neutral.surface)
  setRgb('--color-surface-strong', palette.neutral.raised)
  setRgb('--color-border', palette.neutral.border)
  setRgb('--color-border-strong', palette.neutral.borderStrong)
  setRgb('--color-text', palette.neutral.text)
  setRgb('--color-text-subtle', palette.neutral.subtle)
  setRgb('--color-text-muted', palette.neutral.muted)

  setRgb('--color-accent', palette.brand.primary)
  setRgb('--color-accent-soft', palette.brand.bright)
  setRgb('--color-accent-contrast', palette.brand.glow)

  root.style.setProperty('--font-sans', typography.fontFamily)
  root.style.setProperty('--shadow-soft', shadow.soft)
  root.style.setProperty('--shadow-strong', shadow.strong)
  root.style.setProperty('--radius-md', radii.md)
  root.style.setProperty('--radius-lg', radii.lg)
  root.style.setProperty('--radius-xl', radii.xl)
  root.style.setProperty('--blur-strong', blur.strong)
}

applyDesignTokens()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
