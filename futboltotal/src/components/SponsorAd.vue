<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

import { useConfig } from '../composables/useConfig'

const { config, fetchConfig } = useConfig()
const sponsors = ref([])
const currentSponsor = ref(null)
const currentVideo = ref(null)
const visible = ref(false)
const progress = ref(0)
let sponsorIndex = 0
let adKey = ref(0)
const logoVisible = ref(true)
let hideTimer = null
let progressInterval = null
let logoFadeOutTimer = null
let logoFadeInTimer = null

const AD_DURATION = 6500 // 6.5 seconds


onMounted(async () => {
  const data = await fetchConfig()
  sponsors.value = data.sponsors || []

  // Listen for '<' key (both , and < on keyboard)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  clearTimeout(hideTimer)
  clearTimeout(logoFadeOutTimer)
  clearTimeout(logoFadeInTimer)
  clearInterval(progressInterval)
})

function onKeyDown(e) {
  // '<' key is Shift + Comma, or just check for '<'
  if (e.key === '<' && !visible.value && sponsors.value.length > 0) {
    showAd()
  }
}

function hideAd() {
  clearTimeout(hideTimer)
  clearTimeout(logoFadeOutTimer)
  clearTimeout(logoFadeInTimer)
  clearInterval(progressInterval)
  hideTimer = null
  progressInterval = null
  logoFadeOutTimer = null
  logoFadeInTimer = null
  visible.value = false
  progress.value = 0
  logoVisible.value = true
}

function showAd() {
  // Clean up any leftover timers first
  hideAd()

  // Pick next sponsor in round-robin
  currentSponsor.value = sponsors.value[sponsorIndex % sponsors.value.length]
  sponsorIndex++

  // Pick random video from sponsor's videos array
  const s = currentSponsor.value
  if (s.videos && s.videos.length > 0) {
    const vIndex = Math.floor(Math.random() * s.videos.length)
    currentVideo.value = s.videos[vIndex]
  } else {
    currentVideo.value = null
  }

  adKey.value++
  visible.value = true
  progress.value = 0

  // Extend duration if sponsor has video
  const duration = currentVideo.value ? 9000 : AD_DURATION

  // Animate progress bar
  const startTime = Date.now()
  progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    progress.value = Math.min((elapsed / duration) * 100, 100)
  }, 30)

  // Fade out logo after 1 second
  logoVisible.value = true
  logoFadeOutTimer = setTimeout(() => {
    logoVisible.value = false
  }, 1000)

  // Fade logo back in 1.5 seconds before end
  logoFadeInTimer = setTimeout(() => {
    logoVisible.value = true
  }, duration - 1500)

  // Auto-hide after duration
  hideTimer = setTimeout(() => {
    hideAd()
  }, duration)
}
</script>

<template>
  <Transition name="sponsor-ad">
    <div v-if="visible" class="sponsor-overlay" @click="hideAd">
      <!-- Sponsor badge OUTSIDE card -->
      <div class="sponsor-badge">PATROCINADOR OFICIAL</div>

      <div class="sponsor-card" :class="{ 'has-video': currentVideo }" @click.stop>
        <!-- Video background (if sponsor has video) -->
        <iframe
          v-if="currentVideo"
          :key="'video-' + adKey"
          :src="currentVideo"
          class="sponsor-video-bg"
          frameborder="0"
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>

        <!-- Subtle gradient overlay for text readability -->
        <div v-if="currentVideo" class="sponsor-video-overlay"></div>

        <!-- Sponsor logo (only if sponsor has one) -->
        <div v-if="currentSponsor?.logo" class="sponsor-logo-wrap" :class="{ 'logo-hidden': !logoVisible }">
          <img
            :src="currentSponsor.logo"
            :alt="currentSponsor.name"
            class="sponsor-logo"
            draggable="false"
            decoding="async"
          />
        </div>

        <!-- Progress bar at bottom -->
        <div class="sponsor-progress">
          <div class="sponsor-progress-fill" :style="{ transform: `scaleX(${progress / 100})` }"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
/* ─── Sponsor Ad Overlay ─── */
.sponsor-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.sponsor-card {
  position: relative;
  width: min(640px, 92vw);
  padding: 60px 50px 50px;
  border-radius: 28px;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
  border: 1px solid rgba(16, 185, 129, 0.3);
  box-shadow:
    0 0 60px rgba(16, 185, 129, 0.15),
    0 25px 50px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  text-align: center;
  overflow: hidden;
  animation: sponsorPulseGlow 2s ease-in-out infinite;
}

@keyframes sponsorPulseGlow {
  0%, 100% { box-shadow: 0 0 60px rgba(16, 185, 129, 0.15), 0 25px 50px rgba(0, 0, 0, 0.5); }
  50%      { box-shadow: 0 0 80px rgba(16, 185, 129, 0.25), 0 25px 50px rgba(0, 0, 0, 0.5); }
}

/* Video background - scale up to crop player chrome */
.sponsor-video-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 140%;
  height: 140%;
  transform: translate(-50%, -50%);
  z-index: 0;
  border: none;
  pointer-events: none;
}

.sponsor-video-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.1) 100%);
  border-radius: 28px;
  pointer-events: none;
}

/* When video is present, all content sits above overlay */
.has-video .sponsor-progress,
.has-video .sponsor-badge,
.has-video .sponsor-logo-wrap,
.has-video .sponsor-name,
.has-video .sponsor-sub {
  position: relative;
  z-index: 2;
}

.has-video .sponsor-logo-wrap {
  background: rgba(255, 255, 255, 0.9);
}


/* Progress bar - at bottom */
.sponsor-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 0 0 28px 28px;
  overflow: hidden;
}

.sponsor-progress-fill {
  height: 100%;
  width: 100%;
  background: rgba(255, 255, 255, 0.35);
  transition: transform 0.05s linear;
  transform-origin: left center;
  transform: scaleX(0);
  border-radius: 0 2px 2px 0;
}

/* Badge - sits outside above the card */
.sponsor-badge {
  display: inline-block;
  padding: 6px 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2));
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #fbbf24;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 16px;
}

/* Logo */
.sponsor-logo-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 280px;
  height: 140px;
  margin: 0 auto 24px;
  padding: 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transition: opacity 1s ease;
}

.sponsor-logo-wrap.logo-hidden {
  opacity: 0;
}

.sponsor-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  animation: sponsorLogoReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes sponsorLogoReveal {
  0%   { transform: scale(0.6); opacity: 0; }
  100% { transform: scale(1);   opacity: 1; }
}

/* Name */
.sponsor-name {
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 1px;
  margin-bottom: 8px;
  animation: sponsorTextSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
}

@keyframes sponsorTextSlide {
  0%   { transform: translateY(15px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}

/* Subtitle */
.sponsor-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  animation: sponsorTextSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
}

/* ─── Transition ─── */
.sponsor-ad-enter-active {
  transition: opacity 0.35s ease;
}
.sponsor-ad-leave-active {
  transition: opacity 0.4s ease;
}
.sponsor-ad-enter-from,
.sponsor-ad-leave-to {
  opacity: 0;
}
.sponsor-ad-enter-from .sponsor-card {
  transform: scale(0.85);
}
.sponsor-ad-leave-to .sponsor-card {
  transform: scale(0.9);
}
.sponsor-card {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
