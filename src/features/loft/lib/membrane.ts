import type { Allocation, GustCase, Loft, Pt } from '../model/loft'

export const SCALE = 0.01

export interface NetNode { id: number; x: number; y: number; fixed: boolean }
export type MemberKind = 'seam' | 'edge' | 'cloth' | 'sheet'

export interface NetMember {
  id: string
  label: string
  kind: MemberKind
  a: number
  b: number
  length0: number
  k: number
  allow: number
  warp: number
  panelId?: string
  segmentId?: string
  narrow?: boolean
}

export interface MemberResult extends NetMember {
  tension: number
  utilization: number
  overloaded: boolean
  ax: number
  ay: number
  bx: number
  by: number
}

export interface PanelStat {
  panelId: string
  warpStrain: number
  weftStrain: number
  maxUtil: number
  overloaded: boolean
}

export interface CaseResult {
  gust: GustCase
  members: MemberResult[]
  panelStats: PanelStat[]
  nodes: { x: number; y: number }[]
  maxShift: number
  overloaded: MemberResult[]
  worst: MemberResult
}

const key = (p: Pt) => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) * SCALE
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const centroid = (points: Pt[]): Pt => ({
  x: points.reduce((s, p) => s + p.x, 0) / points.length,
  y: points.reduce((s, p) => s + p.y, 0) / points.length,
})
const polygonArea = (points: Pt[]): number => {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2 * SCALE * SCALE
}

interface Network {
  nodes: NetNode[]
  members: NetMember[]
}

function buildNetwork(def: Loft, allocation: Allocation): Network {
  const nodeMap = new Map<string, number>()
  const nodes: NetNode[] = []
  const fixedKeys = new Set(def.edges.filter(e => e.pinned).flatMap(e => [key(e.from), key(e.to)]))
  const addNode = (p: Pt): number => {
    const k = key(p)
    const existing = nodeMap.get(k)
    if (existing !== undefined) return existing
    const id = nodes.length
    nodes.push({ id, x: p.x * SCALE, y: p.y * SCALE, fixed: fixedKeys.has(k) })
    nodeMap.set(k, id)
    return id
  }
  const members: NetMember[] = []
  const m = def.material
  const addMember = (member: Omit<NetMember, 'length0' | 'k'>, ea: number) => {
    const a = nodes[member.a], b = nodes[member.b]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    members.push({ ...member, length0: length, k: ea / length })
  }

  for (const seam of def.seams) {
    const chain = Array.from({ length: seam.segments + 1 }, (_, i) => addNode(lerp(seam.from, seam.to, i / seam.segments)))
    for (let i = 0; i < seam.segments; i++) {
      const segmentId = `${seam.id}-${i}`
      const strips = allocation[segmentId] ?? 0
      addMember({
        id: segmentId, label: `${seam.name} 段${i + 1}`, kind: 'seam',
        a: chain[i], b: chain[i + 1], segmentId,
        allow: m.seamAllow + m.stripAllowBonus * strips, warp: 0,
      }, m.seamEA + m.stripEABonus * strips)
    }
  }

  for (const edge of def.edges) {
    addMember({
      id: edge.id, label: edge.name, kind: 'edge',
      a: addNode(edge.from), b: addNode(edge.to), narrow: edge.narrow,
      allow: edge.kind === 'foot' ? m.footAllow : edge.narrow ? m.edgeAllow : m.edgeAllow * 1.7,
      warp: 0,
    }, edge.narrow ? m.edgeEA : m.edgeEA * 1.7)
  }

  for (const panel of def.panels) {
    const boundary = panel.plan.map(addNode)
    const center = addNode(centroid(panel.plan))
    const warpRad = panel.warp * Math.PI / 180
    const clothAllow = (dx: number, dy: number, length: number) => {
      const cw = Math.abs((dx * Math.cos(warpRad) + dy * Math.sin(warpRad)) / length)
      const sw = Math.abs((-dx * Math.sin(warpRad) + dy * Math.cos(warpRad)) / length)
      return 1 / (cw / m.warpAllow + sw / m.weftAllow)
    }
    const clothEA = (dx: number, dy: number, length: number) => {
      const c = Math.abs((dx * Math.cos(warpRad) + dy * Math.sin(warpRad)) / length)
      return m.weftEA + (m.warpEA - m.weftEA) * c * c
    }
    for (const nodeId of boundary) {
      const node = nodes[nodeId]
      const dx = node.x - nodes[center].x, dy = node.y - nodes[center].y
      const length = Math.hypot(dx, dy)
      addMember({
        id: `${panel.id}-spoke-${nodeId}`, label: `${panel.name} 布面`, kind: 'cloth',
        a: center, b: nodeId, panelId: panel.id,
        allow: clothAllow(dx, dy, length), warp: panel.warp,
      }, clothEA(dx, dy, length))
    }
    if (boundary.length === 4) {
      for (const [i, j] of [[0, 2], [1, 3]] as const) {
        const a = nodes[boundary[i]], b = nodes[boundary[j]]
        const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
        addMember({
          id: `${panel.id}-brace-${i}${j}`, label: `${panel.name} 布面`, kind: 'cloth',
          a: boundary[i], b: boundary[j], panelId: panel.id,
          allow: clothAllow(dx, dy, length), warp: panel.warp,
        }, clothEA(dx, dy, length))
      }
    }
  }

  const anchor = addNode({ x: def.clew.x + 78, y: def.clew.y + 24 })
  nodes[anchor].fixed = true
  addMember({
    id: 'sheet', label: '缭绳约束（不计入限值）', kind: 'sheet',
    a: addNode(def.clew), b: anchor, allow: Infinity, warp: 0,
  }, m.sheetEA)
  return { nodes, members }
}

