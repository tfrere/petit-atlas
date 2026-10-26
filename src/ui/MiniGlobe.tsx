import { useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import { geoArea, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { MultiPolygon, Position } from 'geojson'
import { isContinent, regionById } from '../data/regions'
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
/** Au-delà de ce diamètre (px), on garde un tracé plus fin. */
const LARGE_PX = 240
const FINE_SEGMENT_DEG = 0.12
const FINE_ISLAND_DEG = 0.3
const MAX_LAT = 80
const COAST_MS = 450
const RETURN_DELAY_MS = 1400
const IDLE_FRAME_MS = 30

function simplifyRing(ring: Position[], step: number): Position[] {
  const out = [ring[0]]
  for (let i = 1; i < ring.length - 1; i++) {
    const prev = out[out.length - 1]
    if (Math.abs(ring[i][0] - prev[0]) + Math.abs(ring[i][1] - prev[1]) >= step) out.push(ring[i])
  }
  out.push(ring[ring.length - 1])
  return out.length >= 4 ? out : ring
}

function isTiny(ring: Position[], min: number) {
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  return Math.max(...xs) - Math.min(...xs) < min && Math.max(...ys) - Math.min(...ys) < min
}

/** Géométrie allégée : à 100 px de diamètre, le détail du 1:50m ne se voit pas mais coûte cher à chaque image. */
function lightMulti(world: WorldData, ids: Iterable<string>, fine: boolean): MultiPolygon {
  const step = fine ? FINE_SEGMENT_DEG : MIN_SEGMENT_DEG
  const minIsland = fine ? FINE_ISLAND_DEG : MIN_ISLAND_DEG
  const coordinates: Position[][][] = []
  for (const id of ids) {
    const shape = world.byId.get(id)
    if (!shape) continue
    const g = shape.feature.geometry
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      if (isTiny(poly[0], minIsland)) continue
      const light = poly.map((ring) => simplifyRing(ring, step))
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
  const view = useRef<{
    lon: number
    lat: number
    vlon: number
    vlat: number
    dragging: boolean
    idleAt: number
  } | null>(null)

  const fine = size >= LARGE_PX
  const { inScope, outScope } = useMemo(() => {
    const all = [...world.byId.keys()]
    if (!isContinent(region)) return { inScope: lightMulti(world, all, fine), outScope: null }
    const inIds = new Set(COUNTRIES.filter((c) => c.region === region).map((c) => c.id))
    return {
      inScope: lightMulti(world, inIds, fine),
      outScope: lightMulti(
        world,
        all.filter((id) => !inIds.has(id)),
        fine,
      ),
    }
  }, [world, region, fine])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const radius = size / 2 - 3
    const c = size / 2
    const projection = geoOrthographic().translate([c, c]).scale(radius).clipAngle(90).precision(0.8)
    const path = geoPath(projection, ctx)
    const graticule = geoGraticule10()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const box = regionById(region).box
    const focus =
      region === 'world' || region === 'planetary' ? null : { lon: (box[0] + box[2]) / 2, lat: (box[1] + box[3]) / 2 }
    const home = { lon: focus ? focus.lon : 20, lat: focus ? focus.lat : TILT_DEG }
    const st = view.current ?? { lon: home.lon, lat: home.lat, vlon: 0, vlat: 0, dragging: false, idleAt: 0 }
    view.current = st
    st.dragging = false

    const draw = () => {
      projection.rotate([-st.lon, -st.lat])
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
      ctx.lineWidth = fine ? 0.7 : 0.5
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
      ctx.lineWidth = fine ? 0.6 : 0.4
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
      ctx.lineWidth = fine ? 1.6 : 1.1
      ctx.stroke()
    }

    let raf = 0
    let timer = 0
    let last = performance.now()
    let drawn = 0

    const coasting = () => Math.abs(st.vlon) > 0.003 || Math.abs(st.vlat) > 0.003
    const settled = () =>
      !st.dragging &&
      !coasting() &&
      !!focus &&
      Math.abs(angleDelta(st.lon, focus.lon)) < 0.05 &&
      Math.abs(focus.lat - st.lat) < 0.05

    const frame = (now: number) => {
      raf = 0
      const interacting = st.dragging || coasting()
      if (!interacting && now - drawn < IDLE_FRAME_MS) {
        raf = requestAnimationFrame(frame)
        return
      }
      const dt = Math.min(64, now - last)
      last = now
      drawn = now

      if (st.dragging) {
        st.idleAt = now
      } else if (coasting()) {
        const decay = Math.exp(-dt / COAST_MS)
        st.vlon *= decay
        st.vlat *= decay
        st.lon += st.vlon * dt
        st.lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, st.lat + st.vlat * dt))
        if (!coasting()) {
          st.vlon = 0
          st.vlat = 0
        }
        st.idleAt = now
      } else if (now - st.idleAt < RETURN_DELAY_MS) {
        timer = window.setTimeout(kick, st.idleAt + RETURN_DELAY_MS - now)
        return
      } else if (focus) {
        const k = 1 - Math.exp(-dt / 260)
        st.lon += angleDelta(st.lon, focus.lon) * k
        st.lat += (focus.lat - st.lat) * k
      } else {
        st.lon += (SPIN_DEG_PER_S * dt) / 1000
        st.lat += (TILT_DEG - st.lat) * (1 - Math.exp(-dt / 400))
      }
      draw()
      if (!settled()) raf = requestAnimationFrame(frame)
    }

    function kick() {
      window.clearTimeout(timer)
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }

    const degPerPx = 180 / Math.PI / radius
    let pointer: { id: number; x: number; y: number; t: number } | null = null
    const onDown = (e: PointerEvent) => {
      if (pointer) return
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }
      st.dragging = true
      st.vlon = 0
      st.vlat = 0
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* le geste reste suivi tant que le pointeur est sur le globe */
      }
      canvas.style.cursor = 'grabbing'
      kick()
    }
    const onMove = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return
      const dt = Math.max(1, e.timeStamp - pointer.t)
      const dlon = -(e.clientX - pointer.x) * degPerPx
      const dlat = (e.clientY - pointer.y) * degPerPx
      st.lon += dlon
      st.lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, st.lat + dlat))
      st.vlon = st.vlon * 0.6 + (dlon / dt) * 0.4
      st.vlat = st.vlat * 0.6 + (dlat / dt) * 0.4
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.t = e.timeStamp
      if (reduce) draw()
    }
    const onUp = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return
      if (e.timeStamp - pointer.t > 80 || reduce) {
        st.vlon = 0
        st.vlat = 0
      }
      pointer = null
      st.dragging = false
      st.idleAt = performance.now()
      canvas.style.cursor = 'grab'
      if (!reduce) kick()
    }

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    draw()
    if (!reduce) {
      st.idleAt = performance.now() - RETURN_DELAY_MS
      kick()
    }
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [inScope, outScope, region, size, fine])

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
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        filter: 'drop-shadow(0 10px 10px rgba(58,46,32,.25)) drop-shadow(0 2px 3px rgba(58,46,32,.18))',
      }}
    />
  )
}
