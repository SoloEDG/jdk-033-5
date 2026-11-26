<script setup lang="ts">
import { Layers3, Minus, Plus } from 'lucide-vue-next'
import type { Loft } from '../model/loft'
import type { Preset } from '../model/useLoft'

defineProps<{
  def: Loft
  rows: { id: string; label: string; strips: number; g1: { utilization: number; overloaded: boolean } | null; g2: { utilization: number; overloaded: boolean } | null }[]
  used: number
  remaining: number
  overBudget: boolean
  preset: Preset
}>()
const emit = defineEmits<{ set: [id: string, value: number]; preset: [kind: Preset] }>()

const pct = (value: number) => `${Math.round(value * 100)}%`
const tone = (cell: { utilization: number; overloaded: boolean } | null) => {
  if (!cell) return 'idle'
  if (cell.overloaded) return 'over'
  if (cell.utilization > 0.8) return 'hot'
  return 'safe'
}
</script>

<template>
  <section class="instrument loft-panel" aria-label="加强条分配">
    <h2><Layers3 :size="17"/> 加强条分配 <b data-testid="strips-used">{{ used }} / {{ def.stripBudget }}</b></h2>
    <div class="segment preset-row">
      <button type="button" :aria-pressed="preset === 'tail'" @click="emit('preset', 'tail')">堆缝尾</button>
      <button type="button" :aria-pressed="preset === 'even'" @click="emit('preset', 'even')">均匀</button>
      <button type="button" :aria-pressed="preset === 'empty'" @click="emit('preset', 'empty')">清空</button>
    </div>
    <ul class="strip-list">
      <li v-for="row in rows" :key="row.id" :data-over="row.g2?.overloaded ? 'true' : 'false'">
        <div class="strip-head">
          <span class="strip-label">{{ row.label }}</span>
          <div class="stepper">
            <button type="button" :disabled="row.strips === 0" aria-label="减少加强条" @click="emit('set', row.id, row.strips - 1)"><Minus :size="13"/></button>
            <strong data-testid="strip-count">{{ row.strips }}</strong>
            <button type="button" :disabled="remaining === 0" aria-label="增加加强条" @click="emit('set', row.id, row.strips + 1)"><Plus :size="13"/></button>
          </div>
        </div>
        <div class="util-cells">
          <span class="util" :data-tone="tone(row.g1)"><small>一档</small>{{ row.g1 ? pct(row.g1.utilization) : '—' }}</span>
          <span class="util" :data-tone="tone(row.g2)"><small>二档</small>{{ row.g2 ? pct(row.g2.utilization) : '—' }}</span>
        </div>
      </li>
    </ul>
    <p v-if="overBudget" class="warn-note" data-testid="budget-warning">加强条超出预算，无法装船试航。</p>
    <p v-else class="hint-note">堆缝尾可缓解原超限缝段，但未加强的中段与相邻窄边可能成为新超限点。</p>
  </section>
</template>
