import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type WindowPresetId =
  | 'none'
  | 'single'
  | 'double'
  | 'lowE'
  | 'metalFilm'
  | 'custom'

type NamigatePresetId = 'conservative' | 'standard' | 'lowEExample' | 'custom'
type ScenarioKey = 'noWindow' | 'withWindow' | 'withNamigate'

type Settings = {
  frequencyMHz: number
  eirpDbm: number
  outdoorDistanceM: number
  windowPresetId: WindowPresetId
  windowLossDb: number
  windowWidthM: number
  windowHeightM: number
  incidentAngleDeg: number
  roomWidthM: number
  roomDepthM: number
  indoorDistanceM: number
  indoorPathLossExponent: number
  groundReflectionDb: number
  namigatePresetId: NamigatePresetId
  namigateGainDb: number
  namigateWidthCm: number
  namigateHeightCm: number
  connectionThresholdDbm: number
}

type NumberInputProps = {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

type ScenarioResult = {
  key: ScenarioKey
  label: string
  color: string
  rsrpDbm: number
  connectedAreaM2: number
  maxReachM: number
}

type ScenarioDefinition = {
  key: ScenarioKey
  label: string
  color: string
}

type PositionDiagramProps = {
  settings: Settings
  angleLossDb: number
  areaGainDb: number
}

type HeatmapCell = {
  id: string
  rsrpDbm: number
  isConnected: boolean
}

type HeatmapData = {
  cells: HeatmapCell[]
  connectedAreaM2: number
}

type HeatmapPlanProps = {
  settings: Settings
  scenario: ScenarioDefinition
  heatmap: HeatmapData
}

const MAIN_COLOR = '#0071BD'
const CONNECTED_THRESHOLD_DEFAULT = -100

const WINDOW_PRESETS: {
  id: WindowPresetId
  label: string
  lossDb: number | null
}[] = [
  { id: 'none', label: '窓なし', lossDb: 0 },
  { id: 'single', label: '通常ガラス', lossDb: 3 },
  { id: 'double', label: '複層ガラス', lossDb: 10 },
  { id: 'lowE', label: 'Low-Eガラス', lossDb: 40 },
  { id: 'metalFilm', label: '金属膜入りガラス', lossDb: 30 },
  { id: 'custom', label: '任意', lossDb: null },
]

const NAMIGATE_PRESETS: {
  id: NamigatePresetId
  label: string
  gainDb: number | null
}[] = [
  { id: 'conservative', label: '保守的', gainDb: 3 },
  { id: 'standard', label: '標準', gainDb: 10 },
  { id: 'lowEExample', label: 'Low-E改善例', gainDb: 25 },
  { id: 'custom', label: '任意', gainDb: null },
]

const SCENARIOS: ScenarioDefinition[] = [
  { key: 'noWindow', label: '窓なし', color: '#15845d' },
  { key: 'withWindow', label: '窓あり', color: '#c96c34' },
  { key: 'withNamigate', label: '窓あり＋ナミゲート', color: MAIN_COLOR },
]

const ANGLE_LOSS_POINTS = [
  { angleDeg: 15, lossDb: 10 },
  { angleDeg: 30, lossDb: 6 },
  { angleDeg: 45, lossDb: 3 },
  { angleDeg: 60, lossDb: 1 },
  { angleDeg: 90, lossDb: 0 },
]

const ANGLE_CHART_POINTS = [90, 60, 45, 30, 15]
const AREA_CHART_SIZES_CM = [5, 10, 15, 20, 30, 40, 50, 60]
const HEATMAP_COLUMNS = 18
const HEATMAP_ROWS = 12

const DEFAULT_SETTINGS: Settings = {
  frequencyMHz: 4700,
  eirpDbm: 43,
  outdoorDistanceM: 100,
  windowPresetId: 'lowE',
  windowLossDb: 40,
  windowWidthM: 2.4,
  windowHeightM: 1.8,
  incidentAngleDeg: 60,
  roomWidthM: 8,
  roomDepthM: 12,
  indoorDistanceM: 8,
  indoorPathLossExponent: 2.2,
  groundReflectionDb: 0,
  namigatePresetId: 'lowEExample',
  namigateGainDb: 25,
  namigateWidthCm: 20,
  namigateHeightCm: 20,
  connectionThresholdDbm: CONNECTED_THRESHOLD_DEFAULT,
}

const numberFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 1,
})

const compactNumberFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function log10(value: number) {
  return Math.log10(Math.max(value, 0.000001))
}

function calculateFsplDb(frequencyMHz: number, distanceM: number) {
  const safeFrequencyMHz = Math.max(frequencyMHz, 1)
  const safeDistanceKm = Math.max(distanceM, 1) / 1000
  return 32.44 + 20 * log10(safeFrequencyMHz) + 20 * log10(safeDistanceKm)
}

