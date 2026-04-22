<script setup>
import { reactive, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useConfig } from '../composables/useConfig'
import TeamButton from './TeamButton.vue'

let confetti = null
const loadConfetti = async () => {
  if (!confetti) {
    const module = await import('canvas-confetti')
    confetti = module.default
  }
  return confetti
}

// initial participants (8 per side) - start empty with letter placeholders
const leftInit = Array.from({ length: 8 }, () => null)
const rightInit = Array.from({ length: 8 }, () => null)

// Generate letter placeholders: A-H for left, I-J-K-L-M-N-Ñ-O for right
const leftLetters = Array.from({ length: 8 }, (_, i) => String.fromCharCode(65 + i)) // A-H
const rightLetters = ['I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O']

function makeRoundsMatches(initial) {
  const rounds = []
  const first = []
  for (let i = 0; i < initial.length; i += 2) {
    first.push([initial[i] || null, initial[i + 1] || null])
  }
  rounds.push(first)
  let count = first.length
  while (count > 1) {
    const next = Array.from({ length: Math.floor(count / 2) }, () => [null, null])
    rounds.push(next)
    count = next.length
  }
  return rounds
}

// Helper function to get placeholder letter for first round
function getPlaceholder(side, roundIdx, matchIdx, pos) {
  if (roundIdx !== 0) return '' // Only first round has placeholders
  const index = matchIdx * 2 + pos
  return side === 'left' ? leftLetters[index] : rightLetters[index]
}

// Helper function to get color scheme for matches
function getColorScheme(rIdx, mIdx) {
  // All matches now use the dark gray scheme
  return 'gray'
}

// Helper function to get match number
// Round 0 (Octavos): Left side 1,3,5,7 / Right side 2,4,6,8
// Round 1 (Cuartos): Left side 9,11 / Right side 10,12
// Round 2 (Semifinales): Left side 13 / Right side 14
function getMatchNumber(side, roundIdx, matchIdx) {
  if (roundIdx === 0) {
    // Octavos de final
    if (side === 'left') {
      return (matchIdx * 2) + 1 // 1, 3, 5, 7
    } else {
      return (matchIdx * 2) + 2 // 2, 4, 6, 8
    }
  } else if (roundIdx === 1) {
    // Cuartos de final
    if (side === 'left') {
      return (matchIdx * 2) + 9 // 9, 11
    } else {
      return (matchIdx * 2) + 10 // 10, 12
    }
  } else if (roundIdx === 2) {
    // Semifinales
    return side === 'left' ? 13 : 14
  }
  return '' // No numbers for finals
}

const state = reactive({
  left: makeRoundsMatches(leftInit),
  right: makeRoundsMatches(rightInit)
})

// Match times for all numbered matches (1-14)
const matchTimes = reactive({
  1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '',
  9: '', 10: '', 11: '', 12: '', 13: '', 14: ''
})

// Dedicated confetti canvas and API to control z-index
const confettiCanvas = ref(null)
const confettiApi = ref(null)
const notificationConfettiInterval = ref(null)

async function emitConfetti(options) {
  const api = confettiApi.value || await loadConfetti()
  return api(options)
}

// Local storage key
const STORAGE_KEY = 'futboltotal-bracket-v1'

// History system for undo
const history = ref([])
const maxHistorySize = 20

function saveToHistory() {
  const snapshot = {
    state: {
      left: JSON.parse(JSON.stringify(state.left)),
      right: JSON.parse(JSON.stringify(state.right))
    },
    final: [...final],
    losers: Array.from(loserSlots.value)
  }
  history.value.push(snapshot)
  // Limit history size
  if (history.value.length > maxHistorySize) {
    history.value.shift()
  }
}

function undo() {
  if (history.value.length === 0) return
  
  const previous = history.value.pop()
  
  // Restore state
  state.left = previous.state.left
  state.right = previous.state.right
  final[0] = previous.final[0]
  final[1] = previous.final[1]
  loserSlots.value = new Set(previous.losers || [])
  
  // Redraw lines after state change
  nextTick(() => {
    debouncedLayout()
    saveToStorage()
  })
}

const linesCanvas = ref(null)

// click to advance within side; if it's the last round, let the handler set the final
function selectTeam(side, roundIdx, matchIdx, pos) {
  const name = state[side][roundIdx][matchIdx][pos]
  if (!name) return
  const nextRound = roundIdx + 1
  if (nextRound >= state[side].length) return
  const nextMatchIdx = Math.floor(matchIdx / 2)
  const nextPos = matchIdx % 2 === 0 ? 0 : 1
  
  // Save to history before making change
  saveToHistory()
  
  // Mark loser (the other position in this match)
  const loserPos = pos === 0 ? 1 : 0
  const loserName = state[side][roundIdx][matchIdx][loserPos]
  if (loserName) {
    loserSlots.value.add(slotKey(side, roundIdx, matchIdx, loserPos))
    showWinDialog(name, loserName)
  }

  state[side][nextRound][nextMatchIdx][nextPos] = name
  saveToStorage()
}

// final slots: [leftChampion, rightChampion]
const final = reactive([null, null])

// Track losing slots by key: `${side}-${roundIdx}-${matchIdx}-${pos}`
const loserSlots = ref(new Set())
function slotKey(side, roundIdx, matchIdx, pos) {
  return `${side}-${roundIdx}-${matchIdx}-${pos}`
}
function isLoser(side, roundIdx, matchIdx, pos) {
  return loserSlots.value.has(slotKey(side, roundIdx, matchIdx, pos))
}

function setFinalFromSide(side) {
  const lastRoundIdx = state[side].length - 1
  const match = state[side][lastRoundIdx] && state[side][lastRoundIdx][0]
  if (!match) {
    // try the other position if first is empty
    const m = state[side][lastRoundIdx]
    if (m) {
      const winner = m[0] || m[1]
      if (!winner) return
      
      // Save to history before making change
      saveToHistory()
      
      final[side === 'left' ? 0 : 1] = winner
      return
    }
    return
  }
  // determine winner in last match (first non-null)
  const winner = match[0] ? match[0] : (match[1] ? match[1] : (state[side][lastRoundIdx][0] || state[side][lastRoundIdx][1]))
  if (!winner) return
  
  // Save to history before making change
  saveToHistory()
  
  final[side === 'left' ? 0 : 1] = winner
  saveToStorage()
}

// Final selection handler when user clicks a specific slot in the last round
function setFinalFromSideClicked(side, matchIdx, pos) {
  const lastRoundIdx = state[side].length - 1
  const match = state[side][lastRoundIdx] && state[side][lastRoundIdx][matchIdx]
  if (!match) return
  const winner = match[pos]
  const loserPos = pos === 0 ? 1 : 0
  const loserName = match[loserPos]
  if (!winner) return

  // Save previous state
  saveToHistory()

  // Mark loser visually
  if (loserName) {
    loserSlots.value.add(slotKey(side, lastRoundIdx, matchIdx, loserPos))
    showWinDialog(winner, loserName)
  }

  final[side === 'left' ? 0 : 1] = winner
  saveToStorage()
}

function handleSelect(side, roundIdx, matchIdx, pos) {
  // if it's the final round in that side, set the central finalist instead of advancing
  if (roundIdx === state[side].length - 1) {
    setFinalFromSideClicked(side, matchIdx, pos)
  } else {
    selectTeam(side, roundIdx, matchIdx, pos)
  }
}

// Notification state
const notification = reactive({
  show: false,
  name: '',
  position: '',
  message: '',
  ballType: '⚽',
  ballStyle: {}
})

function closeNotification(){
  notification.show = false
  if (notificationConfettiInterval.value) {
    try { clearInterval(notificationConfettiInterval.value) } catch (e) {}
    notificationConfettiInterval.value = null
  }
}

function showNotification(name, position) {
  const messages = [
    '¡Que comience el juego!',
    '¡A la cancha!',
    '¡Preparado para ganar!',
    '¡Dale con todo!',
    '¡Vamos por la victoria!',
    '¡El torneo te espera!',
    '¡A demostrar tu poder!'
  ]
  
  notification.name = name
  notification.position = position
  notification.message = messages[Math.floor(Math.random() * messages.length)]
  
  notification.ballType = '⚽'
  
  // Subtle color variations using simple hue-rotate
  const ballStyles = [
    { filter: 'hue-rotate(120deg) brightness(1.1)', textShadow: '0 0 15px rgba(16,185,129,0.3)' }, // Green
    { filter: 'hue-rotate(0deg) brightness(1.1)', textShadow: '0 0 15px rgba(255,255,255,0.3)' },   // Classic
    { filter: 'hue-rotate(-40deg) brightness(1.1) saturate(1.2)', textShadow: '0 0 15px rgba(245,158,11,0.3)' }, // Yellow
    { filter: 'hue-rotate(340deg) brightness(1.1)', textShadow: '0 0 15px rgba(239,68,68,0.3)' }   // Red
  ]
  notification.ballStyle = ballStyles[Math.floor(Math.random() * ballStyles.length)]
  
  notification.show = true
  
  // Initial burst of NORMAL confetti (colors) - INCREASED
  try {
    emitConfetti({
      particleCount: 150, 
      angle: 90,
      spread: 120,
      origin: { x: 0.5, y: 0.4 },
      gravity: 1.0,
      scalar: 1.2,
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e']
    })
  } catch (e) {}
}

// Winner dialog state
const winDialog = reactive({
  show: false,
  winner: '',
  loser: ''
})

async function showWinDialog(winner, loser) {
  winDialog.winner = winner
  winDialog.loser = loser
  winDialog.show = true
  
  let impactShapes = undefined
  try {
    const conf = await loadConfetti()
    if (conf && conf.shapeFromText) {
      impactShapes = [conf.shapeFromText({ text: '❌' })]
    }
  } catch(e) {}

  // COMBAT SPARKS (Timed with CSS hits)
  // Strike 1 (0.8s)
  setTimeout(() => {
    if (!winDialog.show) return
    try {
      emitConfetti({
        particleCount: 25,
        spread: 60,
        origin: { x: 0.75, y: 0.5 }, 
        colors: ['#ff4444', '#ef4444', '#ffffff'],
        shapes: impactShapes,
        scalar: 2.5,
        gravity: 1.5,
        ticks: 50
      })
    } catch (e) {}
  }, 800)

  // Strike 2 (1.3s)
  setTimeout(() => {
    if (!winDialog.show) return
    try {
      emitConfetti({
        particleCount: 35,
        spread: 80,
        origin: { x: 0.78, y: 0.5 },
        colors: ['#ff0000', '#dc2626', '#ffffff'],
        shapes: impactShapes,
        scalar: 3,
        gravity: 1.8,
        ticks: 60
      })
    } catch (e) {}
  }, 1300)

  // Strike 3 (2.0s) - THE BIG FINISHER
  setTimeout(() => {
    if (!winDialog.show) return
    try {
      emitConfetti({
        particleCount: 65,
        spread: 120,
        origin: { x: 0.82, y: 0.5 },
        colors: ['#b91c1c', '#ff0000', '#ffffff'],
        shapes: impactShapes,
        scalar: 3.5,
        gravity: 2.2,
        ticks: 100
      })
    } catch (e) {}
  }, 1950)

  // Main Celebration Confetti (Soccer ball rain)
  try {
    const duration = 3000
    const animationEnd = Date.now() + duration
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0 || !winDialog.show) {
        clearInterval(interval)
        return
      }
      emitConfetti({
        particleCount: 15,
        angle: 60 + Math.random() * 60,
        spread: 70,
        origin: { x: Math.random(), y: -0.1 },
        gravity: 0.8,
        scalar: 1.5,
        ticks: 400,
        colors: ['#ffffff', '#10b981', '#ffd700', '#3b82f6']
      })
    }, 200)
  } catch (e) {}

  setTimeout(() => {
    winDialog.show = false
  }, 8500)
}

// Local storage persistence
function saveToStorage() {
  try {
    const data = {
      left: state.left,
      right: state.right,
      final: Array.from(final),
      losers: Array.from(loserSlots.value),
      matchTimes: { ...matchTimes }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    // ignore storage errors
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data && data.left && data.right) {
      state.left = data.left
      state.right = data.right
    }
    if (data && Array.isArray(data.final)) {
      final[0] = data.final[0] ?? null
      final[1] = data.final[1] ?? null
    }
    if (data && Array.isArray(data.losers)) {
      loserSlots.value = new Set(data.losers)
    }
    if (data && data.matchTimes) {
      for (const k of Object.keys(matchTimes)) {
        if (Object.prototype.hasOwnProperty.call(data.matchTimes, k)) {
          matchTimes[k] = data.matchTimes[k]
        }
      }
    }
  } catch (e) {
    // ignore malformed data
  }
}

// Auto-save when match times change
watch(matchTimes, () => saveToStorage(), { deep: true })

// Final Modal state
const finalModalShow = ref(false)
const finalMatchRunning = ref(false)
const finalConfettiInterval = ref(null)
// Champion celebration overlay
const champion = reactive({ show: false, name: '' })
const championConfettiInterval = ref(null)

