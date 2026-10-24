import { useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import { geoArea, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { MultiPolygon, Position } from 'geojson'
import { REGIONS } from '../data/regions'
import type { RegionId } from '../data/types'
import { COUNTRIES } from '../data/world'
import type { WorldData } from '../data/world'
import { tokens } from '../theme'

interface Props {
  world: WorldData
  region: RegionId
  size?: number
}

const SPIN_DEG_PER_S = 11
const TILT_DEG = 16
const MIN_SEGMENT_DEG = 0.6
const MIN_ISLAND_DEG = 0.9

function simplifyRing(ring: Position[]): Position[] {
  const out = [ring[0]]
  for (let i = 1; i < ring.length - 1; i++) {
    const prev = out[out.length - 1]
    if (Math.abs(ring[i][0] - prev[0]) + Math.abs(ring[i][1] - prev[1]) >= MIN_SEGMENT_DEG) out.push(ring[i])
  }
  out.push(ring[ring.length - 1])
  return out.length >= 4 ? out : ring
}

function isTiny(ring: Position[]) {
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  return Math.max(...xs) - Math.min(...xs) < MIN_ISLAND_DEG && Math.max(...ys) - Math.min(...ys) < MIN_ISLAND_DEG
}

/** Géométrie allégée : à 100 px de diamètre, le détail du 1:50m ne se voit pas mais coûte cher à chaque image. */
function lightMulti(world: WorldData, ids: Iterable<string>): MultiPolygon {
  const coordinates: Position[][][] = []
  for (const id of ids) {
    const shape = world.byId.get(id)
    if (!shape) continue
    const g = shape.feature.geometry
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      if (isTiny(poly[0])) continue
      const light = poly.map(simplifyRing)
      const flipped =
        geoArea({ type: 'Polygon', coordinates: light }) > 2 !== geoArea({ type: 'Polygon', coordinates: poly }) > 2
      coordinates.push(flipped ? poly : light)
    }
  }
  return { type: 'MultiPolygon', coordinates }
}

const angleDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

/** Petit globe qui tourne ; quand une zone est choisie, il s'oriente vers elle et estompe le reste. */
export default function MiniGlobe({ world, region, size = 112 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { inScope, outScope } = useMemo(() => {
    const all = [...world.byId.keys()]
    if (region === 'world') return { inScope: lightMulti(world, all), outScope: null }
    const inIds = new Set(COUNTRIES.filter((c) => c.region === region).map((c) => c.id))
    return {
      inScope: lightMulti(world, inIds),
      outScope: lightMulti(
        world,
        all.filter((id) => !inIds.has(id)),
      ),
    }
  }, [world, region])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const radius = size / 2 - 3
    const c = size / 2
    const projection = geoOrthographic().translate([c, c]).scale(radius).clipAngle(90).precision(0.8)
    const path = geoPath(projection, ctx)
    const graticule = geoGraticule10()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const box = REGIONS.find((r) => r.id === region)?.box
    const focus = region === 'world' || !box ? null : { lon: (box[0] + box[2]) / 2, lat: (box[1] + box[3]) / 2 }
    let lon = focus ? focus.lon : 20
    let lat = focus ? focus.lat : TILT_DEG
    const initial = { lon, lat }

    const draw = () => {
      projection.rotate([-lon, -lat])
      ctx.clearRect(0, 0, size, size)

      const ocean = ctx.createRadialGradient(c - radius * 0.3, c - radius * 0.38, radius * 0.1, c, c, radius)
      ocean.addColorStop(0, '#c4dacf')
      ocean.addColorStop(1, '#93b2a4')
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.fillStyle = ocean
      ctx.fill()

      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = 'rgba(46,36,24,.2)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      if (outScope) {
        ctx.beginPath()
        path(outScope)
        ctx.fillStyle = tokens.dim
        ctx.globalAlpha = 0.85
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.beginPath()
      path(inScope)
      ctx.fillStyle = tokens.land
      ctx.fill()
      ctx.strokeStyle = 'rgba(86,68,46,.7)'
      ctx.lineWidth = 0.4
      ctx.stroke()

      const limb = ctx.createRadialGradient(c - radius * 0.25, c - radius * 0.3, radius * 0.55, c, c, radius)
      limb.addColorStop(0, 'rgba(255,255,255,.16)')
      limb.addColorStop(0.55, 'rgba(255,255,255,0)')
      limb.addColorStop(1, 'rgba(58,46,32,.24)')
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.fillStyle = limb
      ctx.fill()

      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.strokeStyle = tokens.ink
      ctx.lineWidth = 1.1
      ctx.stroke()
    }

    if (reduce) {
      lon = initial.lon
      lat = initial.lat
      draw()
      return
    }

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (focus) {
        const k = 1 - Math.exp(-dt / 260)
        lon += angleDelta(lon, focus.lon) * k
        lat += (focus.lat - lat) * k
      } else {
        lon += (SPIN_DEG_PER_S * dt) / 1000
        lat += (TILT_DEG - lat) * (1 - Math.exp(-dt / 260))
      }
      draw()
      const settled = focus && Math.abs(angleDelta(lon, focus.lon)) < 0.05 && Math.abs(focus.lat - lat) < 0.05
      if (!settled) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [inScope, outScope, region, size])

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      aria-hidden
      sx={{
        width: size,
        height: size,
        display: 'block',
        flex: 'none',
        filter: 'drop-shadow(0 10px 10px rgba(58,46,32,.25)) drop-shadow(0 2px 3px rgba(58,46,32,.18))',
      }}
    />
  )
}
