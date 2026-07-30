<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

let frame = 0
const pointerGlow = ref<HTMLElement | null>(null)

function updatePointer(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    if (!pointerGlow.value) return
    pointerGlow.value.style.transform =
      `translate3d(${event.clientX - 110}px, ${event.clientY - 110}px, 0)`
    pointerGlow.value.style.opacity = '1'
  })
}

function hidePointer() {
  if (pointerGlow.value) pointerGlow.value.style.opacity = '0'
}

onMounted(() => {
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', updatePointer, { passive: true })
    document.documentElement.addEventListener('mouseleave', hidePointer)
  }
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('pointermove', updatePointer)
  document.documentElement.removeEventListener('mouseleave', hidePointer)
})
</script>

<template>
  <div class="ambient-background" aria-hidden="true">
    <span class="ambient-orb ambient-orb--one" />
    <span class="ambient-orb ambient-orb--two" />
    <span class="ambient-grid" />
  </div>
  <div ref="pointerGlow" class="pointer-glow" aria-hidden="true" />
</template>