function showFinalModal() {
  finalModalShow.value = true
  
  // Launch confetti when modal opens
  const duration = 3000
  const animationEnd = Date.now() + duration
  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()
    
    if (timeLeft <= 0) {
      clearInterval(interval)
      return
    }
    
    emitConfetti({
      particleCount: 15,
      angle: 60 + Math.random() * 60,
      spread: 70,
      origin: { x: Math.random(), y: Math.random() * 0.6 },
      colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#a7f3d0'],
      gravity: 0.95,
      scalar: 1.7,
      drift: 0,
      ticks: 480
    })
  }, 100)
}

function closeFinalModal() {
  finalModalShow.value = false
  stopFinalEffects()
}

function startFinalMatch() {
  // Start running state and continuous confetti until winner is chosen
  finalMatchRunning.value = true
  if (finalConfettiInterval.value) {
    try { clearInterval(finalConfettiInterval.value) } catch (e) {}
  }
  finalConfettiInterval.value = setInterval(() => {
    if (!finalMatchRunning.value) { try { clearInterval(finalConfettiInterval.value) } catch (e) {}; finalConfettiInterval.value = null; return }
    try {
      emitConfetti({
        particleCount: 3,
        angle: 90,
        spread: 80,
        origin: { x: Math.random(), y: 0 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e'],
        gravity: 1.0,
        scalar: 1.8,
        ticks: 480
      })
    } catch (e) {}
  }, 600)
}

function stopFinalEffects() {
  finalMatchRunning.value = false
  if (finalConfettiInterval.value) {
    try { clearInterval(finalConfettiInterval.value) } catch (e) {}
    finalConfettiInterval.value = null
  }
}

function chooseChampion(index) {
  // Only allow choosing while match is running
  if (!finalMatchRunning.value) return
  const winner = final[index]
  const loser = final[1 - index]
  // Stop all effects
  stopFinalEffects()
  // Close modal
  finalModalShow.value = false
  // Show champion celebration overlay instead of small dialog
  if (winner) {
    showChampionCelebration(winner)
  }
}

// rename handler: update participant names in state when TeamButton emits 'rename'
function onRename(side, roundIdx, matchIdx, pos, newName) {
  // Don't allow changes while notification is active
  if (notification.show) return
  
  // Save to history before making change (only if there's an actual change)
  const oldName = state[side][roundIdx][matchIdx][pos]
  if (oldName !== newName) {
    saveToHistory()
  }
  
  // coerce empty->null so slot becomes empty when cleared
  state[side][roundIdx][matchIdx][pos] = newName == null ? null : newName
  
  // Show notification when a name is entered (not when cleared)
  if (newName) {
    const sideLabel = side === 'left' ? 'Lado A' : 'Lado B'
    const roundNames = ['Octavos', 'Cuartos', 'Semifinal']
    const roundName = roundNames[roundIdx] || `Ronda ${roundIdx + 1}`
    const position = `${sideLabel} - ${roundName} - Match ${matchIdx + 1}`
    showNotification(newName, position)
  }
  saveToStorage()
}

function onRenameFinal(index, newName) {
  final[index] = newName == null ? null : newName
  saveToStorage()
}

// logo (assign at runtime to avoid static import resolution)
const logoSrc = ref(null)
const logoExists = ref(true)

function onLogoError() {
  logoExists.value = false
}

// player images (assign at runtime to avoid static import resolution)
const player1Src = ref(null)
const player2Src = ref(null)
const player1Exists = ref(true)
const player2Exists = ref(true)

function onPlayer1Error() {
  player1Exists.value = false
}

function onPlayer2Error() {
  player2Exists.value = false
}

// trophy image for final
const trophySrc = ref(null)
const trophyExists = ref(true)

function onTrophyError() {
  trophyExists.value = false
}

// notification artwork (background, frame, side icon)
const notifBgSrc = ref(null)
const notifBgExists = ref(true)
function onNotifBgError(){ notifBgExists.value = false }

const notifFrameSrc = ref(null)
const notifFrameExists = ref(true)
function onNotifFrameError(){ notifFrameExists.value = false }

const notifSideSrc = ref(null)
const notifSideExists = ref(true)
function onNotifSideError(){ notifSideExists.value = false }

// container ref and resize observer
const containerRef = ref(null)
let ro = null

// Performance: Debounce and rAF for layout
let rafId = null
let debounceTimer = null

function debouncedLayout() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      computePositions()
      drawBracketLines()
    })
  }, 16) // ~1 frame delay
}

// Calculate match height based on available vertical space
// Each match needs space for 2 buttons + gap between them
// 4 matches in first round need to fit vertically WITHOUT scroll
function getMatchHeight() {
  const availableHeight = window.innerHeight - 200 // space for header + padding
  const firstRoundMatches = 4 // 8 participants = 4 matches
  const totalRows = 14 // 4 matches with spacing: (4*4)-2 = 14 rows
  
  // Calculate row height to fit all matches in viewport
  const calculatedRowHeight = Math.floor(availableHeight / totalRows)
  
  // Clamp to reasonable values
  const minHeight = 40 // minimum to fit buttons
  const maxHeight = 90 // maximum for comfortable viewing
  
  return Math.max(minHeight, Math.min(maxHeight, calculatedRowHeight))
}

function computePositions() {
  const container = containerRef.value
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const colHeight = rect.height
  
  // Dynamic paddings based on screen height
  const topPadding = Math.max(80, colHeight * 0.1)
  const bottomPadding = Math.max(120, colHeight * 0.13)
  const middleGap = Math.max(140, colHeight * 0.15) // Much larger gap for the bottom half
  
  const availableHeight = colHeight - middleGap - topPadding - bottomPadding

  ;['left', 'right'].forEach((side) => {
    const rounds = state[side]
    if (!rounds || !rounds.length) return

    const sideEl = container.querySelector(`.side.${side}`)
    if (!sideEl) return
    const roundEls = Array.from(sideEl.querySelectorAll('.round'))

    const round0El = roundEls[0]
    if (!round0El) return
    const matchEls0 = Array.from(round0El.querySelectorAll('.match'))

    const centers0 = matchEls0.map((matchEl, i) => {
      const matchH = matchEl.offsetHeight || 80
      let center
      if (i < 2) {
        const groupHeight = availableHeight / 2
        const positionFactor = i === 0 ? 0.12 : 0.88
        center = topPadding + (positionFactor * groupHeight)
      } else {
        const groupHeight = availableHeight / 2
        const localI = i - 2
        const positionFactor = localI === 0 ? 0.12 : 0.88
        const offset = topPadding + groupHeight + middleGap
        center = offset + (positionFactor * groupHeight)
      }
      
      const top = center - matchH / 2
      matchEl.style.position = 'absolute'
      matchEl.style.top = `${top}px`
      matchEl.style.left = '0'
      matchEl.style.right = '0'
      matchEl.style.margin = '0'
      return center
    })

    let prevCenters = centers0
    for (let rIdx = 1; rIdx < roundEls.length; rIdx++) {
      const roundEl = roundEls[rIdx]
      const matchEls = Array.from(roundEl.querySelectorAll('.match'))
      const newCenters = []

      matchEls.forEach((matchEl, mIdx) => {
        const feeder0Center = prevCenters[mIdx * 2]
        const feeder1Center = prevCenters[mIdx * 2 + 1]
        let center

        if (feeder0Center !== undefined && feeder1Center !== undefined) {
          center = (feeder0Center + feeder1Center) / 2
          const distance = feeder1Center - feeder0Center
          const btnEl = matchEl.querySelector('.team-btn')
          const btnHeight = btnEl ? btnEl.offsetHeight : 80
          const dynamicGap = Math.max(10, distance - btnHeight)
          matchEl.style.gap = `${dynamicGap}px`
        } else {
          center = feeder0Center !== undefined ? feeder0Center : colHeight / 2
        }

        const matchH = matchEl.offsetHeight || 80
        const top = center - matchH / 2
        matchEl.style.position = 'absolute'
        matchEl.style.top = `${top}px`
        matchEl.style.left = '0'
        matchEl.style.right = '0'
        matchEl.style.margin = '0'
        newCenters.push(center)
      })
      prevCenters = newCenters
    }
  })
}

function drawBracketLines() {
  const canvas = linesCanvas.value
  const container = containerRef.value
  if (!canvas || !container) return
  
  const ctx = canvas.getContext('2d')
  const width = container.offsetWidth
  const height = container.offsetHeight
  
  // Set canvas size to match container (only if changed)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height)
  
  // Style for lines
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)'
  ctx.lineWidth = 20
  ctx.lineCap = 'round'
  
  // Draw lines for both sides
  drawSideLines(ctx, container, 'left')
  drawSideLines(ctx, container, 'right')
}

function drawSideLines(ctx, container, side) {
  const sideEl = container.querySelector(`.side.${side}`)
  if (!sideEl) return
  
  const rounds = state[side]
  const containerRect = container.getBoundingClientRect()
  const sideRounds = sideEl.querySelectorAll('.round')
  
  for (let rIdx = 0; rIdx < rounds.length - 1; rIdx++) {
    const roundEl = sideRounds[rIdx]
    const nextRoundEl = sideRounds[rIdx + 1]
    if (!roundEl || !nextRoundEl) continue
    
    const matchEls = roundEl.querySelectorAll('.match')
    const nextMatchEls = nextRoundEl.querySelectorAll('.match')
    
    for (let mIdx = 0; mIdx < matchEls.length; mIdx++) {
      const matchEl = matchEls[mIdx]
      const btnEl = matchEl.querySelector('.team-btn')
      if (!btnEl) continue
      
      const btnRect = btnEl.getBoundingClientRect()
      const matchRect = matchEl.getBoundingClientRect()
      
      const x = side === 'left' ? (btnRect.right - containerRect.left) : (btnRect.left - containerRect.left)
      const y = matchRect.top + (matchRect.height / 2) - containerRect.top
      
      const parentIdx = Math.floor(mIdx / 2)
      const parentMatchEl = nextMatchEls[parentIdx]
      if (!parentMatchEl) continue
      
      const parentBtnEl = parentMatchEl.querySelector('.team-btn')
      if (!parentBtnEl) continue
      
      const parentBtnRect = parentBtnEl.getBoundingClientRect()
      const parentRect = parentMatchEl.getBoundingClientRect()
      
      const parentX = side === 'left' ? (parentBtnRect.left - containerRect.left) : (parentBtnRect.right - containerRect.left)
      const parentY = parentRect.top + (parentRect.height / 2) - containerRect.top
      
      const midX = (x + parentX) / 2
      
      if (mIdx % 2 === 0 && matchEls[mIdx + 1]) {
        const matchEl2 = matchEls[mIdx + 1]
        const btnEl2 = matchEl2.querySelector('.team-btn')
        if (!btnEl2) continue
        
        const btnRect2 = btnEl2.getBoundingClientRect()
        const rect2 = matchEl2.getBoundingClientRect()
        const x2 = side === 'left' ? (btnRect2.right - containerRect.left) : (btnRect2.left - containerRect.left)
        const y2 = rect2.top + (rect2.height / 2) - containerRect.top
        const midY = (y + y2) / 2
        
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(midX, y)
        ctx.lineTo(midX, y2)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(midX, midY)
        ctx.lineTo(parentX, parentY)
        ctx.stroke()
      } else if (mIdx % 2 === 0) { // last match if odd number
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(midX, y)
        ctx.lineTo(parentX, parentY)
        ctx.stroke()
      }
    }
  }
}

onMounted(async () => {
  const { fetchConfig } = useConfig()
  
  nextTick(async () => {
    // Load from local storage before computing positions
    loadFromStorage()
    
    // assign images from external config
    const config = await fetchConfig()
    if (config.logo) logoSrc.value = config.logo
    if (config.background) {
      document.body.style.backgroundImage = `url('${config.background}')`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundRepeat = 'no-repeat'
      document.body.style.backgroundAttachment = 'fixed'
    }
    if (config.player1) player1Src.value = config.player1
    if (config.player2) player2Src.value = config.player2
    if (config.trophy) trophySrc.value = config.trophy
    if (config.notifBg) notifBgSrc.value = config.notifBg
    if (config.notifFrame) notifFrameSrc.value = config.notifFrame
    if (config.notifSide) notifSideSrc.value = config.notifSide

    computePositions()
    
    // Draw bracket lines after DOM is ready
    requestAnimationFrame(() => {
      drawBracketLines()
    })
    
    ro = new ResizeObserver(() => {
      debouncedLayout()
    })
    if (containerRef.value) ro.observe(containerRef.value)
    window.addEventListener('resize', debouncedLayout)

    // Create a dedicated high z-index canvas for confetti
    try {
      const conf = await loadConfetti()
      const cvs = document.createElement('canvas')
      cvs.setAttribute('aria-hidden', 'true')
      cvs.style.position = 'fixed'
      cvs.style.inset = '0'
      cvs.style.width = '100vw'
      cvs.style.height = '100vh'
      cvs.style.pointerEvents = 'none'
      cvs.style.zIndex = '100200' 
      document.body.appendChild(cvs)
      confettiCanvas.value = cvs
      confettiApi.value = conf.create(cvs, { resize: true, useWorker: true })
    } catch (e) {
      // fallback
    }
  })
})

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('resize', debouncedLayout)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (rafId) cancelAnimationFrame(rafId)
  // cleanup confetti canvas
  if (confettiCanvas.value && confettiCanvas.value.parentNode) {
    try { confettiCanvas.value.parentNode.removeChild(confettiCanvas.value) } catch (e) {}
  }
  // clear any running notification confetti loop
  if (notificationConfettiInterval.value) {
    try { clearInterval(notificationConfettiInterval.value) } catch (e) {}
  }
})

