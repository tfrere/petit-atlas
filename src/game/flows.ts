import { distanceToFlow } from '../data/flowGeometry'
import type { FlowHit, LonLat } from '../data/flowGeometry'

/** Au-delà, un toucher est trop loin de n'importe quel tracé pour compter. */
export const FLOW_TOLERANCE_KM = 600

export interface FlowVerdict {
  correct: boolean
  /** Distance au tracé cherché. */
  km: number
  /** Point du tracé cherché le plus proche du toucher. */
  at: LonLat
  /** Tracé le plus proche du toucher, parmi ceux du jeu, s'il est plus près que la cible. */
  otherId: string | null
}

/**
 * Le toucher est juste si le tracé cherché est le plus proche de tous les tracés du jeu
 * et à moins de `FLOW_TOLERANCE_KM` : comme pour un pays, on désigne « celui-là » et pas un autre.
 */
export function judgeFlowTap(at: LonLat, targetId: string, poolIds: string[]): FlowVerdict | null {
  const target = distanceToFlow(at, targetId)
  if (!target) return null
  let other: FlowHit | null = null
  for (const id of poolIds) {
    if (id === targetId) continue
    const hit = distanceToFlow(at, id)
    if (hit && (!other || hit.km < other.km)) other = hit
  }
  const beaten = !!other && other.km < target.km
  return {
    correct: !beaten && target.km <= FLOW_TOLERANCE_KM,
    km: target.km,
    at: target.at,
    otherId: beaten && other && other.km <= FLOW_TOLERANCE_KM ? other.id : null,
  }
}
