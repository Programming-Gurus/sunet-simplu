import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-ext-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-ext-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-ext-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-ext-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-ext-600.css'
import './styles.css'

import { createApp } from 'vue'
import App from './App.vue'
import { watchOutputs } from './lib/outputs'
import { loadSettings } from './lib/settings'

const mounted = loadSettings()
  .catch(() => undefined)
  .then(() => watchOutputs().catch(() => undefined))
  .then(() => {
    createApp(App).mount('#app')
  })

if (window.api.app.selfTest) {
  // A self-test run drives the app without a person. See `selftest.ts`.
  window.__sunetSelfTest = async () => {
    await mounted
    return (await import('./selftest')).runSelfTest()
  }
}