function showChampionCelebration(name) {
  champion.name = name
  champion.show = true
  // start continuous confetti until closed
  if (championConfettiInterval.value) {
    try { clearInterval(championConfettiInterval.value) } catch (e) {}
  }
  championConfettiInterval.value = setInterval(() => {
    if (!champion.show) { try { clearInterval(championConfettiInterval.value) } catch (e) {}; championConfettiInterval.value = null; return }
    try {
      // left burst
      emitConfetti({
        particleCount: 16,
        angle: 60,
        spread: 90,
        origin: { x: 0, y: Math.random() * 0.6 },
        colors: ['#FFD700', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7'],
        gravity: 1.0,
        scalar: 2.0,
        ticks: 500
      })
      // right burst
      emitConfetti({
        particleCount: 16,
        angle: 120,
        spread: 90,
        origin: { x: 1, y: Math.random() * 0.6 },
        colors: ['#FFD700', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7'],
        gravity: 1.0,
        scalar: 2.0,
        ticks: 500
      })
    } catch (e) {}
  }, 200)
}

function closeChampionCelebration() {
  champion.show = false
  if (championConfettiInterval.value) {
    try { clearInterval(championConfettiInterval.value) } catch (e) {}
    championConfettiInterval.value = null
  }
}

// Tiny reset control to clear local storage and reset bracket
function resetLocalStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch (e) {}
  // Reset bracket state to initial
  state.left = makeRoundsMatches(Array.from({ length: 8 }, () => null))
  state.right = makeRoundsMatches(Array.from({ length: 8 }, () => null))
  final[0] = null
  final[1] = null
  loserSlots.value = new Set()
  // Clear match times
  Object.keys(matchTimes).forEach(k => { matchTimes[k] = '' })
  // Clear history
  history.value = []
  // Persist cleared state
  saveToStorage()
  // Recompute visuals
  nextTick(() => {
    debouncedLayout()
  })
}
</script>

<template>
  <div class="bracket-container" @dragstart.prevent>
    <!-- Tiny reset storage button (bottom-right) -->
    <button
      class="reset-storage-btn"
      @click="resetLocalStorage"
      title="Restablecer datos"
      aria-label="Restablecer almacenamiento"
    />
    <!-- Undo button -->
    <button 
      v-if="history.length > 0" 
      class="undo-btn" 
      @click="undo" 
      title="Deshacer último cambio"
      aria-label="Deshacer"
    >
      ↶ Deshacer
    </button>

    <!-- Header with logo and players -->
    <div class="header-section">
  <img v-if="player1Exists" class="header-player player-left" :src="player1Src" aria-hidden="true" draggable="false" decoding="async" @error="onPlayer1Error" />
  <img v-if="logoExists" class="top-logo" :src="logoSrc" alt="" draggable="false" decoding="async" @error="onLogoError" />
  <img v-if="player2Exists" class="header-player player-right" :src="player2Src" aria-hidden="true" draggable="false" decoding="async" @error="onPlayer2Error" />
    </div>
    
    <div class="bracket-wrap simple" ref="containerRef">
      <canvas ref="linesCanvas" class="bracket-lines-canvas"></canvas>
      <div class="side left">
      <div
        class="round"
        v-for="(round, rIdx) in state.left"
        :key="`left-${rIdx}`"
      >
        <div class="match" :class="{ 'match-round-2': rIdx === 1, 'match-semifinal': rIdx === 2 }" v-for="(match, mIdx) in round" :key="`l-${rIdx}-${mIdx}`">
          <div class="slot team-a" :class="{ 'slot-semifinal': rIdx === 2 }">
            <TeamButton :name="match[0]" :readonly="rIdx !== 0 || notification.show" :loser="isLoser('left', rIdx, mIdx, 0)" side="left" :placeholder="getPlaceholder('left', rIdx, mIdx, 0)" :colorScheme="getColorScheme(rIdx, mIdx)" @select="() => handleSelect('left', rIdx, mIdx, 0)" @rename="(n) => onRename('left', rIdx, mIdx, 0, n)" />
          </div>
          
          <!-- Círculo con número y campo de tiempo para todas las rondas (octavos, cuartos, semis) -->
          <div class="match-info-container">
            <div class="match-number">{{ getMatchNumber('left', rIdx, mIdx) }}</div>
            <input 
              type="text" 
              class="match-time-input" 
              v-model="matchTimes[getMatchNumber('left', rIdx, mIdx)]"
              placeholder="00:00"
              maxlength="5"
            />
          </div>
          
          <div class="slot team-b" :class="{ 'slot-semifinal': rIdx === 2 }">
            <TeamButton :name="match[1]" :readonly="rIdx !== 0 || notification.show" :loser="isLoser('left', rIdx, mIdx, 1)" side="left" :placeholder="getPlaceholder('left', rIdx, mIdx, 1)" :colorScheme="getColorScheme(rIdx, mIdx)" @select="() => handleSelect('left', rIdx, mIdx, 1)" @rename="(n) => onRename('left', rIdx, mIdx, 1, n)" />
          </div>
        </div>
      </div>
    </div>

    <div class="center-final">
  <img v-if="trophyExists" class="final-trophy" :src="trophySrc" alt="Trophy" draggable="false" decoding="async" @error="onTrophyError" />
      
      <div class="final-btn-container">
        <button class="start-final-btn" @click="showFinalModal">
          INICIAR FINAL
        </button>
        <!-- Sparkles -->
        <span class="magic-sparkle s1"></span>
        <span class="magic-sparkle s2"></span>
        <span class="magic-sparkle s3"></span>
        <span class="magic-sparkle s4"></span>
        <span class="magic-sparkle s5"></span>
        <span class="magic-sparkle s6"></span>
        <span class="magic-sparkle s7"></span>
        <span class="magic-sparkle s8"></span>
      </div>
    </div>

    <div class="side right">
      <div
        class="round"
        v-for="(round, rIdx) in state.right"
        :key="`right-${rIdx}`"
      >
        <div class="match" :class="{ 'match-round-2': rIdx === 1, 'match-semifinal': rIdx === 2 }" v-for="(match, mIdx) in round" :key="`r-${rIdx}-${mIdx}`">
          <div class="slot team-a" :class="{ 'slot-semifinal': rIdx === 2 }">
            <TeamButton :name="match[0]" :readonly="rIdx !== 0 || notification.show" :loser="isLoser('right', rIdx, mIdx, 0)" :placeholder="getPlaceholder('right', rIdx, mIdx, 0)" :colorScheme="getColorScheme(rIdx, mIdx)" @select="() => handleSelect('right', rIdx, mIdx, 0)" @rename="(n) => onRename('right', rIdx, mIdx, 0, n)" />
          </div>
          
          <!-- Círculo con número y campo de tiempo para todas las rondas (octavos, cuartos, semis) -->
          <div class="match-info-container">
            <div class="match-number">{{ getMatchNumber('right', rIdx, mIdx) }}</div>
            <input 
              type="text" 
              class="match-time-input" 
              v-model="matchTimes[getMatchNumber('right', rIdx, mIdx)]"
              placeholder="00:00"
              maxlength="5"
            />
          </div>
          
          <div class="slot team-b" :class="{ 'slot-semifinal': rIdx === 2 }">
            <TeamButton :name="match[1]" :readonly="rIdx !== 0 || notification.show" :loser="isLoser('right', rIdx, mIdx, 1)" :placeholder="getPlaceholder('right', rIdx, mIdx, 1)" :colorScheme="getColorScheme(rIdx, mIdx)" @select="() => handleSelect('right', rIdx, mIdx, 1)" @rename="(n) => onRename('right', rIdx, mIdx, 1, n)" />
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
  
  <!-- Backdrop for notification window -->
  <div v-if="notification.show" class="notification-backdrop"></div>

  <!-- Notification Toast Wrapper -->
  <Transition name="reveal-fade">
    <div v-if="notification.show" class="notification-wrapper">
      <!-- The Giant Rolling Ball (Emoji with subtle style) -->
      <div class="giant-reveal-ball" :style="notification.ballStyle">{{ notification.ballType }}</div>
      
      <!-- The Card that wipes in -->
      <div class="notification-toast">
        <button class="notification-close" @click="closeNotification" aria-label="Cerrar">✕</button>
        <div v-if="notifBgExists" class="notif-bg" :style="{ backgroundImage: `url(${notifBgSrc})` }"></div>

        <div class="notification-content">
          <div class="notification-left">
            <div class="notification-header">
              <span class="notification-icon">🎮</span>
              <h3>{{ notification.name }}</h3>
            </div>
            <p class="notification-position">{{ notification.position }}</p>
            <p class="notification-message">{{ notification.message }}</p>
          </div>
        </div>
        
        <!-- Optional side art (clock, mascot, etc.) -->
        <img v-if="notifSideExists" class="notif-side" :src="notifSideSrc" alt="" draggable="false" decoding="async" @error="onNotifSideError" />
      </div>
    </div>
  </Transition>

  <!-- Winner Dialog Prototype (Elimination Animation) -->
  <Transition name="win-fade">
    <div v-if="winDialog.show" class="win-overlay" aria-live="assertive">
      <div class="battle-card">
        <div class="battle-arena">
          <div class="fighter winner-fighter">
            <div class="fighter-name">{{ winDialog.winner }}</div>
            <div class="crown-badge">🏆 AVANZA</div>
          </div>
          
          <div class="vs-badge">⚽</div>
          
          <div class="fighter loser-fighter">
            <!-- Penalty Shootout UI -->
            <div class="penalty-indicators">
              <div class="penalty-dot p-dot-1">✕</div>
              <div class="penalty-dot p-dot-2">✕</div>
              <div class="penalty-dot p-dot-3">✕</div>
            </div>
            <div class="fighter-name loser-name-anim">{{ winDialog.loser }}</div>
            <div class="ko-stamp">ELIMINADO</div>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Champion Celebration Overlay -->
  <Transition name="modal-fade">
    <div v-if="champion.show" class="champion-overlay" aria-live="assertive">
      <div class="champion-card">
        <button class="champion-close" @click="closeChampionCelebration" aria-label="Cerrar">✕</button>
        <div class="champion-glow"></div>
        <div class="champion-crown">👑</div>
        <div class="champion-title">¡CAMPEÓN!</div>
        <div class="champion-name">{{ champion.name }}</div>
  <img v-if="trophyExists" class="champion-trophy" :src="trophySrc" alt="Trophy" draggable="false" decoding="async" />
        <div class="champion-sub">Orgullo absoluto de la cancha</div>
      </div>
    </div>
  </Transition>

  <!-- Final Modal -->
  <Transition name="modal-fade">
    <div v-if="finalModalShow" class="final-modal-overlay" @click="closeFinalModal">
      <!-- Floating Broadcast Tag (External) -->
      <div class="broadcast-tag-external" v-if="finalMatchRunning">🔴 FINAL EN VIVO</div>
      
      <div class="final-modal" :class="{ running: finalMatchRunning }" @click.stop>
        
        <!-- Stadium Lights Effect -->
        <div class="stadium-lights" v-if="finalMatchRunning">
          <div class="light-beam left-beam"></div>
          <div class="light-beam right-beam"></div>
          <div class="light-beam center-beam"></div>
        </div>

        <!-- Animated Tactical Dots (Simulation / Aerial View / Mini-map) -->
        <div class="tactical-board" v-if="finalMatchRunning">
          <!-- Aerial Pitch Lines -->
          <div class="pitch-line outer-border"></div>
          <div class="pitch-line center-line"></div>
          <div class="pitch-line center-circle"></div>
          <div class="pitch-line penalty-area left-area"></div>
          <div class="pitch-line penalty-area right-area"></div>
          <div class="pitch-line goal-area left-goal"></div>
          <div class="pitch-line goal-area right-goal"></div>
          <div class="pitch-line center-dot"></div>

          <!-- Players (Red Team - 11 players) -->
          <div class="tac-dot red-dot red-1 keeper"><span>1</span></div>
          <div class="tac-dot red-dot red-2"><span>2</span></div>
          <div class="tac-dot red-dot red-3"><span>4</span></div>
          <div class="tac-dot red-dot red-4"><span>5</span></div>
          <div class="tac-dot red-dot red-5"><span>3</span></div>
          <div class="tac-dot red-dot red-6"><span>6</span></div>
          <div class="tac-dot red-dot red-7"><span>8</span></div>
          <div class="tac-dot red-dot red-8"><span>10</span></div>
          <div class="tac-dot red-dot red-9"><span>7</span></div>
          <div class="tac-dot red-dot red-10"><span>9</span></div>
          <div class="tac-dot red-dot red-11"><span>11</span></div>
          
          <!-- Players (Blue Team - 11 players) -->
          <div class="tac-dot blue-dot blue-1 keeper"><span>1</span></div>
          <div class="tac-dot blue-dot blue-2"><span>2</span></div>
          <div class="tac-dot blue-dot blue-3"><span>4</span></div>
          <div class="tac-dot blue-dot blue-4"><span>5</span></div>
          <div class="tac-dot blue-dot blue-5"><span>3</span></div>
          <div class="tac-dot blue-dot blue-6"><span>6</span></div>
          <div class="tac-dot blue-dot blue-7"><span>8</span></div>
          <div class="tac-dot blue-dot blue-8"><span>10</span></div>
          <div class="tac-dot blue-dot blue-9"><span>7</span></div>
          <div class="tac-dot blue-dot blue-10"><span>9</span></div>
          <div class="tac-dot blue-dot blue-11"><span>11</span></div>

          <!-- Referee -->
          <div class="tac-dot referee-dot"><span>R</span></div>

          <!-- Match Ball Dot with Trail -->
          <div class="ball-container">
            <div class="ball-trail"></div>
            <div class="ball-dot">⚽</div>
          </div>
        </div>

        <button class="close-modal-btn" @click="closeFinalModal">✕</button>
        
        <div class="modal-header" v-if="!finalMatchRunning">
          <h1 class="modal-title">¡GRAN FINAL!</h1>
          <p class="modal-subtitle">
            Los mejores se enfrentan por el campeonato
          </p>
        </div>

        <div class="finalists-container" :class="{ 'broadcast-mode': finalMatchRunning }">
          <div class="finalist left-finalist" @click="chooseChampion(0)">
            <div class="card-glare" v-if="finalMatchRunning"></div>
            <TeamButton :name="final[0]" :readonly="true" :colorScheme="'gray'" :placeholder="'F1'" side="none" />
            <div class="click-to-win" v-if="finalMatchRunning">CAMPEÓN</div>
          </div>

          <div class="vs-divider" :class="{ 'live-scoreboard': finalMatchRunning }">
            <span class="vs-text">VS</span>
          </div>

          <div class="finalist right-finalist" @click="chooseChampion(1)">
            <div class="card-glare" v-if="finalMatchRunning"></div>
            <TeamButton :name="final[1]" :readonly="true" :colorScheme="'gray'" :placeholder="'F2'" side="none" />
            <div class="click-to-win" v-if="finalMatchRunning">CAMPEÓN</div>
          </div>
        </div>

        <div class="modal-actions" v-if="!finalMatchRunning">
          <button class="action-btn start-match-btn" @click="startFinalMatch">
            ⚡ COMENZAR PARTIDO ⚡
          </button>
        </div>

        <!-- TV Ticker when running -->
        <div class="match-ticker" v-if="finalMatchRunning">
          <div class="ticker-text-wrapper">
            <span class="ticker-text">🔴 PARTIDO EN VIVO • MÁXIMA TENSIÓN EN LA CANCHA • ¿QUIÉN SE LLEVARÁ LA GLORIA? • ¡EL ESTADIO VIBRA! • HAZ CLIC EN TU FAVORITO PARA CORONARLO CAMPEÓN • </span>
            <span class="ticker-text">🔴 PARTIDO EN VIVO • MÁXIMA TENSIÓN EN LA CANCHA • ¿QUIÉN SE LLEVARÁ LA GLORIA? • ¡EL ESTADIO VIBRA! • HAZ CLIC EN TU FAVORITO PARA CORONARLO CAMPEÓN • </span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.bracket-container{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100vw;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  overflow-y: hidden;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  position: relative;
}

.undo-btn {
  position: fixed;
  /* place it just above the bottom banner */
  bottom: calc(clamp(60px, 10vh, 120px) + 16px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 99998;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  /* a bit more opaque as requested */
  opacity: 0.95;
}

.undo-btn:hover {
  transform: translateX(-50%) translateY(2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.6);
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  opacity: 1;
}

.undo-btn:active {
  transform: translateX(-50%) translateY(0);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
  opacity: 0.9;
}

/* Tiny reset button - almost invisible */
.reset-storage-btn{
  position: fixed;
  bottom: 6px;
  right: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  background: #10b981; /* emerald */
  opacity: 0.08;
  cursor: pointer;
  z-index: 100000; /* keep above bracket */
}
.reset-storage-btn:hover{ opacity: 0.4; box-shadow: 0 0 8px rgba(16,185,129,0.6); }
.reset-storage-btn:focus{ outline: 2px solid rgba(255,255,255,0.35); opacity: 0.5; }

.header-section{
  position: absolute;
  top: 0px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 95vw;
  padding: 5px 20px;
  z-index: 99999;
  pointer-events: none;
}

.top-logo{
  height: clamp(220px, 22vh, 400px);
  width: auto;
  max-width: clamp(850px, 58vw, 1500px);
  object-fit: contain;
  flex-shrink: 0;
}

.header-player{
  height: clamp(180px, 18vh, 320px);
  width: auto;
  max-width: clamp(280px, 19vw, 450px);
  object-fit: contain;
  flex-shrink: 0;
  /* gentle idle animation for players */
  animation: headerFloat 4.2s ease-in-out infinite, headerSway 7s ease-in-out infinite;
  transform-origin: center bottom;
}

.player-left { animation-delay: 0s, 0s; }
.player-right { animation-delay: .6s, 1.2s; }

@keyframes headerFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes headerSway {
  0%, 100% { filter: drop-shadow(0 10px 18px rgba(0,0,0,0.28)); transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(4px) rotate(1.2deg); }
  75% { transform: translateX(-4px) rotate(-1.2deg); }
}

.bracket-wrap{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:clamp(20px, 3vw, 60px);
  padding: 0;
  margin: 0;
  /* background moved to body (global) to cover entire viewport without overflow */
  border-radius:12px;
  box-shadow:0 6px 20px rgba(2,6,23,0.06);
  width:100%;
  max-width: 100vw; /* never exceed viewport width */
  height: 100vh;
  max-height: 100vh;
  box-sizing: border-box;
  position:relative;
  overflow: hidden; /* prevent both scrolls - everything must fit */
}

.center-final{ 
  display:flex; 
  flex-direction: column;
  align-items:center; 
  justify-content:flex-start; 
  position: relative;
  width: clamp(180px, 20vw, 300px);
  flex-shrink: 0;
  gap: clamp(15px, 2vw, 25px);
  margin-top: -120px;
}

.final-trophy{ 
  width: clamp(150px, 16vw, 240px);
  height: clamp(150px, 16vw, 240px);
  object-fit: contain;
  filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.4));
  animation: trophyFloat 3s ease-in-out infinite, trophyGlow 2s ease-in-out infinite;
}

