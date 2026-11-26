<script setup lang="ts">
import { ref } from 'vue'
import { Anchor, CircleStop, Flag, Pause, Play, RotateCcw, Scissors } from 'lucide-vue-next'
import { CourseChart } from '../features/chart'
import { WindPanel } from '../features/wind'
import { SailPanel } from '../features/sail'
import { MarksPanel } from '../features/jury'
import { LogbookPanel } from '../features/logbook'
import { LoftView } from '../features/loft'
import { clock } from '../shared/format'
import { useRace } from './useRace'

const { course, wind, sail, jury, logbook, status, focus, frame, trail, active, start, togglePause, end, locate } = useRace()
const { voyages, selected, cursor, notice, seek, open } = logbook
const { mode } = wind
const { events } = jury
const labels = { ready: '待出发', running: '竞速中', paused: '已暂停', finished: '已完赛', abandoned: '未完赛' }
const view = ref<'race' | 'loft'>('race')
</script>

<template>
  <main class="shell">
    <header class="masthead">
      <div class="brand"><Anchor :size="30" :stroke-width="1.8"/><div><h1>绕标</h1><span>MARK REGATTA</span></div></div>
      <div class="mast-data">
        <div class="segment view-switch" role="group" aria-label="功能切换">
          <button type="button" :aria-pressed="view === 'race'" @click="view = 'race'"><Flag :size="14"/> 竞速</button>
          <button type="button" :aria-pressed="view === 'loft'" data-testid="nav-loft" @click="view = 'loft'"><Scissors :size="14"/> 修帆</button>
        </div>
        <span class="divider"></span>
        <span data-testid="race-state">{{ view === 'loft' ? '修帆车间' : selected ? '回看中' : labels[status] }}</span>
      </div>
    </header>

    <LoftView v-if="view === 'loft'"/>

    <div v-else class="workspace">
      <div class="main-column">
        <div class="race-bar">
          <div class="timer"><span>赛时</span><output data-testid="elapsed">{{ clock(frame.time) }}</output></div>
          <div class="timer final-time"><span>含罚时</span><output data-testid="result">{{ clock(selected ? selected.duration + selected.penalty : frame.time + frame.penalty) }}</output></div>
          <div class="race-actions">
            <button v-if="!active" type="button" class="primary" @click="start"><component :is="status === 'ready' ? Play : RotateCcw" :size="15"/>{{ status === 'ready' ? '出发' : '再跑一场' }}</button>
            <template v-else>
              <button type="button" class="primary" @click="togglePause"><component :is="status === 'running' ? Pause : Play" :size="15"/>{{ status === 'running' ? '暂停' : '继续' }}</button>
              <button class="icon-button" type="button" title="结束航次" aria-label="结束航次" @click="end('abandoned')"><CircleStop :size="18"/></button>
            </template>
          </div>
        </div>
        <CourseChart :course="course" :frame="frame" :trail="trail" :replay="Boolean(selected)" :focus="focus"/>
        <LogbookPanel :voyages="voyages" :selected="selected" :events="selected?.events ?? events" :cursor="cursor" :notice="notice" :locked="active"
          @open="id => { focus = null; open(id) }" @close="selected = null; focus = null" @seek="time => { focus = null; seek(time) }" @focus="locate"/>
      </div>
      <aside class="instruments" aria-label="比赛仪表">
        <WindPanel :wind="frame.wind" :mode="selected?.windMode ?? mode" :locked="active || Boolean(selected)" @mode="wind.set"/>
        <SailPanel :boat="frame.boat" :disabled="status !== 'running' || Boolean(selected)" @steer="sail.steer" @sheet="sail.sheet"/>
        <MarksPanel :gates="course.gates" :next-gate="frame.nextGate" :penalty="frame.penalty"/>
      </aside>
    </div>
  </main>
</template>
