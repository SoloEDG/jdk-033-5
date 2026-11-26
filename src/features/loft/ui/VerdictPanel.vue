<script setup lang="ts">
import { CircleCheck, TriangleAlert } from 'lucide-vue-next'
import type { CaseResult } from '../lib/membrane'

defineProps<{ results: CaseResult[]; approved: boolean; overBudget: boolean }>()
</script>

<template>
  <section class="instrument loft-panel verdict" :data-approved="approved" aria-label="试航判定">
    <h2><component :is="approved ? CircleCheck : TriangleAlert" :size="17"/> 装船试航闸门</h2>
    <div class="verdict-banner" :class="approved ? 'pass' : 'fail'" data-testid="trial-verdict">
      <strong>{{ approved ? '准予装船试航' : '不予装船试航' }}</strong>
      <span>{{ approved ? '两档阵风均在材料限值内' : '存在超限缝段或加强条超预算' }}</span>
    </div>
    <ul class="case-list">
      <li v-for="result in results" :key="result.gust.id" :data-state="result.overloaded.length ? 'fail' : 'pass'">
        <span class="case-name">{{ result.gust.name }} · {{ result.gust.windKnots }} kn</span>
        <span class="case-meta">峰值 {{ Math.round(result.worst.utilization * 100) }}%</span>
        <span class="case-state">{{ result.overloaded.length ? `超限 ${result.overloaded.length} 处` : '通过' }}</span>
      </li>
    </ul>
  </section>
</template>
