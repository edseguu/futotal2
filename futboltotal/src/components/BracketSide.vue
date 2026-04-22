<script setup>
import { computed } from 'vue'
import TeamButton from './TeamButton.vue'

const props = defineProps({
  participants: { type: Array, default: () => [] },
  side: { type: String, default: 'left' } // 'left' or 'right'
})

// Build rounds: array of arrays. Each round has matches count = participants.length / 2^r
const rounds = computed(() => {
  const roundsArr = []
  let count = props.participants.length
  while (count >= 1) {
    roundsArr.push(Array.from({ length: count }, () => null))
    count = Math.floor(count / 2)
  }
  return roundsArr
})

// Provide labels for first round from participants, subsequent rounds show placeholder
const roundNames = (roundIndex, slotIndex) => {
  if (roundIndex === 0) {
    const idx = props.side === 'left' ? slotIndex : props.participants.length - 1 - slotIndex
    return props.participants[idx] || `Team ${idx + 1}`
  }
  return ''
}
</script>

<template>
  <div class="bracket-side" :class="side">
    <div class="rounds">
      <div
        v-for="(round, rIdx) in rounds"
        :key="rIdx"
        class="round"
      >
        <div
          v-for="(slot, sIdx) in round"
          :key="sIdx"
          class="slot"
        >
          <TeamButton v-if="rIdx === 0" :name="roundNames(rIdx, sIdx)" />
          <div v-else class="match-slot">--</div>

          <!-- connector towards center (right for left side, left for right side) -->
          <div class="connector" :class="side"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bracket-side{ display:none; }
.slot .match-slot{
  width:140px; height:36px; display:flex; align-items:center; justify-content:center; background:#f8fafc; border:1px dashed #e2e8f0; border-radius:6px; color:#475569; font-weight:600;
}

.connector{ display:none; }

/* For small first-round team buttons make connector shorter and aligned */
.round:first-child .slot .connector{ width:36px; }
.round:first-child .slot .connector.left{ right:-36px; }
.round:first-child .slot .connector.right{ left:-36px; }

/* Flip layout for right side so rounds appear reversed toward center */
.bracket-side.right .rounds{ flex-direction:row-reverse; }
.bracket-side.right .connector{ border-top-color:#cbd5e1 }

</style>
