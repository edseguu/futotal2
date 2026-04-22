<script setup>
import { defineProps, defineEmits, ref, nextTick } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  active: { type: Boolean, default: false },
  editable: { type: Boolean, default: true },
  readonly: { type: Boolean, default: false },
  side: { type: String, default: 'right' }, // 'left' or 'right'
	placeholder: { type: String, default: '' }, // Letter placeholder (A-P)
	loser: { type: Boolean, default: false },
	colorScheme: { type: String, default: 'white' } // 'white', 'green', 'gray'
})
const emit = defineEmits(['select', 'rename'])

const isEditing = ref(false)
const localName = ref(props.name)
const inputRef = ref(null)

// click on trophy -> emit 'select' to advance winner
function onSelectWinner(evt) {
  evt.stopPropagation()
  emit('select')
}

// click on main area -> start editing
function startEdit() {
  if (!props.editable || props.readonly) return
  localName.value = props.name || ''
  isEditing.value = true
  nextTick(() => {
    if (inputRef.value) inputRef.value.focus()
  })
}

function saveEdit() {
  const newName = localName.value == null ? '' : String(localName.value).trim()
  emit('rename', newName === '' ? null : newName)
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
  localName.value = props.name || ''
}

function onKeydown(evt) {
  if (evt.key === 'Enter') {
    saveEdit()
  } else if (evt.key === 'Escape') {
    cancelEdit()
  }
}
</script>

<template>
	<div class="team-btn-wrapper">
		<div
			v-if="!isEditing"
			class="team-btn"
			:class="{ 
				active: active, 
				readonly: readonly, 
				'left-side': side === 'left', 
				loser: loser,
				'scheme-green': colorScheme === 'green',
				'scheme-gray': colorScheme === 'gray'
			}"
		>
			<!-- Trophy Button (Left Side) -->
			<div 
				v-if="side === 'left'" 
				class="trophy-btn" 
				@click="onSelectWinner" 
				title="Avanzar ganador"
			>
				<span class="trophy-emoji">🏆</span>
			</div>

			<!-- Main clickable area: edit name -->
			<div class="name-area" @click="startEdit" :title="(!readonly && editable) ? 'Click para editar' : ''">
				<span class="label" v-if="name">{{ name }}</span>
				<span class="placeholder" v-else>{{ placeholder }}</span>
			</div>

			<!-- Trophy Button (Right Side) -->
			<div 
				v-if="side === 'right'" 
				class="trophy-btn" 
				@click="onSelectWinner" 
				title="Avanzar ganador"
			>
				<span class="trophy-emoji">🏆</span>
			</div>
		</div>

		<input
			v-else
			class="team-input"
			v-model="localName"
			@blur="saveEdit"
			@keydown="onKeydown"
			ref="inputRef"
			placeholder="Nombre del participante"
			aria-label="Editar nombre del participante"
		/>
	</div>
</template>

<style scoped>
.team-btn-wrapper{
	position: relative;
}

.team-btn{
		/* rectangular: wider than tall */
		width: clamp(130px, 15vw, 220px);
		height: clamp(50px, 5.5vw, 90px);
		display:flex;
		align-items:stretch;
		justify-content:space-between;
		/* Arcade-style thin neon border using background-clip trick */
		background:
			linear-gradient(#ffffff, #ffffff) padding-box,
			linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #f59e0b 100%) border-box;
		border: 2px solid transparent; /* keep it thin */
		padding: 0;
		border-radius: 10px;
		text-align: center;
		color: #042022;
		font-weight:700;
		transition: transform .15s ease, box-shadow .2s ease, filter .2s ease;
		overflow: hidden;
		/* subtle outer glow for arcade look (not too thick) */
		box-shadow:
			0 2px 10px rgba(16,185,129,0.18),
			0 0 14px rgba(16,185,129,0.18);
		box-sizing: border-box;
		position: relative;
}

.name-area{
	flex:1;
	display:flex;
	align-items:center;
	justify-content:center;
	padding:6px 8px;
	transition: background 0.2s ease;
	overflow: hidden; /* hide overflow but allow wrapping inside label */
}

.name-area:hover{
	background: rgba(16,185,129,0.05);
}

.team-btn.readonly .name-area {
	cursor: default; /* no text cursor for readonly */
}

.team-btn.readonly .name-area:hover {
	background: transparent; /* no hover effect for readonly */
}

.name-area .label{ 
	display:block; 
	width:100%; 
	font-size: clamp(16px, 1.9vw, 28px); 
	line-height:1.3; 
	/* allow line breaks instead of ellipsis */
	white-space: normal;
	word-wrap: break-word;
	overflow: hidden;
	text-align: center;
}

.name-area .placeholder{
	display:block; 
	width:100%; 
	font-size: clamp(22px, 2.6vw, 36px); 
	line-height:1.3; 
	text-align: center;
	opacity: 0.65;
	color: inherit; /* follow parent color */
	font-weight: 900;
	font-family: 'Arial Black', 'Impact', sans-serif;
	text-transform: uppercase;
	letter-spacing: 2px;
	text-shadow: 2px 2px 0px rgba(16, 185, 129, 0.3);
}

/* Trophy Button Styles */
.trophy-btn {
	width: clamp(45px, 5vw, 80px);
	height: 100%;
	position: relative;
	background: rgba(16, 185, 129, 0.12);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.3s ease;
  flex-shrink: 0;
  border: none !important;
}

.left-side .trophy-btn {
  border: none !important;
}

.trophy-btn:hover {
	background: rgba(16, 185, 129, 0.25);
}

.trophy-emoji {
	font-size: clamp(24px, 2.8vw, 42px);
	filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.4));
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.trophy-btn:hover .trophy-emoji {
  transform: scale(1.2) rotate(10deg);
  filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.7));
}

