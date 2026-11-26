import { computed, ref } from 'vue'
import { analyzeSail, stripsUsed, type CaseResult } from '../lib/membrane'
import { correlateTacks, type TackRow } from '../lib/correlation'
import {
  emptyAllocation, evenAllocation, loft, segmentIds, segmentLabel, tailStackAllocation,
  type Allocation,
} from './loft'

export type Preset = 'tail' | 'even' | 'empty' | 'custom'

export function useLoft() {
  const def = loft
  const allocation = ref<Allocation>(tailStackAllocation(def))
  const preset = ref<Preset>('tail')
  const activeGust = ref(0)
  const showStock = ref(false)

  const ids = segmentIds(def)
  const used = computed(() => stripsUsed(def, allocation.value))
  const remaining = computed(() => def.stripBudget - used.value)
  const overBudget = computed(() => used.value > def.stripBudget)

  const results = computed<CaseResult[]>(() => analyzeSail(def, allocation.value))
  const tacks = computed<TackRow[]>(() => correlateTacks(def, results.value))
  const activeResult = computed(() => results.value[activeGust.value])
  const approved = computed(() => results.value.every(result => result.overloaded.length === 0) && !overBudget.value)
  const segmentRows = computed(() => ids.map(id => {
    const cases = results.value.map(result => {
      const member = result.members.find(item => item.id === id)
      return member ? { utilization: member.utilization, tension: member.tension, overloaded: member.overloaded } : null
    })
    return {
      id, label: segmentLabel(id), strips: allocation.value[id] ?? 0,
      g1: cases[0], g2: cases[1],
    }
  }))

  function setStrip(id: string, value: number) {
    const next = Math.max(0, Math.round(value))
    const other = used.value - (allocation.value[id] ?? 0)
    allocation.value = { ...allocation.value, [id]: Math.max(0, Math.min(next, def.stripBudget - other)) }
    preset.value = 'custom'
  }
  function applyPreset(kind: Preset) {
    preset.value = kind
    allocation.value = kind === 'tail' ? tailStackAllocation(def) : kind === 'even' ? evenAllocation(def) : emptyAllocation(def)
  }
  function selectGust(index: number) { activeGust.value = index }
  function toggleStock() { showStock.value = !showStock.value }

  return {
    def, allocation, preset, activeGust, showStock, ids, used, remaining, overBudget,
    results, tacks, activeResult, approved, segmentRows,
    setStrip, applyPreset, selectGust, toggleStock,
  }
}
