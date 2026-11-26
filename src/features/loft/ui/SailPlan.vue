<script setup lang="ts">
import { computed } from 'vue'
import { sourcePolygon } from '../model/loft'
import type { Loft, Pt } from '../model/loft'
import type { CaseResult } from '../lib/membrane'

const props = defineProps<{
  def: Loft
  result: CaseResult
  showStock: boolean
  allocation: Record<string, number>
}>()

const points = (poly: Pt[]) => poly.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
const stockViewBox = computed(() => `0 0 ${props.def.stock.width} ${props.def.stock.height}`)
const planViewBox = '0 0 440 360'

const memberColor = (utilization: number, overloaded: boolean) => {
  if (overloaded) return '#d6452c'
  if (utilization > 0.8) return '#e08a2e'
  if (utilization > 0.5) return '#d8b13c'
  return '#5d8a66'
}
const memberWidth = (utilization: number) => 1.5 + Math.min(5, utilization * 5)

const warpArrow = (origin: Pt, angle: number, length = 26) => {
  const rad = angle * Math.PI / 180
  const tip = { x: origin.x + Math.sin(rad) * length, y: origin.y - Math.cos(rad) * length }
  const back = { x: origin.x - Math.sin(rad) * length, y: origin.y + Math.cos(rad) * length }
  const wing = 7
  return {
    line: `M${back.x} ${back.y} L${tip.x} ${tip.y}`,
    head: `${tip.x},${tip.y} ${tip.x - Math.sin(rad) * wing - Math.cos(rad) * wing * .6},${tip.y + Math.cos(rad) * wing - Math.sin(rad) * wing * .6} ${tip.x - Math.sin(rad) * wing + Math.cos(rad) * wing * .6},${tip.y + Math.cos(rad) * wing + Math.sin(rad) * wing * .6}`,
  }
}

const planMembers = computed(() => props.result.members.filter(m => m.kind !== 'sheet'))
const deformedPanels = computed(() => props.def.panels.map(panel => {
  const ids = new Set(panel.plan.map(p => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`))
  const pts: Pt[] = []
  for (const member of props.result.members) {
    for (const p of [{ x: member.ax, y: member.ay }, { x: member.bx, y: member.by }]) {
      const k = `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`
      if (ids.has(k) && !pts.some(q => `${Math.round(q.x * 100)},${Math.round(q.y * 100)}` === k)) pts.push(p)
    }
  }
  return { id: panel.id, pts }
}))
</script>

<template>
  <svg class="sail-svg" :viewBox="showStock ? stockViewBox : planViewBox" role="img" :aria-label="showStock ? '原布排料与缺口' : '帆形应力与变形'">
    <defs>
      <pattern id="cloth-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M20 0H0V20" fill="none" stroke="#b9a978" stroke-opacity=".35" stroke-width=".7"/>
      </pattern>
    </defs>

    <template v-if="showStock">
      <rect :width="def.stock.width" :height="def.stock.height" fill="#e8ddba" stroke="#9c8d63" stroke-width="2"/>
      <rect :width="def.stock.width" :height="def.stock.height" fill="url(#cloth-grid)"/>
      <polygon :points="points(def.stock.gap)" fill="#7a6a52" stroke="#4d4132" stroke-width="1.6" stroke-dasharray="5 4"/>
      <text :x="def.stock.gap[1].x - 14" :y="def.stock.gap[1].y - 8" class="svg-note gap-label">破损缺口</text>
      <g v-for="panel in def.panels" :key="panel.id">
        <polygon :points="points(sourcePolygon(panel))" :fill="panel.tint" fill-opacity=".82" stroke="#6b5d3a" stroke-width="1.8"/>
        <g v-for="(p, i) in sourcePolygon(panel)" :key="i">
          <circle :cx="p.x" :cy="p.y" r="2.4" fill="#6b5d3a"/>
        </g>
        <g class="warp-mark" stroke="#3d5a63" stroke-width="1.4" fill="#3d5a63">
          <path :d="warpArrow({ x: sourcePolygon(panel).reduce((s, p) => s + p.x, 0) / sourcePolygon(panel).length, y: sourcePolygon(panel).reduce((s, p) => s + p.y, 0) / sourcePolygon(panel).length }, panel.warp).line" fill="none"/>
          <polygon :points="warpArrow({ x: sourcePolygon(panel).reduce((s, p) => s + p.x, 0) / sourcePolygon(panel).length, y: sourcePolygon(panel).reduce((s, p) => s + p.y, 0) / sourcePolygon(panel).length }, panel.warp).head"/>
        </g>
        <text class="svg-note" :x="sourcePolygon(panel)[0].x + 6" :y="sourcePolygon(panel)[0].y + 4">{{ panel.id }} {{ panel.name }} · 经{{ panel.warp }}°</text>
      </g>
    </template>

    <template v-else>
      <rect x="0" y="0" width="440" height="360" fill="#f3ecd2"/>
      <rect x="0" y="0" width="440" height="360" fill="url(#cloth-grid)"/>
      <g v-for="dp in deformedPanels" :key="dp.id" :opacity=".28">
        <polygon :points="points(dp.pts)" fill="#c9b583" stroke="none"/>
      </g>
      <g v-for="panel in def.panels" :key="'ref-' + panel.id" :opacity=".5">
        <polygon :points="points(panel.plan)" fill="none" stroke="#8a7c55" stroke-width="1" stroke-dasharray="4 4"/>
      </g>
      <g v-for="member in planMembers" :key="member.id">
        <line :x1="member.ax" :y1="member.ay" :x2="member.bx" :y2="member.by"
          :stroke="memberColor(member.utilization, member.overloaded)" :stroke-width="memberWidth(member.utilization)"
          :stroke-dasharray="member.kind === 'seam' ? '0' : '3 3'" stroke-linecap="round"/>
        <circle v-if="member.overloaded" :cx="(member.ax + member.bx) / 2" :cy="(member.ay + member.by) / 2" r="4.2"
          fill="#d6452c" stroke="#fff" stroke-width="1.2"/>
      </g>
      <g v-for="panel in def.panels" :key="'warp-' + panel.id" class="warp-mark" stroke="#3d5a63" stroke-width="1.2" fill="#3d5a63">
        <path :d="warpArrow({ x: panel.plan.reduce((s, p) => s + p.x, 0) / panel.plan.length, y: panel.plan.reduce((s, p) => s + p.y, 0) / panel.plan.length }, panel.warp, 22).line" fill="none"/>
        <polygon :points="warpArrow({ x: panel.plan.reduce((s, p) => s + p.x, 0) / panel.plan.length, y: panel.plan.reduce((s, p) => s + p.y, 0) / panel.plan.length }, panel.warp, 22).head"/>
      </g>
      <g v-for="over in result.overloaded" :key="'ov-' + over.id">
        <text class="svg-note overload-text" :x="(over.ax + over.bx) / 2 + 6" :y="(over.ay + over.by) / 2 - 6">超限 {{ Math.round(over.utilization * 100) }}%</text>
      </g>
      <text class="svg-note" x="8" y="20">{{ result.gust.name }} · {{ result.gust.windKnots }} kn · 最大位移 {{ result.maxShift.toFixed(2) }}</text>
    </template>
  </svg>
</template>