@keyframes trophyFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes trophyGlow {
  0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3)) drop-shadow(0 4px 8px rgba(0,0,0,0.2)); }
  50% { filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.6)) drop-shadow(0 4px 12px rgba(0,0,0,0.3)); }
}

.start-final-btn {
  width: 250px !important;
  padding: 18px 0;
  font-size: clamp(20px, 2.4vw, 24px);
  font-weight: 900;
  color: #39ff14;
  /* Digital Grid Background */
  background: 
    linear-gradient(rgba(57, 255, 20, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(57, 255, 20, 0.05) 1px, transparent 1px),
    #000;
  background-size: 15px 15px;
  /* Beveled Shape */
  clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);
  border: 1px solid rgba(57, 255, 20, 0.8);
  cursor: pointer;
  position: relative;
  transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  text-transform: uppercase;
  letter-spacing: 5px;
  display: block;
  margin: 0 auto;
  overflow: hidden;
  box-shadow: 
    0 0 20px rgba(57, 255, 20, 0.3), 
    inset 0 0 15px rgba(57, 255, 20, 0.1);
  animation: gamerPulse 2.5s infinite ease-in-out, gamerFlicker 8s infinite;
  z-index: 2;
  text-shadow: 0 0 8px rgba(57, 255, 20, 0.4);
}

/* Corner Accents */
.final-btn-container::before,
.final-btn-container::after {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: #39ff14;
  border-style: solid;
  pointer-events: none;
  z-index: 3;
  opacity: 0.6;
}

.final-btn-container::before {
  top: 0;
  left: 0;
  border-width: 2px 0 0 2px;
}

.final-btn-container::after {
  bottom: 0;
  right: 0;
  border-width: 0 2px 2px 0;
}

.final-btn-container {
  position: relative;
  display: inline-block;
  padding: 15px;
}

/* Magic Sparkle Effect */
.magic-sparkle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: #39ff14;
  border-radius: 50%;
  pointer-events: none;
  box-shadow: 0 0 12px #39ff14, 0 0 20px rgba(57, 255, 20, 0.4);
  animation: sparkleAnim 2s infinite;
  opacity: 0;
  z-index: 1;
}

@keyframes sparkleAnim {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
  100% { transform: scale(0) rotate(360deg); opacity: 0; }
}

.s1 { top: -5%; left: 10%; animation-delay: 0.1s; }
.s2 { top: 15%; left: 98%; animation-delay: 0.4s; }
.s3 { top: 90%; left: 5%; animation-delay: 0.7s; }
.s4 { top: 100%; left: 85%; animation-delay: 1s; }
.s5 { top: 50%; left: -8%; animation-delay: 1.3s; }
.s6 { top: -12%; left: 80%; animation-delay: 1.6s; }
.s7 { top: 30%; left: 105%; animation-delay: 0.9s; }
.s8 { top: 105%; left: 20%; animation-delay: 1.9s; }

/* Continuous scanning light effect */
.start-final-btn::after {
  content: "";
  position: absolute;
  top: -50%;
  left: -60%;
  width: 30%;
  height: 200%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: rotate(30deg);
  animation: scanningLight 4s infinite cubic-bezier(0.19, 1, 0.22, 1);
}

.start-final-btn:hover {
  transform: translateY(-4px);
  background: #39ff14;
  color: #000;
  box-shadow: 
    0 0 40px #39ff14, 
    0 0 80px rgba(57, 255, 20, 0.6),
    inset 0 0 20px rgba(0, 0, 0, 0.2);
  letter-spacing: 8px;
  border-color: #fff;
  text-shadow: none;
}

/* Speed up sparkles on hover for intensity */
.final-btn-container:hover .magic-sparkle {
  animation-duration: 0.8s;
  background: #fff;
  box-shadow: 0 0 15px #fff;
}

.start-final-btn:active {
  transform: scale(0.95);
  box-shadow: 0 0 20px rgba(57, 255, 20, 0.6);
}

@keyframes scanningLight {
  0% { left: -100%; opacity: 0; }
  10% { opacity: 1; }
  25% { left: 120%; opacity: 0; }
  100% { left: 120%; opacity: 0; }
}

@keyframes gamerFlicker {
  0%, 18%, 22%, 25%, 53%, 57%, 100% { filter: brightness(1); }
  20%, 24%, 55% { filter: brightness(1.4) contrast(1.2); }
}

@keyframes gamerPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(57, 255, 20, 0.4), inset 0 0 10px rgba(57, 255, 20, 0.2); }
  50% { box-shadow: 0 0 40px rgba(57, 255, 20, 0.7), inset 0 0 20px rgba(57, 255, 20, 0.4); }
}

@keyframes btnPulse {
  0%, 100% { box-shadow: 0 8px 20px rgba(16, 185, 129, 0.5), 0 0 30px rgba(16, 185, 129, 0.3); }
  50% { box-shadow: 0 8px 20px rgba(16, 185, 129, 0.7), 0 0 50px rgba(16, 185, 129, 0.6); }
}




/* BRACKETS GENERAL
------------------
------------------
-----------------
-------------------
-------------------
------------------- */
/* Simple column-based bracket layout with fixed match height rows */
.bracket-wrap.simple{ 
  display:flex; 
  align-items:center; 
  justify-content:center; 
  gap:clamp(20px, 2.5vw, 40px); 
  padding: 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  position: relative;
  padding-bottom: 20px;
}
.bracket-wrap.simple .side{ 
  display:flex; 
  gap:clamp(16px, 2vw, 32px); 
  align-items:stretch; /* changed from center to stretch to show all content */
  height:100%;
  max-height: 100%;
  flex-shrink: 1; /* allow shrinking if needed */
  flex-grow: 0;
  flex-basis: auto;
  width: auto;
  overflow: visible; /* don't clip content */
  justify-content: center;
}
.bracket-wrap.simple .side.right{ flex-direction:row-reverse; }
.bracket-wrap.simple .round{ 
  /* positioning is handled dynamically in JS with position:absolute on each match */
  display: block;
  position: relative;
  width: clamp(190px, 16vw, 240px);
  min-width: 170px; /* minimum to keep buttons readable */
  height: 100%; /* ensure full height to show all matches */
  overflow: visible; /* don't clip matches */
}
.bracket-wrap.simple .slot{ 
  display:flex; 
  align-items:center; 
  justify-content:center; 
  min-height:50px; 
}
.bracket-wrap.simple .match{ 
  display:flex; 
  flex-direction:column; 
  gap:10px; /* gap between 2 buttons in SAME match */
  align-items:center;
  padding: 0; /* no padding - spacing handled by grid */
  position: relative;
}

