<script setup lang="ts">
import { ShipWheel } from 'lucide-vue-next'
import type { TackRow } from '../lib/correlation'

defineProps<{ rows: TackRow[] }>()
</script>

<template>
  <section class="instrument loft-panel" aria-label="换舷受力对照">
    <h2><ShipWheel :size="17"/> 换舷速度 · 受力形变对照</h2>
    <table class="tack-table">
      <thead>
        <tr><th>阵风</th><th>实航速度</th><th>过载位置</th><th>峰值拉力</th><th>形变</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.gustId" :data-over="row.overloaded">
          <td>{{ row.gustName }}<small>{{ row.windKnots }} kn</small></td>
          <td data-testid="tack-speed">{{ row.boatKnots.toFixed(1) }} kn</td>
          <td><span :class="['loc', row.overloaded ? 'loc-over' : '']">{{ row.worstLabel }}</span><small>{{ row.worstKind }}</small></td>
          <td :class="row.overloaded ? 'loc-over' : ''">{{ Math.round(row.utilization * 100) }}%</td>
          <td><small>经 {{ (row.warpStrain * 100).toFixed(2) }}%<br/>纬 {{ (row.weftStrain * 100).toFixed(2) }}%<br/>位移 {{ row.maxShift.toFixed(2) }}</small></td>
        </tr>
      </tbody>
    </table>
    <p class="hint-note">换舷实航速度由航行动力学推算，过载位置与帆形试验中的峰值构件一一对应。</p>
  </section>
</template>
