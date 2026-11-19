import React from 'react'
import { createRoot } from 'react-dom/client'
import App, { applySettings, loadSettings } from './App.jsx'
import { installCapture } from './lib/bugs.js'
import './styles.css'

installCapture()
applySettings(loadSettings())
createRoot(document.getElementById('root')).render(<App />)