/* Match info container for octavos (circle + time input) */
.match-info-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 200;
  pointer-events: auto;
}

/* Match number circle - positioned absolutely to not affect layout */
.match-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(26px, 2.8vw, 38px);
  height: clamp(26px, 2.8vw, 38px);
  border-radius: 50%;
  background: linear-gradient(135deg, #3dd41f 0%, #b8e735 100%);
  color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(12px, 1.3vw, 16px);
  font-weight: 900;
  box-shadow: 0 3px 15px rgba(0, 3, 1, 0.74);
  border: 2px solid rgb(60, 77, 39);
  z-index: 200;
  pointer-events: none;
}

/* Match number inside container (not absolutely positioned) */
.match-info-container .match-number {
  position: static;
  transform: none;
  flex-shrink: 0;
}

/* Time input field */
.match-time-input {
  width: clamp(42px, 4.2vw, 58px);
  height: clamp(24px, 2.5vw, 32px);
  padding: 3px 5px;
  border-radius: 5px;
  border: 2px solid #b3f79f;
  background: rgb(137, 180, 133);
  color: #000000;
  font-size: clamp(10px, 1.1vw, 13px);
  font-weight: 700;
  text-align: center;
  outline: none;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transition: all 0.2s ease;
}

.match-time-input:focus {
  border-color: #059669;
  box-shadow: 0 3px 12px rgba(16, 185, 129, 0.5);
  transform: scale(1.05);
}

.match-time-input::placeholder {
  color: rgba(4, 32, 34, 0.4);
  font-weight: 600;
}

/* Specific styling for second round (cuartos de final) - increased gap */
.bracket-wrap.simple .match.match-round-2{ 
  gap:120px; /* larger gap for quarterfinals */
}

/* Semifinal matches - larger vertical gap */
.bracket-wrap.simple .match.match-semifinal{ 
  gap:250px; /* larger gap for semifinals */
}

/* Quarter-final buttons (round 1) - slightly less wide now */
.bracket-wrap.simple .match.match-round-2 .slot :deep(.team-btn) {
  /* made narrower to better match user's request */
  width: clamp(140px, 14vw, 220px);
}

/* Semifinal buttons - normal size (ajustado a la mitad) */
.bracket-wrap.simple .slot-semifinal :deep(.team-btn) {
  width: clamp(140px, 16vw, 240px);
  height: clamp(70px, 8vw, 110px);
  font-size: clamp(16px, 1.8vw, 22px);
}

.bracket-wrap.simple .slot-semifinal :deep(.team-btn .label) {
  font-size: clamp(16px, 1.8vw, 22px);
}

.bracket-wrap.simple .slot-semifinal :deep(.check-btn) {
  font-size: clamp(20px, 2.4vw, 30px);
  padding: 0 clamp(12px, 1.5vw, 20px);
}

/* Canvas for connector lines */
.bracket-lines-canvas {
  display: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.bracket-wrap.simple .slot {
  position: relative;
  z-index: 2; /* botones por encima de las líneas */
}
.bracket-wrap.simple .match .slot{ width:100%; max-width: 100%; }
.bracket-wrap.simple .match .team-a{ margin-bottom:8px; }

/* expose match height to CSS if needed */
:root { --match-height: 64px; }

/* Removed old .semi-slot styles - no longer needed */

/* Responsive - Common screen sizes */

/* HD Ready / Tablets landscape (1280px - 1439px) */
@media (min-width: 1280px) and (max-width: 1439px){
  .header-section{
    gap: 8px;
  }
  .top-logo{
    height: clamp(100px, 18vh, 320px);
    max-width: clamp(600px, 50vw, 1200px);
  }
  .header-player{
    height: clamp(80px, 15vh, 240px);
    max-width: clamp(180px, 15vw, 320px);
  }
  .bracket-wrap.simple .round{ 
    width: clamp(160px, 15vw, 210px);
    max-width: calc((100vw - 180px) / 8);
  }
}

/* HD / Laptops (1440px - 1919px) */
@media (min-width: 1440px) and (max-width: 1919px){
  .header-section{
    gap: 10px;
  }
  .top-logo{
    height: clamp(120px, 18vh, 360px);
    max-width: clamp(700px, 55vw, 1400px);
  }
  .header-player{
    height: clamp(100px, 16vh, 280px);
    max-width: clamp(200px, 18vw, 400px);
  }
  .bracket-wrap.simple .round{ 
    width: clamp(180px, 16vw, 240px);
    max-width: calc((100vw - 200px) / 8);
  }
  .bracket-wrap.simple .match{ 
    gap: clamp(6px, 1vh, 12px); 
  }
  .bracket-wrap.simple .slot :deep(.team-btn) {
    width: clamp(130px, 14vw, 220px);
    height: clamp(45px, 5vh, 85px);
  }
  .bracket-wrap.simple .match.match-round-2 .slot :deep(.team-btn) {
    width: clamp(140px, 15vw, 240px);
  }
  .bracket-wrap.simple .slot-semifinal :deep(.team-btn) {
    height: clamp(90px, 8vw, 150px);
  }
  .match-number {
    width: clamp(28px, 2.8vw, 40px);
    height: clamp(28px, 2.8vw, 40px);
    font-size: clamp(13px, 1.4vw, 18px);
  }
  .match-time-input {
    width: clamp(45px, 4.5vw, 62px);
    height: clamp(24px, 2.5vw, 34px);
    font-size: clamp(11px, 1.2vw, 14px);
  }
}

/* Full HD / 1920x1080 (most common) */
@media (min-width: 1920px) and (max-width: 2399px){
  .header-section{
    gap: 12px;
  }
  .top-logo{
    height: clamp(240px, 24vh, 430px);
    max-width: clamp(900px, 62vw, 1600px);
  }
  .header-player{
    height: clamp(200px, 20vh, 340px);
    max-width: clamp(300px, 21vw, 490px);
  }
  .bracket-wrap.simple .round{ 
    width: clamp(230px, 18vw, 300px);
    max-width: calc((100vw - 240px) / 8);
  }
  .bracket-wrap.simple .match{ 
    gap: 16px; 
  }
  .bracket-wrap.simple .match .team-a{ 
    margin-bottom: 12px; 
  }
  .bracket-wrap.simple .slot :deep(.team-btn) {
    width: clamp(160px, 18vw, 260px);
    height: clamp(65px, 7vh, 110px);
    font-size: clamp(18px, 2vw, 28px);
  }
  .bracket-wrap.simple .match.match-round-2 .slot :deep(.team-btn) {
    /* reduce quarter-final width for large screens */
    width: clamp(175px, 18vw, 280px);
  }
  /* semifinal override for large screens */
  .bracket-wrap.simple .slot-semifinal :deep(.team-btn) {
    height: clamp(125px, 10vw, 175px);
  }
  .match-number {
    width: clamp(34px, 3.5vw, 50px);
    height: clamp(34px, 3.5vw, 50px);
    font-size: clamp(16px, 1.7vw, 22px);
  }
  .match-time-input {
    width: clamp(55px, 5.5vw, 72px);
    height: clamp(30px, 3.2vw, 42px);
    font-size: clamp(13px, 1.4vw, 16px);
  }
}

/* 4K and Ultra-wide (2400px+) */
@media (min-width: 2400px){
  .header-section{
    gap: 15px;
  }
  .top-logo{
    /* smaller logo on very large screens */
    height: clamp(200px, 22vh, 380px);
    max-width: clamp(820px, 52vw, 1400px);
  }
  .header-player{
    /* smaller players on very large screens */
    height: clamp(160px, 18vh, 300px);
    max-width: clamp(240px, 18vw, 420px);
  }
  /* Raise trophy and start button higher on ultra-wide screens */
  .center-final {
    margin-top: -180px;
  }
  .start-final-btn {
    font-size: clamp(18px, 2.3vw, 28px);
    padding: clamp(14px, 1.8vw, 22px) clamp(36px, 4.6vw, 64px);
  }
  .bracket-wrap.simple .round{ 
    width: clamp(260px, 20vw, 340px);
    max-width: calc((100vw - 280px) / 8);
  }
  .bracket-wrap.simple .match{ 
    gap: 18px; 
  }
  .bracket-wrap.simple .match .team-a{ 
    margin-bottom: 15px; 
  }
  /* Bigger buttons and text on ultra-wide */
  .bracket-wrap.simple .slot :deep(.team-btn) {
    width: clamp(200px, 22vw, 320px);
    height: clamp(84px, 9vh, 136px);
  }
  .bracket-wrap.simple .slot :deep(.team-btn .label) {
    font-size: clamp(22px, 2.4vw, 34px);
  }
  .bracket-wrap.simple .slot :deep(.check-btn) {
    width: clamp(42px, 4.2vw, 60px);
    font-size: clamp(22px, 2.4vw, 32px);
  }
  .bracket-wrap.simple .match.match-round-2 .slot :deep(.team-btn) {
    /* slightly larger on ultra-wide too */
    width: clamp(210px, 21vw, 340px);
  }
  .bracket-wrap.simple .slot-semifinal :deep(.team-btn) {
    height: clamp(160px, 12vw, 210px);
  }
  .match-number {
    width: clamp(44px, 4.2vw, 60px);
    height: clamp(44px, 4.2vw, 60px);
    font-size: clamp(20px, 2.2vw, 26px);
  }
  .match-time-input {
    width: clamp(66px, 6.4vw, 86px);
    height: clamp(36px, 3.8vw, 50px);
    font-size: clamp(15px, 1.7vw, 20px);
  }
  /* keep undo button above enlarged banner on ultra-wide */
  .undo-btn {
    bottom: calc(clamp(80px, 12vh, 160px) + 20px);
  }
}

/* Responsive - Small screens */
@media (max-width: 768px){
  .header-section{
    gap: 20px;
  }
  .top-logo{
    height: clamp(120px, 15vh, 200px);
    max-width: clamp(350px, 60vw, 600px);
  }
  .header-player{
    height: clamp(100px, 13vh, 180px);
    max-width: clamp(140px, 25vw, 250px);
  }
}

@media (max-width:900px){
  .bracket-wrap{ flex-direction:column; gap:16px; height:auto }
}

/* Notification Toast / Reveal Animation */
.notification-wrapper {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* Let clicks pass through the wrapper */
}

.giant-reveal-ball {
  position: absolute;
  top: 50%;
  left: 0;
  font-size: clamp(200px, 30vw, 400px);
  z-index: 100001;
  pointer-events: none;
  filter: drop-shadow(0 15px 30px rgba(0,0,0,0.4));
  animation: giantRoll 3s linear forwards;
  will-change: transform, opacity;
}

@keyframes giantRoll {
  0%   { transform: translate(-30vw, -50%) rotate(0deg) scale(0.6); opacity: 0; }
  10%  { transform: translate(-14vw, -50%) rotate(90deg) scale(1); opacity: 1; }
  90%  { transform: translate(114vw, -50%) rotate(1080deg) scale(1); opacity: 1; }
  100% { transform: translate(130vw, -50%) rotate(1260deg) scale(0.6); opacity: 0; }
}

.notification-toast {
  position: relative;
  background: radial-gradient(120% 120% at 50% 0%, rgba(11,18,32,0.96) 0%, rgba(10,15,26,0.96) 45%, rgba(6,10,18,0.96) 100%);
  color: white;
  padding: clamp(32px, 3.5vw, 52px);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.55), 0 0 60px rgba(16,185,129,0.25);
  min-width: min(880px, 95vw);
  max-width: 95vw;
  border: 3px solid rgba(16,185,129,0.35);
  overflow: hidden;
  pointer-events: auto;
  user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;
  animation: wipeReveal 3s linear forwards, notificationFloat 5s ease-in-out infinite alternate 3s;
  -webkit-clip-path: inset(0 100% 0 0);
  clip-path: inset(0 100% 0 0);
}

@keyframes wipeReveal {
  0% { -webkit-clip-path: inset(0 100% 0 0); clip-path: inset(0 100% 0 0); transform: scale(0.95); }
  25% { -webkit-clip-path: inset(0 100% 0 0); clip-path: inset(0 100% 0 0); transform: scale(0.95); } /* Ball hits left edge */
  75% { -webkit-clip-path: inset(0 0 0 0); clip-path: inset(0 0 0 0); transform: scale(1); } /* Ball hits right edge */
  100% { -webkit-clip-path: inset(0 0 0 0); clip-path: inset(0 0 0 0); transform: scale(1); }
}

@keyframes notificationFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.notif-bg{
  position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.25; pointer-events:none;
}


.notification-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: clamp(12px, 2vw, 24px);
  z-index: 2;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 1.4vw, 18px);
  margin-bottom: clamp(8px, 1vw, 12px);
}