function calculateIndoorLossDb(distanceM: number, exponent: number) {
  const safeDistanceM = Math.max(distanceM, 1)
  return 10 * Math.max(exponent, 0.1) * log10(safeDistanceM / 1)
}

function calculateAngleLossDb(angleDeg: number) {
  const safeAngle = clamp(angleDeg, 15, 90)

  for (let index = 0; index < ANGLE_LOSS_POINTS.length - 1; index += 1) {
    const lower = ANGLE_LOSS_POINTS[index]
    const upper = ANGLE_LOSS_POINTS[index + 1]

    if (safeAngle >= lower.angleDeg && safeAngle <= upper.angleDeg) {
      const progress =
        (safeAngle - lower.angleDeg) / (upper.angleDeg - lower.angleDeg)
      return lower.lossDb + progress * (upper.lossDb - lower.lossDb)
    }
  }

  return safeAngle >= 90 ? 0 : 10
}

function calculateAreaGainDb(widthCm: number, heightCm: number) {
  const areaCm2 = Math.max(widthCm * heightCm, 1)
  const areaMultiplier = areaCm2 / 100
  return Math.min(10 * log10(areaMultiplier), 10)
}

function getEffectiveAngleLossDb(settings: Settings, angleDeg = settings.incidentAngleDeg) {
  return settings.windowPresetId === 'none' ? 0 : calculateAngleLossDb(angleDeg)
}

function getScenarioAdjustmentDb(settings: Settings, scenario: ScenarioKey) {
  if (scenario === 'noWindow') {
    return 0
  }

  const windowAndAngleLossDb =
    settings.windowLossDb + getEffectiveAngleLossDb(settings)

  if (scenario === 'withWindow') {
    return -windowAndAngleLossDb
  }

  return (
    -windowAndAngleLossDb +
    settings.namigateGainDb +
    calculateAreaGainDb(settings.namigateWidthCm, settings.namigateHeightCm)
  )
}

function calculateRsrpDbm(
  settings: Settings,
  scenario: ScenarioKey,
  indoorDistanceM = settings.indoorDistanceM,
) {
  const fsplDb = calculateFsplDb(settings.frequencyMHz, settings.outdoorDistanceM)
  const indoorLossDb = calculateIndoorLossDb(
    indoorDistanceM,
    settings.indoorPathLossExponent,
  )

  return (
    settings.eirpDbm +
    settings.groundReflectionDb -
    fsplDb -
    indoorLossDb +
    getScenarioAdjustmentDb(settings, scenario)
  )
}

function calculateMaxReachM(settings: Settings, scenario: ScenarioKey) {
  const fsplDb = calculateFsplDb(settings.frequencyMHz, settings.outdoorDistanceM)
  const beforeIndoorLossDb =
    settings.eirpDbm +
    settings.groundReflectionDb -
    fsplDb +
    getScenarioAdjustmentDb(settings, scenario)

  if (beforeIndoorLossDb < settings.connectionThresholdDbm) {
    return 0
  }

  const exponent = Math.max(settings.indoorPathLossExponent, 0.1)
  return Math.pow(10, (beforeIndoorLossDb - settings.connectionThresholdDbm) / (10 * exponent))
}

function getIndoorPointDistanceM(
  roomWidthM: number,
  roomDepthM: number,
  column: number,
  row: number,
) {
  const x = ((column + 0.5) / HEATMAP_COLUMNS) * roomWidthM
  const y = ((row + 0.5) / HEATMAP_ROWS) * roomDepthM
  const windowCenterX = roomWidthM / 2
  return Math.max(Math.hypot(x - windowCenterX, y), 1)
}

function buildHeatmap(settings: Settings, scenario: ScenarioKey): HeatmapData {
  const roomWidthM = Math.max(settings.roomWidthM, 1)
  const roomDepthM = Math.max(settings.roomDepthM, 1)
  const cellAreaM2 = (roomWidthM * roomDepthM) / (HEATMAP_COLUMNS * HEATMAP_ROWS)
  let connectedCells = 0

  const cells = Array.from({ length: HEATMAP_ROWS }, (_, row) =>
    Array.from({ length: HEATMAP_COLUMNS }, (_, column) => {
      const distanceM = getIndoorPointDistanceM(roomWidthM, roomDepthM, column, row)
      const rsrpDbm = calculateRsrpDbm(settings, scenario, distanceM)
      const isConnected = rsrpDbm >= settings.connectionThresholdDbm

      if (isConnected) {
        connectedCells += 1
      }

      return {
        id: `${scenario}-${row}-${column}`,
        rsrpDbm,
        isConnected,
      }
    }),
  ).flat()

  return {
    cells,
    connectedAreaM2: connectedCells * cellAreaM2,
  }
}

