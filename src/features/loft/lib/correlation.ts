import { clamp, normalize } from '../../../shared/math'
import type { Boat, Wind } from '../../../shared/race'
import { advanceBoat } from '../../sail/lib/dynamics'
import type { Loft } from '../model/loft'
import type { CaseResult } from './membrane'

export interface TackRow {
  gustId: string
  gustName: string
  windKnots: number
  boatKnots: number
  worstLabel: string
  worstKind: string
  utilization: number
  overloaded: boolean
  maxShift: number
  warpStrain: number
  weftStrain: number
}

const kindLabel: Record<string, string> = {
  seam: '拼缝缝段', edge: '帆边', cloth: '布面', sheet: '缭绳',
}

export function simulateTack(windKnots: number, sheet = 52): number {
  const wind: Wind = { bearing: 265, knots: windKnots }
  let boat: Boat = { position: { x: 0, y: 0 }, heading: normalize(wind.bearing + 45), knots: 0, sheet, rudder: 0 }
  const dt = 0.05
  for (let t = 0; t < 45; t += dt) boat = advanceBoat(boat, wind, dt)
  return clamp(boat.knots, 0, 99)
}

export function correlateTacks(def: Loft, results: CaseResult[]): TackRow[] {
  return results.map(result => {
    const worstPanel = result.panelStats.reduce((a, b) => b.maxUtil > a.maxUtil ? b : a)
    return {
      gustId: result.gust.id,
      gustName: result.gust.name,
      windKnots: result.gust.windKnots,
      boatKnots: simulateTack(result.gust.windKnots),
      worstLabel: result.worst.label,
      worstKind: kindLabel[result.worst.kind] ?? result.worst.kind,
      utilization: result.worst.utilization,
      overloaded: result.overloaded.length > 0,
      maxShift: result.maxShift,
      warpStrain: worstPanel.warpStrain,
      weftStrain: worstPanel.weftStrain,
    }
  })
}