.notification-icon {
  font-size: clamp(36px, 4vw, 54px);
  animation: iconPulseBounce 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
}

@keyframes iconPulseBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.1); filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.8)); }
}

.notification-header h3 {
  font-size: clamp(32px, 3.8vw, 50px);
  font-weight: 900;
  margin: 0;
  color: #00ffd0;
  text-transform: uppercase;
  letter-spacing: 1px;
  animation: titleGlowPulse 2s ease-in-out infinite alternate;
}

@keyframes titleGlowPulse {
  0% { text-shadow: 0 0 10px rgba(0,255,208,0.6), 2px 2px 0 #072b2b; transform: scale(1); }
  100% { text-shadow: 0 0 25px rgba(0,255,208,1), 0 0 40px rgba(16,185,129,0.8), 3px 3px 0 #072b2b; transform: scale(1.02); }
}

.notification-position {
  font-size: clamp(16px, 1.8vw, 24px);
  opacity: 0.95;
  margin: clamp(10px, 1.2vw, 16px) 0;
  font-weight: 800;
  color: #a7f3d0;
  text-transform: uppercase;
  letter-spacing: 2px;
  background: rgba(16,185,129,0.2);
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid rgba(16,185,129,0.4);
  display: inline-block;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.notification-message {
  font-size: clamp(20px, 2.5vw, 32px);
  font-weight: 800;
  margin: clamp(12px, 1.5vw, 20px) 0 0 0;
  color: #ffffff;
  text-shadow: 0 0 12px rgba(16,185,129,0.6), 2px 2px 4px rgba(0,0,0,0.8);
  letter-spacing: 0.5px;
}

.notification-left{ position: relative; z-index: 2; text-align: center; }
.notif-frame{ position:absolute; inset:auto; left:0; top:0; width:100%; height:100%; object-fit: contain; opacity:0.45; pointer-events:none; mix-blend-mode: screen; z-index:1; }
.notif-side{ width: clamp(100px, 16vw, 220px); height:auto; object-fit: contain; filter: drop-shadow(0 10px 24px rgba(0,0,0,0.5)); }

/* Backdrop behind notification */
.notification-backdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(2px);
  z-index: 99999; /* below toast (100000) */
  user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;
}

/* Close button for notification */
.notification-close{
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(255,255,255,0.3);
  color: white;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .25s ease;
  z-index: 3;
}
.notification-close:hover{
  background: rgba(239,68,68,0.85);
  border-color: #ef4444;
  transform: rotate(90deg);
}

/* Reveal transition for wrapper */
.reveal-fade-enter-active {
  transition: opacity 0.2s ease;
}
.reveal-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.reveal-fade-enter-from {
  opacity: 0;
}
.reveal-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -40%) scale(0.9);
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (max-width: 768px) {
  .undo-btn {
    /* keep it above the banner on small screens too */
    bottom: calc(clamp(60px, 10vh, 120px) + 12px);
    padding: 10px 16px;
    font-size: 14px;
  }

  .notification-toast {
    min-width: 300px;
    max-width: 92%;
    padding: 22px 26px;
  }
  
  .notification-header h3 {
    font-size: 22px;
  }
  
  .notification-message {
    font-size: 16px;
  }
}

/* Final Modal Styles */
.final-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  padding: 20px;
  user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;
}

.final-modal {
  position: relative;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 30px;
  padding: clamp(30px, 5vw, 60px);
  max-width: 900px;
  width: 90%;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(16, 185, 129, 0.3);
  border: 3px solid #10b981;
  overflow: hidden;
  user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;
}

.final-modal.tactical-running {
  background: #112a1d;
  border-color: #fff;
  border-width: 6px;
  border-radius: 10px;
  box-shadow: inset 0 0 50px rgba(0,0,0,0.8), 0 10px 40px rgba(0,0,0,0.6);
  padding-bottom: 60px;
  position: relative;
}

.final-modal.running {
  background-color: #4c8c4a;
  background-image: repeating-linear-gradient(
    90deg, 
    #4c8c4a, 
    #4c8c4a 10%, 
    #458043 10%, 
    #458043 20%
  );
  border-color: #ffffff;
  box-shadow: 0 0 60px rgba(0,0,0,0.8), inset 0 0 100px rgba(0,0,0,0.2);
  padding-bottom: 80px;
  position: relative;
  max-width: 1300px; /* Even longer X-axis */
  width: 98%;
  min-height: 650px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
}

.final-modal.running::before,
.final-modal.running::after {
  display: none; /* Hide previous broadcast overlays */
}

.tactical-board {
  position: absolute;
  inset: 20px; /* Padding for the pitch border */
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  opacity: 1;
  contain: layout;
}

.pitch-line {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.9);
}

.pitch-line.outer-border {
  inset: 0;
}

.pitch-line.center-line {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 0;
}

.pitch-line.center-circle {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(100px, 15vw, 150px);
  height: clamp(100px, 15vw, 150px);
  border-radius: 50%;
}

.pitch-line.center-dot {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  border: none;
}

.pitch-line.penalty-area {
  top: 20%;
  height: 60%;
  width: 18%;
}
.pitch-line.penalty-area.left-area { left: 0; border-left: none; }
.pitch-line.penalty-area.right-area { right: 0; border-right: none; }

.pitch-line.goal-area {
  top: 35%;
  height: 30%;
  width: 7%;
}
.pitch-line.goal-area.left-goal { left: 0; border-left: none; }
.pitch-line.goal-area.right-goal { right: 0; border-right: none; }

.tac-dot {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  box-shadow: 0 4px 8px rgba(0,0,0,0.5);
  transition: all 1.2s ease-in-out;
  animation: dotMove 10s infinite alternate ease-in-out;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

.red-dot { background: #ff4d4d; border: 1.5px solid rgba(255,255,255,0.9); }
.blue-dot { background: #4d94ff; border: 1.5px solid rgba(255,255,255,0.9); }
.referee-dot { 
  background: #fbbf24; 
  border: 1.5px solid black; 
  color: black; 
  text-shadow: none;
  top: 50%; 
  left: 50%; 
  animation: refRoam 15s infinite alternate ease-in-out;
}

@keyframes refRoam {
  0% { transform: translate(-350px, -150px); }
  25% { transform: translate(350px, -120px); }
  50% { transform: translate(250px, 180px); }
  75% { transform: translate(-280px, 140px); }
  100% { transform: translate(-350px, -150px); }
}

/* ======= KEEPERS ======= */
.red-1 { top: 50%; left: 3%; animation: keeperBounce 4s infinite ease-in-out; }
.blue-1 { top: 50%; right: 3%; animation: keeperBounce 4s infinite ease-in-out; animation-delay: -1.5s; }

@keyframes keeperBounce {
  0% { transform: translate(0, -25px); }
  30% { transform: translate(5px, 15px); }
  60% { transform: translate(-3px, -10px); }
  100% { transform: translate(0, 25px); }
}

/* ======= RED TEAM (4-3-3) ======= */
/* Defenders */
.red-2 { top: 20%; left: 14%; animation: defenderDriftA 9s infinite alternate ease-in-out; animation-delay: -0.5s; }
.red-3 { top: 40%; left: 12%; animation: defenderDriftB 11s infinite alternate ease-in-out; animation-delay: -2s; }
.red-4 { top: 60%; left: 12%; animation: defenderDriftA 10s infinite alternate ease-in-out; animation-delay: -4s; }
.red-5 { top: 80%; left: 14%; animation: defenderDriftB 9s infinite alternate ease-in-out; animation-delay: -6s; }
/* Midfielders */
.red-6 { top: 30%; left: 32%; animation: midRoamA 14s infinite alternate ease-in-out; animation-delay: -1s; }
.red-7 { top: 50%; left: 28%; animation: midRoamB 12s infinite alternate ease-in-out; animation-delay: -3s; }
.red-8 { top: 70%; left: 32%; animation: midRoamA 13s infinite alternate ease-in-out; animation-delay: -5s; }
/* Attackers */
.red-9 { top: 25%; left: 55%; animation: attackRunA 10s infinite alternate ease-in-out; animation-delay: -2s; }
.red-10 { top: 50%; left: 48%; animation: attackRunB 11s infinite alternate ease-in-out; animation-delay: -4s; }
.red-11 { top: 75%; left: 55%; animation: attackRunA 12s infinite alternate ease-in-out; animation-delay: -7s; }

/* ======= BLUE TEAM (4-3-3) ======= */
/* Defenders */
.blue-2 { top: 20%; right: 14%; animation: defenderDriftA 10s infinite alternate ease-in-out; animation-delay: -1s; }
.blue-3 { top: 40%; right: 12%; animation: defenderDriftB 9s infinite alternate ease-in-out; animation-delay: -3s; }
.blue-4 { top: 60%; right: 12%; animation: defenderDriftA 11s infinite alternate ease-in-out; animation-delay: -5s; }
.blue-5 { top: 80%; right: 14%; animation: defenderDriftB 10s infinite alternate ease-in-out; animation-delay: -7s; }
/* Midfielders */
.blue-6 { top: 30%; right: 32%; animation: midRoamB 13s infinite alternate ease-in-out; animation-delay: -2s; }
.blue-7 { top: 50%; right: 28%; animation: midRoamA 14s infinite alternate ease-in-out; animation-delay: -4s; }
.blue-8 { top: 70%; right: 32%; animation: midRoamB 12s infinite alternate ease-in-out; animation-delay: -6s; }
/* Attackers */
.blue-9 { top: 25%; right: 55%; animation: attackRunB 11s infinite alternate ease-in-out; animation-delay: -3s; }
.blue-10 { top: 50%; right: 48%; animation: attackRunA 10s infinite alternate ease-in-out; animation-delay: -5s; }
.blue-11 { top: 75%; right: 55%; animation: attackRunB 12s infinite alternate ease-in-out; animation-delay: -8s; }

/* ======= ROLE-BASED MOVEMENT KEYFRAMES ======= */
@keyframes defenderDriftA {
  0% { transform: translate(0, 0); }
  20% { transform: translate(10px, -15px); }
  50% { transform: translate(-8px, 20px); }
  80% { transform: translate(15px, 5px); }
  100% { transform: translate(-5px, -10px); }
}
@keyframes defenderDriftB {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-12px, 10px); }
  50% { transform: translate(8px, -18px); }
  75% { transform: translate(5px, 12px); }
  100% { transform: translate(-10px, -5px); }
}
@keyframes midRoamA {
  0% { transform: translate(0, 0); }
  15% { transform: translate(30px, -20px); }
  35% { transform: translate(-20px, 30px); }
  55% { transform: translate(40px, 10px); }
  75% { transform: translate(-10px, -25px); }
  100% { transform: translate(20px, 15px); }
}
@keyframes midRoamB {
  0% { transform: translate(0, 0); }
  20% { transform: translate(-25px, 15px); }
  40% { transform: translate(35px, -25px); }
  60% { transform: translate(-15px, 20px); }
  80% { transform: translate(25px, -10px); }
  100% { transform: translate(-10px, 5px); }
}
@keyframes attackRunA {
  0% { transform: translate(0, 0); }
  12% { transform: translate(25px, -30px); }
  30% { transform: translate(-15px, 10px); }
  50% { transform: translate(40px, 25px); }
  70% { transform: translate(-30px, -15px); }
  85% { transform: translate(20px, 30px); }
  100% { transform: translate(-10px, -20px); }
}
@keyframes attackRunB {
  0% { transform: translate(0, 0); }
  18% { transform: translate(-20px, 35px); }
  35% { transform: translate(30px, -15px); }
  55% { transform: translate(-35px, -20px); }
  72% { transform: translate(15px, 25px); }
  90% { transform: translate(25px, -30px); }
  100% { transform: translate(-5px, 10px); }
}

/* ======= BALL - REALISTIC PASSING SEQUENCE ======= */
.ball-container {
  position: absolute;
  top: 50%;
  left: 3%;
  width: 20px;
  height: 20px;
  pointer-events: none;
  z-index: 100;
  animation: ballTacticalMove 15s infinite linear;
}

.ball-dot {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  z-index: 101;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
  animation: ballSpin 0.8s linear infinite;
}

@keyframes ballSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ball-trail {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 10px;
  height: 10px;
  background: rgba(255,255,255,0.4);
  border-radius: 50%;
  filter: blur(5px);
  animation: ballTrailPulse 0.4s infinite alternate;
}

@keyframes ballTrailPulse {
  from { transform: scale(1); opacity: 0.3; }
  to { transform: scale(2.5); opacity: 0; }
}

@keyframes ballTacticalMove {
  /* Passing sequence between specific players */
  0%   { top: 50%; left: 3%; }   /* Red Keeper (red-1) */
  10%  { top: 20%; left: 14%; }  /* Pass to Red RB (red-2) */
  20%  { top: 50%; left: 28%; }  /* Pass to Red CM (red-7) */
  30%  { top: 80%; left: 14%; }  /* Pass to Red LB (red-5) */
  40%  { top: 50%; left: 48%; }  /* Pass to Red ST (red-10) */
  50%  { top: 50%; left: 95%; }  /* SHOT to Blue Keeper (blue-1) */
  60%  { top: 20%; left: 86%; }  /* Pass to Blue RB (blue-2) */
  70%  { top: 50%; left: 72%; }  /* Pass to Blue CM (blue-7) */
  80%  { top: 80%; left: 86%; }  /* Pass to Blue LB (blue-5) */
  90%  { top: 50%; left: 10%; }  /* Long Shot back to Red GK */
  100% { top: 50%; left: 3%; }   /* Loop starts again */
}

.broadcast-tag-external {
  position: absolute;
  top: clamp(20px, 5vh, 60px);
  left: 50%;
  transform: translateX(-50%);
  background: #ef4444; /* Bright Red */
  color: white;
  padding: 8px 24px;
  font-weight: 900;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 2px;
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.6);
  z-index: 100001;
  border-radius: 4px;
  animation: tagPulseRed 2s infinite;
  white-space: nowrap;
}

