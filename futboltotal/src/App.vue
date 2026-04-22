<script setup>
import Bracket from './components/Bracket.vue'
import Banner from './components/Banner.vue'
import SponsorAd from './components/SponsorAd.vue'
import { ref, onMounted } from 'vue'
import { useConfig } from './composables/useConfig'

const { config, fetchConfig } = useConfig()
const logoVisible = ref(true)
const particles = ref([])

const animNames = ['floatDrift', 'floatBob', 'floatSpin', 'floatZigZag']

onMounted(async () => {
  const data = await fetchConfig()
  const elementos = data.elementos || []

  if (elementos.length > 0) {
    const generated = []
    // Reduced copies from 8 to 4 for better performance
    const copies = 4
    const cols = 5
    const rows = Math.ceil((elementos.length * copies) / cols)
    let idx = 0

    elementos.forEach((url) => {
      for (let i = 0; i < copies; i++) {
        const col = idx % cols
        const row = Math.floor(idx / cols) % rows
        const cellW = 100 / cols
        const cellH = 100 / rows
        const top = row * cellH + Math.random() * cellH * 0.7
        const left = col * cellW + Math.random() * cellW * 0.7

        const shouldAnimate = Math.random() < 0.6
        const animName = shouldAnimate ? animNames[Math.floor(Math.random() * animNames.length)] : 'none'
        
        generated.push({
          id: `${url}-${idx}`,
          url,
          style: {
            top: `${top}%`,
            left: `${left}%`,
            width: `${25 + Math.random() * 60}px`,
            height: `${25 + Math.random() * 60}px`,
            opacity: 0.15 + Math.random() * 0.4,
            '--base-rot': `${Math.random() * 360}deg`,
            animation: animName !== 'none' ? `${animName} ${12 + Math.random() * 18}s ease-in-out ${Math.random() * -20}s infinite ${Math.random() > 0.5 ? 'normal' : 'alternate'}` : 'none'
          }
        })
        idx++
      }
    })
    particles.value = generated
  }
})
</script>

<template>
  <div class="app-root">
    <!-- Floating background particles layer (behind everything) -->
    <div class="particles-layer" aria-hidden="true">
      <img
        v-for="p in particles"
        :key="p.id"
        :src="p.url"
        :style="p.style"
        class="particle"
        loading="lazy"
        draggable="false"
      />
    </div>

    <Bracket />
    <Banner />
    <SponsorAd />
  </div>
</template>

<style scoped>
.app-root {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
}
</style>

<style>
/* Particle layer behind ALL content */
.particles-layer {
  position: fixed;
  inset: -100px;
  width: calc(100vw + 200px);
  height: calc(100vh + 200px);
  z-index: -2;
  pointer-events: none;
  overflow: hidden;
}

.particle {
  position: absolute;
  object-fit: contain;
  will-change: transform;
  transform: rotate(var(--base-rot));
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
}

/* Animation 1: Gentle vertical bobbing */
@keyframes floatBob {
  0%   { transform: translateY(0) rotate(var(--base-rot)) scale(1); }
  50%  { transform: translateY(-12px) rotate(calc(var(--base-rot) + 5deg)) scale(1.03); }
  100% { transform: translateY(0) rotate(var(--base-rot)) scale(1); }
}

/* Animation 2: Soft horizontal drifting */
@keyframes floatDrift {
  0%   { transform: translate(0, 0) rotate(var(--base-rot)); }
  25%  { transform: translate(12px, -8px) rotate(calc(var(--base-rot) + 6deg)); }
  50%  { transform: translate(-8px, -15px) rotate(calc(var(--base-rot) - 4deg)); }
  75%  { transform: translate(10px, 5px) rotate(calc(var(--base-rot) + 3deg)); }
  100% { transform: translate(0, 0) rotate(var(--base-rot)); }
}

/* Animation 3: Slow gentle spin */
@keyframes floatSpin {
  0%   { transform: rotate(var(--base-rot)) scale(0.95); }
  50%  { transform: rotate(calc(var(--base-rot) + 180deg)) scale(1.05); }
  100% { transform: rotate(calc(var(--base-rot) + 360deg)) scale(0.95); }
}

/* Animation 4: Subtle Zig Zag */
@keyframes floatZigZag {
  0%   { transform: translate(0, 0) rotate(var(--base-rot)); }
  25%  { transform: translate(8px, 6px) rotate(calc(var(--base-rot) + 3deg)); }
  50%  { transform: translate(-8px, 12px) rotate(calc(var(--base-rot) - 3deg)); }
  75%  { transform: translate(8px, 6px) rotate(calc(var(--base-rot) + 3deg)); }
  100% { transform: translate(0, 0) rotate(var(--base-rot)); }
}
</style>
