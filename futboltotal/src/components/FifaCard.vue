<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const base = import.meta.env.BASE_URL
const props = defineProps({
  name: { type: String, default: 'PLAYER' },
  image: { type: String, default: '' },
  logo: { type: String, default: () => `${import.meta.env.BASE_URL}bp.svg` },
  rating: { type: [Number, String], default: 1 },
  position: { type: String, default: 'DT' },
  nation: { type: String, default: () => `${import.meta.env.BASE_URL}Flag_of_Mexico.svg.webp` },
  stats: {
    type: Object,
    default: () => ({
      pac: 99, sho: 99, pas: 99,
      dri: 99, def: 99, phy: 99
    })
  },
  active: { type: Boolean, default: false },
  side: { type: String, default: 'left' }
})

const displayedStats = ref({
  pac: props.stats.pac,
  sho: props.stats.sho,
  pas: props.stats.pas,
  dri: props.stats.dri,
  def: props.stats.def,
  phy: props.stats.phy
})

let loopInterval = null

const startStatsLoop = () => {
  if (loopInterval) clearInterval(loopInterval)
  
  loopInterval = setInterval(() => {
    Object.keys(displayedStats.value).forEach(stat => {
      const base = props.stats[stat]
      const variation = Math.floor(Math.random() * 20) - 10
      let newVal = base + variation
      newVal = Math.max(1, Math.min(99, newVal))
      displayedStats.value[stat] = newVal
    })
  }, 2000)
}

const stopStatsLoop = () => {
  if (loopInterval) {
    clearInterval(loopInterval)
    loopInterval = null
  }
}

watch(() => props.active, (newVal) => {
  if (newVal) startStatsLoop()
  else stopStatsLoop()
})

onMounted(() => {
  if (props.active) startStatsLoop()
})

onUnmounted(() => {
  stopStatsLoop()
})
</script>

<template>
  <div class="fifa-card-wrapper" :class="{ 'active': active }">
    <svg width="0" height="0" style="position: absolute;">
      <defs>
        <clipPath id="fifaCardPath" clipPathUnits="objectBoundingBox">
          <path d="M0.993,0.126 C0.993,0.126,0.926,0.113,0.86,0.1 C0.808,0.089,0.757,0.035,0.755,0.027 C0.754,0.025,0.754,0.022,0.754,0.019 C0.754,0.016,0.75,0.015,0.747,0.014 C0.709,0.007,0.612,0.001,0.5,0 C0.388,0.001,0.291,0.007,0.253,0.014 C0.25,0.015,0.246,0.016,0.246,0.019 C0.246,0.022,0.246,0.025,0.245,0.027 C0.243,0.035,0.192,0.089,0.14,0.1 C0.074,0.113,0.007,0.126,0.007,0.126 C0.001,0.126,-0.001,0.127,0,0.131 V0.819 C0,0.827,0,0.835,0.001,0.843 C0.005,0.854,0.014,0.866,0.03,0.88 C0.044,0.893,0.061,0.901,0.079,0.907 C0.125,0.922,0.171,0.936,0.218,0.951 C0.28,0.971,0.342,0.985,0.405,0.996 C0.436,1,0.468,1,0.5,1 V1 C0.532,1,0.564,1,0.595,0.996 C0.658,0.985,0.72,0.971,0.782,0.951 C0.829,0.936,0.875,0.922,0.921,0.907 C0.939,0.901,0.956,0.893,0.97,0.88 C0.986,0.866,0.995,0.854,0.999,0.843 C1,0.835,1,0.827,1,0.819 V0.131 C1,0.127,0.999,0.126,0.993,0.126 Z" />
        </clipPath>
      </defs>
    </svg>

    <div class="fifa-card">
      <div class="card-inner">
        <!-- Shine Effect -->
        <div class="card-shine"></div>

        <div class="card-top">
          <div class="card-texture"></div>
          
          <div class="info">
            <div class="value">{{ rating }}</div>
            <div class="position">{{ position }}</div>
            <div class="divider"></div>
            <div class="country">
              <div :style="{ backgroundImage: `url(${nation})` }"></div>
            </div>
            <div class="club">
              <div :style="{ backgroundImage: `url(${base}bp.svg)` }"></div>
            </div>
          </div>
          <div class="image" :style="{ backgroundImage: `url(${side === 'left' ? `${base}pepe-removebg-preview.png` : `${base}Gemini_Generated_Image_oyhne7oyhne7oyhn-removebg-preview.png`})` }"></div>
        </div>
        <div class="card-bottom">
          <div class="name"><span>{{ name }}</span></div>
          <div class="stats">
            <div class="stats-col">
              <ul>
                <li><span class="stat-val">{{ displayedStats.pac }}</span><span class="stat-label">PAC</span></li>
                <li><span class="stat-val">{{ displayedStats.sho }}</span><span class="stat-label">SHO</span></li>
                <li><span class="stat-val">{{ displayedStats.pas }}</span><span class="stat-label">PAS</span></li>
              </ul>
            </div>
            <div class="stats-col">
              <ul>
                <li><span class="stat-val">{{ displayedStats.dri }}</span><span class="stat-label">DRI</span></li>
                <li><span class="stat-val">{{ displayedStats.def }}</span><span class="stat-label">DEF</span></li>
                <li><span class="stat-val">{{ displayedStats.phy }}</span><span class="stat-label">PHY</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="card-border"></div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@300;400;700;900&display=swap');