function getHeatColor(rsrpDbm: number, thresholdDbm: number) {
  const delta = rsrpDbm - thresholdDbm

  if (delta >= 18) {
    return '#0f7f5a'
  }
  if (delta >= 8) {
    return MAIN_COLOR
  }
  if (delta >= 0) {
    return '#58a8d3'
  }
  if (delta >= -8) {
    return '#e3b341'
  }
  if (delta >= -18) {
    return '#df7a52'
  }
  return '#ba3b35'
}

function formatDb(value: number) {
  return `${numberFormatter.format(value)} dB`
}

function formatDbm(value: number) {
  return `${numberFormatter.format(value)} dBm`
}

function formatMeters(value: number) {
  if (value >= 999) {
    return '>999 m'
  }

  return `${numberFormatter.format(value)} m`
}

function formatArea(value: number) {
  return `${numberFormatter.format(value)} m²`
}

function formatMultiplier(value: number) {
  if (value >= 1000) {
    return `${compactNumberFormatter.format(value)}倍`
  }

  return `${numberFormatter.format(value)}倍`
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: NumberInputProps) {
  return (
    <label className="control">
      <span>{label}</span>
      <div className="input-row">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(parseNumber(event.target.value, value))}
        />
        {unit ? <small>{unit}</small> : null}
      </div>
    </label>
  )
}

function HeatmapPlan({ settings, scenario, heatmap }: HeatmapPlanProps) {
  const roomWidthM = Math.max(settings.roomWidthM, 1)
  const roomDepthM = Math.max(settings.roomDepthM, 1)
  const safeAngle = clamp(settings.incidentAngleDeg, 15, 90)
  const transmitterXPct = clamp(
    50 - Math.tan(((90 - safeAngle) * Math.PI) / 180) * 22,
    10,
    90,
  )
  const receiverYPct = clamp((settings.indoorDistanceM / roomDepthM) * 100, 9, 92)
  const windowWidthPct =
    scenario.key === 'noWindow'
      ? clamp((settings.windowWidthM / roomWidthM) * 100, 16, 88)
      : clamp((settings.windowWidthM / roomWidthM) * 100, 18, 88)
  const windowLeftPct = 50 - windowWidthPct / 2
  const namigateWidthM = Math.max(settings.namigateWidthCm / 100, 0.01)
  const namigateWidthPct = clamp(
    (namigateWidthM / roomWidthM) * 100,
    5,
    Math.max(windowWidthPct, 5),
  )
  const namigateLeftPct = 50 - namigateWidthPct / 2
  const hasNamigate = scenario.key === 'withNamigate'

  return (
    <div className="heatmap-plan">
      <div className="heatmap-outdoor" aria-hidden="true">
        <span
          className="heatmap-device heatmap-transmitter"
          style={{ left: `${transmitterXPct}%` }}
        >
          送信機
        </span>
        <svg className="heatmap-outdoor-ray" viewBox="0 0 100 56">
          <line
            x1={transmitterXPct}
            y1="18"
            x2="50"
            y2="56"
            stroke={scenario.color}
            strokeLinecap="round"
            strokeWidth="2.8"
          />
        </svg>
        <span className="heatmap-outdoor-distance">
          屋外 {formatMeters(settings.outdoorDistanceM)}
        </span>
      </div>

      <div
        className="heatmap-room"
        aria-label={`${scenario.label}の室内ヒートマップ上面図`}
      >
        <div
          className="heatmap"
          style={{
            gridTemplateColumns: `repeat(${HEATMAP_COLUMNS}, minmax(0, 1fr))`,
          }}
        >
          {heatmap.cells.map((cell) => (
            <span
              className={cell.isConnected ? 'heat-cell' : 'heat-cell is-low'}
              key={cell.id}
              title={`${formatDbm(cell.rsrpDbm)} / ${
                cell.isConnected ? '接続可能' : 'しきい値未満'
              }`}
              style={{
                backgroundColor: getHeatColor(
                  cell.rsrpDbm,
                  settings.connectionThresholdDbm,
                ),
              }}
            />
          ))}
        </div>

        <svg className="heatmap-overlay" viewBox="0 0 100 100" aria-hidden="true">
          <line className="heatmap-wall-line" x1="0" y1="0" x2="100" y2="0" />
          <rect
            className={
              scenario.key === 'noWindow'
                ? 'heatmap-window is-reference'
                : 'heatmap-window'
            }
            x={windowLeftPct}
            y="-1.8"
            width={windowWidthPct}
            height="4.8"
            rx="1.4"
          />
          {hasNamigate ? (
            <rect
              className="heatmap-namigate"
              x={namigateLeftPct}
              y="-3.2"
              width={namigateWidthPct}
              height="7.6"
              rx="1.6"
            />
          ) : null}
          <path
            className="heatmap-indoor-ray"
            d={`M 50 0 L 50 ${receiverYPct}`}
            stroke={scenario.color}
          />
          <circle
            className="heatmap-receiver-dot"
            cx="50"
            cy={receiverYPct}
            r="4"
          />
          <circle
            className="heatmap-receiver-core"
            cx="50"
            cy={receiverYPct}
            r="1.6"
          />
          <text className="heatmap-overlay-label" x="51.8" y={receiverYPct - 3}>
            受信機
          </text>
          <text className="heatmap-overlay-label" x={windowLeftPct} y="8.5">
            窓 {numberFormatter.format(settings.windowWidthM)}m
          </text>
          {hasNamigate ? (
            <text className="heatmap-overlay-accent" x={namigateLeftPct} y="15">
              ナミゲート {numberFormatter.format(settings.namigateWidthCm)}cm
            </text>
          ) : null}
        </svg>
      </div>

      <div className="heatmap-plan-legend">
        <span>窓幅 {numberFormatter.format(settings.windowWidthM)}m</span>
        <span>窓高 {numberFormatter.format(settings.windowHeightM)}m</span>
        <span>室内 {formatMeters(settings.indoorDistanceM)}</span>
        {hasNamigate ? (
          <span>ナミゲート {numberFormatter.format(settings.namigateWidthCm)}cm幅</span>
        ) : (
          <span>ナミゲートなし</span>
        )}
      </div>
    </div>
  )
}

