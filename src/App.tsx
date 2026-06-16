import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
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
type EirpMode = 'direct' | 'detailed'
type ScenarioKey = 'noWindow' | 'withWindow' | 'withNamigate'

type Settings = {
  frequencyMHz: number
  eirpMode: EirpMode
  eirpDbm: number
  txPowerDbm: number
  txAntennaGainDbi: number
  txCableLossDb: number
  txOtherLossDb: number
  rxAntennaGainDbi: number
  rxCableLossDb: number
  rxBodyLossDb: number
  polarizationLossDb: number
  fadeMarginDb: number
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
  namigateAreaGainScale: number
  namigateAreaGainLimitDb: number
  namigateAngleRecoveryPercent: number
  namigateInstallationEfficiencyPercent: number
  namigateAdditionalLossDb: number
  namigateMaxTotalGainDb: number
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

type MeasuredRsrpValues = Record<ScenarioKey, string>

type MeasuredComparison = ScenarioResult & {
  measuredRsrpDbm: number | null
  residualDb: number | null
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
  eirpMode: 'direct',
  eirpDbm: 43,
  txPowerDbm: 30,
  txAntennaGainDbi: 15,
  txCableLossDb: 1,
  txOtherLossDb: 1,
  rxAntennaGainDbi: 0,
  rxCableLossDb: 0,
  rxBodyLossDb: 0,
  polarizationLossDb: 0,
  fadeMarginDb: 0,
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
  namigateAreaGainScale: 1,
  namigateAreaGainLimitDb: 10,
  namigateAngleRecoveryPercent: 0,
  namigateInstallationEfficiencyPercent: 100,
  namigateAdditionalLossDb: 0,
  namigateMaxTotalGainDb: 40,
  connectionThresholdDbm: CONNECTED_THRESHOLD_DEFAULT,
}

const DEFAULT_MEASURED_RSRP: MeasuredRsrpValues = {
  noWindow: '',
  withWindow: '',
  withNamigate: '',
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

function parseOptionalNumber(value: string) {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null
}

function formatNumberInputValue(value: number) {
  return Number.isFinite(value) ? String(value) : ''
}

function isValidNumberInput(value: string) {
  return value.trim() !== '' && Number.isFinite(Number(value))
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

function calculateRawAreaGainDb(
  widthCm: number,
  heightCm: number,
  scale = 1,
  limitDb = 10,
) {
  const areaCm2 = Math.max(widthCm * heightCm, 1)
  const areaMultiplier = areaCm2 / 100
  return Math.min(10 * log10(areaMultiplier) * Math.max(scale, 0), Math.max(limitDb, 0))
}

function calculateDetailedEirpDbm(settings: Settings) {
  return (
    settings.txPowerDbm +
    settings.txAntennaGainDbi -
    settings.txCableLossDb -
    settings.txOtherLossDb
  )
}

function calculateEffectiveEirpDbm(settings: Settings) {
  return settings.eirpMode === 'direct'
    ? settings.eirpDbm
    : calculateDetailedEirpDbm(settings)
}

function calculateReceiverAdjustmentDb(settings: Settings) {
  return (
    settings.rxAntennaGainDbi -
    settings.rxCableLossDb -
    settings.rxBodyLossDb -
    settings.polarizationLossDb -
    settings.fadeMarginDb
  )
}

function calculateAreaGainDb(settings: Settings, widthCm = settings.namigateWidthCm, heightCm = settings.namigateHeightCm) {
  return calculateRawAreaGainDb(
    widthCm,
    heightCm,
    settings.namigateAreaGainScale,
    settings.namigateAreaGainLimitDb,
  )
}

function calculateNamigateAngleRecoveryDb(
  settings: Settings,
  angleDeg = settings.incidentAngleDeg,
) {
  if (settings.windowPresetId === 'none') {
    return 0
  }

  return (
    calculateAngleLossDb(angleDeg) *
    (Math.max(settings.namigateAngleRecoveryPercent, 0) / 100)
  )
}

function calculateNamigateTotalGainDb(
  settings: Settings,
  widthCm = settings.namigateWidthCm,
  heightCm = settings.namigateHeightCm,
  angleDeg = settings.incidentAngleDeg,
) {
  const rawGainDb =
    settings.namigateGainDb +
    calculateAreaGainDb(settings, widthCm, heightCm) +
    calculateNamigateAngleRecoveryDb(settings, angleDeg)
  const efficiency = Math.max(settings.namigateInstallationEfficiencyPercent, 0) / 100
  const effectiveGainDb = rawGainDb * efficiency - settings.namigateAdditionalLossDb

  return Math.min(
    Math.max(effectiveGainDb, 0),
    Math.max(settings.namigateMaxTotalGainDb, 0),
  )
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
    calculateNamigateTotalGainDb(settings)
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
    calculateEffectiveEirpDbm(settings) +
    calculateReceiverAdjustmentDb(settings) +
    settings.groundReflectionDb -
    fsplDb -
    indoorLossDb +
    getScenarioAdjustmentDb(settings, scenario)
  )
}

function calculateMaxReachM(settings: Settings, scenario: ScenarioKey) {
  const fsplDb = calculateFsplDb(settings.frequencyMHz, settings.outdoorDistanceM)
  const beforeIndoorLossDb =
    calculateEffectiveEirpDbm(settings) +
    calculateReceiverAdjustmentDb(settings) +
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

function formatOptionalDbm(value: number | null) {
  return value === null ? '未入力' : formatDbm(value)
}

function formatOptionalDb(value: number | null) {
  return value === null ? '未入力' : formatDb(value)
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

function describeResidual(residualDb: number | null) {
  if (residualDb === null) {
    return '未入力'
  }

  if (Math.abs(residualDb) < 1) {
    return '推定と近い'
  }

  return residualDb > 0 ? '実測が高い' : '実測が低い'
}

function buildAiAnalysisText({
  settings,
  scenarioResults,
  measuredComparisons,
  angleLossDb,
  areaGainDb,
  totalNamigateGainDb,
  recoveryRate,
  measuredAverageResidualDb,
  measuredWindowLossDb,
  measuredNamigateGainDb,
}: {
  settings: Settings
  scenarioResults: ScenarioResult[]
  measuredComparisons: MeasuredComparison[]
  angleLossDb: number
  areaGainDb: number
  totalNamigateGainDb: number
  recoveryRate: number
  measuredAverageResidualDb: number | null
  measuredWindowLossDb: number | null
  measuredNamigateGainDb: number | null
}) {
  const windowLabel =
    WINDOW_PRESETS.find((preset) => preset.id === settings.windowPresetId)?.label ??
    '任意'
  const namigateLabel =
    NAMIGATE_PRESETS.find((preset) => preset.id === settings.namigatePresetId)?.label ??
    '任意'
  const detailedEirpDbm = calculateDetailedEirpDbm(settings)
  const effectiveEirpDbm = calculateEffectiveEirpDbm(settings)
  const receiverAdjustmentDb = calculateReceiverAdjustmentDb(settings)
  const angleRecoveryDb = calculateNamigateAngleRecoveryDb(settings)
  const estimatedWindowLossDb =
    scenarioResults[0].rsrpDbm - scenarioResults[1].rsrpDbm
  const estimatedNamigateGainDb =
    scenarioResults[2].rsrpDbm - scenarioResults[1].rsrpDbm
  const rows = measuredComparisons
    .map(
      (comparison) =>
        `| ${comparison.label} | ${formatDbm(comparison.rsrpDbm)} | ${formatOptionalDbm(
          comparison.measuredRsrpDbm,
        )} | ${formatOptionalDb(comparison.residualDb)} | ${describeResidual(
          comparison.residualDb,
        )} |`,
    )
    .join('\n')

  return [
    '# ローカル5G 窓面電波改善シミュレータ 実測比較データ',
    '',
    '## AIへの依頼',
    '以下の推定値と実測値の差分を分析し、モデル誤差の傾向、窓損失・ナミゲート改善量の妥当性、追加で確認すべき測定条件を整理してください。',
    '',
    '## 入力条件',
    `- 周波数: ${numberFormatter.format(settings.frequencyMHz)} MHz`,
    `- EIRP計算方式: ${settings.eirpMode === 'direct' ? '直接入力' : '無線機詳細から計算'}`,
    `- 実効EIRP: ${formatDbm(effectiveEirpDbm)}`,
    `- EIRP直接入力: ${formatDbm(settings.eirpDbm)}`,
    `- 詳細EIRP: ${formatDbm(detailedEirpDbm)} = 送信出力 ${formatDbm(
      settings.txPowerDbm,
    )} + 送信アンテナ利得 ${formatDb(settings.txAntennaGainDbi)} - 送信給電損失 ${formatDb(
      settings.txCableLossDb,
    )} - その他送信損失 ${formatDb(settings.txOtherLossDb)}`,
    `- 受信系補正: ${formatDb(receiverAdjustmentDb)} = 受信アンテナ利得 ${formatDb(
      settings.rxAntennaGainDbi,
    )} - 受信給電損失 ${formatDb(settings.rxCableLossDb)} - 受信機内部損失 ${formatDb(
      settings.rxBodyLossDb,
    )} - 偏波不整合損失 ${formatDb(settings.polarizationLossDb)} - フェージングマージン ${formatDb(
      settings.fadeMarginDb,
    )}`,
    `- 屋外距離: ${formatMeters(settings.outdoorDistanceM)}`,
    `- 地面反射補正: ${formatDb(settings.groundReflectionDb)}`,
    `- 窓種別: ${windowLabel}`,
    `- 窓損失: ${formatDb(settings.windowLossDb)}`,
    `- 窓サイズ: ${numberFormatter.format(settings.windowWidthM)} x ${numberFormatter.format(
      settings.windowHeightM,
    )} m`,
    `- 入射角: ${numberFormatter.format(settings.incidentAngleDeg)} deg`,
    `- 入射角損失: ${formatDb(angleLossDb)}`,
    `- 部屋サイズ: ${numberFormatter.format(settings.roomWidthM)} x ${numberFormatter.format(
      settings.roomDepthM,
    )} m`,
    `- 室内距離: ${formatMeters(settings.indoorDistanceM)}`,
    `- 屋内伝搬指数: ${numberFormatter.format(settings.indoorPathLossExponent)}`,
    `- 接続しきい値: ${formatDbm(settings.connectionThresholdDbm)}`,
    `- ナミゲートプリセット: ${namigateLabel}`,
    `- ナミゲート改善量: ${formatDb(settings.namigateGainDb)}`,
    `- ナミゲートサイズ: ${numberFormatter.format(
      settings.namigateWidthCm,
    )} x ${numberFormatter.format(settings.namigateHeightCm)} cm`,
    `- 面積補正: ${formatDb(areaGainDb)}`,
    `- 入射角回復: ${formatDb(angleRecoveryDb)}`,
    `- 設置効率: ${numberFormatter.format(settings.namigateInstallationEfficiencyPercent)}%`,
    `- 追加損失: ${formatDb(settings.namigateAdditionalLossDb)}`,
    `- 最大総改善量: ${formatDb(settings.namigateMaxTotalGainDb)}`,
    `- ナミゲート総改善量: ${formatDb(totalNamigateGainDb)}`,
    '',
    '## ナミゲート効果モデルの根拠',
    '- 現状は厳密な電磁界解析や測定校正済みモデルではなく、MVP仕様に基づく簡易リンクバジェットです。',
    '- プリセットの +3 / +10 / +25 dB は、保守的・標準・Low-E改善例を比較するための仮定値です。',
    '- 面積補正は 10cm x 10cm を基準に 10log10(面積倍率) で計算し、上限と係数で調整します。',
    '- ナミゲートの効果は、窓ありと窓なしの差をどれだけ埋めるかという回復量で評価します。',
    '',
    '## 推定値と実測値',
    '| 状態 | 推定RSRP | 実測RSRP | 差分 実測-推定 | 判定 |',
    '| --- | ---: | ---: | ---: | --- |',
    rows,
    '',
    '## 改善効果',
    `- 推定の窓なし-窓あり差: ${formatDb(estimatedWindowLossDb)}`,
    `- 実測の窓なし-窓あり差: ${formatOptionalDb(measuredWindowLossDb)}`,
    `- 推定のナミゲート改善量: ${formatDb(estimatedNamigateGainDb)}`,
    `- 実測のナミゲート改善量: ${formatOptionalDb(measuredNamigateGainDb)}`,
    `- 窓なし状態への推定回復率: ${numberFormatter.format(clamp(recoveryRate, 0, 100))}%`,
    `- 平均誤差 実測-推定: ${formatOptionalDb(measuredAverageResidualDb)}`,
    '',
    '## 解析観点',
    '- 3状態に共通するオフセットがあるか',
    '- 窓ありだけ誤差が大きい場合、窓損失または入射角損失をどう補正すべきか',
    '- ナミゲートありだけ誤差が大きい場合、改善量または面積補正をどう見直すべきか',
  ].join('\n')
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
  const [inputState, setInputState] = useState({
    draftValue: formatNumberInputValue(value),
    isEditing: false,
  })
  const displayValue = inputState.isEditing
    ? inputState.draftValue
    : formatNumberInputValue(value)

  const commitDraftValue = (rawValue: string) => {
    if (!isValidNumberInput(rawValue)) {
      setInputState({
        draftValue: formatNumberInputValue(value),
        isEditing: false,
      })
      return
    }

    const nextValue = Number(rawValue)
    onChange(nextValue)
    setInputState({
      draftValue: formatNumberInputValue(nextValue),
      isEditing: false,
    })
  }

  return (
    <label className="control">
      <span>{label}</span>
      <div className="input-row">
        <input
          type="number"
          inputMode="decimal"
          value={displayValue}
          min={min}
          max={max}
          step={step}
          onFocus={() => {
            setInputState({
              draftValue: formatNumberInputValue(value),
              isEditing: true,
            })
          }}
          onChange={(event) => {
            const nextValue = event.target.value
            setInputState({
              draftValue: nextValue,
              isEditing: true,
            })

            if (isValidNumberInput(nextValue)) {
              onChange(Number(nextValue))
            }
          }}
          onBlur={(event) => {
            commitDraftValue(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }

            if (event.key === 'Escape') {
              const resetValue = formatNumberInputValue(value)
              event.currentTarget.value = resetValue
              setInputState({
                draftValue: resetValue,
                isEditing: false,
              })
              event.currentTarget.blur()
            }
          }}
        />
        {unit ? <small>{unit}</small> : null}
      </div>
    </label>
  )
}

function PositionScene3D({ settings, angleLossDb, areaGainDb }: PositionDiagramProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return undefined
    }

    const roomWidthM = clamp(settings.roomWidthM, 2, 30)
    const roomDepthM = clamp(settings.roomDepthM, 2, 40)
    const windowWidthM = clamp(settings.windowWidthM, 0.2, roomWidthM)
    const windowHeightM = clamp(settings.windowHeightM, 0.2, 4)
    const namigateWidthM = clamp(settings.namigateWidthCm / 100, 0.05, windowWidthM)
    const namigateHeightM = clamp(settings.namigateHeightCm / 100, 0.05, windowHeightM)
    const windowBottomM = 0.72
    const windowCenterY = windowBottomM + windowHeightM / 2
    const wallHeightM = Math.max(3.2, windowBottomM + windowHeightM + 0.72)
    const receiverZ = clamp(settings.indoorDistanceM, 0.7, roomDepthM - 0.45)
    const safeAngle = clamp(settings.incidentAngleDeg, 15, 90)
    const outdoorDisplayM = clamp(Math.log10(Math.max(settings.outdoorDistanceM, 1)) * 2.6, 3, 9)
    const transmitterX = clamp(
      -Math.tan(((90 - safeAngle) * Math.PI) / 180) * outdoorDisplayM,
      -roomWidthM / 2 + 0.6,
      roomWidthM / 2 - 0.6,
    )
    const transmitterZ = -outdoorDisplayM
    const transmitterPoint = new THREE.Vector3(transmitterX, windowCenterY, transmitterZ)
    const windowPoint = new THREE.Vector3(0, windowCenterY, 0)
    const receiverPoint = new THREE.Vector3(0, 1.05, receiverZ)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf7fafc)

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120)
    camera.position.set(roomWidthM * 0.95, wallHeightM * 1.8, roomDepthM * 1.55)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.domElement.className = 'position-3d-canvas'
    renderer.domElement.setAttribute('aria-label', '3D位置関係ビュー')
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.22
    controls.target.set(0, wallHeightM * 0.48, roomDepthM * 0.48)
    controls.minDistance = Math.max(4, Math.min(roomWidthM, roomDepthM) * 0.6)
    controls.maxDistance = Math.max(18, roomDepthM * 3)
    controls.update()

    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xced8e2, 2.2)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
    keyLight.position.set(roomWidthM * 0.35, wallHeightM * 2.6, -roomDepthM * 0.65)
    keyLight.castShadow = true
    scene.add(keyLight)

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xeaf1f6,
      roughness: 0.82,
      metalness: 0.02,
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidthM, roomDepthM), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0, roomDepthM / 2)
    floor.receiveShadow = true
    scene.add(floor)

    const grid = new THREE.GridHelper(
      Math.max(roomWidthM, roomDepthM),
      Math.max(8, Math.round(Math.max(roomWidthM, roomDepthM))),
      0xc8d6e0,
      0xdfe8ef,
    )
    grid.position.set(0, 0.012, roomDepthM / 2)
    scene.add(grid)

    const outlinePoints = [
      new THREE.Vector3(-roomWidthM / 2, 0.04, 0),
      new THREE.Vector3(roomWidthM / 2, 0.04, 0),
      new THREE.Vector3(roomWidthM / 2, 0.04, roomDepthM),
      new THREE.Vector3(-roomWidthM / 2, 0.04, roomDepthM),
      new THREE.Vector3(-roomWidthM / 2, 0.04, 0),
    ]
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(outlinePoints),
        new THREE.LineBasicMaterial({ color: 0x2f3f4f }),
      ),
    )

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidthM, wallHeightM),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        roughness: 0.9,
      }),
    )
    wall.position.set(0, wallHeightM / 2, 0)
    wall.receiveShadow = true
    scene.add(wall)

    const wallFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(roomWidthM, wallHeightM, 0.035)),
      new THREE.LineBasicMaterial({ color: 0x6b7b88 }),
    )
    wallFrame.position.set(0, wallHeightM / 2, 0)
    scene.add(wallFrame)

    const windowGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(windowWidthM, windowHeightM),
      new THREE.MeshPhysicalMaterial({
        color: 0xbfe9fb,
        transparent: true,
        opacity: settings.windowPresetId === 'none' ? 0.18 : 0.56,
        roughness: 0.08,
        metalness: 0,
        transmission: 0.28,
        side: THREE.DoubleSide,
      }),
    )
    windowGlass.position.set(0, windowCenterY, -0.025)
    scene.add(windowGlass)

    const windowFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(windowWidthM, windowHeightM, 0.045)),
      new THREE.LineBasicMaterial({ color: 0x0071bd }),
    )
    windowFrame.position.copy(windowGlass.position)
    scene.add(windowFrame)

    const namigate = new THREE.Mesh(
      new THREE.BoxGeometry(namigateWidthM, namigateHeightM, 0.09),
      new THREE.MeshStandardMaterial({
        color: 0x0071bd,
        roughness: 0.38,
        metalness: 0.18,
        emissive: 0x003b64,
        emissiveIntensity: 0.12,
      }),
    )
    namigate.position.set(0, windowCenterY, -0.105)
    namigate.castShadow = true
    scene.add(namigate)

    const transmitterGroup = new THREE.Group()
    transmitterGroup.position.set(transmitterX, 0, transmitterZ)
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.08, windowCenterY, 16),
      new THREE.MeshStandardMaterial({ color: 0x16212c, roughness: 0.55 }),
    )
    mast.position.y = windowCenterY / 2
    transmitterGroup.add(mast)
    const transmitterHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0x16212c, roughness: 0.35 }),
    )
    transmitterHead.position.y = windowCenterY
    transmitterHead.castShadow = true
    transmitterGroup.add(transmitterHead)
    scene.add(transmitterGroup)

    const receiverGroup = new THREE.Group()
    receiverGroup.position.set(receiverPoint.x, 0, receiverPoint.z)
    const receiverPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.065, receiverPoint.y, 16),
      new THREE.MeshStandardMaterial({ color: 0x4f6575, roughness: 0.55 }),
    )
    receiverPole.position.y = receiverPoint.y / 2
    receiverGroup.add(receiverPole)
    const receiverHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0x0071bd, roughness: 0.32 }),
    )
    receiverHead.position.y = receiverPoint.y
    receiverHead.castShadow = true
    receiverGroup.add(receiverHead)
    scene.add(receiverGroup)

    const rayCurve = new THREE.CatmullRomCurve3([transmitterPoint, windowPoint, receiverPoint])
    const ray = new THREE.Mesh(
      new THREE.TubeGeometry(rayCurve, 64, 0.035, 12, false),
      new THREE.MeshStandardMaterial({
        color: 0x0071bd,
        emissive: 0x0071bd,
        emissiveIntensity: 0.45,
        roughness: 0.18,
      }),
    )
    scene.add(ray)

    const indoorDistanceLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.08, 0),
        new THREE.Vector3(0, 0.08, receiverZ),
      ]),
      new THREE.LineDashedMaterial({
        color: 0x667788,
        dashSize: 0.18,
        gapSize: 0.12,
      }),
    )
    indoorDistanceLine.computeLineDistances()
    scene.add(indoorDistanceLine)

    const outdoorDistanceLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(transmitterX, 0.08, transmitterZ),
        new THREE.Vector3(0, 0.08, 0),
      ]),
      new THREE.LineDashedMaterial({
        color: 0x667788,
        dashSize: 0.18,
        gapSize: 0.12,
      }),
    )
    outdoorDistanceLine.computeLineDistances()
    scene.add(outdoorDistanceLine)

    const addDimensionLine = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      color = 0x3f5366,
    ) => {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, end]),
        new THREE.LineDashedMaterial({
          color,
          dashSize: 0.14,
          depthTest: false,
          gapSize: 0.09,
        }),
      )
      line.computeLineDistances()
      scene.add(line)
      return line
    }

    const roomWidthLineZ = roomDepthM + 0.28
    const roomDepthLineX = roomWidthM / 2 + 0.28
    const windowWidthLineY = windowCenterY + windowHeightM / 2 + 0.16
    const windowHeightLineX = -windowWidthM / 2 - 0.18

    addDimensionLine(
      new THREE.Vector3(-roomWidthM / 2, 0.12, roomWidthLineZ),
      new THREE.Vector3(roomWidthM / 2, 0.12, roomWidthLineZ),
    )
    addDimensionLine(
      new THREE.Vector3(roomDepthLineX, 0.12, 0),
      new THREE.Vector3(roomDepthLineX, 0.12, roomDepthM),
    )
    addDimensionLine(
      new THREE.Vector3(-windowWidthM / 2, windowWidthLineY, -0.08),
      new THREE.Vector3(windowWidthM / 2, windowWidthLineY, -0.08),
      0x0071bd,
    )
    addDimensionLine(
      new THREE.Vector3(windowHeightLineX, windowBottomM, -0.08),
      new THREE.Vector3(windowHeightLineX, windowBottomM + windowHeightM, -0.08),
      0x0071bd,
    )

    const makeLabel = (text: string, color = '#172330') => {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 128
      const context = canvas.getContext('2d')

      if (context) {
        context.fillStyle = 'rgba(255,255,255,0.88)'
        context.fillRect(0, 20, 512, 88)
        context.strokeStyle = 'rgba(0,113,189,0.28)'
        context.lineWidth = 4
        context.strokeRect(2, 22, 508, 84)
        context.fillStyle = color
        context.font = '700 42px system-ui, sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(text, 256, 64)
      }

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
        }),
      )
      sprite.scale.set(Math.min(3.3, Math.max(1.5, text.length * 0.24)), 0.42, 1)
      return sprite
    }

    const labels = [
      { label: makeLabel('送信機'), position: new THREE.Vector3(transmitterX, windowCenterY + 0.55, transmitterZ) },
      { label: makeLabel(`屋外距離 ${formatMeters(settings.outdoorDistanceM)}`), position: new THREE.Vector3(transmitterX / 2, 0.42, transmitterZ / 2) },
      { label: makeLabel(`入射角 ${numberFormatter.format(safeAngle)}°`, '#c96c34'), position: new THREE.Vector3(transmitterX * 0.28, windowCenterY + 0.35, -0.72) },
      { label: makeLabel(`窓幅 ${numberFormatter.format(settings.windowWidthM)}m`, '#0071BD'), position: new THREE.Vector3(0, windowWidthLineY + 0.18, -0.1) },
      { label: makeLabel(`窓高 ${numberFormatter.format(settings.windowHeightM)}m`, '#0071BD'), position: new THREE.Vector3(windowHeightLineX - 0.55, windowCenterY, -0.1) },
      { label: makeLabel(`ナミゲート ${numberFormatter.format(settings.namigateWidthCm)}×${numberFormatter.format(settings.namigateHeightCm)}cm`, '#0071BD'), position: new THREE.Vector3(namigateWidthM / 2 + 1.1, windowCenterY, -0.24) },
      { label: makeLabel('受信機'), position: new THREE.Vector3(0.65, receiverPoint.y + 0.28, receiverZ) },
      { label: makeLabel(`室内距離 ${formatMeters(settings.indoorDistanceM)}`), position: new THREE.Vector3(0.9, 0.38, receiverZ / 2) },
      { label: makeLabel(`部屋幅 ${numberFormatter.format(settings.roomWidthM)}m`), position: new THREE.Vector3(0, 0.42, roomWidthLineZ + 0.22) },
      { label: makeLabel(`奥行 ${numberFormatter.format(settings.roomDepthM)}m`), position: new THREE.Vector3(roomDepthLineX + 0.58, 0.42, roomDepthM / 2) },
    ]

    labels.forEach(({ label, position }) => {
      label.position.copy(position)
      scene.add(label)
    })

    const resize = () => {
      const width = Math.max(mount.clientWidth, 320)
      const height = Math.max(mount.clientHeight, 320)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    let animationFrame = 0
    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      controls.dispose()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        const geometry = mesh.geometry
        const material = mesh.material

        if (geometry instanceof THREE.BufferGeometry) {
          geometry.dispose()
        }

        const disposeMaterial = (item: THREE.Material) => {
          const materialWithMap = item as THREE.Material & { map?: THREE.Texture }
          materialWithMap.map?.dispose()
          item.dispose()
        }

        if (Array.isArray(material)) {
          material.forEach(disposeMaterial)
        } else if (material instanceof THREE.Material) {
          disposeMaterial(material)
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [settings, angleLossDb, areaGainDb])

  return (
    <div className="position-3d-layout">
      <div className="position-3d-scene" ref={mountRef}>
        <div className="position-3d-help">ドラッグで回転 / ホイールで拡大</div>
      </div>
      <div className="position-3d-facts">
        <div>
          <span>3D表示</span>
          <strong>屋外から窓面へ入射</strong>
          <small>
            屋外距離 {formatMeters(settings.outdoorDistanceM)} / 入射角{' '}
            {numberFormatter.format(settings.incidentAngleDeg)}° / 損失 {formatDb(angleLossDb)}
          </small>
        </div>
        <div>
          <span>窓とナミゲート</span>
          <strong>
            窓 {numberFormatter.format(settings.windowWidthM)}×
            {numberFormatter.format(settings.windowHeightM)}m
          </strong>
          <small>
            ナミゲート {numberFormatter.format(settings.namigateWidthCm)}×
            {numberFormatter.format(settings.namigateHeightCm)}cm / 面積補正{' '}
            {formatDb(areaGainDb)}
          </small>
        </div>
        <div>
          <span>受信点</span>
          <strong>室内 {formatMeters(settings.indoorDistanceM)}</strong>
          <small>
            部屋幅 {numberFormatter.format(settings.roomWidthM)}m / 奥行{' '}
            {numberFormatter.format(settings.roomDepthM)}m
          </small>
        </div>
      </div>
    </div>
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
          <text
            className="heatmap-outdoor-label"
            x={(transmitterXPct + 50) / 2}
            y="38"
          >
            入射角 {numberFormatter.format(safeAngle)}°
          </text>
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
          <line className="heatmap-dimension-line" x1="0" y1="96" x2="100" y2="96" />
          <line className="heatmap-dimension-line" x1="96" y1="0" x2="96" y2="100" />
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
          <text
            className="heatmap-dimension-label"
            textAnchor="middle"
            x="50"
            y="94"
          >
            部屋幅 {numberFormatter.format(settings.roomWidthM)}m
          </text>
          <text
            className="heatmap-dimension-label"
            textAnchor="middle"
            transform="rotate(90 96 50)"
            x="96"
            y="50"
          >
            奥行 {numberFormatter.format(settings.roomDepthM)}m
          </text>
          <text className="heatmap-dimension-label" x="52" y={receiverYPct / 2}>
            室内 {formatMeters(settings.indoorDistanceM)}
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
        <span>部屋幅 {numberFormatter.format(settings.roomWidthM)}m</span>
        <span>奥行 {numberFormatter.format(settings.roomDepthM)}m</span>
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
          className="diagram-dimension"
          x1={roomX}
          y1="34"
          x2={roomX + roomWidth}
          y2="34"
          markerEnd="url(#arrowhead-muted)"
        />
        <line
          className="diagram-dimension"
          x1={windowX - 26}
          y1={windowCenterY - windowPatchHeight / 2}
          x2={windowX - 26}
          y2={windowCenterY + windowPatchHeight / 2}
          markerEnd="url(#arrowhead-muted)"
        />
        <text className="diagram-dimension-label" x={roomX + 92} y="30">
          部屋奥行 {numberFormatter.format(settings.roomDepthM)}m
        </text>
        <text className="diagram-dimension-label" x={roomX + 168} y="88">
          部屋幅 {numberFormatter.format(settings.roomWidthM)}m（画面奥行）
        </text>
        <text className="diagram-dimension-label" x={windowX - 126} y={windowCenterY + 42}>
          窓高 {numberFormatter.format(settings.windowHeightM)}m
        </text>
        <text className="diagram-dimension-label" x={windowX + 18} y={windowCenterY + 25}>
          窓幅 {numberFormatter.format(settings.windowWidthM)}m
        </text>

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
          入射角 {numberFormatter.format(safeAngle)}° / 損失 {formatDb(angleLossDb)}
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
  const [measuredRsrpValues, setMeasuredRsrpValues] =
    useState<MeasuredRsrpValues>(DEFAULT_MEASURED_RSRP)
  const [copyStatus, setCopyStatus] = useState('')

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const updateMeasuredRsrp = (key: ScenarioKey, value: string) => {
    setMeasuredRsrpValues((current) => ({ ...current, [key]: value }))
    setCopyStatus('')
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

  const effectiveEirpDbm = useMemo(
    () => calculateEffectiveEirpDbm(settings),
    [settings],
  )

  const detailedEirpDbm = useMemo(
    () => calculateDetailedEirpDbm(settings),
    [settings],
  )

  const receiverAdjustmentDb = useMemo(
    () => calculateReceiverAdjustmentDb(settings),
    [settings],
  )

  const areaGainDb = useMemo(
    () => calculateAreaGainDb(settings),
    [settings],
  )

  const namigateAngleRecoveryDb = useMemo(
    () => calculateNamigateAngleRecoveryDb(settings),
    [settings],
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

  const measuredComparisons = useMemo<MeasuredComparison[]>(
    () =>
      scenarioResults.map((scenario) => {
        const measuredRsrpDbm = parseOptionalNumber(measuredRsrpValues[scenario.key])

        return {
          ...scenario,
          measuredRsrpDbm,
          residualDb:
            measuredRsrpDbm === null ? null : measuredRsrpDbm - scenario.rsrpDbm,
        }
      }),
    [measuredRsrpValues, scenarioResults],
  )

  const noWindowRsrp = scenarioResults[0].rsrpDbm
  const withWindowRsrp = scenarioResults[1].rsrpDbm
  const withNamigateRsrp = scenarioResults[2].rsrpDbm
  const totalNamigateGainDb = calculateNamigateTotalGainDb(settings)
  const powerMultiplier = Math.pow(10, totalNamigateGainDb / 10)
  const fieldMultiplier = Math.pow(10, totalNamigateGainDb / 20)
  const windowGapDb = Math.max(noWindowRsrp - withWindowRsrp, 0)
  const recoveredGapDb = Math.max(
    Math.min(withNamigateRsrp - withWindowRsrp, windowGapDb),
    0,
  )
  const recoveryRate = windowGapDb <= 0 ? 100 : (recoveredGapDb / windowGapDb) * 100
  const roomAreaM2 = Math.max(settings.roomWidthM, 1) * Math.max(settings.roomDepthM, 1)
  const measuredResiduals = measuredComparisons
    .map((comparison) => comparison.residualDb)
    .filter((value): value is number => value !== null)
  const measuredAverageResidualDb =
    measuredResiduals.length === 0
      ? null
      : measuredResiduals.reduce((sum, value) => sum + value, 0) / measuredResiduals.length
  const measuredNoWindowRsrp = measuredComparisons[0].measuredRsrpDbm
  const measuredWithWindowRsrp = measuredComparisons[1].measuredRsrpDbm
  const measuredWithNamigateRsrp = measuredComparisons[2].measuredRsrpDbm
  const measuredWindowLossDb =
    measuredNoWindowRsrp === null || measuredWithWindowRsrp === null
      ? null
      : measuredNoWindowRsrp - measuredWithWindowRsrp
  const measuredNamigateGainDb =
    measuredWithWindowRsrp === null || measuredWithNamigateRsrp === null
      ? null
      : measuredWithNamigateRsrp - measuredWithWindowRsrp
  const estimatedNamigateGainDb = withNamigateRsrp - withWindowRsrp
  const measuredNamigateGapDb =
    measuredNamigateGainDb === null
      ? null
      : measuredNamigateGainDb - estimatedNamigateGainDb

  const aiAnalysisText = useMemo(
    () =>
      buildAiAnalysisText({
        settings,
        scenarioResults,
        measuredComparisons,
        angleLossDb,
        areaGainDb,
        totalNamigateGainDb,
        recoveryRate,
        measuredAverageResidualDb,
        measuredWindowLossDb,
        measuredNamigateGainDb,
      }),
    [
      settings,
      scenarioResults,
      measuredComparisons,
      angleLossDb,
      areaGainDb,
      totalNamigateGainDb,
      recoveryRate,
      measuredAverageResidualDb,
      measuredWindowLossDb,
      measuredNamigateGainDb,
    ],
  )

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
        const candidateTotalGainDb = calculateNamigateTotalGainDb(
          settings,
          settings.namigateWidthCm,
          settings.namigateHeightCm,
          angleDeg,
        )
        const filledDb = Math.max(Math.min(candidateTotalGainDb, gapDb), 0)

        return {
          angle: `${angleDeg}°`,
          '回復dB': Number(filledDb.toFixed(1)),
          '窓との差dB': Number(gapDb.toFixed(1)),
        }
      }),
    [settings],
  )

  const areaData = useMemo(
    () =>
      AREA_CHART_SIZES_CM.map((sizeCm) => {
        const candidateTotalGainDb = calculateNamigateTotalGainDb(
          settings,
          sizeCm,
          sizeCm,
        )
        const filledDb = Math.max(Math.min(candidateTotalGainDb, windowGapDb), 0)

        return {
          size: `${sizeCm}×${sizeCm}`,
          '総改善dB': Number(candidateTotalGainDb.toFixed(1)),
          '回復dB': Number(filledDb.toFixed(1)),
        }
      }),
    [settings, windowGapDb],
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

  const handleCopyAnalysis = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(aiAnalysisText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = aiAnalysisText
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textarea)

        if (!copied) {
          throw new Error('copy failed')
        }
      }

      setCopyStatus('AI分析用データをコピーしました')
    } catch {
      setCopyStatus('コピーできませんでした')
    }
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
            <label className="control">
              <span>EIRP計算方式</span>
              <select
                value={settings.eirpMode}
                onChange={(event) =>
                  updateSetting('eirpMode', event.target.value as EirpMode)
                }
              >
                <option value="direct">EIRP直接入力</option>
                <option value="detailed">無線機詳細から計算</option>
              </select>
            </label>
            <NumberInput
              label="EIRP直接入力"
              value={settings.eirpDbm}
              step={1}
              unit="dBm"
              onChange={(value) => updateSetting('eirpDbm', value)}
            />
            <NumberInput
              label="送信出力"
              value={settings.txPowerDbm}
              step={0.5}
              unit="dBm"
              onChange={(value) => updateSetting('txPowerDbm', value)}
            />
            <NumberInput
              label="送信アンテナ利得"
              value={settings.txAntennaGainDbi}
              step={0.5}
              unit="dBi"
              onChange={(value) => updateSetting('txAntennaGainDbi', value)}
            />
            <NumberInput
              label="送信給電損失"
              value={settings.txCableLossDb}
              min={0}
              step={0.1}
              unit="dB"
              onChange={(value) => updateSetting('txCableLossDb', value)}
            />
            <NumberInput
              label="その他送信損失"
              value={settings.txOtherLossDb}
              min={0}
              step={0.1}
              unit="dB"
              onChange={(value) => updateSetting('txOtherLossDb', value)}
            />
            <NumberInput
              label="受信アンテナ利得"
              value={settings.rxAntennaGainDbi}
              step={0.5}
              unit="dBi"
              onChange={(value) => updateSetting('rxAntennaGainDbi', value)}
            />
            <NumberInput
              label="受信給電損失"
              value={settings.rxCableLossDb}
              min={0}
              step={0.1}
              unit="dB"
              onChange={(value) => updateSetting('rxCableLossDb', value)}
            />
            <NumberInput
              label="受信機内部損失"
              value={settings.rxBodyLossDb}
              min={0}
              step={0.1}
              unit="dB"
              onChange={(value) => updateSetting('rxBodyLossDb', value)}
            />
            <NumberInput
              label="偏波不整合損失"
              value={settings.polarizationLossDb}
              min={0}
              step={0.1}
              unit="dB"
              onChange={(value) => updateSetting('polarizationLossDb', value)}
            />
            <NumberInput
              label="フェージングマージン"
              value={settings.fadeMarginDb}
              min={0}
              step={0.5}
              unit="dB"
              onChange={(value) => updateSetting('fadeMarginDb', value)}
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
              label="面積補正係数"
              value={settings.namigateAreaGainScale}
              min={0}
              step={0.1}
              onChange={(value) => updateSetting('namigateAreaGainScale', value)}
            />
            <NumberInput
              label="面積補正上限"
              value={settings.namigateAreaGainLimitDb}
              min={0}
              step={1}
              unit="dB"
              onChange={(value) => updateSetting('namigateAreaGainLimitDb', value)}
            />
            <NumberInput
              label="入射角回復率"
              value={settings.namigateAngleRecoveryPercent}
              min={0}
              max={100}
              step={5}
              unit="%"
              onChange={(value) => updateSetting('namigateAngleRecoveryPercent', value)}
            />
            <NumberInput
              label="設置効率"
              value={settings.namigateInstallationEfficiencyPercent}
              min={0}
              step={5}
              unit="%"
              onChange={(value) =>
                updateSetting('namigateInstallationEfficiencyPercent', value)
              }
            />
            <NumberInput
              label="追加損失"
              value={settings.namigateAdditionalLossDb}
              min={0}
              step={0.5}
              unit="dB"
              onChange={(value) => updateSetting('namigateAdditionalLossDb', value)}
            />
            <NumberInput
              label="最大総改善量"
              value={settings.namigateMaxTotalGainDb}
              min={0}
              step={1}
              unit="dB"
              onChange={(value) => updateSetting('namigateMaxTotalGainDb', value)}
            />
            <div className="model-note">
              <strong>効果根拠</strong>
              <span>
                現状は測定校正済みの電磁界解析ではなく、プリセット改善量 +
                面積補正を基本に、窓なしとの差をどれだけ回復するかを見る簡易モデルです。
              </span>
            </div>
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
              <small>
                面積 {formatDb(areaGainDb)} / 入射角回復 {formatDb(namigateAngleRecoveryDb)}
              </small>
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
              <span>実効EIRP</span>
              <strong>{formatDbm(effectiveEirpDbm)}</strong>
              <small>
                詳細 {formatDbm(detailedEirpDbm)} / 受信系 {formatDb(receiverAdjustmentDb)}
              </small>
            </article>
            <article className="metric-card">
              <span>計算損失</span>
              <strong>{formatDb(currentFsplDb)}</strong>
              <small>室内距離損失 {formatDb(currentIndoorLossDb)}</small>
            </article>
          </section>

          <section className="measurement-section">
            <div className="section-heading">
              <h2>実測値比較</h2>
              <span>実測 - 推定</span>
            </div>

            <div className="measurement-body">
              <div className="measurement-input-grid">
                {SCENARIOS.map((scenario) => (
                  <label className="control measurement-input" key={scenario.key}>
                    <span>実測RSRP（{scenario.label}）</span>
                    <div className="input-row">
                      <input
                        type="number"
                        value={measuredRsrpValues[scenario.key]}
                        step={0.1}
                        placeholder="-80"
                        onChange={(event) =>
                          updateMeasuredRsrp(scenario.key, event.target.value)
                        }
                      />
                      <small>dBm</small>
                    </div>
                  </label>
                ))}
              </div>

              <div
                className="measurement-table"
                role="table"
                aria-label="推定値と実測値の比較"
              >
                <div className="measurement-row is-head" role="row">
                  <span role="columnheader">状態</span>
                  <span role="columnheader">推定</span>
                  <span role="columnheader">実測</span>
                  <span role="columnheader">差分</span>
                  <span role="columnheader">判定</span>
                </div>
                {measuredComparisons.map((comparison) => (
                  <div className="measurement-row" key={comparison.key} role="row">
                    <span data-label="状態" role="cell">
                      {comparison.label}
                    </span>
                    <strong data-label="推定" role="cell">
                      {formatDbm(comparison.rsrpDbm)}
                    </strong>
                    <strong data-label="実測" role="cell">
                      {formatOptionalDbm(comparison.measuredRsrpDbm)}
                    </strong>
                    <strong
                      className={
                        comparison.residualDb === null
                          ? 'is-muted'
                          : comparison.residualDb >= 0
                            ? 'is-positive'
                            : 'is-negative'
                      }
                      data-label="差分"
                      role="cell"
                    >
                      {formatOptionalDb(comparison.residualDb)}
                    </strong>
                    <span data-label="判定" role="cell">
                      {describeResidual(comparison.residualDb)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="measurement-summary">
                <article>
                  <span>平均誤差</span>
                  <strong>{formatOptionalDb(measuredAverageResidualDb)}</strong>
                  <small>実測 - 推定</small>
                </article>
                <article>
                  <span>実測の窓損失</span>
                  <strong>{formatOptionalDb(measuredWindowLossDb)}</strong>
                  <small>窓なし - 窓あり</small>
                </article>
                <article>
                  <span>実測のナミゲート改善</span>
                  <strong>{formatOptionalDb(measuredNamigateGainDb)}</strong>
                  <small>
                    推定差 {formatOptionalDb(measuredNamigateGapDb)}
                  </small>
                </article>
              </div>

              <div className="analysis-copy-panel">
                <button type="button" onClick={handleCopyAnalysis}>
                  AI分析用データをコピー
                </button>
                {copyStatus ? <span>{copyStatus}</span> : null}
              </div>
            </div>
          </section>

          <section className="position-section">
            <div className="section-heading">
              <h2>送信機・窓・受信機の3D位置関係</h2>
              <span>入力条件に連動した3Dビュー</span>
            </div>
            <PositionScene3D
              settings={settings}
              angleLossDb={angleLossDb}
              areaGainDb={areaGainDb}
            />
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
