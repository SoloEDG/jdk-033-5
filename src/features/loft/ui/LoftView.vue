<script setup lang="ts">
import { Eye, Scissors } from 'lucide-vue-next'
import { useLoft } from '../model/useLoft'
import SailPlan from './SailPlan.vue'
import ReinforcePanel from './ReinforcePanel.vue'
import VerdictPanel from './VerdictPanel.vue'
import TackPanel from './TackPanel.vue'

const {
  def, allocation, preset, activeGust, showStock, used, remaining, overBudget,
  results, tacks, activeResult, approved, segmentRows,
  setStrip, applyPreset, selectGust, toggleStock,
} = useLoft()
</script>

<template>
  <div class="loft-view">
    <div class="loft-toolbar">
      <div class="loft-title"><Scissors :size="18"/><div><h2>修帆车间 · 试航验算</h2><span>破损帆改裁 · 两档阵风强度闸门</span></div></div>
      <div class="loft-actions">
        <div class="segment gust-switch" role="group" aria-label="阵风档位">
          <button v-for="(gust, i) in def.gusts" :key="gust.id" type="button" :aria-pressed="activeGust === i"
            :data-testid="`gust-${gust.id}`" @click="selectGust(i)">
            {{ gust.name }} · {{ gust.windKnots }}kn
          </button>
        </div>
        <button type="button" class="view-toggle" :aria-pressed="showStock" @click="toggleStock">
          <Eye :size="15"/>{{ showStock ? '查看帆形' : '查看原布' }}
        </button>
      </div>
    </div>

    <div class="loft-grid">
      <div class="loft-main">
        <div class="sail-card">
          <SailPlan :def="def" :result="activeResult" :show-stock="showStock" :allocation="allocation"/>
          <div class="sail-legend">
            <span><i class="dot" style="background:#5d8a66"></i>正常 ≤80%</span>
            <span><i class="dot" style="background:#d8b13c"></i>偏高 80–100%</span>
            <span><i class="dot" style="background:#e08a2e"></i>临界</span>
            <span><i class="dot" style="background:#d6452c"></i>超限</span>
          </div>
        </div>
        <TackPanel :rows="tacks"/>
      </div>
      <aside class="loft-side">
        <ReinforcePanel :def="def" :rows="segmentRows" :used="used" :remaining="remaining" :over-budget="overBudget"
          :preset="preset" @set="setStrip" @preset="applyPreset"/>
        <VerdictPanel :results="results" :approved="approved" :over-budget="overBudget"/>
      </aside>
    </div>
  </div>
</template>
