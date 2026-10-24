import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Box from '@mui/material/Box'
import { geoArea, geoGraticule, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import { easeCubicInOut } from 'd3-ease'
import { geoMiller } from 'd3-geo-projection'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, zoomTransform } from 'd3-zoom'
import type { ZoomBehavior, ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { regionById } from '../data/regions'
import type { RegionId } from '../data/types'
import { COUNTRIES } from '../data/world'
import type { WorldData } from '../data/world'
import { fontBody, tokens } from '../theme'

export type HighlightKind = 'target' | 'selected' | 'correct' | 'wrong'

export interface MapMarker {
  lon: number
  lat: number
  kind: 'star' | 'guess'
}

export interface MapLabel {
  lon: number
  lat: number
  text: string
  dy?: number
}

export interface MapView {
  key: string | number
  ids?: string[]
  points?: [number, number][]
  /** Largeur minimale de la vue, en fraction de la largeur du monde. */
  minSpan?: number
  pad?: number
  animate?: boolean
}

export interface TapInfo {
  id: string | null
  lon: number | null
  lat: number | null
  /** Le tap est tombé à moins de ~30 px d'un repère « guess » (sélection en cours). */
  nearSelected: boolean
}

interface Props {
  world: WorldData
  region: RegionId
  highlights?: Record<string, HighlightKind>
  markers?: MapMarker[]
  labels?: MapLabel[]
  line?: [[number, number], [number, number]] | null
  view?: MapView
  interactive?: boolean
  /** Affiche des pastilles tactiles autour des micro-États pour les rendre faciles à toucher. */
  tapRings?: boolean
  /** Vue figée sur le globe entier : la région choisie est seulement mise en valeur (les autres pays s'estompent). */
  still?: boolean
  /** Léger reflet de lumière sur le globe, façon objet posé. */
  sheen?: boolean
  /** Ombre intérieure façon papier ancien (activée par défaut). */
  vignette?: boolean
  onTap?: (tap: TapInfo) => void
}

const MAX_ZOOM = 120
const WORLD_CENTER_LON = 15
const MAP_LAT_MAX = 84
const MAP_LAT_MIN = -58
const PAN_GAIN_TOUCH = 1.8
const PAN_GAIN_MOUSE = 1.4
const PAN_SLOP_PX = 8
const SELECT_RADIUS_PX = 30
const RING_AREA_KM2 = 3000

const KIND_FILL: Record<HighlightKind, string> = {
  target: tokens.target,
  selected: tokens.selected,
  correct: tokens.sage,
  wrong: tokens.wrong,
}

const STAR_PATH = 'M0,-9 L2.6,-3.2 L8.6,-2.8 L4,1.4 L5.3,7.3 L0,4.3 L-5.3,7.3 L-4,1.4 L-8.6,-2.8 L-2.6,-3.2 Z'

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = Math.round(el.clientWidth)
      const h = Math.round(el.clientHeight)
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

type Bounds = [[number, number], [number, number]]

function unionBounds(list: Bounds[]): Bounds {
  return [
    [Math.min(...list.map((b) => b[0][0])), Math.min(...list.map((b) => b[0][1]))],
    [Math.max(...list.map((b) => b[1][0])), Math.max(...list.map((b) => b[1][1]))],
  ]
}

function focusBounds(
  feature: Feature<Polygon | MultiPolygon>,
  path: ReturnType<typeof geoPath>,
  sphereWidth: number,
): Bounds | null {
  const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  const parts = polys
    .map((coordinates) => {
      const f: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }
      return { area: geoArea(f), bounds: path.bounds(f) as Bounds }
    })
    .filter((p) => Number.isFinite(p.bounds[0][0]))
  if (!parts.length) return null
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a))
  const cx = (main.bounds[0][0] + main.bounds[1][0]) / 2
  const near = parts.filter((p) => Math.abs((p.bounds[0][0] + p.bounds[1][0]) / 2 - cx) < sphereWidth * 0.3)
  return unionBounds(near.map((p) => p.bounds))
}

function regionBounds(box: [number, number, number, number], projection: GeoProjection): Bounds {
  const [x0, y0, x1, y1] = box
  const pts: [number, number][] = []
  for (let i = 0; i <= 8; i++) {
    const lon = x0 + ((x1 - x0) * i) / 8
    const lat = y0 + ((y1 - y0) * i) / 8
    pts.push([lon, y0], [lon, y1], [x0, lat], [x1, lat])
  }
  const xy = pts.map((p) => projection(p)).filter((p): p is [number, number] => !!p)
  return [
    [Math.min(...xy.map((p) => p[0])), Math.min(...xy.map((p) => p[1]))],
    [Math.max(...xy.map((p) => p[0])), Math.max(...xy.map((p) => p[1]))],
  ]
}

