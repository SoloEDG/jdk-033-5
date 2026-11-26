export interface Pt { x: number; y: number }

export interface PanelDef {
  id: string
  name: string
  plan: Pt[]
  rotate: number
  shift: Pt
  warp: number
  tint: string
}

export interface SeamDef {
  id: string
  name: string
  from: Pt
  to: Pt
  panels: [string, string]
  segments: number
}

export type EdgeKind = 'luff' | 'leech' | 'foot'

export interface EdgeDef {
  id: string
  name: string
  kind: EdgeKind
  from: Pt
  to: Pt
  narrow: boolean
  pinned: boolean
}

export interface Material {
  warpAllow: number
  weftAllow: number
  seamAllow: number
  edgeAllow: number
  footAllow: number
  stripAllowBonus: number
  warpEA: number
  weftEA: number
  seamEA: number
  edgeEA: number
  stripEABonus: number
  sheetEA: number
}

export interface GustCase {
  id: string
  name: string
  windKnots: number
  pressure: number
}

export interface Loft {
  stock: { width: number; height: number; gap: Pt[] }
  panels: PanelDef[]
  seams: SeamDef[]
  edges: EdgeDef[]
  clew: Pt
  loadAngle: number
  seamEndFactor: number
  material: Material
  gusts: [GustCase, GustCase]
  stripBudget: number
  segmentCount: number
}

export const H = { x: 70, y: 30 }
export const T = { x: 40, y: 340 }
export const C = { x: 400, y: 300 }
const U1 = { x: 55, y: 150 }
const L1 = { x: 217, y: 150 }
const U2 = { x: 47, y: 250 }
const L2 = { x: 339, y: 250 }

export const loft: Loft = {
  stock: {
    width: 560, height: 480,
    gap: [{ x: 300, y: 60 }, { x: 430, y: 50 }, { x: 450, y: 180 }, { x: 340, y: 200 }, { x: 305, y: 140 }],
  },
  panels: [
    { id: 'A', name: '顶片', plan: [H, L1, U1], rotate: 0, shift: { x: 0, y: 0 }, warp: 90, tint: '#e9d9a8' },
    { id: 'B', name: '中片', plan: [U1, L1, L2, U2], rotate: 0, shift: { x: 0, y: 216 }, warp: 90, tint: '#ddc98f' },
    { id: 'C', name: '底片', plan: [U2, L2, C, T], rotate: 0, shift: { x: 156, y: 24 }, warp: 80, tint: '#cdb87e' },
  ],
  seams: [
    { id: 'S1', name: '拼缝 S1（顶片/中片）', from: U1, to: L1, panels: ['A', 'B'], segments: 3 },
    { id: 'S2', name: '拼缝 S2（中片/底片）', from: U2, to: L2, panels: ['B', 'C'], segments: 3 },
  ],
  edges: [
    { id: 'E-luff-1', name: '前缘 H–U1', kind: 'luff', from: H, to: U1, narrow: false, pinned: true },
    { id: 'E-luff-2', name: '前缘 U1–U2', kind: 'luff', from: U1, to: U2, narrow: false, pinned: true },
    { id: 'E-luff-3', name: '前缘 U2–T', kind: 'luff', from: U2, to: T, narrow: false, pinned: true },
    { id: 'E-leech-1', name: '帆弧窄边 H–L1', kind: 'leech', from: H, to: L1, narrow: true, pinned: false },
    { id: 'E-leech-2', name: '帆弧窄边 L1–L2', kind: 'leech', from: L1, to: L2, narrow: true, pinned: false },
    { id: 'E-leech-3', name: '帆弧窄边 L2–C', kind: 'leech', from: L2, to: C, narrow: true, pinned: false },
    { id: 'E-foot', name: '底边 T–C', kind: 'foot', from: T, to: C, narrow: true, pinned: false },
  ],
  clew: C,
  loadAngle: 72,
  seamEndFactor: 1.8,
  material: {
    warpAllow: 340, weftAllow: 260,
    seamAllow: 75, edgeAllow: 62, footAllow: 150,
    stripAllowBonus: 130,
    warpEA: 26000, weftEA: 17000, seamEA: 15000, edgeEA: 9000, stripEABonus: 9000, sheetEA: 22000,
  },
  gusts: [
    { id: 'g1', name: '阵风一档', windKnots: 16, pressure: 27 },
    { id: 'g2', name: '阵风二档', windKnots: 24, pressure: 27 * (24 / 16) ** 2 },
  ],
  stripBudget: 6,
  segmentCount: 6,
}

export type Allocation = Record<string, number>

export function segmentIds(def: Loft): string[] {
  return def.seams.flatMap(seam => Array.from({ length: seam.segments }, (_, i) => `${seam.id}-${i}`))
}

export function segmentLabel(id: string): string {
  const [seam, raw] = id.split('-')
  const index = Number(raw)
  const role = index === 0 || index === 2 ? '缝尾' : '中段'
  return `${seam} 段${index + 1} · ${role}`
}

export function tailStackAllocation(def: Loft): Allocation {
  const allocation: Allocation = {}
  for (const id of segmentIds(def)) allocation[id] = id.endsWith('-0') || id.endsWith('-2') ? (id.startsWith('S1') ? 2 : 1) : 0
  return allocation
}

export function evenAllocation(def: Loft): Allocation {
  const allocation: Allocation = {}
  const per = Math.floor(def.stripBudget / def.segmentCount)
  for (const id of segmentIds(def)) allocation[id] = per
  return allocation
}

export function emptyAllocation(def: Loft): Allocation {
  const allocation: Allocation = {}
  for (const id of segmentIds(def)) allocation[id] = 0
  return allocation
}

export function transformPoint(point: Pt, rotate: number, shift: Pt): Pt {
  const rad = rotate * Math.PI / 180
  return {
    x: point.x * Math.cos(rad) - point.y * Math.sin(rad) + shift.x,
    y: point.x * Math.sin(rad) + point.y * Math.cos(rad) + shift.y,
  }
}

export function sourcePolygon(panel: PanelDef): Pt[] {
  return panel.plan.map(point => transformPoint(point, panel.rotate, panel.shift))
}

export function polygonArea(points: Pt[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function pointInPolygon(point: Pt, polygon: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