@keyframes tagPulseRed {
  0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
  50% { transform: translateX(-50%) scale(1.05); box-shadow: 0 0 40px rgba(239, 68, 68, 0.8); }
}

.final-modal.running .finalists-container {
  position: relative;
  background: transparent;
  border: none;
  padding: 0 10px;
  z-index: 1;
  display: flex;
  justify-content: center; /* Center on X-axis */
  gap: clamp(40px, 8vw, 150px);
  align-items: center;
  min-height: 550px; /* Taller Y-axis for a more expansive pitch */
}

.final-modal.running .finalist {
  border-radius: 12px;
  width: 220px; /* Back to original size */
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border: 2px solid white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 20px;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
  z-index: 10;
}

.final-modal.running .left-finalist {
  margin: 0; 
}

.final-modal.running .right-finalist {
  margin: 0;
}

.card-glare {
  position: absolute;
  top: -100%;
  left: -100%;
  width: 300%;
  height: 300%;
  background: linear-gradient(
    45deg,
    transparent 45%,
    rgba(255, 255, 255, 0.05) 48%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 52%,
    transparent 55%
  );
  animation: glareMove 4s infinite linear;
  pointer-events: none;
}

@keyframes glareMove {
  0% { transform: translate(0,0); }
  100% { transform: translate(30%, 30%); }
}

.final-modal.running .finalist:hover {
  border-color: #f59e0b;
  box-shadow: 0 0 40px rgba(245, 158, 11, 0.4);
  transform: scale(1.08) !important;
}

.live-scoreboard {
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.final-modal.running .click-to-win {
  background: rgba(59, 130, 246, 0.2); 
  border: 1px solid #3b82f6;
  color: #3b82f6;
  padding: 4px 12px;
  font-size: 12px;
  letter-spacing: 2px;
  margin-top: 15px;
  font-weight: bold;
}

@keyframes cardPulseBroadcast {
  0%, 100% { transform: translateY(0); border-color: rgba(59, 130, 246, 0.5); }
  50% { transform: translateY(-5px); border-color: rgba(59, 130, 246, 0.8); }
}

.match-ball {
  position: absolute;
  top: 50%;
  left: 5%;
  transform: translate(-50%, -50%);
  font-size: clamp(28px, 3.4vw, 40px);
  filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
  animation: ballPass 2.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes ballPass {
  0% { left: 10%; transform: translate(-50%, -50%) rotate(0deg); }
  50% { left: 90%; transform: translate(-50%, -50%) rotate(360deg); }
  100% { left: 10%; transform: translate(-50%, -50%) rotate(720deg); }
}

.close-modal-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 10;
}

.close-modal-btn:hover {
  background: rgba(239, 68, 68, 0.8);
  border-color: #ef4444;
  transform: rotate(90deg);
}

.modal-header {
  text-align: center;
  margin-bottom: clamp(30px, 5vw, 50px);
}

.modal-title {
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 900;
  color: #FFD700;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.5);
  margin: 0 0 15px 0;
  animation: titleGlow 2s ease-in-out infinite;
}

.modal-subtitle {
  font-size: clamp(16px, 2.5vw, 24px);
  color: #a7f3d0;
  font-weight: 600;
  margin: 0;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
}

@keyframes titleGlow {
  0%, 100% { text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.5); }
  50% { text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5), 0 0 50px rgba(255, 215, 0, 0.8); }
}

.finalists-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: clamp(20px, 3vw, 40px);
  margin-bottom: clamp(30px, 5vw, 50px);
  flex-wrap: wrap;
}

.finalist {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%);
  border: 3px solid #10b981;
  border-radius: 20px;
  padding: clamp(20px, 3vw, 35px);
  text-align: center;
  position: relative;
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
  animation: finalistPulse 2s ease-in-out infinite;
}

.finalist:nth-child(1) { animation-delay: 0s; }
.finalist:nth-child(3) { animation-delay: 0.5s; }

@keyframes finalistPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3); }
  50% { transform: scale(1.05); box-shadow: 0 15px 40px rgba(16, 185, 129, 0.5); }
}

.finalist-badge {
  background: #10b981;
  color: white;
  font-size: clamp(10px, 1.5vw, 14px);
  font-weight: 800;
  padding: 5px 15px;
  border-radius: 20px;
  display: inline-block;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.finalist-name {
  font-size: clamp(20px, 3vw, 32px);
  font-weight: 900;
  color: white;
  margin: 15px 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.finalist-emoji {
  font-size: clamp(40px, 6vw, 60px);
  margin-top: 10px;
  animation: emojiSpin 3s ease-in-out infinite;
}

@keyframes emojiSpin {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-15deg); }
  75% { transform: rotate(15deg); }
}

.vs-divider {
  display: flex;
  align-items: center;
  justify-content: center;
}

.vs-text {
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 900;
  color: #FFD700;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7), 0 0 20px rgba(255, 215, 0, 0.6);
  animation: vsRotate 4s linear infinite;
}

@keyframes vsRotate {
  0%, 100% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(-10deg) scale(1.2); }
  75% { transform: rotate(10deg) scale(1.2); }
}

.modal-actions {
  text-align: center;
}

.action-btn {
  padding: clamp(15px, 2vw, 20px) clamp(40px, 5vw, 60px);
  font-size: clamp(18px, 2.5vw, 26px);
  font-weight: 900;
  color: white;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 3px solid #FFD700;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(245, 158, 11, 0.5), 0 0 50px rgba(245, 158, 11, 0.3);
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 2px;
  animation: actionBtnGlow 2s ease-in-out infinite;
}

.action-btn:hover {
  transform: scale(1.1) translateY(-5px);
  box-shadow: 0 15px 40px rgba(245, 158, 11, 0.7), 0 0 70px rgba(245, 158, 11, 0.5);
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.action-btn:active {
  transform: scale(0.95);
}

@keyframes actionBtnGlow {
  0%, 100% { box-shadow: 0 10px 30px rgba(245, 158, 11, 0.5), 0 0 50px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 10px 30px rgba(245, 158, 11, 0.7), 0 0 80px rgba(245, 158, 11, 0.6); }
}

/* Animated soccer balls */
.soccer-ball {
  position: absolute;
  font-size: clamp(30px, 4vw, 50px);
  pointer-events: none;
  z-index: 1;
}

.ball-1 {
  top: 10%;
  left: 5%;
  animation: ballFloat 4s ease-in-out infinite;
}

.ball-2 {
  top: 15%;
  right: 8%;
  animation: ballFloat 3.5s ease-in-out infinite 0.5s;
}

.ball-3 {
  bottom: 15%;
  left: 8%;
  animation: ballFloat 3.8s ease-in-out infinite 1s;
}

.ball-4 {
  bottom: 10%;
  right: 5%;
  animation: ballFloat 4.2s ease-in-out infinite 1.5s;
}

@keyframes ballFloat {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
}

/* LIVE MATCH STYLES */
.stadium-lights {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.light-beam {
  position: absolute;
  top: -50px;
  width: 150px;
  height: 200%;
  background: linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%);
  transform-origin: top center;
  filter: blur(25px);
  mix-blend-mode: screen;
}

.left-beam {
  left: 15%;
  animation: sweepLeft 8s ease-in-out infinite alternate;
}

.right-beam {
  right: 15%;
  animation: sweepRight 7s ease-in-out infinite alternate;
}

.center-beam {
  left: 45%;
  width: 250px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
  animation: sweepCenter 6s ease-in-out infinite alternate;
}

@keyframes sweepLeft {
  0% { transform: rotate(-35deg); opacity: 0.3; }
  100% { transform: rotate(15deg); opacity: 0.8; }
}

@keyframes sweepRight {
  0% { transform: rotate(35deg); opacity: 0.3; }
  100% { transform: rotate(-15deg); opacity: 0.8; }
}

@keyframes sweepCenter {
  0% { transform: rotate(-15deg); opacity: 0.5; }
  100% { transform: rotate(15deg); opacity: 0.9; }
}

.live-indicator {
  position: absolute;
  top: 24px;
  left: 24px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(239, 68, 68, 0.6);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 900;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 1px;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
  z-index: 10;
}

.live-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  animation: pulseLive 1s infinite alternate;
}

@keyframes pulseLive {
  0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  100% { transform: scale(1.3); box-shadow: 0 0 10px 5px rgba(239, 68, 68, 0.0); }
}

.modal-title.live-title {
  color: #ef4444;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.6);
  animation: titleGlowLive 2s ease-in-out infinite;
}

@keyframes titleGlowLive {
  0%, 100% { text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.6); }
  50% { text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.6), 0 0 50px rgba(239, 68, 68, 0.9); }
}

.click-to-win {
  margin-top: 15px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 800;
  font-size: clamp(14px, 1.8vw, 18px);
  box-shadow: 0 4px 10px rgba(245, 158, 11, 0.4);
  animation: clickPulse 1.5s infinite;
}

@keyframes clickPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.live-scoreboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 15px 25px;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8), 0 10px 20px rgba(0, 0, 0, 0.5);
  position: relative;
  z-index: 2;
}

.scoreboard-timer {
  background: #ef4444;
  color: white;
  padding: 4px 12px;
  border-radius: 5px;
  font-weight: 900;
  font-size: clamp(16px, 2vw, 22px);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
}

.pulsing-time {
  animation: pulseOpacity 1s infinite;
}