function CompassRose() {
  return (
    <Box
      component="svg"
      viewBox="-50 -50 100 100"
      aria-hidden
      sx={{
        position: 'absolute',
        left: 8,
        bottom: 8,
        width: 64,
        height: 64,
        opacity: 0.5,
        pointerEvents: 'none',
        color: tokens.ink,
      }}
    >
      <circle r="34" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle r="28" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <path d="M0,-44 L7,-7 L0,0 Z M0,44 L-7,7 L0,0 Z M44,0 L7,7 L0,0 Z M-44,0 L-7,-7 L0,0 Z" fill="currentColor" />
      <path
        d="M0,-44 L-7,-7 L0,0 Z M0,44 L7,7 L0,0 Z M44,0 L7,-7 L0,0 Z M-44,0 L-7,7 L0,0 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      <path d="M0,0 L22,-22 M0,0 L-22,-22 M0,0 L22,22 M0,0 L-22,22" stroke="currentColor" strokeWidth="0.6" />
      <text y="-47.5" textAnchor="middle" fontSize="12" fontFamily={fontBody} fontWeight="600" fill="currentColor">
        N
      </text>
    </Box>
  )
}

const LOD_STEP = 0.6
const LOD_MAX_K = 2.5
const SCOPE_FADE_MS = 420
const MAX_DPR = 2
const CACHE_MARGIN_X = 0.6
const CACHE_MARGIN_Y = 0.4
const SETTLE_MS = 160

const LAND_RGB = [0xf1, 0xe6, 0xc6]
const DIM_RGB = [0xdc, 0xd6, 0xc4]
const mixColor = (m: number) => `rgb(${LAND_RGB.map((c, i) => Math.round(c + (DIM_RGB[i] - c) * m)).join(',')})`
const LAND_COLOR = mixColor(0)
const DIM_COLOR = mixColor(1)

/** Enregistre un tracé dans un Path2D en écartant les points trop proches (niveau de détail réduit). */
class PathRecorder {
  path = new Path2D()
  private lx = 0
  private ly = 0
  private step: number
  constructor(step: number) {
    this.step = step
  }
  beginPath() {}
  moveTo(x: number, y: number) {
    this.path.moveTo(x, y)
    this.lx = x
    this.ly = y
  }
  lineTo(x: number, y: number) {
    if (this.step === 0 || Math.abs(x - this.lx) + Math.abs(y - this.ly) >= this.step) {
      this.path.lineTo(x, y)
      this.lx = x
      this.ly = y
    }
  }
  closePath() {
    this.path.closePath()
  }
  arc() {}
}

function record(projection: GeoProjection, feature: Feature<Polygon | MultiPolygon>, step: number) {
  const rec = new PathRecorder(step)
  geoPath(projection, rec as unknown as CanvasRenderingContext2D)(feature)
  return rec.path
}

interface CanvasShape {
  id: string
  bounds: Bounds
  low: Path2D
  full: Path2D
}

