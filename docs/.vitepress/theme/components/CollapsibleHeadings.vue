<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

function isHeading(el: Element | null): el is HTMLElement {
  return !!el && /^H[1-6]$/.test(el.tagName)
}

function sectionContent(heading: HTMLElement): Element[] {
  const level = Number(heading.tagName[1])
  const els: Element[] = []
  let el = heading.nextElementSibling
  while (el) {
    if (isHeading(el) && Number(el.tagName[1]) <= level) break
    els.push(el)
    el = el.nextElementSibling
  }
  return els
}

function hasCollapsibleContent(heading: HTMLElement): boolean {
  const next = heading.nextElementSibling
  if (!next) return false
  if (isHeading(next)) return Number(next.tagName[1]) > Number(heading.tagName[1])
  return true
}

function setCollapsed(heading: HTMLElement, collapsed: boolean): void {
  heading.classList.toggle('vp-collapsed', collapsed)
  const btn = heading.querySelector<HTMLButtonElement>(':scope > .vp-collapse-toggle')
  btn?.setAttribute('aria-expanded', String(!collapsed))
  for (const el of sectionContent(heading)) {
    el.classList.toggle('vp-collapse-hidden', collapsed)
  }
}

function toggleSection(heading: HTMLElement): void {
  setCollapsed(heading, !heading.classList.contains('vp-collapsed'))
}

function expandAncestors(target: HTMLElement): void {
  if (isHeading(target) && target.classList.contains('vp-collapsed')) {
    setCollapsed(target, false)
  }
  let cur: HTMLElement | null = target
  while (cur && !isHeading(cur)) {
    cur = cur.previousElementSibling as HTMLElement | null
  }
  if (!cur) return
  if (cur.classList.contains('vp-collapsed')) {
    setCollapsed(cur, false)
  }
  let level = Number(cur.tagName[1])
  let prev = cur.previousElementSibling as HTMLElement | null
  while (prev) {
    if (isHeading(prev)) {
      const l = Number(prev.tagName[1])
      if (l < level) {
        if (prev.classList.contains('vp-collapsed')) {
          setCollapsed(prev, false)
        }
        level = l
      }
    }
    prev = prev.previousElementSibling as HTMLElement | null
  }
}

function onClick(e: MouseEvent): void {
  if (typeof document === 'undefined') return
  const link = (e.target as Element | null)?.closest('a[href^="#"]') as HTMLAnchorElement | null
  if (!link) return
  const id = decodeURIComponent((link.getAttribute('href') || '#').slice(1))
  if (!id) return
  const el = document.getElementById(id)
  if (el) expandAncestors(el)
}

function apply(): void {
  if (typeof document === 'undefined') return
  const doc = document.querySelector('.vp-doc')
  if (!doc) return
  doc.querySelectorAll('h2, h3, h4').forEach((heading) => {
    if (heading.querySelector(':scope > .vp-collapse-toggle')) return
    if (!hasCollapsibleContent(heading)) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'vp-collapse-toggle'
    btn.setAttribute('aria-expanded', 'true')
    btn.setAttribute('aria-label', '折叠 / 展开本节')
    heading.classList.add('vp-has-toggle')
    heading.appendChild(btn)
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleSection(heading)
    })
  })
}

let timer = 0
function scheduleApply(): void {
  clearTimeout(timer)
  timer = window.setTimeout(apply, 0)
}

onMounted(() => {
  apply()
  document.addEventListener('click', onClick, true)
})

onUnmounted(() => {
  clearTimeout(timer)
  document.removeEventListener('click', onClick, true)
})

watch(() => route.path, () => {
  nextTick(scheduleApply)
})
</script>

<template></template>