@keyframes pulseOpacity {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.scoreboard-score {
  display: flex;
  align-items: center;
  gap: 15px;
  font-family: 'Courier New', Courier, monospace;
}

.score-num {
  font-size: clamp(40px, 6vw, 70px);
  font-weight: 900;
  color: #fcd34d;
  text-shadow: 0 0 15px rgba(252, 211, 77, 0.5);
}

.score-dash {
  font-size: clamp(30px, 5vw, 50px);
  color: rgba(255, 255, 255, 0.5);
}

.blink-score {
  animation: rapidBlink 0.5s infinite alternate;
}

@keyframes rapidBlink {
  0% { opacity: 0.7; }
  100% { opacity: 1; text-shadow: 0 0 20px rgba(252, 211, 77, 0.8); }
}

.match-ticker {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(90deg, #b91c1c 0%, #ef4444 50%, #b91c1c 100%);
  color: white;
  padding: 10px 0;
  overflow: hidden;
  font-weight: 800;
  font-size: clamp(16px, 2vw, 20px);
  letter-spacing: 2px;
  white-space: nowrap;
  box-shadow: 0 -5px 20px rgba(239, 68, 68, 0.5);
  z-index: 10;
  border-top: 2px solid #fca5a5;
}

.ticker-text-wrapper {
  display: inline-block;
  animation: tickerSlide 20s linear infinite;
}

.ticker-text {
  padding-right: 50px;
}

@keyframes tickerSlide {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.live-ball {
  font-size: clamp(40px, 5vw, 60px) !important;
  filter: drop-shadow(0 10px 20px rgba(0,0,0,0.6));
  animation: fastBallPass 1s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate !important;
}

@keyframes fastBallPass {
  0% { left: 15%; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  50% { transform: translate(-50%, -80%) scale(1.5) rotate(180deg); }
  100% { left: 85%; transform: translate(-50%, -50%) scale(1) rotate(360deg); }
}

/* Animated player icons */
.player-icon {
  position: absolute;
  font-size: clamp(40px, 5vw, 60px);
  pointer-events: none;
  z-index: 1;
}

.player-1 {
  top: 40%;
  left: 2%;
  animation: playerRun 3s ease-in-out infinite;
}

.player-2 {
  top: 45%;
  right: 2%;
  animation: playerRun 3s ease-in-out infinite 1.5s;
  transform: scaleX(-1);
}

@keyframes playerRun {
  0%, 100% { transform: translateX(0) translateY(0); }
  50% { transform: translateX(15px) translateY(-10px); }
}

/* Modal transition */
.modal-fade-enter-active {
  animation: modalIn 0.4s ease-out;
}

.modal-fade-leave-active {
  animation: modalOut 0.3s ease-in;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.7) translateY(-50px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes modalOut {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.8) translateY(30px);
  }
}

@media (max-width: 768px) {
  .finalists-container {
    flex-direction: column;
  }
  
  .finalist {
    width: 100%;
    max-width: 400px;
  }
  
  .vs-divider {
    transform: rotate(90deg);
    margin: 10px 0;
  }
}
</style>

<style scoped>
/* Winner dialog styles - Retro Arcade */
.win-overlay{
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  z-index: 100001; /* above undo and header */
  overflow: hidden;
  user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;
}
.notification-toast img, .final-modal img, .win-overlay img, .champion-overlay img {
  -webkit-user-drag: none;
}

.champion-overlay, .champion-card {
  user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;
}

/* subtle scanlines */
.win-overlay::after{
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    rgba(255,255,255,0.04),
    rgba(255,255,255,0.04) 2px,
    rgba(0,0,0,0.04) 2px,
    rgba(0,0,0,0.04) 4px
  );
  pointer-events: none;
}

/* Battle Animation Prototype */
.battle-card {
  position: relative;
  background: radial-gradient(circle at center, #1a2a42 0%, #0d1522 100%);
  border-radius: 20px;
  width: 90vw;
  max-width: 900px;
  padding: 60px 40px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(16,185,129,0.3);
  border: 4px solid #3b82f6;
  animation: screenShake 5s linear forwards;
}

@keyframes screenShake {
  0%, 15% { transform: translate(0,0); }
  16% { transform: translate(15px, -10px); }
  17% { transform: translate(-15px, 10px); }
  18% { transform: translate(10px, -5px); }
  19% { transform: translate(0,0); }
  
  26% { transform: translate(20px, -15px); }
  27% { transform: translate(-20px, 15px); }
  28% { transform: translate(12px, -8px); }
  29% { transform: translate(0,0); }
  
  39% { transform: translate(30px, -25px); }
  40% { transform: translate(-30px, 25px); }
  41% { transform: translate(15px, -12px); }
  42% { transform: translate(0,0); }
}

/* Penalty Shootout Indicators (E-Soccer Style) */
.penalty-indicators {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-bottom: 20px;
}

.penalty-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid #1a2a42;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 900;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 10px rgba(0,0,0,0.5);
  transition: all 0.1s;
}

.p-dot-1 { animation: loseDot1 5s linear forwards; }
.p-dot-2 { animation: loseDot2 5s linear forwards; }
.p-dot-3 { animation: loseDot3 5s linear forwards; }

@keyframes loseDot1 {
  0%, 15% { background: #10b981; box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 15px #10b981; color: transparent; transform: scale(1); }
  16%, 100% { background: #ef4444; box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 20px #ef4444; color: white; transform: scale(1.2); }
}

@keyframes loseDot2 {
  0%, 25% { background: #10b981; box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 15px #10b981; color: transparent; transform: scale(1); }
  26%, 100% { background: #ef4444; box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 20px #ef4444; color: white; transform: scale(1.2); }
}

@keyframes loseDot3 {
  0%, 38% { background: #10b981; box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 15px #10b981; color: transparent; transform: scale(1); }
  39%, 100% { background: #ef4444; box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 20px #ef4444; color: white; transform: scale(1.2); }
}

.battle-arena {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.fighter {
  flex: 1;
  text-align: center;
  position: relative;
  transition: all 0.5s ease;
}

.fighter-name {
  font-size: clamp(24px, 4vw, 48px);
  font-weight: 900;
  text-transform: uppercase;
  color: white;
  text-shadow: 0 4px 10px rgba(0,0,0,0.5);
  word-break: break-word;
}

.vs-badge {
  font-size: clamp(50px, 8vw, 100px);
  filter: drop-shadow(0 0 20px rgba(255,255,255,0.4));
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  animation: vsStrike 5s linear forwards;
}

.loser-name-anim {
  animation: loserDefeat 5s linear forwards;
}

.ko-stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-15deg) scale(5);
  font-size: clamp(28px, 4vw, 52px);
  font-weight: 900;
  color: #ffffff;
  background: #ef4444;
  border: 4px solid #ffffff;
  padding: 8px 24px;
  border-radius: 8px;
  opacity: 0;
  animation: stampSlam 5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  pointer-events: none;
  text-shadow: 2px 2px 0px rgba(0,0,0,0.2);
  box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(239,68,68,0.6);
  z-index: 20;
}

.winner-fighter {
  animation: winnerTriumph 5s ease forwards;
}

.crown-badge {
  margin-top: 20px;
  color: #10b981;
  font-size: clamp(18px, 2.5vw, 28px);
  font-weight: 900;
  opacity: 0;
  animation: fadeInCrown 5s ease forwards;
  text-shadow: 0 0 15px rgba(16,185,129,0.5);
}

@keyframes vsStrike {
  0% { transform: translate(-50%, -100%) scale(3) rotate(0deg); opacity: 0; }
  5% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } /* Drop in center */
  10% { transform: translate(-50%, -50%) scale(1) rotate(0deg); } 
  
  /* Hit 1: Spinning ball jab */
  13% { transform: translate(-60%, -50%) scale(0.9) rotate(-30deg); } /* Wind up */
  16% { transform: translate(20%, -50%) scale(1.3) rotate(360deg); } /* Strike & Spin */
  18% { transform: translate(15%, -50%) scale(1.2) rotate(340deg); } /* Impact recoil */

  /* Hit 2: Fast spin hook */
  23% { transform: translate(-60%, -50%) scale(0.9) rotate(300deg); } /* Wind up */
  26% { transform: translate(35%, -50%) scale(1.6) rotate(720deg); } /* Strike & Spin */
  28% { transform: translate(30%, -50%) scale(1.5) rotate(700deg); } /* Impact recoil */

  /* Hit 3: Massive Finisher Shot */
  35% { transform: translate(-70%, -50%) scale(0.8) rotate(650deg); } /* Deep wind up */
  39% { transform: translate(50%, -50%) scale(2.2) rotate(1080deg); } /* Massive Strike */
  44% { transform: translate(50%, -50%) scale(2.2) rotate(1080deg); } /* Pin down */
  
  /* Disappear */
  50% { transform: translate(60%, -50%) scale(0) rotate(1120deg); opacity: 0; }
  100% { opacity: 0; transform: translate(60%, -50%) scale(0) rotate(1120deg); }
}

@keyframes loserDefeat {
  0%, 15% { filter: grayscale(0) brightness(1); opacity: 1; transform: translateX(0); color: white; }
  
  /* Reaction 1 */
  16% { transform: translateX(15px) rotate(5deg) scale(0.95); filter: brightness(2.5); color: #ffd700; text-shadow: 0 0 40px #ffd700; }
  18% { transform: translateX(-5px) rotate(-2deg); filter: brightness(1); color: white; text-shadow: none; }
  22% { transform: translateX(0) scale(1); }
  
  /* Reaction 2 */
  26% { transform: translateX(30px) rotate(10deg) scale(0.9); filter: brightness(3); color: #ff8c00; text-shadow: 0 0 60px #ff8c00; }
  28% { transform: translateX(-10px) rotate(-5deg); filter: brightness(1); color: white; text-shadow: none; }
  34% { transform: translateX(0) scale(1); filter: grayscale(0.5); }
  
  /* Reaction 3 (Finisher) */
  39% { transform: translateX(60px) rotate(20deg) scale(0.8); filter: brightness(4) grayscale(0); color: #ff4500; text-shadow: 0 0 100px #ff4500; opacity: 1; }
  44% { transform: translateX(55px) rotate(18deg) scale(0.8); opacity: 0.5; filter: brightness(1) grayscale(1); color: white; text-shadow: none; }
  
  /* Final state */
  60%, 100% { transform: translateX(0) scale(0.9); filter: grayscale(1) brightness(0.5); opacity: 0.3; }
}

@keyframes stampSlam {
  0%, 48% { opacity: 0; transform: translate(-50%, -50%) rotate(-15deg) scale(5); }
  53% { opacity: 1; transform: translate(-50%, -50%) rotate(-15deg) scale(0.8); }
  58%, 100% { opacity: 1; transform: translate(-50%, -50%) rotate(-15deg) scale(1); }
}

@keyframes winnerTriumph {
  0%, 55% { transform: scale(1); }
  60% { transform: scale(1.3) translateY(-20px); } /* Jump! */
  65% { transform: scale(1.2) translateY(0); }
  75%, 100% { transform: scale(1.2); text-shadow: 0 0 30px rgba(16,185,129,0.8); color: #a7f3d0; }
}

@keyframes fadeInCrown {
  0%, 65% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
.win-fade-enter-active{ animation: winIn .28s ease-out; }
.win-fade-leave-active{ animation: winOut .22s ease-in; }

@keyframes winIn{
  from { opacity: 0; transform: scale(.92) rotate(-1deg); }
  to { opacity: 1; transform: scale(1) rotate(0deg); }
}
@keyframes winOut{
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(.98); }
}

/* Champion Overlay - full screen celebration */
.champion-overlay {
  position: fixed;
  inset: 0;
  z-index: 100100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(120% 120% at 50% 10%, rgba(5,10,20,0.9), rgba(3,6,12,0.96));
  overflow: hidden;
}

.champion-card {
  position: relative;
  text-align: center;
  padding: clamp(30px, 6vw, 80px);
  border-radius: 28px;
  border: 3px solid rgba(255,215,0,0.6);
  background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.12));
  box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 120px rgba(255, 215, 0, 0.35);
}

.champion-glow {
  position: absolute;
  inset: -60px;
  background: conic-gradient(from 0deg, #FFD700, #10b981, #3b82f6, #ef4444, #a855f7, #FFD700);
  filter: blur(28px) opacity(0.45);
  z-index: -1;
}

.champion-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(255,255,255,0.35);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  transition: all .25s ease;
}
.champion-close:hover { background: rgba(239,68,68,0.85); border-color: #ef4444; transform: rotate(90deg); }

.champion-crown {
  font-size: clamp(44px, 7vw, 90px);
  margin-bottom: clamp(6px, 1vw, 12px);
  animation: crownPulse 1.8s ease-in-out infinite;
}

.champion-title {
  font-size: clamp(38px, 6vw, 88px);
  font-weight: 1000;
  color: #FFD700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 2px 2px 0 #5c4400;
  letter-spacing: 2px;
}

.champion-name {
  margin-top: clamp(10px, 1.5vw, 16px);
  font-size: clamp(28px, 4.8vw, 64px);
  font-weight: 900;
  color: #fff;
  text-shadow: 0 0 12px rgba(255,255,255,0.6);
}

.champion-trophy {
  display: block;
  margin: clamp(18px, 2.2vw, 28px) auto;
  width: clamp(160px, 22vw, 320px);
  height: auto;
  filter: drop-shadow(0 20px 40px rgba(255, 215, 0, 0.35));
  animation: trophyShine 3s ease-in-out infinite;
}

.champion-sub {
  color: #a7f3d0;
  font-weight: 700;
  font-size: clamp(14px, 2.4vw, 24px);
  text-shadow: 0 0 10px rgba(16,185,129,0.6);
}

@keyframes crownPulse {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.06); }
}

@keyframes trophyShine {
  0%, 100% { filter: drop-shadow(0 20px 40px rgba(255, 215, 0, 0.35)); }
  50% { filter: drop-shadow(0 28px 60px rgba(255, 215, 0, 0.6)); }
}

/* ─── Responsive - Mid-size Screens (Tablets/Small Laptops) ─── */
@media (max-width: 1100px) {
  .top-logo {
    height: clamp(100px, 12vh, 160px) !important;
  }
  .center-final {
    width: 200px !important;
    gap: 10px !important;
    margin: 0 20px !important;
  }
  .final-trophy {
    width: 120px !important;
    height: 120px !important;
  }
  .start-final-btn {
    width: 180px !important;
    font-size: 16px !important;
    padding: 12px 0 !important;
    letter-spacing: 2px !important;
  }
  .bracket-wrap.simple .round {
    width: clamp(120px, 12vw, 160px) !important;
  }
  .bracket-wrap.simple .slot :deep(.team-btn) {
    width: 100% !important;
  }
}

/* ─── Responsive - Short Viewports (Laptops/Small screens) ─── */
@media (max-height: 850px) {
  .top-logo {
    height: clamp(80px, 12vh, 160px) !important;
  }
  .header-player {
    height: clamp(70px, 10vh, 150px) !important;
  }
  .bracket-wrap.simple .slot :deep(.team-btn) {
    height: clamp(38px, 5vh, 52px) !important;
    font-size: clamp(12px, 1.2vw, 15px) !important;
  }
  .bracket-wrap.simple .slot-semifinal :deep(.team-btn) {
    height: clamp(80px, 8vh, 110px) !important;
  }
  .bracket-wrap.simple .match {
    gap: 4px !important;
  }
  .center-final {
    margin-top: -60px !important;
    gap: 15px !important;
  }
  .final-trophy {
    width: clamp(100px, 12vw, 160px) !important;
    height: clamp(100px, 12vw, 160px) !important;
  }
  .start-final-btn {
    padding: 12px 0 !important;
    font-size: 18px !important;
    width: 200px !important;
  }
  .match-time-input {
    height: 22px !important;
    font-size: 11px !important;
  }
}
</style>