.team-btn:hover .trophy-btn {
	background: rgba(16, 185, 129, 0.15);
}

.team-btn:hover{
		transform: translateY(-2px);
		box-shadow:
			0 6px 16px rgba(16,185,129,0.28),
			0 0 20px rgba(16,185,129,0.26);
}

.team-btn.active{ 
		/* Keep the neon frame but soften fill */
		background:
			linear-gradient(#ecfdf5, #ecfdf5) padding-box,
			linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #f59e0b 100%) border-box;
		color:#064e3b; 
		box-shadow:
			0 8px 22px rgba(16,185,129,0.30),
			0 0 26px rgba(16,185,129,0.28);
}

/* Green Color Scheme */
.team-btn.scheme-green {
	background:
		linear-gradient(#bbf7d0, #bbf7d0) padding-box,
		linear-gradient(135deg, #10b981 0%, #059669 100%) border-box;
	color: #064e3b;
	box-shadow:
		0 2px 10px rgba(16,185,129,0.15),
		0 0 14px rgba(16,185,129,0.12);
}
.team-btn.scheme-green:hover {
	box-shadow:
		0 6px 16px rgba(16,185,129,0.25),
		0 0 20px rgba(16,185,129,0.20);
}

.team-btn.scheme-gray {
	background:
		/* LED Matrix Pattern - Internal only */
		radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px) 0 0 / 4px 4px padding-box,
		linear-gradient(#1f2937, #111827) padding-box,
		/* Moving Golden Shine Border */
		linear-gradient(110deg, #FFD700 0%, #FFD700 40%, #ffffff 50%, #FFD700 60%, #FFD700 100%) border-box;
	background-size: 4px 4px, 100% 100%, 300% 100%;
	color: #ffffff;
	box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
	position: relative;
	animation: goldenShine 3s linear infinite;
}

/* LCD Grid Overlay */
.team-btn.scheme-gray::after {
	content: '';
	position: absolute;
	inset: 0;
	background-image: 
		linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
		linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
	background-size: 4px 4px;
	pointer-events: none;
	mix-blend-mode: overlay;
	opacity: 0.6;
	border-radius: 10px;
}

.team-btn.scheme-gray .placeholder {
	color: #FFD700;
	opacity: 0.3;
	text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
}

.team-btn.scheme-gray:hover {
	box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
}

@keyframes goldenShine {
	0% { background-position: 0 0, 0 0, 150% 0%; }
	100% { background-position: 0 0, 0 0, -150% 0%; }
}

/* Loser visual state */
.team-btn.loser{
	/* Override arcade frame for losers */
	background: #e5e7eb; /* Tailwind gray-200 */
	color: #6b7280; /* gray-500 */
	filter: grayscale(1);
	opacity: 0.9;
	border: 2px solid rgba(107,114,128,0.35);
	box-shadow: none;
	pointer-events: none; /* prevent further interaction */
}

.team-btn.loser .label{
	text-decoration: line-through;
	text-decoration-thickness: 3px;
}

.team-input{
	width: clamp(130px, 15vw, 220px);
	height: clamp(50px, 5.5vw, 90px);
	padding: 8px 10px;
	border-radius: 8px;
	border: 2px solid rgba(16,185,129,0.18);
	font-weight:700;
	font-size: clamp(12px, 1.2vw, 16px);
	outline:none;
	box-sizing: border-box;
}
</style>