export default function WorldMap({
  world,
  region,
  highlights = {},
  markers = [],
  labels = [],
  line = null,
  view,
  interactive = true,
  tapRings = false,
  vignette = true,
  still = false,
  sheen = false,
  onTap,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const firstView = useRef(true)
  const { w, h } = useElementSize(wrapRef)

  const geo = useMemo(() => {
    if (w < 10 || h < 10) return null
    const pad = 6
    const unit = geoMiller().scale(1).translate([0, 0])
    const [ux0, uy0] = unit([-180, MAP_LAT_MAX]) as [number, number]
    const [ux1, uy1] = unit([180, MAP_LAT_MIN]) as [number, number]
    const k = Math.min((w - 2 * pad) / (ux1 - ux0), (h - 2 * pad) / (uy1 - uy0))
    const projection = geoMiller()
      .scale(k)
      .translate([w / 2 - (k * (ux0 + ux1)) / 2, h / 2 - (k * (uy0 + uy1)) / 2])
    const path = geoPath(projection).digits(2)
    const shapes: CanvasShape[] = world.shapes.map((s) => ({
      id: s.id,
      bounds: path.bounds(s.feature) as Bounds,
      low: record(projection, s.feature, LOD_STEP),
      full: record(projection, s.feature, 0),
    }))
    const x0 = w / 2 - (k * (ux1 - ux0)) / 2
    const x1 = w / 2 + (k * (ux1 - ux0)) / 2
    const y0 = h / 2 - (k * (uy1 - uy0)) / 2
    const y1 = h / 2 + (k * (uy1 - uy0)) / 2
    const r = still ? 10 : 0
    const sphereBounds: Bounds = [
      [x0, y0],
      [x1, y1],
    ]
    const lines = geoGraticule().extent([
      [-180, MAP_LAT_MIN],
      [180, MAP_LAT_MAX],
    ])
    const wrapX = interactive && !still
    const panExtent: Bounds = wrapX
      ? [
          [-Infinity, y0],
          [Infinity, y1],
        ]
      : sphereBounds
    return {
      projection,
      path,
      sphereBounds,
      minK: wrapX ? Math.max(1, h / (y1 - y0)) : 1,
      panExtent,
      wrapX,
      sphereWidth: x1 - x0,
      sphereHeight: y1 - y0,
      sphere: new Path2D(
        `M${x0 + r},${y0}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y0 + r}V${y1 - r}A${r},${r} 0 0 1 ${x1 - r},${y1}H${x0 + r}A${r},${r} 0 0 1 ${x0},${y1 - r}V${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}Z`,
      ),
      edges: new Path2D(`M${x0},${y0}H${x1}M${x0},${y1}H${x1}`),
      graticule: new Path2D(
        path({ type: 'MultiLineString', coordinates: lines.lines().map((l) => l.coordinates) }) ?? '',
      ),
      shapes,
      shapeById: new Map(shapes.map((s) => [s.id, s])),
    }
  }, [world, w, h, still, interactive])

  const inScope = useMemo(
    () => (region === 'world' ? null : new Set(COUNTRIES.filter((c) => c.region === region).map((c) => c.id))),
    [region],
  )

  const offsets = useMemo(() => (geo?.wrapX ? [-geo.sphereWidth, 0, geo.sphereWidth] : [0]), [geo])

  const rings = useMemo(() => {
    if (!geo) return []
    return COUNTRIES.filter((c) => (c.area < RING_AREA_KM2 || !world.byId.has(c.id)) && (!inScope || inScope.has(c.id)))
      .map((c) => {
        const shape = world.byId.get(c.id)
        const p = geo.projection(shape ? shape.centroid : [c.lon, c.lat])
        return p ? { id: c.id, x: p[0], y: p[1] } : null
      })
      .filter((r): r is { id: string; x: number; y: number } => !!r)
  }, [geo, world, inScope])

  const linePath = useMemo(() => {
    const d = geo && line ? geo.path({ type: 'LineString', coordinates: line }) : null
    return d ? new Path2D(d) : null
  }, [geo, line])

  const starPath = useMemo(() => new Path2D(STAR_PATH), [])

  const wrapTransform = useCallback(
    (t: ZoomTransform): ZoomTransform => {
      if (!geo?.wrapX) return t
      const width = geo.sphereWidth
      const x0 = geo.sphereBounds[0][0]
      const left = -t.x / t.k
      const wrapped = x0 + ((((left - x0 + width / 2) % width) + width) % width) - width / 2
      return Math.abs(wrapped - left) < 1e-6 ? t : zoomIdentity.translate(-wrapped * t.k, t.y).scale(t.k)
    },
    [geo],
  )

  const scope = useRef({ from: inScope, to: inScope, t0: 0 })
  const drawRef = useRef<() => void>(() => {})
  const frame = useRef(0)
  const scheduleDraw = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      drawRef.current()
    })
  }, [])

  const cache = useRef<{
    canvas: HTMLCanvasElement
    ready: boolean
    tx: number
    ty: number
    k: number
    geo: unknown
    scope: unknown
  } | null>(null)
  const lastK = useRef(0)
  const settleTimer = useRef(0)

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)

    const paintBase = (
      ctx: CanvasRenderingContext2D,
      t: { x: number; y: number; k: number },
      vw: number,
      vh: number,
      fillFor: (id: string) => string,
      dimmed: (id: string) => boolean,
    ) => {
      if (!geo) return
      const k = t.k
      const left = -t.x / k
      const right = (vw - t.x) / k
      const top = -t.y / k
      const bottom = (vh - t.y) / k
      const lod = k < LOD_MAX_K
      const [[bx0], [bx1]] = geo.sphereBounds
      for (const dx of offsets) {
        if (bx1 + dx < left || bx0 + dx > right) continue
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (t.x + k * dx), dpr * t.y)
        ctx.lineJoin = 'round'

        ctx.fillStyle = tokens.ocean
        ctx.fill(geo.sphere)
        if (!geo.wrapX) {
          ctx.lineWidth = 1.4 / k
          ctx.strokeStyle = tokens.ink
          ctx.stroke(geo.sphere)
        }

        ctx.lineWidth = 0.5 / k
        ctx.strokeStyle = 'rgba(46,36,24,.22)'
        ctx.setLineDash([2 / k, 3 / k])
        ctx.stroke(geo.graticule)
        ctx.setLineDash([])

        const visible = geo.shapes.filter(
          (s) =>
            s.bounds[1][0] + dx >= left &&
            s.bounds[0][0] + dx <= right &&
            s.bounds[1][1] >= top &&
            s.bounds[0][1] <= bottom,
        )
        for (const s of visible) {
          ctx.fillStyle = fillFor(s.id)
          ctx.fill(lod ? s.low : s.full)
        }
        ctx.lineWidth = 0.45 / k
        ctx.strokeStyle = 'rgba(86,68,46,.85)'
        for (const s of visible) if (!dimmed(s.id)) ctx.stroke(lod ? s.low : s.full)
        ctx.strokeStyle = 'rgba(86,68,46,.34)'
        for (const s of visible) if (dimmed(s.id)) ctx.stroke(lod ? s.low : s.full)

        if (sheen && dx === 0) {
          const [[, by0], [, by1]] = geo.sphereBounds
          const g = ctx.createLinearGradient(bx0, by0, bx0 + 0.6 * (bx1 - bx0), by1)
          g.addColorStop(0, 'rgba(255,255,255,.5)')
          g.addColorStop(0.45, 'rgba(255,255,255,0)')
          g.addColorStop(1, 'rgba(58,46,32,.14)')
          ctx.fillStyle = g
          ctx.fill(geo.sphere)
        }
      }
    }

    const paintOverlay = (ctx: CanvasRenderingContext2D, t: ZoomTransform) => {
      if (!geo) return
      const k = t.k
      const lod = k < LOD_MAX_K
      for (const dx of offsets) {
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (t.x + k * dx), dpr * t.y)
        ctx.lineJoin = 'round'
        for (const [id, kind] of Object.entries(highlights)) {
          const s = geo.shapeById.get(id)
          if (!s) continue
          ctx.globalAlpha = 0.92
          ctx.fillStyle = KIND_FILL[kind]
          ctx.fill(lod ? s.low : s.full)
          ctx.globalAlpha = 1
          ctx.lineWidth = 0.7 / k
          ctx.strokeStyle = 'rgba(58,46,32,.8)'
          ctx.stroke(lod ? s.low : s.full)
        }
        if (linePath) {
          ctx.lineWidth = 1.1 / k
          ctx.strokeStyle = tokens.brickDark
          ctx.setLineDash([4 / k, 3 / k])
          ctx.stroke(linePath)
          ctx.setLineDash([])
        }
        if (geo.wrapX) {
          ctx.lineWidth = 1.4 / k
          ctx.strokeStyle = tokens.ink
          ctx.stroke(geo.edges)
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const margin = 24
      const onScreen = (x: number, y: number) => x > -margin && x < w + margin && y > -margin && y < h + margin

      const fade = Math.max(0, Math.min(1, (22 - k) / 10))
      if (fade > 0.01) {
        for (const dx of offsets) {
          for (const r of rings) {
            const kind = highlights[r.id]
            if (!kind && !tapRings) continue
            const x = t.x + k * (r.x + dx)
            const y = t.y + k * r.y
            if (!onScreen(x, y)) continue
            ctx.beginPath()
            ctx.arc(x, y, kind ? 10 : 9, 0, Math.PI * 2)
            if (kind) {
              ctx.globalAlpha = fade * 0.55
              ctx.fillStyle = KIND_FILL[kind]
              ctx.fill()
              ctx.globalAlpha = fade
              ctx.setLineDash([])
              ctx.strokeStyle = tokens.ink
              ctx.lineWidth = 1
            } else {
              ctx.globalAlpha = fade
              ctx.setLineDash([2, 2])
              ctx.strokeStyle = 'rgba(110,92,69,.7)'
              ctx.lineWidth = 0.8
            }
            ctx.stroke()
          }
        }
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      for (const dx of offsets) {
        for (const m of markers) {
          const pt = geo.projection([m.lon, m.lat])
          if (!pt) continue
          const x = t.x + k * (pt[0] + dx)
          const y = t.y + k * pt[1]
          if (!onScreen(x, y)) continue
          ctx.save()
          ctx.translate(x, y)
          if (m.kind === 'star') {
            ctx.scale(1.05, 1.05)
            ctx.lineWidth = 2
            ctx.strokeStyle = tokens.paperLight
            ctx.stroke(starPath)
            ctx.fillStyle = tokens.ink
            ctx.fill(starPath)
          } else {
            ctx.beginPath()
            ctx.arc(0, 0, 5.5, 0, Math.PI * 2)
            ctx.lineWidth = 2
            ctx.strokeStyle = tokens.paperLight
            ctx.stroke()
            ctx.fillStyle = tokens.brick
            ctx.fill()
            ctx.beginPath()
            ctx.arc(0, 0, 1.6, 0, Math.PI * 2)
            ctx.fillStyle = tokens.paperLight
            ctx.fill()
          }
          ctx.restore()
        }
        if (labels.length) {
          ctx.font = `600 11.5px ${fontBody}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'alphabetic'
          ctx.lineJoin = 'round'
          if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '0.69px'
        }
        for (const l of labels) {
          const pt = geo.projection([l.lon, l.lat])
          if (!pt) continue
          const x = t.x + k * (pt[0] + dx)
          const y = t.y + k * pt[1] + (l.dy ?? 0)
          if (!onScreen(x, y)) continue
          const text = l.text.toUpperCase()
          ctx.lineWidth = 3.2
          ctx.strokeStyle = 'rgba(249,243,227,.9)'
          ctx.strokeText(text, x, y)
          ctx.fillStyle = tokens.ink
          ctx.fillText(text, x, y)
        }
      }
    }

    const rebuildCache = (t: ZoomTransform, fillFor: (id: string) => string, dimmed: (id: string) => boolean) => {
      const mx = Math.round(w * CACHE_MARGIN_X)
      const my = Math.round(h * CACHE_MARGIN_Y)
      const c = cache.current?.canvas ?? document.createElement('canvas')
      const cw = Math.round((w + 2 * mx) * dpr)
      const ch = Math.round((h + 2 * my) * dpr)
      if (c.width !== cw || c.height !== ch) {
        c.width = cw
        c.height = ch
      }
      const cctx = c.getContext('2d')
      if (!cctx) return false
      cctx.setTransform(1, 0, 0, 1, 0, 0)
      cctx.clearRect(0, 0, c.width, c.height)
      paintBase(cctx, { x: t.x + mx, y: t.y + my, k: t.k }, w + 2 * mx, h + 2 * my, fillFor, dimmed)
      cache.current = { canvas: c, ready: true, tx: t.x, ty: t.y, k: t.k, geo, scope: scope.current.to }
      return true
    }

    drawRef.current = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || !geo) return
      const t = zoomTransform(canvas)
      const sc = scope.current
      const p = Math.min(1, (performance.now() - sc.t0) / SCOPE_FADE_MS)
      const eased = p * p * (3 - 2 * p)
      const dimOf = (set: Set<string> | null, id: string) => (set && !set.has(id) ? 1 : 0)
      const fillFor =
        p < 1
          ? (id: string) => {
              const a = dimOf(sc.from, id)
              return mixColor(a + (dimOf(sc.to, id) - a) * eased)
            }
          : (id: string) => (dimOf(sc.to, id) ? DIM_COLOR : LAND_COLOR)
      const dimmed = (id: string) => !!dimOf(sc.to, id)
      if (p < 1) scheduleDraw()

      const mx = Math.round(w * CACHE_MARGIN_X)
      const my = Math.round(h * CACHE_MARGIN_Y)
      const stable = Math.abs(t.k - lastK.current) < 1e-9 * t.k
      lastK.current = t.k
      window.clearTimeout(settleTimer.current)

      let c = cache.current
      const period = geo.wrapX ? geo.sphereWidth * t.k : 0
      const shiftX = (cc: NonNullable<typeof c>) => {
        const s = t.x - cc.tx
        return period ? s - Math.round(s / period) * period : s
      }
      const fits = (cc: NonNullable<typeof c>) =>
        cc.ready &&
        cc.geo === geo &&
        cc.scope === sc.to &&
        Math.abs(cc.k - t.k) < 1e-9 * t.k &&
        Math.abs(shiftX(cc)) <= mx &&
        Math.abs(t.y - cc.ty) <= my
      const cacheable = !sheen && p >= 1
      if (cacheable && !(c && fits(c)) && stable) {
        if (rebuildCache(t, fillFor, dimmed)) c = cache.current
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (cacheable && c && fits(c)) {
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
        const ox = Math.round((mx - shiftX(c)) * dpr)
        const oy = Math.round((my - (t.y - c.ty)) * dpr)
        ctx.drawImage(c.canvas, ox, oy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
      } else {
        paintBase(ctx, t, w, h, fillFor, dimmed)
        if (cacheable) {
          settleTimer.current = window.setTimeout(() => {
            const tt = canvasRef.current ? zoomTransform(canvasRef.current) : null
            if (tt && rebuildCache(tt, fillFor, dimmed)) scheduleDraw()
          }, SETTLE_MS)
        }
      }
      paintOverlay(ctx, t)
    }
    scheduleDraw()
  })

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !w || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }, [w, h])

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const sc = scope.current
    if (sc.to === inScope) return
    scope.current = { from: sc.to, to: inScope, t0: reduce ? -SCOPE_FADE_MS : performance.now() }
  }, [inScope])

  useEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) scheduleDraw()
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [scheduleDraw])

  const computeTransform = useCallback(
    (v: MapView | undefined): ZoomTransform => {
      if (!geo || still) return zoomIdentity
      let box: Bounds | null = null
      const chunks: Bounds[] = []
      for (const id of v?.ids ?? []) {
        const shape = world.byId.get(id)
        const b = shape ? focusBounds(shape.focus, geo.path, geo.sphereWidth) : null
        if (b) chunks.push(b)
      }
      for (const pt of v?.points ?? []) {
        const p = geo.projection(pt)
        if (p) chunks.push([p, p])
      }
      if (chunks.length) {
        box = unionBounds(chunks)
      } else {
        const r = regionById(region)
        if (r.id === 'world') {
          const k = geo.minK
          const cx = geo.projection([WORLD_CENTER_LON, 30])?.[0] ?? w / 2
          const cy = (geo.sphereBounds[0][1] + geo.sphereBounds[1][1]) / 2
          const t = zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k)
          return (
            zoomRef.current?.constrain()(
              t,
              [
                [0, 0],
                [w, h],
              ],
              geo.panExtent,
            ) ?? t
          )
        }
        box = regionBounds(r.box, geo.projection)
      }
      const minSpan = geo.sphereWidth * (chunks.length ? (v?.minSpan ?? 0.07) : 0)
      let bw = box[1][0] - box[0][0]
      let bh = box[1][1] - box[0][1]
      const cx = (box[0][0] + box[1][0]) / 2
      const cy = (box[0][1] + box[1][1]) / 2
      bw = Math.max(bw, minSpan)
      bh = Math.max(bh, minSpan * (h / w))
      const pad = chunks.length ? (v?.pad ?? 1.5) : 1.08
      const fill = Math.max(1, h / geo.sphereHeight, w / geo.sphereWidth)
      const k = Math.max(fill, Math.min(MAX_ZOOM, Math.min(w / (bw * pad), h / (bh * pad))))
      const raw = zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k)
      const constrain = zoomRef.current?.constrain()
      return constrain
        ? constrain(
            raw,
            [
              [0, 0],
              [w, h],
            ],
            geo.panExtent,
          )
        : raw
    },
    [geo, world, region, w, h, still],
  )

  useEffect(() => {
    if (!geo || !canvasRef.current) return
    const canvas = select(canvasRef.current)
    const behavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([geo.minK, MAX_ZOOM])
      .extent([
        [0, 0],
        [w, h],
      ])
      .translateExtent(geo.panExtent)
      .filter((e: Event) => interactive && e.type === 'wheel')
      .on('zoom', (e) => {
        const t = wrapTransform(e.transform)
        if (t !== e.transform) canvas.property('__zoom', t)
        scheduleDraw()
      })
    canvas.call(behavior)
    zoomRef.current = behavior
    scheduleDraw()
    firstView.current = true
    return () => {
      canvas.on('.zoom', null)
      canvas.interrupt()
    }
  }, [geo, w, h, interactive, scheduleDraw, wrapTransform])

  const viewKey = view?.key
  const regionKey = region
  useEffect(() => {
    if (!geo || !canvasRef.current || !zoomRef.current) return
    let target = computeTransform(view)
    const canvas = select(canvasRef.current)
    if (geo.wrapX) {
      const cur = zoomTransform(canvasRef.current)
      const shift = Math.round(((w / 2 - cur.x) / cur.k - (w / 2 - target.x) / target.k) / geo.sphereWidth)
      if (shift)
        target = zoomIdentity.translate(target.x - shift * geo.sphereWidth * target.k, target.y).scale(target.k)
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const instant = firstView.current || view?.animate === false || reduce
    firstView.current = false
    if (instant) canvas.call(zoomRef.current.transform, target)
    else canvas.transition().duration(750).ease(easeCubicInOut).call(zoomRef.current.transform, target)
    // la vue ne se recalcule que lorsque sa clé ou la région change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, viewKey, regionKey])

  const press = useRef<{ x: number; y: number; t: number; multi: boolean } | null>(null)
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    mode: 'pan' | 'pinch'
    start: ZoomTransform
    cx: number
    cy: number
    dist: number
    engaged: boolean
    gain: number
    samples: { x: number; y: number; t: number }[]
  } | null>(null)
  const fling = useRef<number | null>(null)

  const applyTransform = useCallback(
    (x: number, y: number, k: number) => {
      if (!geo || !canvasRef.current || !zoomRef.current) return
      const t = zoomRef.current.constrain()(
        zoomIdentity.translate(x, y).scale(k),
        [
          [0, 0],
          [w, h],
        ],
        geo.panExtent,
      )
      select(canvasRef.current).call(zoomRef.current.transform, t)
    },
    [geo, w, h],
  )

  const stopFling = () => {
    if (fling.current !== null) cancelAnimationFrame(fling.current)
    fling.current = null
  }

  const startGesture = (pointerType: string) => {
    if (!canvasRef.current) return
    const list = [...pts.current.values()]
    const start = zoomTransform(canvasRef.current)
    if (list.length >= 2) {
      const [a, b] = list
      gesture.current = {
        mode: 'pinch',
        start,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        engaged: true,
        gain: 1,
        samples: [],
      }
    } else if (list.length === 1) {
      gesture.current = {
        mode: 'pan',
        start,
        cx: list[0].x,
        cy: list[0].y,
        dist: 0,
        engaged: gesture.current?.engaged ?? false,
        gain: pointerType === 'mouse' ? PAN_GAIN_MOUSE : PAN_GAIN_TOUCH,
        samples: [],
      }
    } else gesture.current = null
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canvasRef.current) return
    stopFling()
    select(canvasRef.current).interrupt()
    try {
      canvasRef.current.setPointerCapture(e.pointerId)
    } catch {
      /* capture indisponible : le geste reste suivi tant que le pointeur est sur la carte */
    }
    const rect = canvasRef.current.getBoundingClientRect()
    pts.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    if (pts.current.size > 1) {
      if (press.current) press.current.multi = true
    } else {
      press.current = { x: e.clientX, y: e.clientY, t: performance.now(), multi: false }
      gesture.current = null
    }
    startGesture(e.pointerType)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current
    if (!g || !canvasRef.current || !pts.current.has(e.pointerId)) return
    const rect = canvasRef.current.getBoundingClientRect()
    pts.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    const list = [...pts.current.values()]
    if (g.mode === 'pinch' && list.length >= 2) {
      const [a, b] = list
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const k = Math.min(
        MAX_ZOOM,
        Math.max(geo?.minK ?? 1, (g.start.k * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / g.dist),
      )
      const [wx, wy] = g.start.invert([g.cx, g.cy])
      applyTransform(cx - wx * k, cy - wy * k, k)
      return
    }
    const p = list[0]
    const dx = p.x - g.cx
    const dy = p.y - g.cy
    if (!g.engaged) {
      if (Math.hypot(dx, dy) < PAN_SLOP_PX) return
      g.engaged = true
    }
    applyTransform(g.start.x + dx * g.gain, g.start.y + dy * g.gain, g.start.k)
    const now = performance.now()
    g.samples.push({ x: p.x, y: p.y, t: now })
    while (g.samples.length > 2 && now - g.samples[0].t > 90) g.samples.shift()
  }

  const startFling = (g: NonNullable<typeof gesture.current>) => {
    const first = g.samples[0]
    const last = g.samples[g.samples.length - 1]
    if (!first || !last || last.t === first.t || performance.now() - last.t > 70) return
    let vx = ((last.x - first.x) / (last.t - first.t)) * g.gain
    let vy = ((last.y - first.y) / (last.t - first.t)) * g.gain
    if (Math.hypot(vx, vy) < 0.25) return
    let prev = performance.now()
    const step = (now: number) => {
      if (!canvasRef.current) return
      const dt = Math.min(48, now - prev)
      prev = now
      const decay = Math.exp(-dt / 380)
      vx *= decay
      vy *= decay
      const cur = zoomTransform(canvasRef.current)
      applyTransform(cur.x + vx * dt, cur.y + vy * dt, cur.k)
      fling.current = Math.hypot(vx, vy) > 0.03 ? requestAnimationFrame(step) : null
    }
    fling.current = requestAnimationFrame(step)
  }

  const endPointer = (e: ReactPointerEvent) => {
    pts.current.delete(e.pointerId)
    const g = gesture.current
    if (pts.current.size === 0) {
      gesture.current = null
      if (g && g.mode === 'pan' && g.engaged && e.type === 'pointerup') startFling(g)
    } else startGesture(e.pointerType)
  }

  const hitTest = (px: number, py: number, sx: number, sy: number, t: ZoomTransform): string | null => {
    const fade = Math.max(0, Math.min(1, (22 - t.k) / 10))
    if (geo && fade >= 0.2) {
      let best: { id: string; d: number } | null = null
      for (const dx of offsets) {
        for (const r of rings) {
          if (!highlights[r.id] && !tapRings) continue
          const d = Math.hypot(t.x + t.k * (r.x + dx) - sx, t.y + t.k * r.y - sy)
          if (d <= (highlights[r.id] ? 10 : 9) && (!best || d < best.d)) best = { id: r.id, d }
        }
      }
      if (best) return best.id
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (!geo || !ctx) return null
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    for (const s of geo.shapes) {
      const [[x0, y0], [x1, y1]] = s.bounds
      if (px < x0 || px > x1 || py < y0 || py > y1) continue
      if (ctx.isPointInPath(s.full, px, py)) return inScope && !inScope.has(s.id) ? null : s.id
    }
    return null
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const p = press.current
    endPointer(e)
    if (pts.current.size === 0) press.current = null
    if (!p || p.multi || !onTap || !geo || !canvasRef.current) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > PAN_SLOP_PX || performance.now() - p.t > 700) return

    const rect = canvasRef.current.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const transform = zoomTransform(canvasRef.current)
    const [rawX, py] = transform.invert([sx, sy])
    let px = rawX
    if (geo.wrapX) {
      const x0 = geo.sphereBounds[0][0]
      px = x0 + ((((px - x0) % geo.sphereWidth) + geo.sphereWidth) % geo.sphereWidth)
    }
    const lonlat = geo.projection.invert?.([px, py])
    const id = hitTest(px, py, sx, sy, transform)
    const back = lonlat && Number.isFinite(lonlat[0]) ? geo.projection(lonlat) : null
    const [[bx0, by0], [bx1, by1]] = geo.sphereBounds
    const valid =
      !!lonlat &&
      !!back &&
      Math.hypot(back[0] - px, back[1] - py) < 1.5 &&
      px >= bx0 &&
      px <= bx1 &&
      py >= by0 &&
      py <= by1
    const nearSelected = markers.some((m) => {
      if (m.kind !== 'guess') return false
      const mp = geo.projection([m.lon, m.lat])
      if (!mp) return false
      return offsets.some((dx) => {
        const [mx, my] = transform.apply([mp[0] + dx, mp[1]])
        return Math.hypot(mx - sx, my - sy) < SELECT_RADIUS_PX
      })
    })
    onTap({ id, lon: valid ? lonlat![0] : null, lat: valid ? lonlat![1] : null, nearSelected })
  }

  const onPointerCancel = (e: ReactPointerEvent) => {
    endPointer(e)
    if (pts.current.size === 0) press.current = null
  }

  useEffect(() => stopFling, [])

  return (
    <Box
      ref={wrapRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Carte du monde"
        style={{ display: 'block', width: w, height: h, cursor: interactive ? 'crosshair' : 'default' }}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerUp={interactive ? onPointerUp : undefined}
        onPointerCancel={interactive ? onPointerCancel : undefined}
      />

      {vignette && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 36px rgba(120,90,50,.28), inset 0 0 0 1px rgba(58,46,32,.2)',
          }}
        />
      )}

      {interactive && <CompassRose />}
    </Box>
  )
}