.fifa-card-wrapper {
  --gold-primary: #e9cc74;
  --gold-secondary: #cbad5e;
  --gold-dark: #725b16;
  --gold-light: #fdeaa7;
  --text-dark: #3b2f0a;
  
  font-family: 'Saira Semi Condensed', sans-serif;
  perspective: 1500px;
  width: 270px;
  height: 430px;
}

.fifa-card {
  position: relative;
  width: 100%;
  height: 100%;
  clip-path: url("#fifaCardPath");
  display: block;
  opacity: 0;
  transition: 0.9s all cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform: rotateY(-180deg) scale(0.8);
  backface-visibility: hidden;
  transform: translateZ(0);
}

.fifa-card-wrapper.active .fifa-card {
  transform: rotateY(0deg) scale(1);
  opacity: 1;
}

.card-inner {
  position: absolute;
  top: 0;
  left: 0;
  background: #222;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* Shine Effect Overlay */
.card-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 20%,
    rgba(255, 255, 255, 0.05) 30%,
    rgba(255, 255, 255, 0.4) 40%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 70%
  );
  z-index: 10;
  transform: translateX(-100%) skewX(-15deg);
  animation: shineSweep 4s infinite linear;
  pointer-events: none;
}

@keyframes shineSweep {
  0% { transform: translateX(-150%) skewX(-15deg); }
  25% { transform: translateX(150%) skewX(-15deg); }
  100% { transform: translateX(150%) skewX(-15deg); }
}

.card-texture {
  position: absolute;
  inset: 0;
  opacity: 0.15;
  background-image: radial-gradient(#000 1px, transparent 1px);
  background-size: 10px 10px;
  pointer-events: none;
}

.card-top {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 52%;
  background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold-primary) 40%, var(--gold-secondary) 100%);
  overflow: hidden;
  border-bottom: 2px solid rgba(0,0,0,0.1);
}

.card-top .image {
  position: absolute;
  right: -30px;
  bottom: -5px;
  z-index: 2;
  height: 90%;
  width: 85%;
  background-position: bottom center;
  background-repeat: no-repeat;
  background-size: contain;
  opacity: 0;
  transition: 0.8s all ease-out 0.6s;
  filter: drop-shadow(0 15px 20px rgba(0,0,0,0.3));
}

.fifa-card-wrapper.active .image {
  right: 0;
  opacity: 1;
}

.card-top .info {
  position: absolute;
  left: 0;
  top: 20%;
  z-index: 3;
  height: 80%;
  width: 32%;
  box-sizing: border-box;
  padding: 0 5px;
  text-align: center;
  text-transform: uppercase;
  color: var(--text-dark);
}

.info div {
  position: relative;
  line-height: 1;
  opacity: 0;
  top: 15px;
  transition: 0.6s all cubic-bezier(0.075, 0.82, 0.165, 1) 0.9s;
}

.fifa-card-wrapper.active .info div {
  opacity: 1;
  top: 0;
}

.info div.value {
  font-size: 42px;
  font-weight: 900;
  letter-spacing: -2px;
}

.info div.position {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.info .divider {
  width: 60%;
  height: 2px;
  background: var(--gold-dark);
  margin: 4px auto;
  opacity: 0.3;
}

.info .country, .info .club {
  position: relative;
  display: block;
  width: 38px;
  height: 24px;
  margin: 6px auto;
}

.info .country div, .info .club div {
  position: relative;
  height: 100%;
  width: 100%;
  background-position: center;
  background-size: contain;
  background-repeat: no-repeat;
  opacity: 1;
  top: 0;
}

.info .club {
  height: 48px;
}

.card-bottom {
  position: absolute;
  overflow: hidden;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 48%;
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-secondary) 100%);
  color: var(--text-dark);
}

.card-bottom .name {
  text-align: center;
  font-size: 26px;
  text-transform: uppercase;
  font-weight: 900;
  opacity: 0;
  top: -5px;
  position: relative;
  transition: 0.6s all ease-out 1.3s;
  margin: 10px 0 6px;
  letter-spacing: -1px;
}

.fifa-card-wrapper.active .name {
  opacity: 1;
  top: 0;
}

.stats {
  position: relative;
  display: flex;
  justify-content: center;
  margin: 0 20px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.stats:after {
  content: "";
  position: absolute;
  top: 10%;
  bottom: 25%;
  left: 50%;
  width: 1px;
  background: rgba(0, 0, 0, 0.15);
}

.stats-col {
  flex: 1;
  padding: 0 10px;
}

.stats ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.stats li {
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.5s all cubic-bezier(0.075, 0.82, 0.165, 1) 1.6s;
  opacity: 0;
  left: 15px;
}

.fifa-card-wrapper.active .stats li {
  opacity: 1;
  left: 0;
}

.stat-val {
  font-weight: 900;
  font-size: 20px;
  min-width: 25px;
  text-align: right;
  transition: all 0.5s ease-in-out;
}

.stat-label {
  font-weight: 400;
  font-size: 14px;
  opacity: 0.8;
}

.card-border {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 3px solid var(--gold-secondary);
  clip-path: url("#fifaCardPath");
  z-index: 11;
}
</style>