function PositionDiagram({ settings, angleLossDb, areaGainDb }: PositionDiagramProps) {
  const roomX = 300
  const roomY = 48
  const roomWidth = 300
  const roomHeight = 202
  const windowX = roomX
  const windowCenterY = roomY + roomHeight / 2
  const safeAngle = clamp(settings.incidentAngleDeg, 15, 90)
  const incidentOffset = Math.tan(((90 - safeAngle) * Math.PI) / 180) * 92
  const transmitterX = 70
  const transmitterY = clamp(windowCenterY - incidentOffset, 34, 266)
  const receiverX =
    roomX +
    34 +
    clamp(settings.indoorDistanceM / Math.max(settings.roomDepthM, 1), 0, 1) *
      (roomWidth - 82)
  const receiverY = clamp(
    windowCenterY + (windowCenterY - transmitterY) * 0.28,
    roomY + 34,
    roomY + roomHeight - 34,
  )
  const normalStartX = windowX - 90
  const windowLabel =
    WINDOW_PRESETS.find((preset) => preset.id === settings.windowPresetId)?.label ??
    '任意'
  const windowPatchHeight = clamp(settings.windowHeightM * 44, 46, 132)
  const namigatePatchHeight = clamp(
    (settings.namigateHeightCm / 100 / Math.max(settings.windowHeightM, 0.2)) *
      windowPatchHeight,
    22,
    windowPatchHeight,
  )

  return (
    <div className="position-layout">
      <svg
        className="position-diagram"
        role="img"
        aria-label="送信機、窓、受信機の位置関係"
        viewBox="0 0 640 300"
      >
        <defs>
          <marker
            id="arrowhead"
            markerHeight="7"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="3.5"
          >
            <path d="M0,0 L8,3.5 L0,7 Z" fill="#0071BD" />
          </marker>
          <marker
            id="arrowhead-muted"
            markerHeight="7"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="3.5"
          >
            <path d="M0,0 L8,3.5 L0,7 Z" fill="#6f7f8d" />
          </marker>
        </defs>

        <rect className="diagram-outdoor" x="26" y="48" width="236" height="202" />
        <rect className="diagram-room" x={roomX} y={roomY} width={roomWidth} height={roomHeight} />
        <text className="diagram-zone-label" x="40" y="70">
          屋外
        </text>
        <text className="diagram-zone-label" x={roomX + 16} y="70">
          室内
        </text>

        <line className="diagram-wall" x1={windowX} y1={roomY} x2={windowX} y2={roomY + roomHeight} />
        <rect
          className="diagram-window"
          x={windowX - 8}
          y={windowCenterY - windowPatchHeight / 2}
          width="16"
          height={windowPatchHeight}
          rx="4"
        />
        <rect
          className="diagram-namigate"
          x={windowX - 13}
          y={windowCenterY - namigatePatchHeight / 2}
          width="26"
          height={namigatePatchHeight}
          rx="5"
        />

        <line
          className="diagram-normal"
          x1={normalStartX}
          y1={windowCenterY}
          x2={windowX}
          y2={windowCenterY}
        />
        <path
          className="diagram-ray"
          d={`M ${transmitterX} ${transmitterY} L ${windowX} ${windowCenterY} L ${receiverX} ${receiverY}`}
          markerEnd="url(#arrowhead)"
        />
        <line
          className="diagram-distance"
          x1={transmitterX}
          y1="268"
          x2={windowX}
          y2="268"
          markerEnd="url(#arrowhead-muted)"
        />
        <line
          className="diagram-distance"
          x1={windowX}
          y1="268"
          x2={receiverX}
          y2="268"
          markerEnd="url(#arrowhead-muted)"
        />

        <circle className="diagram-transmitter" cx={transmitterX} cy={transmitterY} r="15" />
        <path
          className="diagram-antenna"
          d={`M ${transmitterX - 18} ${transmitterY - 18} Q ${transmitterX - 34} ${transmitterY} ${transmitterX - 18} ${transmitterY + 18}`}
        />
        <path
          className="diagram-antenna"
          d={`M ${transmitterX - 30} ${transmitterY - 30} Q ${transmitterX - 54} ${transmitterY} ${transmitterX - 30} ${transmitterY + 30}`}
        />
        <circle className="diagram-receiver" cx={receiverX} cy={receiverY} r="14" />
        <circle className="diagram-receiver-core" cx={receiverX} cy={receiverY} r="5" />

        <path
          className="diagram-angle"
          d={`M ${windowX - 58} ${windowCenterY} Q ${windowX - 44} ${
            windowCenterY - 25
          } ${windowX - 18} ${windowCenterY - 36}`}
        />

        <text className="diagram-label" x={transmitterX - 48} y={transmitterY - 34}>
          送信機
        </text>
        <text className="diagram-label" x={receiverX - 28} y={receiverY - 24}>
          受信機
        </text>
        <text className="diagram-label" x={windowX - 62} y={windowCenterY - 58}>
          窓面
        </text>
        <text className="diagram-accent-label" x={windowX + 18} y={windowCenterY + 5}>
          ナミゲート
        </text>
        <text className="diagram-muted-label" x="150" y="286">
          屋外距離 {formatMeters(settings.outdoorDistanceM)}
        </text>
        <text className="diagram-muted-label" x={windowX + 42} y="286">
          室内距離 {formatMeters(settings.indoorDistanceM)}
        </text>
        <text className="diagram-muted-label" x={windowX - 95} y={windowCenterY - 18}>
          入射角 {numberFormatter.format(safeAngle)}°
        </text>
      </svg>

      <div className="position-facts">
        <div>
          <span>窓種別</span>
          <strong>{windowLabel}</strong>
          <small>
            {numberFormatter.format(settings.windowWidthM)}×
            {numberFormatter.format(settings.windowHeightM)}m / 損失{' '}
            {formatDb(settings.windowLossDb)} / 入射角損失 {formatDb(angleLossDb)}
          </small>
        </div>
        <div>
          <span>ナミゲートサイズ</span>
          <strong>
            {numberFormatter.format(settings.namigateWidthCm)}×
            {numberFormatter.format(settings.namigateHeightCm)} cm
          </strong>
          <small>面積補正 {formatDb(areaGainDb)}</small>
        </div>
        <div>
          <span>部屋寸法</span>
          <strong>
            {numberFormatter.format(settings.roomWidthM)}×
            {numberFormatter.format(settings.roomDepthM)} m
          </strong>
          <small>窓中央から室内側へ到達距離を評価</small>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const currentFsplDb = useMemo(
    () => calculateFsplDb(settings.frequencyMHz, settings.outdoorDistanceM),
    [settings.frequencyMHz, settings.outdoorDistanceM],
  )

  const currentIndoorLossDb = useMemo(
    () =>
      calculateIndoorLossDb(
        settings.indoorDistanceM,
        settings.indoorPathLossExponent,
      ),
    [settings.indoorDistanceM, settings.indoorPathLossExponent],
  )

  const areaGainDb = useMemo(
    () => calculateAreaGainDb(settings.namigateWidthCm, settings.namigateHeightCm),
    [settings.namigateWidthCm, settings.namigateHeightCm],
  )

  const angleLossDb = useMemo(
    () => getEffectiveAngleLossDb(settings),
    [settings],
  )

  const heatmaps = useMemo(
    () =>
      SCENARIOS.reduce(
        (accumulator, scenario) => ({
          ...accumulator,
          [scenario.key]: buildHeatmap(settings, scenario.key),
        }),
        {} as Record<ScenarioKey, ReturnType<typeof buildHeatmap>>,
      ),
    [settings],
  )

  const scenarioResults = useMemo<ScenarioResult[]>(
    () =>
      SCENARIOS.map((scenario) => ({
        ...scenario,
        rsrpDbm: calculateRsrpDbm(settings, scenario.key),
        connectedAreaM2: heatmaps[scenario.key].connectedAreaM2,
        maxReachM: calculateMaxReachM(settings, scenario.key),
      })),
    [heatmaps, settings],
  )

  const noWindowRsrp = scenarioResults[0].rsrpDbm
  const withWindowRsrp = scenarioResults[1].rsrpDbm
  const withNamigateRsrp = scenarioResults[2].rsrpDbm
  const totalNamigateGainDb = settings.namigateGainDb + areaGainDb
  const powerMultiplier = Math.pow(10, totalNamigateGainDb / 10)
  const fieldMultiplier = Math.pow(10, totalNamigateGainDb / 20)
  const windowGapDb = Math.max(noWindowRsrp - withWindowRsrp, 0)
  const recoveredGapDb = Math.max(
    Math.min(withNamigateRsrp - withWindowRsrp, windowGapDb),
    0,
  )
  const recoveryRate = windowGapDb <= 0 ? 100 : (recoveredGapDb / windowGapDb) * 100
  const roomAreaM2 = Math.max(settings.roomWidthM, 1) * Math.max(settings.roomDepthM, 1)

  const comparisonData = useMemo(
    () =>
      scenarioResults.map((scenario) => ({
        name: scenario.label,
        rsrp: Number(scenario.rsrpDbm.toFixed(1)),
      })),
    [scenarioResults],
  )

  const distanceData = useMemo(() => {
    const maxDistanceM = Math.max(settings.roomDepthM, settings.indoorDistanceM, 12)
    return Array.from({ length: 28 }, (_, index) => {
      const distanceM = 1 + (index / 27) * (maxDistanceM - 1)

      return {
        distance: Number(distanceM.toFixed(1)),
        '窓なし': Number(calculateRsrpDbm(settings, 'noWindow', distanceM).toFixed(1)),
        '窓あり': Number(calculateRsrpDbm(settings, 'withWindow', distanceM).toFixed(1)),
        '窓あり＋ナミゲート': Number(
          calculateRsrpDbm(settings, 'withNamigate', distanceM).toFixed(1),
        ),
      }
    })
  }, [settings])

  const angleData = useMemo(
    () =>
      ANGLE_CHART_POINTS.map((angleDeg) => {
        const lossDb =
          settings.windowPresetId === 'none' ? 0 : calculateAngleLossDb(angleDeg)
        const gapDb = settings.windowLossDb + lossDb
        const filledDb = Math.max(Math.min(totalNamigateGainDb, gapDb), 0)

        return {
          angle: `${angleDeg}°`,
          '回復dB': Number(filledDb.toFixed(1)),
          '窓との差dB': Number(gapDb.toFixed(1)),
        }
      }),
    [settings.windowLossDb, settings.windowPresetId, totalNamigateGainDb],
  )

  const areaData = useMemo(
    () =>
      AREA_CHART_SIZES_CM.map((sizeCm) => {
        const candidateAreaGainDb = calculateAreaGainDb(sizeCm, sizeCm)
        const candidateTotalGainDb = settings.namigateGainDb + candidateAreaGainDb
        const filledDb = Math.max(Math.min(candidateTotalGainDb, windowGapDb), 0)

        return {
          size: `${sizeCm}×${sizeCm}`,
          '総改善dB': Number(candidateTotalGainDb.toFixed(1)),
          '回復dB': Number(filledDb.toFixed(1)),
        }
      }),
    [settings.namigateGainDb, windowGapDb],
  )

  const handleWindowPresetChange = (presetId: WindowPresetId) => {
    const preset = WINDOW_PRESETS.find((item) => item.id === presetId)
    setSettings((current) => ({
      ...current,
      windowPresetId: presetId,
      windowLossDb: preset?.lossDb ?? current.windowLossDb,
    }))
  }

  const handleNamigatePresetChange = (presetId: NamigatePresetId) => {
    const preset = NAMIGATE_PRESETS.find((item) => item.id === presetId)
    setSettings((current) => ({
      ...current,
      namigatePresetId: presetId,
      namigateGainDb: preset?.gainDb ?? current.namigateGainDb,
    }))
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local 5G Window Link MVP</p>
          <h1>ローカル5G 窓面電波改善シミュレータ</h1>
        </div>
        <div className="header-summary">
          <span>基準しきい値</span>
          <strong>{formatDbm(settings.connectionThresholdDbm)}</strong>
        </div>
      </header>

      <section className="layout-grid">
        <aside className="control-panel">
          <div className="panel-heading">
            <h2>入力条件</h2>
          </div>

          <div className="control-group">
            <h3>屋外電波</h3>
            <NumberInput
              label="周波数"
              value={settings.frequencyMHz}
              min={1}
              step={10}
              unit="MHz"
              onChange={(value) => updateSetting('frequencyMHz', value)}
            />
            <NumberInput
              label="EIRP"
              value={settings.eirpDbm}
              step={1}
              unit="dBm"
              onChange={(value) => updateSetting('eirpDbm', value)}
            />
            <NumberInput
              label="屋外距離"
              value={settings.outdoorDistanceM}
              min={1}
              step={1}
              unit="m"
              onChange={(value) => updateSetting('outdoorDistanceM', value)}
            />
            <NumberInput
              label="地面反射補正"
              value={settings.groundReflectionDb}
              step={0.5}
              unit="dB"
              onChange={(value) => updateSetting('groundReflectionDb', value)}
            />
          </div>

          <div className="control-group">
            <h3>窓条件</h3>
            <label className="control">
              <span>窓種別</span>
              <select
                value={settings.windowPresetId}
                onChange={(event) =>
                  handleWindowPresetChange(event.target.value as WindowPresetId)
                }
              >
                {WINDOW_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberInput
              label="窓損失"
              value={settings.windowLossDb}
              min={0}
              step={1}
              unit="dB"
              onChange={(value) => {
                updateSetting('windowPresetId', 'custom')
                updateSetting('windowLossDb', value)
              }}
            />
            <NumberInput
              label="窓幅"
              value={settings.windowWidthM}
              min={0.2}
              step={0.1}
              unit="m"
              onChange={(value) => updateSetting('windowWidthM', value)}
            />
            <NumberInput
              label="窓高さ"
              value={settings.windowHeightM}
              min={0.2}
              step={0.1}
              unit="m"
              onChange={(value) => updateSetting('windowHeightM', value)}
            />
            <NumberInput
              label="入射角"
              value={settings.incidentAngleDeg}
              min={15}
              max={90}
              step={1}
              unit="°"
              onChange={(value) => updateSetting('incidentAngleDeg', value)}
            />
          </div>

          <div className="control-group">
            <h3>室内条件</h3>
            <NumberInput
              label="部屋幅"
              value={settings.roomWidthM}
              min={1}
              step={0.5}
              unit="m"
              onChange={(value) => updateSetting('roomWidthM', value)}
            />
            <NumberInput
              label="部屋奥行"
              value={settings.roomDepthM}
              min={1}
              step={0.5}
              unit="m"
              onChange={(value) => updateSetting('roomDepthM', value)}
            />
            <NumberInput
              label="室内距離"
              value={settings.indoorDistanceM}
              min={1}
              step={0.5}
              unit="m"
              onChange={(value) => updateSetting('indoorDistanceM', value)}
            />
            <NumberInput
              label="屋内伝搬指数"
              value={settings.indoorPathLossExponent}
              min={0.5}
              step={0.1}
              onChange={(value) => updateSetting('indoorPathLossExponent', value)}
            />
          </div>

          <div className="control-group">
            <h3>ナミゲート</h3>
            <label className="control">
              <span>改善量プリセット</span>
              <select
                value={settings.namigatePresetId}
                onChange={(event) =>
                  handleNamigatePresetChange(event.target.value as NamigatePresetId)
                }
              >
                {NAMIGATE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberInput
              label="ナミゲート改善量"
              value={settings.namigateGainDb}
              step={1}
              unit="dB"
              onChange={(value) => {
                updateSetting('namigatePresetId', 'custom')
                updateSetting('namigateGainDb', value)
              }}
            />
            <NumberInput
              label="サイズ幅"
              value={settings.namigateWidthCm}
              min={1}
              step={1}
              unit="cm"
              onChange={(value) => updateSetting('namigateWidthCm', value)}
            />
            <NumberInput
              label="サイズ高さ"
              value={settings.namigateHeightCm}
              min={1}
              step={1}
              unit="cm"
              onChange={(value) => updateSetting('namigateHeightCm', value)}
            />
            <NumberInput
              label="接続しきい値"
              value={settings.connectionThresholdDbm}
              step={1}
              unit="dBm"
              onChange={(value) => updateSetting('connectionThresholdDbm', value)}
            />
          </div>
        </aside>

        <section className="results-panel">
          <section className="rsrp-grid" aria-label="3状態の推定RSRP">
            {scenarioResults.map((scenario) => (
              <article
                className="rsrp-card"
                key={scenario.key}
                style={{ borderColor: scenario.color }}
              >
                <span>{scenario.label}</span>
                <strong>{formatDbm(scenario.rsrpDbm)}</strong>
                <small>
                  {scenario.rsrpDbm >= settings.connectionThresholdDbm
                    ? '接続可能'
                    : 'しきい値未満'}
                </small>
              </article>
            ))}
          </section>

          <section className="metric-grid">
            <article className="metric-card">
              <span>窓損失</span>
              <strong>{formatDb(settings.windowLossDb)}</strong>
              <small>入射角損失 {formatDb(angleLossDb)}</small>
            </article>
            <article className="metric-card">
              <span>ナミゲート総改善量</span>
              <strong>{formatDb(totalNamigateGainDb)}</strong>
              <small>面積補正 {formatDb(areaGainDb)}</small>
            </article>
            <article className="metric-card">
              <span>電力倍率</span>
              <strong>{formatMultiplier(powerMultiplier)}</strong>
              <small>窓あり比</small>
            </article>
            <article className="metric-card">
              <span>電界倍率</span>
              <strong>{formatMultiplier(fieldMultiplier)}</strong>
              <small>窓あり比</small>
            </article>
            <article className="metric-card">
              <span>窓なし状態への回復率</span>
              <strong>{numberFormatter.format(clamp(recoveryRate, 0, 100))}%</strong>
              <small>{formatDb(recoveredGapDb)} 回復</small>
            </article>
            <article className="metric-card">
              <span>計算損失</span>
              <strong>{formatDb(currentFsplDb)}</strong>
              <small>室内距離損失 {formatDb(currentIndoorLossDb)}</small>
            </article>
          </section>

          <section className="position-section">
            <div className="section-heading">
              <h2>送信機・窓・受信機の位置関係</h2>
              <span>入力条件に連動した簡易模式図</span>
            </div>
            <PositionDiagram
              settings={settings}
              angleLossDb={angleLossDb}
              areaGainDb={areaGainDb}
            />
          </section>

          <section className="coverage-section">
            <div className="section-heading">
              <h2>接続可能面積と最大到達距離</h2>
              <span>部屋面積 {formatArea(roomAreaM2)}</span>
            </div>
            <div className="coverage-grid">
              {scenarioResults.map((scenario) => (
                <article className="coverage-card" key={scenario.key}>
                  <span style={{ color: scenario.color }}>{scenario.label}</span>
                  <strong>{formatArea(scenario.connectedAreaM2)}</strong>
                  <small>最大到達距離 {formatMeters(scenario.maxReachM)}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="heatmap-section">
            <div className="section-heading">
              <h2>室内ヒートマップ</h2>
              <span>RSRP / しきい値 {formatDbm(settings.connectionThresholdDbm)}</span>
            </div>
            <div className="heatmap-grid">
              {SCENARIOS.map((scenario) => (
                <article className="heatmap-card" key={scenario.key}>
                  <div className="heatmap-title">
                    <strong>{scenario.label}</strong>
                    <span>{formatArea(heatmaps[scenario.key].connectedAreaM2)}</span>
                  </div>
                  <HeatmapPlan
                    settings={settings}
                    scenario={scenario}
                    heatmap={heatmaps[scenario.key]}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="chart-grid">
            <article className="chart-card">
              <h2>3状態比較</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis unit=" dBm" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${value} dBm`} />
                  <ReferenceLine
                    y={settings.connectionThresholdDbm}
                    stroke="#333"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="rsrp" fill={MAIN_COLOR} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>

            <article className="chart-card">
              <h2>距離別RSRP</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={distanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="distance"
                    unit="m"
                    tick={{ fontSize: 12 }}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis unit=" dBm" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${value} dBm`} />
                  <Legend />
                  <ReferenceLine
                    y={settings.connectionThresholdDbm}
                    stroke="#333"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="窓なし"
                    stroke="#15845d"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="窓あり"
                    stroke="#c96c34"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="窓あり＋ナミゲート"
                    stroke={MAIN_COLOR}
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </article>

            <article className="chart-card">
              <h2>入射角別改善量</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={angleData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="angle" tick={{ fontSize: 12 }} />
                  <YAxis unit=" dB" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${value} dB`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="回復dB"
                    stroke={MAIN_COLOR}
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="窓との差dB"
                    stroke="#7c8794"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </article>

            <article className="chart-card">
              <h2>ナミゲート面積別改善量</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={areaData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="size" tick={{ fontSize: 12 }} />
                  <YAxis unit=" dB" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${value} dB`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="総改善dB"
                    stroke={MAIN_COLOR}
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="回復dB"
                    stroke="#15845d"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </article>
          </section>
        </section>
      </section>

      <footer className="app-footer">
        これは厳密な電磁界解析ではなく、営業・技術検討用の簡易シミュレータである
      </footer>
    </main>
  )
}

export default App
