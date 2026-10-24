import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Box from '@mui/material/Box'
import { keyframes } from '@emotion/react'
import { geoArea, geoGraticule10, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import { easeCubicInOut } from 'd3-ease'
import { geoEckert4 } from 'd3-geo-projection'
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
  /** Remplit tout le cadre, même en vue monde (bords du globe rognés). */
  cover?: boolean
  /** Vue figée sur le globe entier : la région choisie est seulement mise en valeur (les autres pays s'estompent). */
  still?: boolean
  /** Léger reflet de lumière sur le globe, façon objet posé. */
  sheen?: boolean
  /** Ombre intérieure façon papier ancien (activée par défaut). */
  vignette?: boolean
  onTap?: (tap: TapInfo) => void
}

const MAX_ZOOM = 120
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

const ripple = keyframes`
  from { transform: scale(0.3); opacity: 0.9; }
  to { transform: scale(1.6); opacity: 0; }
`

const STAR = 'M0,-9 L2.6,-3.2 L8.6,-2.8 L4,1.4 L5.3,7.3 L0,4.3 L-5.3,7.3 L-4,1.4 L-8.6,-2.8 L-2.6,-3.2 Z'

interface ShapePathProps {
  id: string
  d: string
  color: string
  dim: boolean
}

const ShapePath = memo(function ShapePath({ id, d, color, dim }: ShapePathProps) {
  // Les pays hors périmètre n'ont pas d'identifiant : un tap dessus est traité comme un tap dans l'eau.
  return dim ? <path data-dim d={d} fill={tokens.dim} /> : <path data-id={id} d={d} fill={color} />
})

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
  cover = false,
  vignette = true,
  still = false,
  sheen = false,
  onTap,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const ringsRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const firstView = useRef(true)
  const { w, h } = useElementSize(wrapRef)
  const [splash, setSplash] = useState<{ x: number; y: number; n: number } | null>(null)

  const geo = useMemo(() => {
    if (w < 10 || h < 10) return null
    const pad = 6
    const projection = geoEckert4().fitExtent(
      [
        [pad, pad],
        [w - pad, h - pad],
      ],
      { type: 'Sphere' },
    )
    const path = geoPath(projection).digits(2)
    const shapes = world.shapes.map((s) => ({ id: s.id, d: path(s.feature) ?? '', colorIndex: s.colorIndex }))
    const sphereBounds = path.bounds({ type: 'Sphere' }) as Bounds
    return {
      projection,
      path,
      sphereBounds,
      sphereWidth: sphereBounds[1][0] - sphereBounds[0][0],
      sphereHeight: sphereBounds[1][1] - sphereBounds[0][1],
      sphereD: path({ type: 'Sphere' }) ?? '',
      graticuleD: path(geoGraticule10()) ?? '',
      shapes,
      landD: shapes.map((s) => s.d).join(''),
    }
  }, [world, w, h])

  const inScope = useMemo(
    () => (region === 'world' ? null : new Set(COUNTRIES.filter((c) => c.region === region).map((c) => c.id))),
    [region],
  )

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

  const syncZoomDecor = useCallback((t: ZoomTransform) => {
    gRef.current?.setAttribute('transform', t.toString())
    svgRef.current?.style.setProperty('--inv-k', String(1 / t.k))
    const rg = ringsRef.current
    if (rg) {
      const fade = Math.max(0, Math.min(1, (22 - t.k) / 10))
      rg.style.opacity = String(fade)
      rg.style.pointerEvents = fade < 0.2 ? 'none' : 'all'
    }
  }, [])

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
          if (!cover) return zoomIdentity
          const [[x0, y0], [x1, y1]] = geo.sphereBounds
          const k = Math.max(1, h / geo.sphereHeight, w / geo.sphereWidth) * 1.12
          const t = zoomIdentity.translate(w / 2 - (k * (x0 + x1)) / 2, h / 2 - (k * (y0 + y1)) / 2).scale(k)
          return (
            zoomRef.current?.constrain()(
              t,
              [
                [0, 0],
                [w, h],
              ],
              geo.sphereBounds,
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
            geo.sphereBounds,
          )
        : raw
    },
    [geo, world, region, w, h, cover, still],
  )

  useEffect(() => {
    if (!geo || !svgRef.current) return
    const svg = select(svgRef.current)
    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .extent([
        [0, 0],
        [w, h],
      ])
      .translateExtent(geo.sphereBounds)
      .filter((e: Event) => interactive && e.type === 'wheel')
      .on('zoom', (e) => syncZoomDecor(e.transform))
    svg.call(behavior)
    zoomRef.current = behavior
    syncZoomDecor(zoomTransform(svgRef.current))
    firstView.current = true
    return () => {
      svg.on('.zoom', null)
      svg.interrupt()
    }
  }, [geo, w, h, interactive, syncZoomDecor])

  const viewKey = view?.key
  const regionKey = region
  useEffect(() => {
    if (!geo || !svgRef.current || !zoomRef.current) return
    const target = computeTransform(view)
    const svg = select(svgRef.current)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const instant = firstView.current || view?.animate === false || reduce
    firstView.current = false
    if (instant) svg.call(zoomRef.current.transform, target)
    else svg.transition().duration(750).ease(easeCubicInOut).call(zoomRef.current.transform, target)
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
      if (!geo || !svgRef.current || !zoomRef.current) return
      const t = zoomRef.current.constrain()(
        zoomIdentity.translate(x, y).scale(k),
        [
          [0, 0],
          [w, h],
        ],
        geo.sphereBounds,
      )
      select(svgRef.current).call(zoomRef.current.transform, t)
    },
    [geo, w, h],
  )

  const stopFling = () => {
    if (fling.current !== null) cancelAnimationFrame(fling.current)
    fling.current = null
  }

  const startGesture = (pointerType: string) => {
    if (!svgRef.current) return
    const list = [...pts.current.values()]
    const start = zoomTransform(svgRef.current)
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
    if (!svgRef.current) return
    stopFling()
    select(svgRef.current).interrupt()
    try {
      svgRef.current.setPointerCapture(e.pointerId)
    } catch {
      /* capture indisponible : le geste reste suivi tant que le pointeur est sur la carte */
    }
    const rect = svgRef.current.getBoundingClientRect()
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
    if (!g || !svgRef.current || !pts.current.has(e.pointerId)) return
    const rect = svgRef.current.getBoundingClientRect()
    pts.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    const list = [...pts.current.values()]
    if (g.mode === 'pinch' && list.length >= 2) {
      const [a, b] = list
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const k = Math.min(MAX_ZOOM, Math.max(1, (g.start.k * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / g.dist))
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
      if (!svgRef.current) return
      const dt = Math.min(48, now - prev)
      prev = now
      const decay = Math.exp(-dt / 380)
      vx *= decay
      vy *= decay
      const cur = zoomTransform(svgRef.current)
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

  const onPointerUp = (e: ReactPointerEvent) => {
    const p = press.current
    endPointer(e)
    if (pts.current.size === 0) press.current = null
    if (!p || p.multi || !onTap || !geo || !svgRef.current) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > PAN_SLOP_PX || performance.now() - p.t > 700) return

    const rect = svgRef.current.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const transform = zoomTransform(svgRef.current)
    const [px, py] = transform.invert([sx, sy])
    const lonlat = geo.projection.invert?.([px, py])
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]')
    const id = hit?.getAttribute('data-id') ?? null
    const back = lonlat && Number.isFinite(lonlat[0]) ? geo.projection(lonlat) : null
    const valid = !!lonlat && !!back && Math.hypot(back[0] - px, back[1] - py) < 1.5
    const nearSelected = markers.some((m) => {
      if (m.kind !== 'guess') return false
      const mp = geo.projection([m.lon, m.lat])
      if (!mp) return false
      const [mx, my] = transform.apply(mp)
      return Math.hypot(mx - sx, my - sy) < SELECT_RADIUS_PX
    })
    setSplash({ x: sx, y: sy, n: Date.now() })
    onTap({ id, lon: valid ? lonlat![0] : null, lat: valid ? lonlat![1] : null, nearSelected })
  }

  const onPointerCancel = (e: ReactPointerEvent) => {
    endPointer(e)
    if (pts.current.size === 0) press.current = null
  }

  useEffect(() => stopFling, [])

  const highlighted = Object.entries(highlights)
  const project = (lon: number, lat: number) => geo?.projection([lon, lat]) ?? null
  const lineD = geo && line ? geo.path({ type: 'LineString', coordinates: line }) : null

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
        '& .counter': { transform: 'scale(var(--inv-k, 1))' },
        '& .land path': {
          stroke: 'rgba(86,68,46,.85)',
          strokeWidth: 0.45,
          vectorEffect: 'non-scaling-stroke',
          strokeLinejoin: 'round',
          transition: 'fill .45s ease',
        },
        '& .land path[data-dim]': { strokeOpacity: 0.4 },
      }}
    >
      <svg
        ref={svgRef}
        width={w}
        height={h}
        style={{ display: 'block', cursor: interactive ? 'crosshair' : 'default' }}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerUp={interactive ? onPointerUp : undefined}
        onPointerCancel={interactive ? onPointerCancel : undefined}
      >
        {geo && (
          <g ref={gRef}>
            <path
              d={geo.sphereD}
              fill={tokens.ocean}
              stroke={tokens.ink}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={geo.graticuleD}
              fill="none"
              stroke="rgba(46,36,24,.22)"
              strokeWidth={0.5}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <g className="land">
              {geo.shapes.map((s) => (
                <ShapePath
                  key={s.id}
                  id={s.id}
                  d={s.d}
                  color={tokens.land[s.colorIndex]}
                  dim={!!inScope && !inScope.has(s.id)}
                />
              ))}
            </g>
            {sheen && (
              <>
                <defs>
                  <linearGradient id="atlas-sheen" x1="0" y1="0" x2="0.6" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
                    <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
                    <stop offset="1" stopColor="#3a2e20" stopOpacity="0.14" />
                  </linearGradient>
                </defs>
                <path d={geo.sphereD} fill="url(#atlas-sheen)" pointerEvents="none" />
              </>
            )}
            <g className="land" pointerEvents="none">
              {highlighted.map(([id, kind]) => {
                const s = geo.shapes.find((x) => x.id === id)
                return s ? (
                  <path
                    key={id}
                    d={s.d}
                    fill={KIND_FILL[kind]}
                    fillOpacity={0.92}
                    style={{ strokeWidth: 0.7, stroke: 'rgba(58,46,32,.8)' }}
                  />
                ) : null
              })}
            </g>
            {lineD && (
              <path
                d={lineD}
                fill="none"
                stroke={tokens.brickDark}
                strokeWidth={1.1}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            <g ref={ringsRef}>
              {rings.map((r) => {
                const kind = highlights[r.id]
                if (!kind && !tapRings) return null
                return (
                  <g key={r.id} transform={`translate(${r.x},${r.y})`}>
                    <g className="counter">
                      <circle
                        data-id={r.id}
                        r={kind ? 10 : 9}
                        fill={kind ? KIND_FILL[kind] : 'rgba(255,250,235,.01)'}
                        fillOpacity={kind ? 0.55 : 1}
                        stroke={kind ? tokens.ink : tokens.inkSoft}
                        strokeOpacity={kind ? 1 : 0.7}
                        strokeWidth={kind ? 1 : 0.8}
                        strokeDasharray={kind ? undefined : '2 2'}
                      />
                    </g>
                  </g>
                )
              })}
            </g>
            <g pointerEvents="none">
              {markers.map((m, i) => {
                const p = project(m.lon, m.lat)
                if (!p) return null
                return (
                  <g key={i} transform={`translate(${p[0]},${p[1]})`}>
                    <g className="counter">
                      {m.kind === 'star' ? (
                        <path
                          d={STAR}
                          fill={tokens.ink}
                          stroke={tokens.paperLight}
                          strokeWidth={2}
                          paintOrder="stroke"
                          transform="scale(1.05)"
                        />
                      ) : (
                        <>
                          <circle r={5.5} fill={tokens.brick} stroke={tokens.paperLight} strokeWidth={2} />
                          <circle r={1.6} fill={tokens.paperLight} />
                        </>
                      )}
                    </g>
                  </g>
                )
              })}
              {labels.map((l, i) => {
                const p = project(l.lon, l.lat)
                if (!p) return null
                return (
                  <g key={i} transform={`translate(${p[0]},${p[1]})`}>
                    <g className="counter">
                      <text
                        y={l.dy ?? 0}
                        textAnchor="middle"
                        fontFamily={fontBody}
                        fontWeight={600}
                        fontSize={11.5}
                        letterSpacing="0.06em"
                        fill={tokens.ink}
                        stroke={tokens.paperLight}
                        strokeOpacity={0.9}
                        strokeWidth={3.2}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                      >
                        {l.text.toUpperCase()}
                      </text>
                    </g>
                  </g>
                )
              })}
            </g>
          </g>
        )}
      </svg>

      {splash && (
        <Box
          key={splash.n}
          sx={{
            position: 'absolute',
            left: splash.x - 18,
            top: splash.y - 18,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: `2px solid ${tokens.ink}`,
            pointerEvents: 'none',
            animation: `${ripple} 520ms ease-out forwards`,
          }}
        />
      )}

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