function solve(def: Loft, allocation: Allocation, gust: GustCase): CaseResult {
  const network = buildNetwork(def, allocation)
  const n = network.nodes.length
  const x = network.nodes.map(node => node.x)
  const y = network.nodes.map(node => node.y)
  const fx = new Array(n).fill(0)
  const fy = new Array(n).fill(0)

  const rad = def.loadAngle * Math.PI / 180
  const push = { x: Math.sin(rad), y: Math.cos(rad) }
  const planKey = new Map(network.nodes.map(node => [key({ x: node.x / SCALE, y: node.y / SCALE }), node.id]))
  for (const panel of def.panels) {
    const area = polygonArea(panel.plan)
    const share = gust.pressure * area / panel.plan.length
    for (const point of panel.plan) {
      const id = planKey.get(key(point))
      if (id === undefined || network.nodes[id].fixed) continue
      fx[id] += push.x * share
      fy[id] += push.y * share
    }
  }
  // 缝端应力集中：缝与帆边交汇处承受放大的集中拉力
  for (const seam of def.seams) {
    const seamLength = dist(seam.from, seam.to)
    const concentrated = gust.pressure * seamLength * def.seamEndFactor
    for (const end of [seam.from, seam.to]) {
      const id = planKey.get(key(end))
      if (id === undefined || network.nodes[id].fixed) continue
      fx[id] += push.x * concentrated
      fy[id] += push.y * concentrated
    }
  }

  const freeNodes = network.nodes.filter(node => !node.fixed).map(node => node.id)
  const fCount = freeNodes.length * 2
  const dofOf = new Map<number, number>()
  freeNodes.forEach((nodeId, i) => { dofOf.set(nodeId, 2 * i) })
  const fLoad = new Array(fCount).fill(0)
  freeNodes.forEach((nodeId, i) => { fLoad[2 * i] = fx[nodeId]; fLoad[2 * i + 1] = fy[nodeId] })
  const anchorK = 0.05 * Math.max(...network.members.map(member => member.k))

  const solveElastic = (active: boolean[]): number[] => {
    const K = Array.from({ length: fCount }, () => new Array(fCount).fill(0))
    const add = (r: number, c: number, v: number) => { if (r >= 0 && c >= 0) K[r][c] += v }
    network.members.forEach((member, mi) => {
      if (!active[mi]) return
      const dx = x[member.b] - x[member.a], dy = y[member.b] - y[member.a]
      const length = Math.hypot(dx, dy)
      if (length < 1e-9) return
      const c = dx / length, s = dy / length
      const kxx = member.k * c * c, kyy = member.k * s * s, kxy = member.k * c * s
      const ra = dofOf.get(member.a), rb = dofOf.get(member.b)
      const blocks: [number, number, number][] = [[0, 0, kxx], [0, 1, kxy], [1, 0, kxy], [1, 1, kyy]]
      for (const [i, j, v] of blocks) {
        if (ra !== undefined) add(ra + i, ra + j, v)
        if (rb !== undefined) add(rb + i, rb + j, v)
        if (ra !== undefined && rb !== undefined) { add(ra + i, rb + j, -v); add(rb + j, ra + i, -v) }
      }
    })
    for (let r = 0; r < fCount; r++) K[r][r] += anchorK
    const diag = K.map((row, r) => row[r] || 1)
    const apply = (v: number[]) => K.map(row => row.reduce((sum, value, c) => sum + value * v[c], 0))
    const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0)

    let rVec = [...fLoad]
    const r0Norm = Math.hypot(...rVec) || 1
    let zVec = rVec.map((v, i) => v / diag[i])
    let pVec = [...zVec]
    let rz = dot(rVec, zVec)
    const u = new Array(fCount).fill(0)
    for (let iter = 0; iter < 2000; iter++) {
      const kp = apply(pVec)
      const denom = dot(pVec, kp)
      if (!Number.isFinite(denom) || Math.abs(denom) < 1e-24) break
      const alpha = rz / denom
      for (let i = 0; i < fCount; i++) u[i] += alpha * pVec[i]
      rVec = rVec.map((v, i) => v - alpha * kp[i])
      const res = Math.hypot(...rVec)
      if (!Number.isFinite(res) || res < r0Norm * 1e-10) break
      zVec = rVec.map((v, i) => v / diag[i])
      const rzNext = dot(rVec, zVec)
      if (rz === 0) break
      const beta = rzNext / rz
      pVec = zVec.map((v, i) => v + beta * pVec[i])
      rz = rzNext
    }
    return u
  }

  // 线性弹性求解：小幅面内变形，所有构件参与；拉力为负（微压）时按零拉力计入强度
  const uFree = solveElastic(network.members.map(() => true))
  const u = new Array(2 * n).fill(0)
  freeNodes.forEach((nodeId, i) => { u[2 * nodeId] = uFree[2 * i]; u[2 * nodeId + 1] = uFree[2 * i + 1] })
  for (let i = 0; i < n; i++) { x[i] += u[2 * i]; y[i] += u[2 * i + 1] }

  const members: MemberResult[] = network.members.map(member => {
    const dx = x[member.b] - x[member.a], dy = y[member.b] - y[member.a]
    const length = Math.hypot(dx, dy) || 1e-9
    const strain = (length - member.length0) / member.length0
    const tension = Math.max(0, member.k * strain)
    const utilization = tension / member.allow
    return {
      ...member, tension, utilization,
      overloaded: member.kind !== 'sheet' && utilization > 1,
      ax: x[member.a] / SCALE, ay: y[member.a] / SCALE, bx: x[member.b] / SCALE, by: y[member.b] / SCALE,
    }
  })

  const panelStats: PanelStat[] = def.panels.map(panel => {
    const cloth = members.filter(member => member.panelId === panel.id)
    const warpRad = panel.warp * Math.PI / 180
    const strains = cloth.map(member => {
      const dx = (member.bx - member.ax) * SCALE, dy = (member.by - member.ay) * SCALE
      const length = Math.hypot(dx, dy) || 1e-9
      const along = (dx * Math.cos(warpRad) + dy * Math.sin(warpRad)) / length
      return { strain: (length - member.length0) / member.length0, warp: Math.abs(along) }
    })
    const warpSamples = strains.filter(s => s.warp > 0.6)
    const weftSamples = strains.filter(s => s.warp < 0.4)
    const avg = (items: { strain: number }[]) => items.length ? items.reduce((s, item) => s + item.strain, 0) / items.length : 0
    const maxUtil = Math.max(...cloth.map(member => member.utilization))
    return {
      panelId: panel.id,
      warpStrain: avg(warpSamples), weftStrain: avg(weftSamples),
      maxUtil, overloaded: maxUtil > 1,
    }
  })

  let maxShift = 0
  for (const node of network.nodes) {
    if (!node.fixed) maxShift = Math.max(maxShift, Math.hypot(x[node.id] - node.x, y[node.id] - node.y))
  }
  const checked = members.filter(member => member.kind !== 'sheet')
  const worst = checked.reduce((a, b) => b.utilization > a.utilization ? b : a)
  return {
    gust, members, panelStats,
    nodes: x.map((px, i) => ({ x: px / SCALE, y: y[i] / SCALE })),
    maxShift: maxShift / SCALE,
    overloaded: checked.filter(member => member.overloaded),
    worst,
  }
}

export function analyzeSail(def: Loft, allocation: Allocation): CaseResult[] {
  return def.gusts.map(gust => solve(def, allocation, gust))
}

export function stripsUsed(def: Loft, allocation: Allocation): number {
  return Object.values(allocation).reduce((sum, value) => sum + value, 0)
}
