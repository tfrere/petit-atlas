import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Box from '@mui/material/Box'
import { keyframes } from '@emotion/react'
import { geoArea, geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import { easeCubicInOut } from 'd3-ease'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, zoomTransform } from 'd3-zoom'
import type { ZoomBehavior, ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { regionById } from '../data/regions'
import type { RegionId } from '../data/types'
import { COUNTRIES } from '../data/world'
import type { WorldData } from '../data/world'
import { fontDisplay, tokens } from '../theme'

export type HighlightKind = 'target' | 'correct' | 'wrong'

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
  onTap?: (tap: TapInfo) => void
}

const MAX_ZOOM = 120
const RING_AREA_KM2 = 3000

const KIND_FILL: Record<HighlightKind, string> = {
  target: '#d9743c',
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
}

const ShapePath = memo(function ShapePath({ id, d, color }: ShapePathProps) {
  return <path data-id={id} d={d} fill={color} />
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
        opacity: 0.6,
        pointerEvents: 'none',
        color: tokens.ink,
      }}
    >
      <circle r="34" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle r="28" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <path d="M0,-44 L7,-7 L0,0 Z M0,44 L-7,7 L0,0 Z M44,0 L7,7 L0,0 Z M-44,0 L-7,-7 L0,0 Z" fill="currentColor" />
      <path d="M0,-44 L-7,-7 L0,0 Z M0,44 L7,7 L0,0 Z M44,0 L7,-7 L0,0 Z M-44,0 L-7,7 L0,0 Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <path d="M0,0 L22,-22 M0,0 L-22,-22 M0,0 L22,22 M0,0 L-22,22" stroke="currentColor" strokeWidth="0.6" />
      <text y="-47.5" textAnchor="middle" fontSize="12" fontFamily={fontDisplay} fontWeight="700" fill="currentColor">
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
    const projection = geoNaturalEarth1().fitExtent(
      [
        [pad, pad],
        [w - pad, h - pad],
      ],
      { type: 'Sphere' },
    )
    const path = geoPath(projection).digits(2)
    const sphereBounds = path.bounds({ type: 'Sphere' }) as Bounds
    return {
      projection,
      path,
      sphereWidth: sphereBounds[1][0] - sphereBounds[0][0],
      sphereD: path({ type: 'Sphere' }) ?? '',
      graticuleD: path(geoGraticule10()) ?? '',
      shapes: world.shapes.map((s) => ({ id: s.id, d: path(s.feature) ?? '', colorIndex: s.colorIndex })),
    }
  }, [world, w, h])

  const rings = useMemo(() => {
    if (!geo) return []
    return COUNTRIES.filter((c) => c.area < RING_AREA_KM2 || !world.byId.has(c.id))
      .map((c) => {
        const shape = world.byId.get(c.id)
        const p = geo.projection(shape ? shape.centroid : [c.lon, c.lat])
        return p ? { id: c.id, x: p[0], y: p[1] } : null
      })
      .filter((r): r is { id: string; x: number; y: number } => !!r)
  }, [geo, world])

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
      if (!geo) return zoomIdentity
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
        if (r.id === 'world') return zoomIdentity
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
      const k = Math.max(1, Math.min(MAX_ZOOM, Math.min(w / (bw * pad), h / (bh * pad))))
      return zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k)
    },
    [geo, world, region, w, h],
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
      .translateExtent([
        [0, 0],
        [w, h],
      ])
      .filter((e: Event) => {
        const ev = e as MouseEvent
        return interactive && e.type !== 'dblclick' && (!ev.ctrlKey || e.type === 'wheel') && !ev.button
      })
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
  const pointers = useRef(new Set<number>())

  const onPointerDown = (e: ReactPointerEvent) => {
    pointers.current.add(e.pointerId)
    if (pointers.current.size > 1) {
      if (press.current) press.current.multi = true
      return
    }
    press.current = { x: e.clientX, y: e.clientY, t: performance.now(), multi: false }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    const p = press.current
    if (pointers.current.size === 0) press.current = null
    if (!p || p.multi || !onTap || !geo || !svgRef.current) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || performance.now() - p.t > 700) return

    const rect = svgRef.current.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const [px, py] = zoomTransform(svgRef.current).invert([sx, sy])
    const lonlat = geo.projection.invert?.([px, py])
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]')
    const id = hit?.getAttribute('data-id') ?? null
    const back = lonlat && Number.isFinite(lonlat[0]) ? geo.projection(lonlat) : null
    const valid = !!lonlat && !!back && Math.hypot(back[0] - px, back[1] - py) < 1.5
    setSplash({ x: sx, y: sy, n: Date.now() })
    onTap({ id, lon: valid ? lonlat![0] : null, lat: valid ? lonlat![1] : null })
  }

  const onPointerCancel = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) press.current = null
  }

  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor)
  }

  const overview = () => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current)
      .transition()
      .duration(500)
      .ease(easeCubicInOut)
      .call(zoomRef.current.transform, computeTransform(undefined))
  }

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
          stroke: '#6b5a45',
          strokeWidth: 0.6,
          vectorEffect: 'non-scaling-stroke',
          strokeLinejoin: 'round',
        },
      }}
    >
      <svg
        ref={svgRef}
        width={w}
        height={h}
        style={{ display: 'block', cursor: interactive ? 'crosshair' : 'default' }}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerUp={interactive ? onPointerUp : undefined}
        onPointerCancel={interactive ? onPointerCancel : undefined}
      >
        {geo && (
          <g ref={gRef}>
            <path d={geo.sphereD} fill={tokens.ocean} stroke={tokens.ink} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
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
                <ShapePath key={s.id} id={s.id} d={s.d} color={tokens.land[s.colorIndex]} />
              ))}
            </g>
            <g
              className="land"
              pointerEvents="none"
              style={{ filter: 'drop-shadow(0 0 0.5px rgba(46,36,24,.6))' }}
            >
              {highlighted.map(([id, kind]) => {
                const s = geo.shapes.find((x) => x.id === id)
                return s ? <path key={id} d={s.d} fill={KIND_FILL[kind]} style={{ strokeWidth: 1.2 }} /> : null
              })}
            </g>
            {lineD && (
              <path
                d={lineD}
                fill="none"
                stroke={tokens.brickDark}
                strokeWidth={1.6}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            <g ref={ringsRef}>
              {rings.map((r) => {
                const kind = highlights[r.id]
                return (
                  <g key={r.id} transform={`translate(${r.x},${r.y})`}>
                    <g className="counter">
                      <circle
                        data-id={r.id}
                        r={11}
                        fill={kind ? KIND_FILL[kind] : 'rgba(184,138,46,.18)'}
                        fillOpacity={kind ? 0.55 : 1}
                        stroke={kind ? tokens.ink : tokens.inkSoft}
                        strokeWidth={kind ? 1.6 : 1}
                        strokeDasharray={kind ? undefined : '2.5 2'}
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
                        <path d={STAR} fill={tokens.ink} stroke={tokens.paper} strokeWidth={2} paintOrder="stroke" />
                      ) : (
                        <>
                          <circle r={7} fill={tokens.brick} stroke={tokens.paper} strokeWidth={2.5} />
                          <circle r={2} fill={tokens.paper} />
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
                        fontFamily={fontDisplay}
                        fontStyle="italic"
                        fontWeight={700}
                        fontSize={17}
                        fill={tokens.ink}
                        stroke={tokens.paper}
                        strokeWidth={4.5}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                      >
                        {l.text}
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

      {interactive && <CompassRose />}

      {interactive && (
        <Box
          sx={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {(
            [
              ['+', 'Zoomer', () => zoomBy(1.8)],
              ['−', 'Dézoomer', () => zoomBy(1 / 1.8)],
              ['⌂', 'Vue d’ensemble', overview],
            ] as const
          ).map(([glyph, label, action]) => (
            <Box
              key={label}
              component="button"
              type="button"
              aria-label={label}
              onClick={action}
              sx={{
                width: 42,
                height: 42,
                fontFamily: fontDisplay,
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1,
                color: tokens.ink,
                background: tokens.paper,
                border: `1.5px solid ${tokens.ink}`,
                borderRadius: '3px',
                cursor: 'pointer',
                boxShadow: `2px 2px 0 ${tokens.ink}`,
                '&:active': { transform: 'translate(1px,1px)', boxShadow: `1px 1px 0 ${tokens.ink}` },
              }}
            >
              {glyph}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
