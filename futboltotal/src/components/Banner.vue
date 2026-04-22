<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// Load all PNGs placed under src/banner/* automatically
// Use eager + as:url to get final asset URLs from Vite
const logos = ref([])
const bannerBg = ref(null)
const phrases = [
  'Juego limpio, pasión total',
  'La Reta: donde nacen campeones',
  'Fútbol total — potencia y corazón',
  '¡Que ruede el balón!'
]
// Build a mixed track: logos interleaved with phrases so text appears between logos
const trackItems = computed(() => {
  const items = []
  const logosArr = logos.value || []
  if (logosArr.length === 0) return items
  for (let i = 0; i < logosArr.length; i++) {
    items.push({ type: 'logo', src: logosArr[i] })
  }
  return items
})

// Constant speed: 8 seconds per logo footprint
const scrollDuration = computed(() => {
  const count = logos.value.length
  if (count === 0) return '0s'
  return (count * 8) + 's'
})

onMounted(() => {
  // Fetch logos and background from external JSON
  fetch(`${import.meta.env.BASE_URL}images.json`)
    .then(r => r.json())
    .then(config => {
      if (config.bannerLogos && Array.isArray(config.bannerLogos)) {
        logos.value = config.bannerLogos
      }
      if (config.bannerBackground) {
        bannerBg.value = config.bannerBackground
      }
    })
    .catch(e => {
      console.error('Error loading images.json for banner:', e)
    })
})

onBeforeUnmount(() => {
  // nothing
})
</script>

<template>
  <div class="banner-root" aria-hidden="true">
    <div class="glass" :style="bannerBg ? { backgroundImage: `url('${bannerBg}')` } : {}"></div>
    <div class="track-mask"></div>

    <div v-if="logos.length > 0" class="slider">
      <!-- Duplicate the row for seamless loop -->
      <div class="row" :style="{ animationDuration: scrollDuration }">
        <template v-for="(it, i) in trackItems" :key="`a-`+i">
          <div v-if="it.type==='logo'" class="logo-item">
            <img class="logo" :src="it.src" alt="logo" draggable="false" loading="lazy" decoding="async" />
          </div>
          <div v-else class="phrase-chip">{{ it.text }}</div>
        </template>
      </div>
      <div class="row" :style="{ animationDuration: scrollDuration }">
        <template v-for="(it, i) in trackItems" :key="`b-`+i">
          <div v-if="it.type==='logo'" class="logo-item">
            <img class="logo" :src="it.src" alt="logo" draggable="false" loading="lazy" decoding="async" />
          </div>
          <div v-else class="phrase-chip">{{ it.text }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-root {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: clamp(120px, 18vh, 220px);
  z-index: -1;
  pointer-events: none; /* decorative, avoid blocking clicks */
  overflow: hidden;
}

/* Background layer using Cloudinary image */
.glass {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-position: center bottom;
  background-size: 100% auto;
}

/* no mask needed for the new design */
.track-mask {
  display: none;
}

.slider {
  position: absolute;
  bottom: 10px; /* Align logos to the solid part of the banner */
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 80px;
  padding: 0;
  animation: scrollX linear infinite;
  will-change: transform;
}

/* Two rows side-by-side for a seamless loop */
/* Remove extra margin between rows to avoid a visible jump at the seam */
.row + .row { margin-left: 0; }

@keyframes scrollX {
  0% { transform: translate3d(0,0,0); }
  100% { transform: translate3d(-100%,0,0); }
}

.logo-item {
  /* Uniform footprint for all logos - increased size */
  width: clamp(240px, 24vw, 360px);
  height: clamp(80px, 10vh, 110px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.logo {
  /* Force all logos to fill container identically */
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 1;
  user-select: none;
  -webkit-user-drag: none;
}

.phrase-chip {
  pointer-events: none;
  color: #ffffff;
  font-weight: 900;
  font-size: clamp(12px, 2vw, 18px);
  letter-spacing: 0;
  text-align: left;
  white-space: nowrap;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 0 2px 10px rgba(0,0,0,0.25);
  backdrop-filter: blur(6px) saturate(120%);
  -webkit-backdrop-filter: blur(6px) saturate(120%);
}

.placeholder {
  color: rgba(255,255,255,0.7);
  font-weight: 700;
  font-size: clamp(12px, 2.2vw, 18px);
}

/* removed fixed corner phrase; phrases now scroll between logos */

</style>
