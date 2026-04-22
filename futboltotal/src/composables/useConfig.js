import { ref, reactive } from 'vue'

const config = reactive({
  logo: null,
  background: null,
  bannerBackground: null,
  trophy: null,
  bannerLogos: [],
  elementos: [],
  sponsors: [],
  loaded: false
})

const error = ref(null)

async function fetchConfig() {
  if (config.loaded) return config
  
  try {
    const res = await fetch('/images.json')
    const data = await res.json()
    Object.assign(config, data)
    config.loaded = true
  } catch (e) {
    console.warn('Could not load images.json:', e)
    error.value = e
  }
  
  return config
}

export function useConfig() {
  return {
    config,
    error,
    fetchConfig
  }
}
