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
type OutdoorModelId =
  | 'fspl'
  | 'hataUrbanSmall'
  | 'hataUrbanLarge'
  | 'hataSuburban'
  | 'hataOpen'
type ScenarioKey = 'noWindow' | 'withWindow' | 'withNamigate'
type ActiveView = 'overview' | 'measurement' | 'analysis' | 'visualization' | 'charts'
type ModulePresetId =
  | 'custom'
  | 'sub6IndoorSmallCell'
  | 'sub6OutdoorMicro'
  | 'sub6CompactCpe'
  | 'sub6ExternalAntennaModule'
  | 'mmwaveEvaluation'

type Settings = {
  modulePresetId: ModulePresetId
  frequencyMHz: number
  eirpMode: EirpMode
  eirpDbm: number
  txPowerDbm: number
  txAntennaGainDbi: number
  txAntennaHeightM: number
  txCableLossDb: number
  txOtherLossDb: number
  rxAntennaGainDbi: number
  rxAntennaHeightM: number
  rxCableLossDb: number
  rxBodyLossDb: number
  antennaAlignmentLossDb: number
  polarizationLossDb: number
  fadeMarginDb: number
  outdoorModelId: OutdoorModelId
  outdoorDistanceM: number
  outdoorObstructionLossDb: number
  windowPresetId: WindowPresetId
  windowLossDb: number
  windowWidthM: number
  windowHeightM: number
  windowCenterHeightM: number
  incidentAngleDeg: number
  roomWidthM: number
  roomDepthM: number
  indoorDistanceM: number
  indoorPathLossExponent: number
  indoorObstacleLossDb: number
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
  help?: string
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
  measurementPoints?: MeasurementPoint[]
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
  measurementPoints: MeasurementPoint[]
}

type MeasurementPoint = {
  id: string
  name: string
  scenario: ScenarioKey
  xM: number
  yM: number
  heightM: number
  rsrpDbm: number
  rsrqDb: number | null
  sinrDb: number | null
  dlMbps: number | null
  ulMbps: number | null
  timestamp: string
  device: string
  antennaDirection: string
  note: string
}

type PointComparison = MeasurementPoint & {
  estimatedRsrpDbm: number
  residualDb: number
  distanceM: number
}

type ErrorStats = {
  count: number
  meanResidualDb: number | null
  maeDb: number | null
  rmseDb: number | null
  stddevDb: number | null
  maxAbsDb: number | null
}

type QualityStats = {
  pointCount: number
  avgRsrqDb: number | null
  avgSinrDb: number | null
  avgDlMbps: number | null
  avgUlMbps: number | null
  connectedRatio: number | null
}

type CalibrationResult = {
  source: string
  pointCount: number
  recommendedWindowLossDb: number
  recommendedIndoorPathLossExponent: number
  recommendedNamigateGainDb: number
  recommendedTotalNamigateGainDb: number
  beforeRmseDb: number | null
  afterRmseDb: number | null
}

type ProtocolChecklistKey =
  | 'sameDevice'
  | 'sameHeight'
  | 'fixedWindowPosition'
  | 'sameAntennaDirection'
  | 'averagedSamples'
  | 'recordedEnvironment'

type TestProtocol = {
  siteName: string
  operatorName: string
  deviceName: string
  measurementHeightM: number
  averagingSeconds: number
  samplesPerPoint: number
  antennaDirection: string
  weather: string
  notes: string
  checklist: Record<ProtocolChecklistKey, boolean>
}

type SavedTestCase = {
  id: string
  name: string
  savedAt: string
  settings: Settings
  measuredRsrpValues: MeasuredRsrpValues
  measurementPoints: MeasurementPoint[]
  protocol: TestProtocol
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

const OUTDOOR_MODEL_PRESETS: {
  id: OutdoorModelId
  label: string
  description: string
}[] = [
  {
    id: 'fspl',
    label: '自由空間損失（FSPL）',
    description: '見通しのよい屋外区間を、周波数と3D距離だけで評価します。',
  },
  {
    id: 'hataUrbanSmall',
    label: '奥村-秦 都市（中小都市）',
    description: '市街地のマクロセル相当を、移動局補正込みで見積もります。',
  },
  {
    id: 'hataUrbanLarge',
    label: '奥村-秦 都市（大都市）',
    description: '大都市環境の移動局補正を使う奥村-秦モデルです。',
  },
  {
    id: 'hataSuburban',
    label: '奥村-秦 郊外',
    description: '都市モデルから郊外補正を差し引いたプリセットです。',
  },
  {
    id: 'hataOpen',
    label: '奥村-秦 開放地',
    description: '開放地/田園地に近い条件の補正を使うプリセットです。',
  },
]

const HATA_MODEL_IDS = new Set<OutdoorModelId>([
  'hataUrbanSmall',
  'hataUrbanLarge',
  'hataSuburban',
  'hataOpen',
])

const MODULE_PRESETS: {
  id: ModulePresetId
  label: string
  description: string
  settings: Partial<Settings>
}[] = [
  {
    id: 'custom',
    label: '任意',
    description: '現在の入力値をそのまま使う',
    settings: {},
  },
  {
    id: 'sub6IndoorSmallCell',
    label: '汎用Sub6 屋内小型基地局',
    description: '屋内窓面評価の初期値。EIRPを控えめに扱う小型局想定',
    settings: {
      frequencyMHz: 4700,
      eirpMode: 'detailed',
      txPowerDbm: 24,
      txAntennaGainDbi: 8,
      txCableLossDb: 1,
      txOtherLossDb: 1,
      txAntennaHeightM: 3,
      rxAntennaGainDbi: 0,
      rxCableLossDb: 0,
      rxBodyLossDb: 1,
      rxAntennaHeightM: 1.2,
      antennaAlignmentLossDb: 1,
      fadeMarginDb: 3,
      outdoorDistanceM: 60,
    },
  },
  {
    id: 'sub6OutdoorMicro',
    label: '汎用Sub6 屋外マイクロ局',
    description: '屋外から建物窓へ入射する検討向け。外部アンテナ局想定',
    settings: {
      frequencyMHz: 4850,
      eirpMode: 'detailed',
      txPowerDbm: 30,
      txAntennaGainDbi: 15,
      txCableLossDb: 1,
      txOtherLossDb: 1,
      txAntennaHeightM: 5,
      rxAntennaGainDbi: 0,
      rxCableLossDb: 0,
      rxBodyLossDb: 0,
      rxAntennaHeightM: 1.2,
      antennaAlignmentLossDb: 0,
      fadeMarginDb: 3,
      outdoorDistanceM: 100,
    },
  },
  {
    id: 'sub6CompactCpe',
    label: '汎用Sub6 CPE/固定端末',
    description: '窓際受信機や固定CPEで外部アンテナ利得を見込む例',
    settings: {
      frequencyMHz: 4700,
      eirpMode: 'detailed',
      txPowerDbm: 26,
      txAntennaGainDbi: 10,
      txCableLossDb: 1,
      txOtherLossDb: 1,
      txAntennaHeightM: 4,
      rxAntennaGainDbi: 6,
      rxCableLossDb: 1,
      rxBodyLossDb: 0,
      rxAntennaHeightM: 1.5,
      antennaAlignmentLossDb: 1,
      fadeMarginDb: 3,
      outdoorDistanceM: 100,
    },
  },
  {
    id: 'sub6ExternalAntennaModule',
    label: '汎用Sub6 通信モジュール＋外部アンテナ',
    description: '評価ボードや組込みモジュールに外部アンテナを接続する例',
    settings: {
      frequencyMHz: 4700,
      eirpMode: 'detailed',
      txPowerDbm: 23,
      txAntennaGainDbi: 5,
      txCableLossDb: 1,
      txOtherLossDb: 1,
      txAntennaHeightM: 2.5,
      rxAntennaGainDbi: 3,
      rxCableLossDb: 0.5,
      rxBodyLossDb: 1,
      rxAntennaHeightM: 1.2,
      antennaAlignmentLossDb: 2,
      fadeMarginDb: 4,
      outdoorDistanceM: 50,
    },
  },
  {
    id: 'mmwaveEvaluation',
    label: '汎用28GHz 評価構成',
    description: 'ミリ波評価の入口。周波数依存の損失が大きい条件を確認',
    settings: {
      frequencyMHz: 28200,
      eirpMode: 'detailed',
      txPowerDbm: 20,
      txAntennaGainDbi: 18,
      txCableLossDb: 2,
      txOtherLossDb: 2,
      txAntennaHeightM: 3,
      rxAntennaGainDbi: 10,
      rxCableLossDb: 2,
      rxBodyLossDb: 2,
      rxAntennaHeightM: 1.2,
      antennaAlignmentLossDb: 3,
      fadeMarginDb: 8,
      outdoorDistanceM: 30,
      windowLossDb: 45,
      incidentAngleDeg: 75,
    },
  },
]

const MODULE_PRESET_SETTING_KEYS = new Set<keyof Settings>([
  'frequencyMHz',
  'eirpMode',
  'eirpDbm',
  'txPowerDbm',
  'txAntennaGainDbi',
  'txAntennaHeightM',
  'txCableLossDb',
  'txOtherLossDb',
  'rxAntennaGainDbi',
  'rxAntennaHeightM',
  'rxCableLossDb',
  'rxBodyLossDb',
  'antennaAlignmentLossDb',
  'polarizationLossDb',
  'fadeMarginDb',
  'outdoorDistanceM',
  'outdoorObstructionLossDb',
  'groundReflectionDb',
])

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
const SAVED_CASES_STORAGE_KEY = 'private5g-namigate-saved-cases'

const VIEW_TABS: {
  id: ActiveView
  label: string
  description: string
}[] = [
  {
    id: 'overview',
    label: '概要',
    description: '3状態の差と到達性を最初に確認',
  },
  {
    id: 'measurement',
    label: '実測データ',
    description: '手入力やCSVから現場データを比較',
  },
  {
    id: 'analysis',
    label: '分析・校正',
    description: '誤差、校正候補、レポートを作成',
  },
  {
    id: 'visualization',
    label: '可視化',
    description: '位置関係と室内分布を確認',
  },
  {
    id: 'charts',
    label: 'グラフ',
    description: '距離、角度、面積の傾向を確認',
  },
]

const HELP_TEXT: Record<string, string> = {
  RSRP:
    '端末が受け取る5G基準信号の強さです。値が大きいほど受信しやすく、ここではしきい値以上を接続可能とします。',
  SINR:
    '信号と干渉・雑音の比です。RSRPが高くてもSINRが低いとスループットが伸びにくくなります。',
  RSRQ:
    '受信品質の指標です。電波の強さだけでは見えない混雑や干渉の影響を見る補助指標です。',
  RMSE:
    '推定と実測のズレを二乗平均平方根で表した値です。小さいほどモデルが現場に合っています。',
  '無線機プリセット': '汎用的な基地局・通信モジュール構成の初期値です。メーカー仕様や免許条件を保証するものではありません。',
  '周波数': '電波の周波数です。FSPLや奥村-秦モデルの屋外損失計算に使い、高い周波数ほど損失が大きくなります。',
  'EIRP計算方式': 'EIRPを直接入れるか、送信出力やアンテナ利得から計算するかを選びます。',
  'EIRP直接入力': '送信出力、アンテナ利得、給電損失をまとめた実効的な送信電力です。免許条件上のEIRP制限とは別に、正式判断は最新の総務省資料で確認してください。',
  '送信出力': '無線機から出る空中線電力相当の入力値です。詳細EIRP計算方式のときに使い、法規制上は無線局免許・技術基準の確認対象になります。',
  '送信アンテナ利得': '送信アンテナが特定方向へ電波を集中させる効果です。EIRPは概ね送信出力＋アンテナ利得−給電損失で大きくなります。',
  '送信アンテナ高': '屋外側の送信アンテナ中心の地上高です。窓中心高との差から屋外の3D斜距離を計算します。',
  '送信給電損失': '無線機からアンテナまでのケーブルなどで失われる量です。',
  'その他送信損失': 'コネクタ、分配器、設置条件など送信側の追加損失です。',
  '受信アンテナ利得': '受信側アンテナの利得です。端末内蔵アンテナなら0dBi付近から始めると扱いやすいです。',
  '受信アンテナ高': '屋内側の代表受信点の高さです。窓中心高との差から室内の3D斜距離を計算します。',
  '受信給電損失': '受信側のケーブルや接続部で失われる量です。',
  '受信機内部損失': '端末筐体や人体保持など、受信系で見込む追加損失です。',
  'アンテナ指向ずれ損失': '送受信アンテナの方位・チルト・ビーム方向が理想から外れる分を追加損失として見込みます。',
  '偏波不整合損失': '送受信アンテナの偏波向きがずれることで発生する損失です。',
  'フェージングマージン': '反射や人体遮蔽などのばらつきを保守的に見込む余裕です。',
  '屋外伝搬モデル': '送信機から窓までの屋外区間をどう見積もるかを選びます。FSPLは見通し基準、奥村-秦は市街地/郊外/開放地の経験式です。',
  '屋外距離': '送信機から窓面までの水平距離です。送信アンテナ高と窓中心高を加味して屋外3D斜距離へ変換します。',
  '屋外遮蔽損失': '屋外側の樹木、車両、仮設物、見通し悪化などを追加損失として見込む値です。',
  '地面反射補正': '地面反射などで強め/弱めに見込む補正値です。まず0dBから始めます。',
  '窓種別': '代表的な窓損失をプリセットから選べます。実測に合わせる場合は窓損失を直接変更します。',
  '窓損失': '窓ガラスを通過するときに失われる量です。Low-Eや金属膜入りでは大きくなりやすいです。',
  '窓幅': '窓の横幅です。図示とヒートマップの窓表示に使います。',
  '窓高さ': '窓の高さです。3D図の窓サイズに使います。',
  '窓中心高': '窓またはナミゲート中心の地上高です。送信・受信アンテナ高との差から3D距離を計算します。',
  '入射角': '電波が窓へ入る角度です。90度が正面入射で、浅い角度ほど損失を大きく見込みます。',
  '部屋幅': '窓に沿った横方向の部屋寸法です。接続可能面積の計算に使います。',
  '部屋奥行': '窓から室内奥方向の部屋寸法です。ヒートマップ範囲と到達距離評価に使います。',
  '室内距離': '窓から受信点までの水平距離です。受信アンテナ高と窓中心高を加味して室内3D距離へ変換します。',
  '屋内伝搬指数': '室内で距離が伸びたときの減衰の強さです。大きいほど奥まで届きにくくなります。',
  '屋内遮蔽損失': '什器、壁、人体、パーティションなど室内側で一律に見込む追加損失です。',
  '改善量プリセット': 'ナミゲート改善量の仮定値を選びます。実測に合わせる場合は改善量を直接変更します。',
  'ナミゲート改善量': 'ナミゲートで窓あり状態から上積みする改善量の仮定値です。',
  'サイズ幅': 'ナミゲートの幅です。面積補正と図示に使います。',
  'サイズ高さ': 'ナミゲートの高さです。面積補正と図示に使います。',
  '面積補正係数': 'ナミゲート面積による改善量の効き具合を調整します。',
  '面積補正上限': '面積補正が大きくなりすぎないようにする上限です。',
  '入射角回復率': '入射角損失のうち、ナミゲートがどれだけ回復できると仮定するかです。',
  '設置効率': '理想的な改善量に対して、実際の設置で得られる割合です。',
  '追加損失': '取り付け状態や位置ずれなどで差し引く損失です。',
  '最大総改善量': 'ナミゲートによる総改善量の上限です。',
  '接続しきい値': 'このRSRP以上なら接続可能とみなす判定基準です。',
  '測定高さ': '実測時の端末またはアンテナ高さです。比較時は高さを固定すると誤差を読みやすくなります。',
  '平均化時間': '1点あたり何秒測って平均するかです。短すぎると瞬間的なフェージングの影響が残ります。',
  'サンプル数/点': '1つの測定点で記録するサンプル数です。ばらつき確認に使います。',
}

const SAMPLE_MEASUREMENT_CSV = [
  'point,scenario,x_m,y_m,height_m,rsrp_dbm,rsrq_db,sinr_db,dl_mbps,ul_mbps,timestamp,device,antenna_direction,note',
  'P1,noWindow,4,2,1.2,-65,-9,18,280,42,2026-06-16T10:00:00,UE-A,窓向き,窓なし基準',
  'P1,withWindow,4,2,1.2,-106,-14,4,18,3,2026-06-16T10:05:00,UE-A,窓向き,Low-E越し',
  'P1,withNamigate,4,2,1.2,-80,-10,15,190,28,2026-06-16T10:10:00,UE-A,窓向き,ナミゲート中央',
  'P2,withNamigate,4,8,1.2,-91,-11,11,92,17,2026-06-16T10:15:00,UE-A,窓向き,室内奥側',
].join('\n')

const DEFAULT_SETTINGS: Settings = {
  modulePresetId: 'custom',
  frequencyMHz: 4700,
  eirpMode: 'direct',
  eirpDbm: 43,
  txPowerDbm: 30,
  txAntennaGainDbi: 15,
  txAntennaHeightM: 5,
  txCableLossDb: 1,
  txOtherLossDb: 1,
  rxAntennaGainDbi: 0,
  rxAntennaHeightM: 1.2,
  rxCableLossDb: 0,
  rxBodyLossDb: 0,
  antennaAlignmentLossDb: 0,
  polarizationLossDb: 0,
  fadeMarginDb: 0,
  outdoorModelId: 'fspl',
  outdoorDistanceM: 100,
  outdoorObstructionLossDb: 0,
  windowPresetId: 'lowE',
  windowLossDb: 40,
  windowWidthM: 2.4,
  windowHeightM: 1.8,
  windowCenterHeightM: 1.6,
  incidentAngleDeg: 60,
  roomWidthM: 8,
  roomDepthM: 12,
  indoorDistanceM: 8,
  indoorPathLossExponent: 2.2,
  indoorObstacleLossDb: 0,
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

const DEFAULT_PROTOCOL: TestProtocol = {
  siteName: '',
  operatorName: '',
  deviceName: '',
  measurementHeightM: 1.2,
  averagingSeconds: 30,
  samplesPerPoint: 10,
  antennaDirection: '窓面へ正対',
  weather: '',
  notes: '',
  checklist: {
    sameDevice: false,
    sameHeight: false,
    fixedWindowPosition: false,
    sameAntennaDirection: false,
    averagedSamples: false,
    recordedEnvironment: false,
  },
}

const PROTOCOL_CHECKLIST_LABELS: Record<ProtocolChecklistKey, string> = {
  sameDevice: '同一端末・同一SIMで測定',
  sameHeight: '測定高さを固定',
  fixedWindowPosition: '窓・ナミゲート位置を記録',
  sameAntennaDirection: '端末/アンテナ向きを固定',
  averagedSamples: '複数サンプルを平均化',
  recordedEnvironment: '天候・人流・遮蔽物を記録',
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

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && nextCharacter === '"') {
      current += '"'
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (character === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += character
  }

  values.push(current.trim())
  return values
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()[\]{}]/g, '')
    .replace(/_/g, '')
}

function getCsvValue(
  row: Record<string, string>,
  names: string[],
  fallback = '',
) {
  for (const name of names) {
    const normalizedName = normalizeHeader(name)
    if (row[normalizedName] !== undefined && row[normalizedName] !== '') {
      return row[normalizedName]
    }
  }

  return fallback
}

function parseCsvNumber(
  row: Record<string, string>,
  names: string[],
  fallback: number | null = null,
) {
  const value = getCsvValue(row, names)
  const parsed = Number(value)
  return value !== '' && Number.isFinite(parsed) ? parsed : fallback
}

function normalizeScenario(value: string): ScenarioKey {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[+＋\s_-]/g, '')

  if (
    normalized.includes('namigate') ||
    normalized.includes('withnamigate') ||
    normalized.includes('ナミゲート')
  ) {
    return 'withNamigate'
  }

  if (
    normalized.includes('withwindow') ||
    normalized.includes('window') ||
    normalized.includes('窓あり') ||
    normalized.includes('窓有')
  ) {
    return 'withWindow'
  }

  return 'noWindow'
}

function parseMeasurementCsv(text: string): MeasurementPoint[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  if (lines.length < 2) {
    return []
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)

  return lines
    .slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line)
      const row = headers.reduce<Record<string, string>>((accumulator, header, column) => {
        accumulator[header] = values[column] ?? ''
        return accumulator
      }, {})
      const scenario = normalizeScenario(
        getCsvValue(row, ['scenario', 'condition', '状態', '条件'], 'noWindow'),
      )
      const xM = parseCsvNumber(row, ['x_m', 'xm', 'x', 'x[m]', '横位置m'], 0)
      const yM = parseCsvNumber(
        row,
        ['y_m', 'ym', 'y', 'y[m]', 'depth_m', '室内距離m', '奥行m'],
        1,
      )
      const heightM = parseCsvNumber(
        row,
        ['height_m', 'heightm', 'height', 'h_m', '測定高さm', '高さm'],
        DEFAULT_PROTOCOL.measurementHeightM,
      )
      const rsrpDbm = parseCsvNumber(
        row,
        ['rsrp_dbm', 'rsrpdbm', 'rsrp', 'rsrp[dBm]', 'RSRP'],
        null,
      )

      if (rsrpDbm === null || xM === null || yM === null || heightM === null) {
        return null
      }

      return {
        id: `${Date.now()}-${index}`,
        name:
          getCsvValue(row, ['point', 'name', '測定点', 'point_name'], '') ||
          `P${index + 1}`,
        scenario,
        xM,
        yM,
        heightM,
        rsrpDbm,
        rsrqDb: parseCsvNumber(row, ['rsrq_db', 'rsrqdb', 'rsrq'], null),
        sinrDb: parseCsvNumber(row, ['sinr_db', 'sinrdb', 'sinr'], null),
        dlMbps: parseCsvNumber(
          row,
          ['dl_mbps', 'dlmbps', 'downlink_mbps', 'download', 'dl'],
          null,
        ),
        ulMbps: parseCsvNumber(
          row,
          ['ul_mbps', 'ulmbps', 'uplink_mbps', 'upload', 'ul'],
          null,
        ),
        timestamp: getCsvValue(row, ['timestamp', 'time', 'datetime', '時刻'], ''),
        device: getCsvValue(row, ['device', 'ue', 'terminal', '端末'], ''),
        antennaDirection: getCsvValue(
          row,
          ['antenna_direction', 'antenna', 'direction', 'アンテナ向き'],
          '',
        ),
        note: getCsvValue(row, ['note', 'memo', '備考', 'メモ'], ''),
      }
    })
    .filter((point): point is MeasurementPoint => point !== null)
}

function log10(value: number) {
  return Math.log10(Math.max(value, 0.000001))
}

function calculateFsplDb(frequencyMHz: number, distanceM: number) {
  const safeFrequencyMHz = Math.max(frequencyMHz, 1)
  const safeDistanceKm = Math.max(distanceM, 1) / 1000
  return 32.44 + 20 * log10(safeFrequencyMHz) + 20 * log10(safeDistanceKm)
}

function isHataModel(modelId: OutdoorModelId) {
  return HATA_MODEL_IDS.has(modelId)
}

function getOutdoorModelLabel(modelId: OutdoorModelId) {
  return (
    OUTDOOR_MODEL_PRESETS.find((preset) => preset.id === modelId)?.label ??
    '自由空間損失（FSPL）'
  )
}

function calculateOutdoorLinkDistanceM(settings: Settings) {
  return Math.max(
    Math.hypot(
      Math.max(settings.outdoorDistanceM, 1),
      settings.txAntennaHeightM - settings.windowCenterHeightM,
    ),
    1,
  )
}

function calculateHataMobileCorrectionDb(
  frequencyMHz: number,
  mobileHeightM: number,
  citySize: 'small' | 'large',
) {
  const safeFrequencyMHz = Math.max(frequencyMHz, 1)
  const safeMobileHeightM = Math.max(mobileHeightM, 0.1)
  const logFrequency = log10(safeFrequencyMHz)

  if (citySize === 'large') {
    if (safeFrequencyMHz <= 200) {
      return 8.29 * Math.pow(log10(1.54 * safeMobileHeightM), 2) - 1.1
    }

    return 3.2 * Math.pow(log10(11.75 * safeMobileHeightM), 2) - 4.97
  }

  return (
    (1.1 * logFrequency - 0.7) * safeMobileHeightM -
    (1.56 * logFrequency - 0.8)
  )
}

function calculateHataUrbanLossDb(
  settings: Settings,
  citySize: 'small' | 'large',
) {
  const frequencyMHz = Math.max(settings.frequencyMHz, 1)
  const baseHeightM = Math.max(settings.txAntennaHeightM, 0.1)
  const mobileHeightM = Math.max(settings.rxAntennaHeightM, 0.1)
  const distanceKm = Math.max(calculateOutdoorLinkDistanceM(settings) / 1000, 0.001)
  const logFrequency = log10(frequencyMHz)
  const logBaseHeight = log10(baseHeightM)
  const mobileCorrectionDb = calculateHataMobileCorrectionDb(
    frequencyMHz,
    mobileHeightM,
    citySize,
  )

  return (
    69.55 +
    26.16 * logFrequency -
    13.82 * logBaseHeight -
    mobileCorrectionDb +
    (44.9 - 6.55 * logBaseHeight) * log10(distanceKm)
  )
}

function calculateHataPathLossDb(settings: Settings) {
  const urbanSmallDb = calculateHataUrbanLossDb(settings, 'small')
  const urbanLargeDb = calculateHataUrbanLossDb(settings, 'large')
  const logFrequency = log10(Math.max(settings.frequencyMHz, 1))

  if (settings.outdoorModelId === 'hataUrbanLarge') {
    return urbanLargeDb
  }

  if (settings.outdoorModelId === 'hataSuburban') {
    return urbanSmallDb - 2 * Math.pow(log10(settings.frequencyMHz / 28), 2) - 5.4
  }

  if (settings.outdoorModelId === 'hataOpen') {
    return urbanSmallDb - 4.78 * Math.pow(logFrequency, 2) + 18.33 * logFrequency - 40.94
  }

  return urbanSmallDb
}

function calculateOutdoorPathLossDb(settings: Settings) {
  if (isHataModel(settings.outdoorModelId)) {
    return calculateHataPathLossDb(settings)
  }

  return calculateFsplDb(settings.frequencyMHz, calculateOutdoorLinkDistanceM(settings))
}

function getHataValidityMessages(settings: Settings) {
  if (!isHataModel(settings.outdoorModelId)) {
    return []
  }

  const messages: string[] = []
  const outdoorDistanceKm = calculateOutdoorLinkDistanceM(settings) / 1000

  if (settings.frequencyMHz < 150 || settings.frequencyMHz > 1500) {
    messages.push('周波数150-1500MHz外')
  }

  if (outdoorDistanceKm < 1 || outdoorDistanceKm > 20) {
    messages.push('屋外距離1-20km外')
  }

  if (settings.txAntennaHeightM < 30 || settings.txAntennaHeightM > 200) {
    messages.push('送信アンテナ高30-200m外')
  }

  if (settings.rxAntennaHeightM < 1 || settings.rxAntennaHeightM > 10) {
    messages.push('受信アンテナ高1-10m外')
  }

  return messages
}

function getOutdoorModelNotice(settings: Settings) {
  if (!isHataModel(settings.outdoorModelId)) {
    return 'FSPLは見通し基準の単純モデルです。市街地の回折・建物群・地形による追加損失は、屋外遮蔽損失や実測校正で見込んでください。'
  }

  const validityMessages = getHataValidityMessages(settings)
  const baseText =
    '奥村-秦モデルは、周波数150-1500MHz、距離1-20km、基地局高30-200m、移動局高1-10m程度を前提にした経験式です。'

  if (validityMessages.length === 0) {
    return `${baseText} 現在の入力は代表的な適用範囲内です。`
  }

  return `${baseText} 現在は適用範囲外: ${validityMessages.join('、')}。ローカル5GのSub6/ミリ波では比較用プリセットとして扱い、実測で校正してください。`
}

function calculateIndoorLinkDistanceM(
  settings: Settings,
  horizontalDistanceM = settings.indoorDistanceM,
  receiverHeightM = settings.rxAntennaHeightM,
) {
  return Math.max(
    Math.hypot(
      Math.max(horizontalDistanceM, 0),
      receiverHeightM - settings.windowCenterHeightM,
    ),
    1,
  )
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
    settings.antennaAlignmentLossDb -
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
  receiverHeightM = settings.rxAntennaHeightM,
) {
  const outdoorPathLossDb = calculateOutdoorPathLossDb(settings)
  const indoorLossDb = calculateIndoorLossDb(
    calculateIndoorLinkDistanceM(settings, indoorDistanceM, receiverHeightM),
    settings.indoorPathLossExponent,
  )

  return (
    calculateEffectiveEirpDbm(settings) +
    calculateReceiverAdjustmentDb(settings) +
    settings.groundReflectionDb -
    settings.outdoorObstructionLossDb -
    outdoorPathLossDb -
    indoorLossDb -
    settings.indoorObstacleLossDb +
    getScenarioAdjustmentDb(settings, scenario)
  )
}

function calculateMaxReachM(settings: Settings, scenario: ScenarioKey) {
  const outdoorPathLossDb = calculateOutdoorPathLossDb(settings)
  const beforeIndoorLossDb =
    calculateEffectiveEirpDbm(settings) +
    calculateReceiverAdjustmentDb(settings) +
    settings.groundReflectionDb -
    settings.outdoorObstructionLossDb -
    outdoorPathLossDb -
    settings.indoorObstacleLossDb +
    getScenarioAdjustmentDb(settings, scenario)

  if (beforeIndoorLossDb < settings.connectionThresholdDbm) {
    return 0
  }

  const exponent = Math.max(settings.indoorPathLossExponent, 0.1)
  const maxLinkDistanceM = Math.pow(
    10,
    (beforeIndoorLossDb - settings.connectionThresholdDbm) / (10 * exponent),
  )
  const heightDeltaM = Math.abs(settings.rxAntennaHeightM - settings.windowCenterHeightM)

  if (maxLinkDistanceM <= heightDeltaM) {
    return 0
  }

  return Math.sqrt(maxLinkDistanceM * maxLinkDistanceM - heightDeltaM * heightDeltaM)
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

function getMeasurementPointDistanceM(settings: Settings, point: MeasurementPoint) {
  const windowCenterX = Math.max(settings.roomWidthM, 1) / 2
  return Math.max(Math.hypot(point.xM - windowCenterX, point.yM), 1)
}

function buildPointComparisons(
  settings: Settings,
  points: MeasurementPoint[],
): PointComparison[] {
  return points.map((point) => {
    const horizontalDistanceM = getMeasurementPointDistanceM(settings, point)
    const distanceM = calculateIndoorLinkDistanceM(
      settings,
      horizontalDistanceM,
      point.heightM,
    )
    const estimatedRsrpDbm = calculateRsrpDbm(
      settings,
      point.scenario,
      horizontalDistanceM,
      point.heightM,
    )

    return {
      ...point,
      distanceM,
      estimatedRsrpDbm,
      residualDb: point.rsrpDbm - estimatedRsrpDbm,
    }
  })
}

function calculateErrorStats(residuals: number[]): ErrorStats {
  if (residuals.length === 0) {
    return {
      count: 0,
      meanResidualDb: null,
      maeDb: null,
      rmseDb: null,
      stddevDb: null,
      maxAbsDb: null,
    }
  }

  const meanResidualDb =
    residuals.reduce((sum, value) => sum + value, 0) / residuals.length
  const maeDb =
    residuals.reduce((sum, value) => sum + Math.abs(value), 0) / residuals.length
  const rmseDb = Math.sqrt(
    residuals.reduce((sum, value) => sum + value * value, 0) / residuals.length,
  )
  const stddevDb = Math.sqrt(
    residuals.reduce(
      (sum, value) => sum + Math.pow(value - meanResidualDb, 2),
      0,
    ) / residuals.length,
  )
  const maxAbsDb = Math.max(...residuals.map((value) => Math.abs(value)))

  return {
    count: residuals.length,
    meanResidualDb,
    maeDb,
    rmseDb,
    stddevDb,
    maxAbsDb,
  }
}

function averageNullable(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => value !== null)

  if (numbers.length === 0) {
    return null
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

function calculateQualityStats(
  points: MeasurementPoint[],
  thresholdDbm: number,
): QualityStats {
  if (points.length === 0) {
    return {
      pointCount: 0,
      avgRsrqDb: null,
      avgSinrDb: null,
      avgDlMbps: null,
      avgUlMbps: null,
      connectedRatio: null,
    }
  }

  const connectedCount = points.filter((point) => point.rsrpDbm >= thresholdDbm).length

  return {
    pointCount: points.length,
    avgRsrqDb: averageNullable(points.map((point) => point.rsrqDb)),
    avgSinrDb: averageNullable(points.map((point) => point.sinrDb)),
    avgDlMbps: averageNullable(points.map((point) => point.dlMbps)),
    avgUlMbps: averageNullable(points.map((point) => point.ulMbps)),
    connectedRatio: (connectedCount / points.length) * 100,
  }
}

function calculateCalibrationResult(
  settings: Settings,
  points: MeasurementPoint[],
  measuredComparisons: MeasuredComparison[],
): CalibrationResult {
  const beforeStats = calculateErrorStats(
    buildPointComparisons(settings, points).map((comparison) => comparison.residualDb),
  )
  const noWindowPoints = points.filter((point) => point.scenario === 'noWindow')
  let recommendedIndoorPathLossExponent = settings.indoorPathLossExponent

  if (noWindowPoints.length >= 2) {
    let bestRmse = Number.POSITIVE_INFINITY

    for (let exponent = 0.8; exponent <= 4.01; exponent += 0.05) {
      const candidateSettings = {
        ...settings,
        indoorPathLossExponent: exponent,
      }
      const residuals = buildPointComparisons(candidateSettings, noWindowPoints).map(
        (comparison) => comparison.residualDb,
      )
      const rmseDb = calculateErrorStats(residuals).rmseDb ?? Number.POSITIVE_INFINITY

      if (rmseDb < bestRmse) {
        bestRmse = rmseDb
        recommendedIndoorPathLossExponent = exponent
      }
    }
  }

  const exponentSettings = {
    ...settings,
    indoorPathLossExponent: recommendedIndoorPathLossExponent,
  }
  const withWindowPoints = points.filter((point) => point.scenario === 'withWindow')
  const angleLossDb = getEffectiveAngleLossDb(settings)
  const windowLossCandidates = withWindowPoints.map((point) => {
    const noWindowEstimate = calculateRsrpDbm(
      exponentSettings,
      'noWindow',
      getMeasurementPointDistanceM(settings, point),
      point.heightM,
    )
    return noWindowEstimate - point.rsrpDbm - angleLossDb
  })
  const manualWindowLossCandidate =
    measuredComparisons[0].measuredRsrpDbm !== null &&
    measuredComparisons[1].measuredRsrpDbm !== null
      ? measuredComparisons[0].measuredRsrpDbm -
        measuredComparisons[1].measuredRsrpDbm -
        angleLossDb
      : null
  const recommendedWindowLossDb = clamp(
    averageNullable([
      ...windowLossCandidates,
      manualWindowLossCandidate,
    ]) ?? settings.windowLossDb,
    0,
    80,
  )
  const windowCalibratedSettings = {
    ...exponentSettings,
    windowPresetId: 'custom' as WindowPresetId,
    windowLossDb: recommendedWindowLossDb,
  }
  const withNamigatePoints = points.filter((point) => point.scenario === 'withNamigate')
  const totalGainCandidates = withNamigatePoints.map((point) => {
    const withWindowEstimate = calculateRsrpDbm(
      windowCalibratedSettings,
      'withWindow',
      getMeasurementPointDistanceM(settings, point),
      point.heightM,
    )
    return point.rsrpDbm - withWindowEstimate
  })
  const manualNamigateGainCandidate =
    measuredComparisons[1].measuredRsrpDbm !== null &&
    measuredComparisons[2].measuredRsrpDbm !== null
      ? measuredComparisons[2].measuredRsrpDbm -
        measuredComparisons[1].measuredRsrpDbm
      : null
  const recommendedTotalNamigateGainDb = clamp(
    averageNullable([
      ...totalGainCandidates,
      manualNamigateGainCandidate,
    ]) ?? calculateNamigateTotalGainDb(settings),
    0,
    Math.max(settings.namigateMaxTotalGainDb, 0),
  )
  const efficiency = Math.max(settings.namigateInstallationEfficiencyPercent, 0.001) / 100
  const recommendedNamigateGainDb = clamp(
    recommendedTotalNamigateGainDb / efficiency +
      settings.namigateAdditionalLossDb -
      calculateAreaGainDb(settings) -
      calculateNamigateAngleRecoveryDb(settings),
    0,
    Math.max(settings.namigateMaxTotalGainDb, 0),
  )
  const afterSettings = {
    ...windowCalibratedSettings,
    namigatePresetId: 'custom' as NamigatePresetId,
    namigateGainDb: recommendedNamigateGainDb,
  }
  const afterStats = calculateErrorStats(
    buildPointComparisons(afterSettings, points).map((comparison) => comparison.residualDb),
  )
  const pointCount = points.length
  const hasManualValues = measuredComparisons.some(
    (comparison) => comparison.measuredRsrpDbm !== null,
  )

  return {
    source:
      pointCount > 0
        ? 'CSV実測点'
        : hasManualValues
          ? '3状態の手入力値'
          : '未入力',
    pointCount,
    recommendedWindowLossDb,
    recommendedIndoorPathLossExponent,
    recommendedNamigateGainDb,
    recommendedTotalNamigateGainDb,
    beforeRmseDb: beforeStats.rmseDb,
    afterRmseDb: afterStats.rmseDb,
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

function formatOptionalMbps(value: number | null) {
  return value === null ? '未入力' : `${numberFormatter.format(value)} Mbps`
}

function formatOptionalPercent(value: number | null) {
  return value === null ? '未入力' : `${numberFormatter.format(value)}%`
}

function formatMultiplier(value: number) {
  if (value >= 1000) {
    return `${compactNumberFormatter.format(value)}倍`
  }

  return `${numberFormatter.format(value)}倍`
}

function getModulePresetLabel(id: ModulePresetId) {
  return MODULE_PRESETS.find((preset) => preset.id === id)?.label ?? '任意'
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

function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      <span aria-hidden="true">?</span>
      <span className="help-bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}

function TermLabel({ label, help }: { label: string; help?: string }) {
  return (
    <span className="field-label">
      {label}
      {help ? <HelpTip text={help} /> : null}
    </span>
  )
}

function HelpChip({ label }: { label: keyof typeof HELP_TEXT }) {
  return (
    <span className="help-chip">
      {label}
      <HelpTip text={HELP_TEXT[label]} />
    </span>
  )
}

function buildMeasurementCsv(points: MeasurementPoint[]) {
  const escape = (value: string | number | null) => {
    if (value === null) {
      return ''
    }

    const text = String(value)
    return text.includes(',') || text.includes('"') || text.includes('\n')
      ? `"${text.replace(/"/g, '""')}"`
      : text
  }

  return [
    'point,scenario,x_m,y_m,height_m,rsrp_dbm,rsrq_db,sinr_db,dl_mbps,ul_mbps,timestamp,device,antenna_direction,note',
    ...points.map((point) =>
      [
        point.name,
        point.scenario,
        point.xM,
        point.yM,
        point.heightM,
        point.rsrpDbm,
        point.rsrqDb,
        point.sinrDb,
        point.dlMbps,
        point.ulMbps,
        point.timestamp,
        point.device,
        point.antennaDirection,
        point.note,
      ]
        .map(escape)
        .join(','),
    ),
  ].join('\n')
}

function downloadTextFile(filename: string, text: string, mimeType = 'text/plain') {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function loadSavedTestCases(): SavedTestCase[] {
  try {
    const raw = localStorage.getItem(SAVED_CASES_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedTestCase[]) : []
  } catch {
    return []
  }
}

function persistSavedTestCases(cases: SavedTestCase[]) {
  localStorage.setItem(SAVED_CASES_STORAGE_KEY, JSON.stringify(cases))
}

function buildExperimentReport({
  settings,
  protocol,
  scenarioResults,
  pointComparisons,
  errorStats,
  qualityStats,
  calibration,
  sensitivityRows,
  confidenceRows,
}: {
  settings: Settings
  protocol: TestProtocol
  scenarioResults: ScenarioResult[]
  pointComparisons: PointComparison[]
  errorStats: ErrorStats
  qualityStats: QualityStats
  calibration: CalibrationResult
  sensitivityRows: Array<{
    label: string
    rsrpDbm: number
    connectedAreaM2: number
    maxReachM: number
    deltaRsrpDb: number
  }>
  confidenceRows: Array<{
    label: string
    rsrpDbm: number
    connectedAreaM2: number
    maxReachM: number
  }>
}) {
  const pointRows = pointComparisons
    .map(
      (point) =>
	        `| ${point.name} | ${
	          SCENARIOS.find((scenario) => scenario.key === point.scenario)?.label
	        } | ${numberFormatter.format(point.xM)} | ${numberFormatter.format(
	          point.yM,
	        )} | ${formatMeters(point.heightM)} | ${formatMeters(point.distanceM)} | ${formatDbm(point.rsrpDbm)} | ${formatDbm(
	          point.estimatedRsrpDbm,
	        )} | ${formatDb(point.residualDb)} | ${formatOptionalDb(
	          point.sinrDb,
        )} | ${formatOptionalMbps(point.dlMbps)} |`,
    )
    .join('\n')
  const sensitivityRowsText = sensitivityRows
    .map(
      (row) =>
        `| ${row.label} | ${formatDbm(row.rsrpDbm)} | ${formatDb(
          row.deltaRsrpDb,
        )} | ${formatArea(row.connectedAreaM2)} | ${formatMeters(row.maxReachM)} |`,
    )
    .join('\n')
  const confidenceRowsText = confidenceRows
    .map(
      (row) =>
        `| ${row.label} | ${formatDbm(row.rsrpDbm)} | ${formatArea(
          row.connectedAreaM2,
        )} | ${formatMeters(row.maxReachM)} |`,
    )
    .join('\n')

  return [
    '# ローカル5G 窓面電波改善 実証試験レポート',
    '',
    '## 試験条件',
    `- 試験場所: ${protocol.siteName || '未入力'}`,
    `- 測定者: ${protocol.operatorName || '未入力'}`,
    `- 端末: ${protocol.deviceName || '未入力'}`,
    `- 測定高さ: ${formatMeters(protocol.measurementHeightM)}`,
    `- 平均化時間: ${numberFormatter.format(protocol.averagingSeconds)} 秒`,
    `- サンプル数/点: ${numberFormatter.format(protocol.samplesPerPoint)}`,
    `- アンテナ/端末向き: ${protocol.antennaDirection || '未入力'}`,
    `- 天候・環境: ${protocol.weather || '未入力'}`,
    '',
	    '## 入力モデル',
	    `- 無線機プリセット: ${getModulePresetLabel(settings.modulePresetId)}`,
	    `- 周波数: ${numberFormatter.format(settings.frequencyMHz)} MHz`,
	    `- 屋外伝搬モデル: ${getOutdoorModelLabel(settings.outdoorModelId)}`,
	    `- 屋外伝搬損失: ${formatDb(calculateOutdoorPathLossDb(settings))}`,
	    `- 屋外伝搬モデルメモ: ${getOutdoorModelNotice(settings)}`,
	    `- 実効EIRP: ${formatDbm(calculateEffectiveEirpDbm(settings))}`,
	    `- 屋外水平距離: ${formatMeters(settings.outdoorDistanceM)}`,
	    `- 屋外3D距離: ${formatMeters(calculateOutdoorLinkDistanceM(settings))}`,
	    `- 送信アンテナ高: ${formatMeters(settings.txAntennaHeightM)}`,
	    `- 窓中心高: ${formatMeters(settings.windowCenterHeightM)}`,
	    `- 受信アンテナ高: ${formatMeters(settings.rxAntennaHeightM)}`,
	    `- アンテナ指向ずれ損失: ${formatDb(settings.antennaAlignmentLossDb)}`,
	    `- 屋外遮蔽損失: ${formatDb(settings.outdoorObstructionLossDb)}`,
	    `- 屋内遮蔽損失: ${formatDb(settings.indoorObstacleLossDb)}`,
	    `- 窓損失: ${formatDb(settings.windowLossDb)}`,
	    `- 入射角: ${numberFormatter.format(settings.incidentAngleDeg)}°`,
	    `- 屋内伝搬指数: ${numberFormatter.format(settings.indoorPathLossExponent)}`,
	    `- ナミゲート総改善量: ${formatDb(calculateNamigateTotalGainDb(settings))}`,
	    `- 法規制メモ: 本ツールはEIRP等の法令上限適合を判定しません。最新の総務省ガイドライン、免許条件、管轄総合通信局の確認が必要です。`,
    '',
    '## 3状態推定',
    '| 状態 | RSRP | 接続可能面積 | 最大到達距離 |',
    '| --- | ---: | ---: | ---: |',
    ...scenarioResults.map(
      (scenario) =>
        `| ${scenario.label} | ${formatDbm(scenario.rsrpDbm)} | ${formatArea(
          scenario.connectedAreaM2,
        )} | ${formatMeters(scenario.maxReachM)} |`,
    ),
    '',
    '## 実測点誤差',
    `- 実測点数: ${numberFormatter.format(errorStats.count)}`,
    `- 平均誤差: ${formatOptionalDb(errorStats.meanResidualDb)}`,
    `- MAE: ${formatOptionalDb(errorStats.maeDb)}`,
    `- RMSE: ${formatOptionalDb(errorStats.rmseDb)}`,
    `- 標準偏差: ${formatOptionalDb(errorStats.stddevDb)}`,
    `- 最大絶対誤差: ${formatOptionalDb(errorStats.maxAbsDb)}`,
    '',
    '## 品質指標',
    `- 接続可能率: ${formatOptionalPercent(qualityStats.connectedRatio)}`,
    `- 平均RSRQ: ${formatOptionalDb(qualityStats.avgRsrqDb)}`,
    `- 平均SINR: ${formatOptionalDb(qualityStats.avgSinrDb)}`,
    `- 平均DL: ${formatOptionalMbps(qualityStats.avgDlMbps)}`,
    `- 平均UL: ${formatOptionalMbps(qualityStats.avgUlMbps)}`,
    '',
    '## 校正候補',
    `- データ源: ${calibration.source}`,
    `- 推奨 窓損失: ${formatDb(calibration.recommendedWindowLossDb)}`,
    `- 推奨 屋内伝搬指数: ${numberFormatter.format(
      calibration.recommendedIndoorPathLossExponent,
    )}`,
    `- 推奨 ナミゲート改善量: ${formatDb(calibration.recommendedNamigateGainDb)}`,
    `- 校正前RMSE: ${formatOptionalDb(calibration.beforeRmseDb)}`,
    `- 校正後RMSE: ${formatOptionalDb(calibration.afterRmseDb)}`,
	    '',
	    '## 実測点一覧',
	    '| 点 | 状態 | x[m] | y[m] | 高さ | 3D距離 | 実測RSRP | 推定RSRP | 差分 | SINR | DL |',
	    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
	    pointRows || '| 未入力 | - | - | - | - | - | - | - | - | - | - |',
    '',
    '## 感度分析',
    '| 条件 | RSRP | 標準との差 | 接続可能面積 | 最大到達距離 |',
    '| --- | ---: | ---: | ---: | ---: |',
    sensitivityRowsText,
    '',
    '## 信頼ケース',
    '| ケース | RSRP | 接続可能面積 | 最大到達距離 |',
    '| --- | ---: | ---: | ---: |',
    confidenceRowsText,
    '',
    '## 備考',
    protocol.notes || '未入力',
    '',
    '## 注意',
    'これは厳密な電磁界解析ではなく、営業・技術検討用の簡易シミュレータである。',
  ].join('\n')
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
	    `- 無線機プリセット: ${getModulePresetLabel(settings.modulePresetId)}`,
	    `- 周波数: ${numberFormatter.format(settings.frequencyMHz)} MHz`,
	    `- 屋外伝搬モデル: ${getOutdoorModelLabel(settings.outdoorModelId)}`,
	    `- 屋外伝搬損失: ${formatDb(calculateOutdoorPathLossDb(settings))}`,
	    `- 屋外伝搬モデルメモ: ${getOutdoorModelNotice(settings)}`,
    `- EIRP計算方式: ${settings.eirpMode === 'direct' ? '直接入力' : '無線機詳細から計算'}`,
    `- 実効EIRP: ${formatDbm(effectiveEirpDbm)}`,
    `- EIRP直接入力: ${formatDbm(settings.eirpDbm)}`,
	    `- 詳細EIRP: ${formatDbm(detailedEirpDbm)} = 送信出力 ${formatDbm(
	      settings.txPowerDbm,
	    )} + 送信アンテナ利得 ${formatDb(settings.txAntennaGainDbi)} - 送信給電損失 ${formatDb(
	      settings.txCableLossDb,
	    )} - その他送信損失 ${formatDb(settings.txOtherLossDb)}`,
	    `- 送信アンテナ高: ${formatMeters(settings.txAntennaHeightM)}`,
	    `- 受信系補正: ${formatDb(receiverAdjustmentDb)} = 受信アンテナ利得 ${formatDb(
	      settings.rxAntennaGainDbi,
	    )} - 受信給電損失 ${formatDb(settings.rxCableLossDb)} - 受信機内部損失 ${formatDb(
	      settings.rxBodyLossDb,
	    )} - アンテナ指向ずれ損失 ${formatDb(
	      settings.antennaAlignmentLossDb,
	    )} - 偏波不整合損失 ${formatDb(settings.polarizationLossDb)} - フェージングマージン ${formatDb(
	      settings.fadeMarginDb,
	    )}`,
	    `- 受信アンテナ高: ${formatMeters(settings.rxAntennaHeightM)}`,
	    `- 屋外水平距離: ${formatMeters(settings.outdoorDistanceM)}`,
	    `- 屋外3D距離: ${formatMeters(calculateOutdoorLinkDistanceM(settings))}`,
	    `- 室内水平距離: ${formatMeters(settings.indoorDistanceM)}`,
	    `- 室内3D距離: ${formatMeters(calculateIndoorLinkDistanceM(settings))}`,
	    `- 地面反射補正: ${formatDb(settings.groundReflectionDb)}`,
	    `- 屋外遮蔽損失: ${formatDb(settings.outdoorObstructionLossDb)}`,
	    `- 窓種別: ${windowLabel}`,
	    `- 窓損失: ${formatDb(settings.windowLossDb)}`,
	    `- 窓サイズ: ${numberFormatter.format(settings.windowWidthM)} x ${numberFormatter.format(
	      settings.windowHeightM,
	    )} m`,
	    `- 窓中心高: ${formatMeters(settings.windowCenterHeightM)}`,
	    `- 入射角: ${numberFormatter.format(settings.incidentAngleDeg)} deg`,
	    `- 入射角損失: ${formatDb(angleLossDb)}`,
	    `- 部屋サイズ: ${numberFormatter.format(settings.roomWidthM)} x ${numberFormatter.format(
	      settings.roomDepthM,
	    )} m`,
	    `- 屋内伝搬指数: ${numberFormatter.format(settings.indoorPathLossExponent)}`,
	    `- 屋内遮蔽損失: ${formatDb(settings.indoorObstacleLossDb)}`,
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
	    `- 法規制メモ: このコピー内容は技術検討用であり、EIRP、空中線電力、設置場所、周波数帯の法令適合を判定するものではありません。`,
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
  help,
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
      <TermLabel label={label} help={help ?? HELP_TEXT[label]} />
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

function PositionScene3D({
  settings,
  angleLossDb,
  areaGainDb,
  measurementPoints = [],
}: PositionDiagramProps) {
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
	    const windowCenterY = clamp(
	      settings.windowCenterHeightM,
	      windowHeightM / 2 + 0.1,
	      12,
	    )
	    const windowBottomM = windowCenterY - windowHeightM / 2
	    const transmitterHeightY = clamp(settings.txAntennaHeightM, 0.4, 12)
	    const receiverHeightY = clamp(settings.rxAntennaHeightM, 0.35, 5)
	    const wallHeightM = Math.max(
	      3.2,
	      windowBottomM + windowHeightM + 0.72,
	      transmitterHeightY + 0.8,
	      receiverHeightY + 0.8,
	    )
	    const receiverZ = clamp(settings.indoorDistanceM, 0.7, roomDepthM - 0.45)
	    const safeAngle = clamp(settings.incidentAngleDeg, 15, 90)
	    const outdoorDisplayM = clamp(Math.log10(Math.max(settings.outdoorDistanceM, 1)) * 2.6, 3, 9)
    const transmitterX = clamp(
      -Math.tan(((90 - safeAngle) * Math.PI) / 180) * outdoorDisplayM,
      -roomWidthM / 2 + 0.6,
      roomWidthM / 2 - 0.6,
	    )
	    const transmitterZ = -outdoorDisplayM
	    const transmitterPoint = new THREE.Vector3(transmitterX, transmitterHeightY, transmitterZ)
	    const windowPoint = new THREE.Vector3(0, windowCenterY, 0)
	    const receiverPoint = new THREE.Vector3(0, receiverHeightY, receiverZ)

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
	      new THREE.CylinderGeometry(0.055, 0.08, transmitterHeightY, 16),
	      new THREE.MeshStandardMaterial({ color: 0x16212c, roughness: 0.55 }),
	    )
	    mast.position.y = transmitterHeightY / 2
	    transmitterGroup.add(mast)
    const transmitterHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0x16212c, roughness: 0.35 }),
    )
	    transmitterHead.position.y = transmitterHeightY
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
	      { label: makeLabel('送信機'), position: new THREE.Vector3(transmitterX, transmitterHeightY + 0.55, transmitterZ) },
	      { label: makeLabel(`送信高 ${formatMeters(settings.txAntennaHeightM)}`), position: new THREE.Vector3(transmitterX + 0.85, transmitterHeightY / 2, transmitterZ) },
	      { label: makeLabel(`屋外3D ${formatMeters(calculateOutdoorLinkDistanceM(settings))}`), position: new THREE.Vector3(transmitterX / 2, 0.42, transmitterZ / 2) },
	      { label: makeLabel(`入射角 ${numberFormatter.format(safeAngle)}°`, '#c96c34'), position: new THREE.Vector3(transmitterX * 0.28, windowCenterY + 0.35, -0.72) },
	      { label: makeLabel(`窓幅 ${numberFormatter.format(settings.windowWidthM)}m`, '#0071BD'), position: new THREE.Vector3(0, windowWidthLineY + 0.18, -0.1) },
	      { label: makeLabel(`窓高 ${numberFormatter.format(settings.windowHeightM)}m`, '#0071BD'), position: new THREE.Vector3(windowHeightLineX - 0.55, windowCenterY, -0.1) },
	      { label: makeLabel(`窓中心 ${formatMeters(settings.windowCenterHeightM)}`, '#0071BD'), position: new THREE.Vector3(-windowWidthM / 2 - 0.9, windowCenterY, -0.24) },
	      { label: makeLabel(`ナミゲート ${numberFormatter.format(settings.namigateWidthCm)}×${numberFormatter.format(settings.namigateHeightCm)}cm`, '#0071BD'), position: new THREE.Vector3(namigateWidthM / 2 + 1.1, windowCenterY, -0.24) },
	      { label: makeLabel('受信機'), position: new THREE.Vector3(0.65, receiverPoint.y + 0.28, receiverZ) },
	      { label: makeLabel(`受信高 ${formatMeters(settings.rxAntennaHeightM)}`), position: new THREE.Vector3(0.9, receiverPoint.y / 2, receiverZ) },
	      { label: makeLabel(`室内3D ${formatMeters(calculateIndoorLinkDistanceM(settings))}`), position: new THREE.Vector3(0.9, 0.38, receiverZ / 2) },
      { label: makeLabel(`部屋幅 ${numberFormatter.format(settings.roomWidthM)}m`), position: new THREE.Vector3(0, 0.42, roomWidthLineZ + 0.22) },
      { label: makeLabel(`奥行 ${numberFormatter.format(settings.roomDepthM)}m`), position: new THREE.Vector3(roomDepthLineX + 0.58, 0.42, roomDepthM / 2) },
    ]

    labels.forEach(({ label, position }) => {
      label.position.copy(position)
      scene.add(label)
    })

    measurementPoints.slice(0, 24).forEach((point, index) => {
      const scenarioColor =
        SCENARIOS.find((scenario) => scenario.key === point.scenario)?.color ?? MAIN_COLOR
      const pointX = clamp(point.xM - roomWidthM / 2, -roomWidthM / 2 + 0.12, roomWidthM / 2 - 0.12)
      const pointY = clamp(point.heightM, 0.35, wallHeightM - 0.25)
      const pointZ = clamp(point.yM, 0.15, roomDepthM - 0.15)
      const markerGroup = new THREE.Group()
      markerGroup.position.set(pointX, 0, pointZ)

      const markerPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, pointY, 12),
        new THREE.MeshStandardMaterial({ color: 0x5d6b78, roughness: 0.6 }),
      )
      markerPole.position.y = pointY / 2
      markerGroup.add(markerPole)

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 20, 12),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(scenarioColor),
          emissive: new THREE.Color(scenarioColor),
          emissiveIntensity: 0.25,
          roughness: 0.32,
        }),
      )
      marker.position.y = pointY
      marker.castShadow = true
      markerGroup.add(marker)
      scene.add(markerGroup)

      const markerLabel = makeLabel(
        `${point.name} ${formatDbm(point.rsrpDbm)}`,
        scenarioColor,
      )
      const sideOffset = index % 2 === 0 ? 0.48 : -0.48
      markerLabel.position.set(pointX + sideOffset, pointY + 0.36, pointZ)
      scene.add(markerLabel)
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
  }, [settings, angleLossDb, areaGainDb, measurementPoints])

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
            水平 {formatMeters(settings.outdoorDistanceM)} / 3D{' '}
            {formatMeters(calculateOutdoorLinkDistanceM(settings))} / 送信高{' '}
            {formatMeters(settings.txAntennaHeightM)}
          </small>
        </div>
        <div>
          <span>窓とナミゲート</span>
          <strong>
            窓 {numberFormatter.format(settings.windowWidthM)}×
            {numberFormatter.format(settings.windowHeightM)}m
          </strong>
          <small>
            中心高 {formatMeters(settings.windowCenterHeightM)} / ナミゲート{' '}
            {numberFormatter.format(settings.namigateWidthCm)}×
            {numberFormatter.format(settings.namigateHeightCm)}cm / 面積補正{' '}
            {formatDb(areaGainDb)}
          </small>
        </div>
        <div>
          <span>受信点</span>
          <strong>室内 {formatMeters(settings.indoorDistanceM)}</strong>
          <small>
            3D {formatMeters(calculateIndoorLinkDistanceM(settings))} / 受信高{' '}
            {formatMeters(settings.rxAntennaHeightM)} / 入射角損失 {formatDb(angleLossDb)}
          </small>
        </div>
        <div>
          <span>実測点</span>
          <strong>{numberFormatter.format(measurementPoints.length)} 点</strong>
          <small>CSV実測点を3D上に重ね表示</small>
        </div>
      </div>
    </div>
  )
}

function HeatmapPlan({
  settings,
  scenario,
  heatmap,
  measurementPoints,
}: HeatmapPlanProps) {
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
  const scenarioMeasurements = measurementPoints.filter(
    (point) => point.scenario === scenario.key,
  )

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
          屋外3D {formatMeters(calculateOutdoorLinkDistanceM(settings))}
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
          {scenarioMeasurements.map((point) => {
            const xPct = clamp((point.xM / roomWidthM) * 100, 3, 97)
            const yPct = clamp((point.yM / roomDepthM) * 100, 4, 96)
            const residualDb =
              point.rsrpDbm -
              calculateRsrpDbm(
                settings,
                point.scenario,
                getMeasurementPointDistanceM(settings, point),
                point.heightM,
              )

            return (
              <g key={point.id}>
                <circle
                  className={
                    residualDb >= 0
                      ? 'heatmap-measured-point is-positive'
                      : 'heatmap-measured-point is-negative'
                  }
                  cx={xPct}
                  cy={yPct}
                  r="3.2"
                />
                <text
                  className="heatmap-measured-label"
                  textAnchor="middle"
                  x={xPct}
                  y={yPct - 4.6}
                >
                  {point.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="heatmap-plan-legend">
        <span>部屋幅 {numberFormatter.format(settings.roomWidthM)}m</span>
        <span>奥行 {numberFormatter.format(settings.roomDepthM)}m</span>
        <span>窓幅 {numberFormatter.format(settings.windowWidthM)}m</span>
        <span>窓高 {numberFormatter.format(settings.windowHeightM)}m</span>
        <span>窓中心高 {formatMeters(settings.windowCenterHeightM)}</span>
        <span>室内3D {formatMeters(calculateIndoorLinkDistanceM(settings))}</span>
        <span>受信高 {formatMeters(settings.rxAntennaHeightM)}</span>
        {hasNamigate ? (
          <span>ナミゲート {numberFormatter.format(settings.namigateWidthCm)}cm幅</span>
        ) : (
          <span>ナミゲートなし</span>
        )}
        <span>実測点 {numberFormatter.format(scenarioMeasurements.length)}点</span>
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
  const verticalMaxM = Math.max(
    3,
    settings.txAntennaHeightM,
    settings.windowCenterHeightM + settings.windowHeightM / 2,
    settings.rxAntennaHeightM,
  )
  const heightToDiagramY = (heightM: number) =>
    roomY + roomHeight - (clamp(heightM, 0, verticalMaxM) / verticalMaxM) * roomHeight
  const windowCenterY = heightToDiagramY(settings.windowCenterHeightM)
  const safeAngle = clamp(settings.incidentAngleDeg, 15, 90)
  const transmitterX = 70
  const transmitterY = heightToDiagramY(settings.txAntennaHeightM)
  const receiverX =
    roomX +
    34 +
    clamp(settings.indoorDistanceM / Math.max(settings.roomDepthM, 1), 0, 1) *
      (roomWidth - 82)
  const receiverY = heightToDiagramY(settings.rxAntennaHeightM)
  const normalStartX = windowX - 90
  const windowLabel =
    WINDOW_PRESETS.find((preset) => preset.id === settings.windowPresetId)?.label ??
    '任意'
  const windowPatchHeight = clamp(
    (settings.windowHeightM / verticalMaxM) * roomHeight,
    46,
    132,
  )
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
        <text className="diagram-dimension-label" x={transmitterX + 18} y={transmitterY + 34}>
          送信高 {formatMeters(settings.txAntennaHeightM)}
        </text>
        <text className="diagram-label" x={receiverX - 28} y={receiverY - 24}>
          受信機
        </text>
        <text className="diagram-dimension-label" x={receiverX + 18} y={receiverY + 30}>
          受信高 {formatMeters(settings.rxAntennaHeightM)}
        </text>
        <text className="diagram-label" x={windowX - 62} y={windowCenterY - 58}>
          窓面
        </text>
        <text className="diagram-dimension-label" x={windowX + 18} y={windowCenterY - 22}>
          中心高 {formatMeters(settings.windowCenterHeightM)}
        </text>
        <text className="diagram-accent-label" x={windowX + 18} y={windowCenterY + 5}>
          ナミゲート
        </text>
        <text className="diagram-muted-label" x="150" y="286">
          屋外3D {formatMeters(calculateOutdoorLinkDistanceM(settings))}
        </text>
        <text className="diagram-muted-label" x={windowX + 42} y="286">
          室内3D {formatMeters(calculateIndoorLinkDistanceM(settings))}
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
  const [measurementCsvText, setMeasurementCsvText] = useState(SAMPLE_MEASUREMENT_CSV)
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([])
  const [importStatus, setImportStatus] = useState('')
  const [protocol, setProtocol] = useState<TestProtocol>(DEFAULT_PROTOCOL)
  const [savedCases, setSavedCases] = useState<SavedTestCase[]>(loadSavedTestCases)
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [caseName, setCaseName] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('overview')
  const [copyStatus, setCopyStatus] = useState('')

  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
    options: { keepModulePreset?: boolean } = {},
  ) => {
    setSettings((current) => ({
      ...current,
      modulePresetId:
        key === 'modulePresetId' ||
        options.keepModulePreset ||
        !MODULE_PRESET_SETTING_KEYS.has(key)
          ? current.modulePresetId
          : 'custom',
      [key]: value,
    }))
  }

  const handleModulePresetChange = (presetId: ModulePresetId) => {
    const preset = MODULE_PRESETS.find((item) => item.id === presetId)

    if (!preset) {
      return
    }

    setSettings((current) => ({
      ...current,
      ...preset.settings,
      modulePresetId: presetId,
    }))
  }

  const updateMeasuredRsrp = (key: ScenarioKey, value: string) => {
    setMeasuredRsrpValues((current) => ({ ...current, [key]: value }))
    setCopyStatus('')
  }

  const updateProtocol = <K extends keyof TestProtocol>(
    key: K,
    value: TestProtocol[K],
  ) => {
    setProtocol((current) => ({ ...current, [key]: value }))
  }

  const updateProtocolChecklist = (key: ProtocolChecklistKey, value: boolean) => {
    setProtocol((current) => ({
      ...current,
      checklist: {
        ...current.checklist,
        [key]: value,
      },
    }))
  }

  const currentOutdoorLinkDistanceM = useMemo(
    () => calculateOutdoorLinkDistanceM(settings),
    [settings],
  )

  const currentIndoorLinkDistanceM = useMemo(
    () => calculateIndoorLinkDistanceM(settings),
    [settings],
  )

  const currentOutdoorPathLossDb = useMemo(
    () => calculateOutdoorPathLossDb(settings),
    [settings],
  )

  const outdoorModelNotice = useMemo(() => getOutdoorModelNotice(settings), [settings])

  const currentIndoorLossDb = useMemo(
    () =>
      calculateIndoorLossDb(
        currentIndoorLinkDistanceM,
        settings.indoorPathLossExponent,
      ),
    [currentIndoorLinkDistanceM, settings.indoorPathLossExponent],
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

  const pointComparisons = useMemo(
    () => buildPointComparisons(settings, measurementPoints),
    [measurementPoints, settings],
  )

  const pointErrorStats = useMemo(
    () =>
      calculateErrorStats(
        pointComparisons.map((comparison) => comparison.residualDb),
      ),
    [pointComparisons],
  )

  const qualityStats = useMemo(
    () => calculateQualityStats(measurementPoints, settings.connectionThresholdDbm),
    [measurementPoints, settings.connectionThresholdDbm],
  )

  const calibrationResult = useMemo(
    () => calculateCalibrationResult(settings, measurementPoints, measuredComparisons),
    [measuredComparisons, measurementPoints, settings],
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

  const sensitivityRows = useMemo(() => {
    const baseline = scenarioResults[2]
    const candidates: Array<{ label: string; settings: Settings }> = [
      { label: '標準', settings },
      {
        label: '窓損失 +5dB',
        settings: { ...settings, windowLossDb: settings.windowLossDb + 5 },
      },
      {
        label: '窓損失 -5dB',
        settings: {
          ...settings,
          windowLossDb: Math.max(settings.windowLossDb - 5, 0),
        },
      },
      {
        label: '改善量 +5dB',
        settings: { ...settings, namigateGainDb: settings.namigateGainDb + 5 },
      },
      {
        label: '改善量 -5dB',
        settings: {
          ...settings,
          namigateGainDb: Math.max(settings.namigateGainDb - 5, 0),
        },
      },
      {
        label: '伝搬指数 +0.3',
        settings: {
          ...settings,
          indoorPathLossExponent: settings.indoorPathLossExponent + 0.3,
        },
      },
      {
        label: '入射角 -15°',
        settings: {
          ...settings,
          incidentAngleDeg: Math.max(settings.incidentAngleDeg - 15, 15),
        },
      },
      {
        label: '送信高 +5m',
        settings: {
          ...settings,
          txAntennaHeightM: settings.txAntennaHeightM + 5,
        },
      },
      {
        label: '受信高 +1m',
        settings: {
          ...settings,
          rxAntennaHeightM: settings.rxAntennaHeightM + 1,
        },
      },
      {
        label: '指向ずれ +3dB',
        settings: {
          ...settings,
          antennaAlignmentLossDb: settings.antennaAlignmentLossDb + 3,
        },
      },
      {
        label: '屋内遮蔽 +5dB',
        settings: {
          ...settings,
          indoorObstacleLossDb: settings.indoorObstacleLossDb + 5,
        },
      },
    ]

    return candidates.map((candidate) => {
      const rsrpDbm = calculateRsrpDbm(candidate.settings, 'withNamigate')
      const connectedAreaM2 = buildHeatmap(
        candidate.settings,
        'withNamigate',
      ).connectedAreaM2
      const maxReachM = calculateMaxReachM(candidate.settings, 'withNamigate')

      return {
        label: candidate.label,
        rsrpDbm,
        connectedAreaM2,
        maxReachM,
        deltaRsrpDb: rsrpDbm - baseline.rsrpDbm,
      }
    })
  }, [scenarioResults, settings])

  const confidenceRows = useMemo(() => {
    const cases: Array<{ label: string; settings: Settings }> = [
      {
        label: '保守',
        settings: {
          ...settings,
          windowLossDb: settings.windowLossDb + 5,
          namigateGainDb: Math.max(settings.namigateGainDb - 5, 0),
          indoorPathLossExponent: settings.indoorPathLossExponent + 0.3,
          fadeMarginDb: settings.fadeMarginDb + 3,
          antennaAlignmentLossDb: settings.antennaAlignmentLossDb + 2,
          indoorObstacleLossDb: settings.indoorObstacleLossDb + 3,
        },
      },
      { label: '標準', settings },
      {
        label: '楽観',
        settings: {
          ...settings,
          windowLossDb: Math.max(settings.windowLossDb - 3, 0),
          namigateGainDb: settings.namigateGainDb + 3,
          indoorPathLossExponent: Math.max(
            settings.indoorPathLossExponent - 0.2,
            0.5,
          ),
          fadeMarginDb: Math.max(settings.fadeMarginDb - 2, 0),
          antennaAlignmentLossDb: Math.max(settings.antennaAlignmentLossDb - 1, 0),
          indoorObstacleLossDb: Math.max(settings.indoorObstacleLossDb - 2, 0),
        },
      },
    ]

    return cases.map((item) => ({
      label: item.label,
      rsrpDbm: calculateRsrpDbm(item.settings, 'withNamigate'),
      connectedAreaM2: buildHeatmap(item.settings, 'withNamigate').connectedAreaM2,
      maxReachM: calculateMaxReachM(item.settings, 'withNamigate'),
    }))
  }, [settings])

  const experimentReportText = useMemo(
    () =>
      buildExperimentReport({
        settings,
        protocol,
        scenarioResults,
        pointComparisons,
        errorStats: pointErrorStats,
        qualityStats,
        calibration: calibrationResult,
        sensitivityRows,
        confidenceRows,
      }),
    [
      calibrationResult,
      confidenceRows,
      pointComparisons,
      pointErrorStats,
      protocol,
      qualityStats,
      scenarioResults,
      sensitivityRows,
      settings,
    ],
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

  const handleImportMeasurementCsv = (text = measurementCsvText) => {
    const points = parseMeasurementCsv(text)
    setMeasurementPoints(points)
    setImportStatus(
      points.length === 0
        ? '取り込める実測点がありません'
        : `${numberFormatter.format(points.length)}点の実測データを取り込みました`,
    )
  }

  const handleApplyCalibration = () => {
    setSettings((current) => ({
      ...current,
      windowPresetId: 'custom',
      windowLossDb: calibrationResult.recommendedWindowLossDb,
      indoorPathLossExponent: calibrationResult.recommendedIndoorPathLossExponent,
      namigatePresetId: 'custom',
      namigateGainDb: calibrationResult.recommendedNamigateGainDb,
    }))
    setCopyStatus('校正候補を入力条件へ反映しました')
  }

  const handleCopyExperimentReport = async () => {
    try {
      await navigator.clipboard.writeText(experimentReportText)
      setCopyStatus('実証レポートをコピーしました')
    } catch {
      setCopyStatus('レポートをコピーできませんでした')
    }
  }

  const handleSaveCase = () => {
    const name =
      caseName.trim() ||
      protocol.siteName.trim() ||
      `試験ケース ${new Date().toLocaleString('ja-JP')}`
    const savedCase: SavedTestCase = {
      id: `${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      settings,
      measuredRsrpValues,
      measurementPoints,
      protocol,
    }
    const nextCases = [
      savedCase,
      ...savedCases.filter((item) => item.name !== name),
    ].slice(0, 12)
    setSavedCases(nextCases)
    persistSavedTestCases(nextCases)
    setSelectedCaseId(savedCase.id)
    setCaseName(name)
    setCopyStatus('試験ケースを保存しました')
  }

  const handleLoadCase = () => {
    const savedCase = savedCases.find((item) => item.id === selectedCaseId)

    if (!savedCase) {
      setCopyStatus('読み込む試験ケースを選択してください')
      return
    }

    setSettings({ ...DEFAULT_SETTINGS, ...savedCase.settings })
    setMeasuredRsrpValues(savedCase.measuredRsrpValues)
    setMeasurementPoints(savedCase.measurementPoints)
    setProtocol(savedCase.protocol)
    setCaseName(savedCase.name)
    setCopyStatus('試験ケースを読み込みました')
  }

  const handleDeleteCase = () => {
    const nextCases = savedCases.filter((item) => item.id !== selectedCaseId)
    setSavedCases(nextCases)
    persistSavedTestCases(nextCases)
    setSelectedCaseId('')
    setCopyStatus('試験ケースを削除しました')
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

          <details className="control-group" open>
            <summary>
              <span>屋外電波</span>
              <HelpTip text="送信機から窓面へ届くまでの条件です。まずは周波数、EIRP、屋外距離を確認します。" />
            </summary>
            <p className="control-group-note">
              送信側の強さ、アンテナ高、屋外距離を決めます。EIRPが分かる場合は直接入力、無線機構成が分かる場合は詳細計算を使います。
            </p>
            <label className="control">
              <TermLabel label="無線機プリセット" help={HELP_TEXT['無線機プリセット']} />
              <select
                value={settings.modulePresetId}
                onChange={(event) =>
                  handleModulePresetChange(event.target.value as ModulePresetId)
                }
              >
                {MODULE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="model-note regulation-note">
              <strong>法規制メモ</strong>
              <span>
                ローカル5Gは無線局免許を前提とする制度です。日本では主に
                4.6-4.9GHz帯と28.2-29.1GHz帯が対象で、周波数帯、設置場所、
                自己土地/他者土地、同期条件、空中線電力・EIRP等の条件確認が必要です。
                この画面は上限適合判定ではないため、申請・運用前に最新の総務省ガイドラインと管轄の総合通信局で確認してください。
              </span>
            </div>
            <div className="model-note preset-note">
              <strong>プリセットの扱い</strong>
              <span>
                {
                  MODULE_PRESETS.find((preset) => preset.id === settings.modulePresetId)
                    ?.description
                }
                。値は汎用例であり、メーカー仕様・技適・免許条件を保証しません。
              </span>
            </div>
            <NumberInput
              label="周波数"
              value={settings.frequencyMHz}
              min={1}
              step={10}
              unit="MHz"
              onChange={(value) => updateSetting('frequencyMHz', value)}
            />
            <label className="control">
              <TermLabel label="EIRP計算方式" help={HELP_TEXT['EIRP計算方式']} />
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
              label="送信アンテナ高"
              value={settings.txAntennaHeightM}
              min={0.2}
              step={0.1}
              unit="m"
              onChange={(value) => updateSetting('txAntennaHeightM', value)}
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
              label="アンテナ指向ずれ損失"
              value={settings.antennaAlignmentLossDb}
              min={0}
              step={0.5}
              unit="dB"
              onChange={(value) => updateSetting('antennaAlignmentLossDb', value)}
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
            <label className="control">
              <TermLabel
                label="屋外伝搬モデル"
                help={HELP_TEXT['屋外伝搬モデル']}
              />
              <select
                value={settings.outdoorModelId}
                onChange={(event) =>
                  updateSetting('outdoorModelId', event.target.value as OutdoorModelId)
                }
              >
                {OUTDOOR_MODEL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="model-note propagation-note">
              <strong>{getOutdoorModelLabel(settings.outdoorModelId)}</strong>
              <span>{outdoorModelNotice}</span>
            </div>
            <NumberInput
              label="屋外遮蔽損失"
              value={settings.outdoorObstructionLossDb}
              min={0}
              step={0.5}
              unit="dB"
              onChange={(value) => updateSetting('outdoorObstructionLossDb', value)}
            />
            <NumberInput
              label="地面反射補正"
              value={settings.groundReflectionDb}
              step={0.5}
              unit="dB"
              onChange={(value) => updateSetting('groundReflectionDb', value)}
            />
          </details>

          <details className="control-group" open>
            <summary>
              <span>窓条件</span>
              <HelpTip text="窓ガラスで失われる量と、電波が窓に入る角度を設定します。Low-Eでは損失が大きくなりやすいです。" />
            </summary>
            <p className="control-group-note">
              窓あり状態の悪化量を決める中心条件です。窓中心高は送信/受信アンテナ高との差から3D距離を出すために使います。
            </p>
            <label className="control">
              <TermLabel label="窓種別" help={HELP_TEXT['窓種別']} />
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
              label="窓中心高"
              value={settings.windowCenterHeightM}
              min={0.2}
              step={0.1}
              unit="m"
              onChange={(value) => updateSetting('windowCenterHeightM', value)}
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
          </details>

          <details className="control-group" open>
            <summary>
              <span>室内条件</span>
              <HelpTip text="窓から屋内へ入った後の距離減衰と、部屋の評価範囲を設定します。" />
            </summary>
            <p className="control-group-note">
              部屋寸法はヒートマップと接続可能面積に、室内距離と受信アンテナ高は代表受信点のRSRPに効きます。
            </p>
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
              label="受信アンテナ高"
              value={settings.rxAntennaHeightM}
              min={0.2}
              step={0.1}
              unit="m"
              onChange={(value) => updateSetting('rxAntennaHeightM', value)}
            />
            <NumberInput
              label="屋内伝搬指数"
              value={settings.indoorPathLossExponent}
              min={0.5}
              step={0.1}
              onChange={(value) => updateSetting('indoorPathLossExponent', value)}
            />
            <NumberInput
              label="屋内遮蔽損失"
              value={settings.indoorObstacleLossDb}
              min={0}
              step={0.5}
              unit="dB"
              onChange={(value) => updateSetting('indoorObstacleLossDb', value)}
            />
          </details>

          <details className="control-group" open>
            <summary>
              <span>ナミゲート</span>
              <HelpTip text="窓あり状態からどれだけ回復できるかを仮定します。実測後は校正候補を反映できます。" />
            </summary>
            <p className="control-group-note">
              ナミゲートの効果は「窓なしとの差をどれだけ埋めたか」で見ます。面積、設置効率、追加損失で現場条件を調整します。
            </p>
            <label className="control">
              <TermLabel label="改善量プリセット" help={HELP_TEXT['改善量プリセット']} />
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
          </details>
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

          <nav className="view-tabs" role="tablist" aria-label="表示切り替え">
            {VIEW_TABS.map((tab) => (
              <button
                aria-selected={activeView === tab.id}
                className={activeView === tab.id ? 'is-active' : ''}
                key={tab.id}
                role="tab"
                type="button"
                onClick={() => setActiveView(tab.id)}
              >
                <strong>{tab.label}</strong>
                <span>{tab.description}</span>
              </button>
            ))}
          </nav>

          {activeView === 'overview' ? (
            <>
              <section className="beginner-guide" aria-label="読み方ガイド">
                <article>
                  <span>1. まずRSRP</span>
                  <strong>3状態の差を見る</strong>
                  <p>
                    上段の3枚で、窓なし、窓あり、窓あり＋ナミゲートの受信強度を比較します。
                  </p>
                </article>
                <article>
                  <span>2. 回復率</span>
                  <strong>窓なしとの差をどれだけ埋めたか</strong>
                  <p>
                    ナミゲート効果は、窓損失で落ちた分をどれだけ戻せたかで読みます。
                  </p>
                </article>
                <article>
                  <span>3. 面積と距離</span>
                  <strong>現場で使える範囲を見る</strong>
                  <p>
                    接続可能面積と最大到達距離で、改善が部屋全体に効くか確認します。
                  </p>
                </article>
              </section>

              <section className="glossary-strip" aria-label="用語の補足">
                <HelpChip label="RSRP" />
                <HelpChip label="SINR" />
                <HelpChip label="RSRQ" />
                <HelpChip label="RMSE" />
              </section>

              <section className="metric-grid" aria-label="改善効果の要約">
                <article className="metric-card" data-metric="窓損失">
                  <span className="label-with-help">
                    窓損失
                    <HelpTip text={HELP_TEXT['窓損失']} />
                  </span>
                  <strong>{formatDb(settings.windowLossDb)}</strong>
                  <small>入射角損失 {formatDb(angleLossDb)}</small>
                </article>
                <article className="metric-card" data-metric="ナミゲート総改善量">
                  <span className="label-with-help">
                    ナミゲート総改善量
                    <HelpTip text="改善量、面積補正、入射角回復、設置効率、追加損失、上限をまとめた最終的な上積み量です。" />
                  </span>
                  <strong>{formatDb(totalNamigateGainDb)}</strong>
                  <small>
                    面積 {formatDb(areaGainDb)} / 入射角回復{' '}
                    {formatDb(namigateAngleRecoveryDb)}
                  </small>
                </article>
                <article className="metric-card" data-metric="電力倍率">
                  <span className="label-with-help">
                    電力倍率
                    <HelpTip text="窓あり状態に対し、ナミゲートありの受信電力が何倍相当かをdBから換算した値です。" />
                  </span>
                  <strong>{formatMultiplier(powerMultiplier)}</strong>
                  <small>窓あり比</small>
                </article>
                <article className="metric-card" data-metric="電界倍率">
                  <span className="label-with-help">
                    電界倍率
                    <HelpTip text="電力倍率を電界強度の倍率に換算した目安です。電界は電力の平方根で増減します。" />
                  </span>
                  <strong>{formatMultiplier(fieldMultiplier)}</strong>
                  <small>窓あり比</small>
                </article>
                <article className="metric-card" data-metric="窓なし状態への回復率">
                  <span className="label-with-help">
                    窓なし状態への回復率
                    <HelpTip text="窓ありで落ちた差分に対して、ナミゲートで何%戻ったかを示します。100%なら窓なし相当に届いた扱いです。" />
                  </span>
                  <strong>{numberFormatter.format(clamp(recoveryRate, 0, 100))}%</strong>
                  <small>{formatDb(recoveredGapDb)} 回復</small>
                </article>
                <article className="metric-card" data-metric="実効EIRP">
                  <span className="label-with-help">
                    実効EIRP
                    <HelpTip text={HELP_TEXT['EIRP直接入力']} />
                  </span>
                  <strong>{formatDbm(effectiveEirpDbm)}</strong>
                  <small>
                    詳細 {formatDbm(detailedEirpDbm)} / 受信系{' '}
                    {formatDb(receiverAdjustmentDb)}
                  </small>
                </article>
                <article className="metric-card" data-metric="計算損失">
                  <span className="label-with-help">
                    計算損失
                    <HelpTip text="選択した屋外伝搬モデルの損失と、代表受信点までの室内距離損失を表示します。" />
                  </span>
                  <strong>{formatDb(currentOutdoorPathLossDb)}</strong>
                  <small>
                    {getOutdoorModelLabel(settings.outdoorModelId)} / 室内{' '}
                    {formatDb(currentIndoorLossDb)}
                  </small>
                </article>
                <article className="metric-card" data-metric="3Dリンク距離">
                  <span className="label-with-help">
                    3Dリンク距離
                    <HelpTip text="水平距離に送信アンテナ高、窓中心高、受信アンテナ高の差を加味した、計算上の斜距離です。" />
                  </span>
                  <strong>{formatMeters(currentOutdoorLinkDistanceM)}</strong>
                  <small>室内3D {formatMeters(currentIndoorLinkDistanceM)}</small>
                </article>
                <article className="metric-card" data-metric="追加損失">
                  <span className="label-with-help">
                    追加損失
                    <HelpTip text="アンテナ指向ずれ、屋外遮蔽、屋内遮蔽を足した、窓損失以外の追加的な悪化量です。" />
                  </span>
                  <strong>
                    {formatDb(
                      settings.antennaAlignmentLossDb +
                        settings.outdoorObstructionLossDb +
                        settings.indoorObstacleLossDb,
                    )}
                  </strong>
                  <small>
                    指向 {formatDb(settings.antennaAlignmentLossDb)} / 遮蔽{' '}
                    {formatDb(settings.outdoorObstructionLossDb + settings.indoorObstacleLossDb)}
                  </small>
                </article>
              </section>
            </>
          ) : null}

          {activeView === 'measurement' ? (
            <section className="measurement-section">
            <div className="section-heading">
              <h2>実測値比較</h2>
              <span className="label-with-help">
                実測 - 推定
                <HelpTip text="正の値なら実測の方が強く、負の値なら推定より弱く測定されています。" />
              </span>
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

              <div className="csv-import-panel">
                <div className="subsection-heading">
                  <h3>CSV実測点取り込み</h3>
                  <span>
                    scenario, x_m, y_m, RSRP, RSRQ, SINR, DL/ULを読み込み
                  </span>
                </div>
                <textarea
                  aria-label="CSV実測データ"
                  className="csv-textarea"
                  value={measurementCsvText}
                  onChange={(event) => setMeasurementCsvText(event.target.value)}
                  spellCheck={false}
                />
                <div className="action-row">
                  <button
                    type="button"
                    onClick={() => handleImportMeasurementCsv()}
                  >
                    CSVを取り込み
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMeasurementCsvText(SAMPLE_MEASUREMENT_CSV)
                      handleImportMeasurementCsv(SAMPLE_MEASUREMENT_CSV)
                    }}
                  >
                    サンプルCSVを読み込み
                  </button>
                  <label className="file-button">
                    CSVファイルを選択
                    <input
                      accept=".csv,text/csv"
                      type="file"
                      onChange={async (event) => {
                        const file = event.currentTarget.files?.[0]

                        if (!file) {
                          return
                        }

                        const text = await file.text()
                        setMeasurementCsvText(text)
                        handleImportMeasurementCsv(text)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        'namigate_measurements.csv',
                        buildMeasurementCsv(measurementPoints),
                        'text/csv',
                      )
                    }
                  >
                    実測CSVを書き出し
                  </button>
                  {importStatus ? <span>{importStatus}</span> : null}
                </div>
              </div>

              <div className="measurement-summary">
                <article>
                  <span>CSV実測点</span>
                  <strong>{numberFormatter.format(qualityStats.pointCount)} 点</strong>
                  <small>ヒートマップ/3Dへ重ね表示</small>
                </article>
                <article>
                  <span>RMSE</span>
                  <strong>{formatOptionalDb(pointErrorStats.rmseDb)}</strong>
                  <small>点別 実測 - 推定</small>
                </article>
                <article>
                  <span>接続可能率</span>
                  <strong>{formatOptionalPercent(qualityStats.connectedRatio)}</strong>
                  <small>RSRPしきい値判定</small>
                </article>
                <article>
                  <span>平均SINR</span>
                  <strong>{formatOptionalDb(qualityStats.avgSinrDb)}</strong>
                  <small>品質指標</small>
                </article>
                <article>
                  <span>平均RSRQ</span>
                  <strong>{formatOptionalDb(qualityStats.avgRsrqDb)}</strong>
                  <small>品質指標</small>
                </article>
                <article>
                  <span>平均DL/UL</span>
                  <strong>
                    {formatOptionalMbps(qualityStats.avgDlMbps)} /{' '}
                    {formatOptionalMbps(qualityStats.avgUlMbps)}
                  </strong>
                  <small>スループット</small>
                </article>
              </div>

              <div
                className="point-table"
                role="table"
                aria-label="CSV実測点ごとの推定誤差"
              >
                <div className="point-row is-head" role="row">
                  <span role="columnheader">点</span>
                  <span role="columnheader">状態</span>
                  <span role="columnheader">位置</span>
                  <span role="columnheader">実測RSRP</span>
                  <span role="columnheader">推定RSRP</span>
                  <span role="columnheader">差分</span>
                  <span role="columnheader">SINR</span>
                  <span role="columnheader">DL</span>
                </div>
                {pointComparisons.length === 0 ? (
                  <div className="point-row" role="row">
                    <span role="cell">未入力</span>
                    <span role="cell">CSVを取り込んでください</span>
                    <span role="cell">-</span>
                    <span role="cell">-</span>
                    <span role="cell">-</span>
                    <span role="cell">-</span>
                    <span role="cell">-</span>
                    <span role="cell">-</span>
                  </div>
                ) : (
                  pointComparisons.slice(0, 12).map((point) => (
                    <div className="point-row" key={point.id} role="row">
                      <strong role="cell">{point.name}</strong>
                      <span role="cell">
                        {
                          SCENARIOS.find(
                            (scenario) => scenario.key === point.scenario,
                          )?.label
                        }
                      </span>
                      <span role="cell">
                        x{numberFormatter.format(point.xM)} / y
                        {numberFormatter.format(point.yM)}
                      </span>
                      <strong role="cell">{formatDbm(point.rsrpDbm)}</strong>
                      <span role="cell">{formatDbm(point.estimatedRsrpDbm)}</span>
                      <strong
                        className={
                          point.residualDb >= 0 ? 'is-positive' : 'is-negative'
                        }
                        role="cell"
                      >
                        {formatDb(point.residualDb)}
                      </strong>
                      <span role="cell">{formatOptionalDb(point.sinrDb)}</span>
                      <span role="cell">{formatOptionalMbps(point.dlMbps)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="analysis-copy-panel">
                <button type="button" onClick={handleCopyAnalysis}>
                  AI分析用データをコピー
                </button>
                {copyStatus ? <span>{copyStatus}</span> : null}
              </div>
            </div>
            </section>
          ) : null}

          {activeView === 'analysis' ? (
            <section className="experiment-section">
            <div className="section-heading">
              <h2>実証試験分析</h2>
              <span className="label-with-help">
                校正・感度・信頼ケース・レポート
                <HelpTip text="実測点からモデルを現場寄りに合わせ、条件が変わったときの影響と報告用テキストを確認します。" />
              </span>
            </div>

            <div className="experiment-body">
              <div className="analysis-card-grid">
                <article>
                  <span>推奨 窓損失</span>
                  <strong>{formatDb(calibrationResult.recommendedWindowLossDb)}</strong>
                  <small>データ源: {calibrationResult.source}</small>
                </article>
                <article>
                  <span>推奨 屋内伝搬指数</span>
                  <strong>
                    {numberFormatter.format(
                      calibrationResult.recommendedIndoorPathLossExponent,
                    )}
                  </strong>
                  <small>noWindow実測点から探索</small>
                </article>
                <article>
                  <span>推奨 ナミゲート改善量</span>
                  <strong>{formatDb(calibrationResult.recommendedNamigateGainDb)}</strong>
                  <small>
                    総改善 {formatDb(calibrationResult.recommendedTotalNamigateGainDb)}
                  </small>
                </article>
                <article>
                  <span>校正前/後 RMSE</span>
                  <strong>
                    {formatOptionalDb(calibrationResult.beforeRmseDb)} /{' '}
                    {formatOptionalDb(calibrationResult.afterRmseDb)}
                  </strong>
                  <small>CSV実測点ベース</small>
                </article>
              </div>

              <div className="action-row">
                <button type="button" onClick={handleApplyCalibration}>
                  校正候補を入力へ反映
                </button>
                <button type="button" onClick={handleCopyExperimentReport}>
                  実証レポートをコピー
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      'namigate_experiment_report.md',
                      experimentReportText,
                    )
                  }
                >
                  Markdownを保存
                </button>
                {copyStatus ? <span>{copyStatus}</span> : null}
              </div>

              <div className="analysis-table-grid">
                <div className="compact-table">
                  <div className="subsection-heading">
                    <h3>感度分析</h3>
                    <span>窓あり＋ナミゲートの変動</span>
                  </div>
                  <div className="compact-row is-head">
                    <span>条件</span>
                    <span>RSRP</span>
                    <span>差分</span>
                    <span>面積</span>
                  </div>
                  {sensitivityRows.map((row) => (
                    <div className="compact-row" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{formatDbm(row.rsrpDbm)}</span>
                      <span>{formatDb(row.deltaRsrpDb)}</span>
                      <span>{formatArea(row.connectedAreaM2)}</span>
                    </div>
                  ))}
                </div>

                <div className="compact-table">
                  <div className="subsection-heading">
                    <h3>信頼ケース</h3>
                    <span>保守/標準/楽観</span>
                  </div>
                  <div className="compact-row is-head">
                    <span>ケース</span>
                    <span>RSRP</span>
                    <span>面積</span>
                    <span>到達</span>
                  </div>
                  {confidenceRows.map((row) => (
                    <div className="compact-row" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{formatDbm(row.rsrpDbm)}</span>
                      <span>{formatArea(row.connectedAreaM2)}</span>
                      <span>{formatMeters(row.maxReachM)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="protocol-panel">
                <div className="subsection-heading">
                  <h3>測定プロトコル</h3>
                  <span>実証条件の再現性を記録</span>
                </div>
                <div className="protocol-grid">
                  <label className="control">
                    <span>試験場所</span>
                    <input
                      value={protocol.siteName}
                      onChange={(event) =>
                        updateProtocol('siteName', event.target.value)
                      }
                      placeholder="例: 工場A 2F"
                    />
                  </label>
                  <label className="control">
                    <span>測定者</span>
                    <input
                      value={protocol.operatorName}
                      onChange={(event) =>
                        updateProtocol('operatorName', event.target.value)
                      }
                      placeholder="担当者"
                    />
                  </label>
                  <label className="control">
                    <span>端末/測定器</span>
                    <input
                      value={protocol.deviceName}
                      onChange={(event) =>
                        updateProtocol('deviceName', event.target.value)
                      }
                      placeholder="UE/測定器名"
                    />
                  </label>
                  <NumberInput
                    label="測定高さ"
                    value={protocol.measurementHeightM}
                    min={0.2}
                    step={0.1}
                    unit="m"
                    onChange={(value) => updateProtocol('measurementHeightM', value)}
                  />
                  <NumberInput
                    label="平均化時間"
                    value={protocol.averagingSeconds}
                    min={1}
                    step={1}
                    unit="秒"
                    onChange={(value) => updateProtocol('averagingSeconds', value)}
                  />
                  <NumberInput
                    label="サンプル数/点"
                    value={protocol.samplesPerPoint}
                    min={1}
                    step={1}
                    onChange={(value) => updateProtocol('samplesPerPoint', value)}
                  />
                  <label className="control">
                    <span>端末/アンテナ向き</span>
                    <input
                      value={protocol.antennaDirection}
                      onChange={(event) =>
                        updateProtocol('antennaDirection', event.target.value)
                      }
                    />
                  </label>
                  <label className="control">
                    <span>天候・環境</span>
                    <input
                      value={protocol.weather}
                      onChange={(event) =>
                        updateProtocol('weather', event.target.value)
                      }
                      placeholder="屋外天候/人流/遮蔽物"
                    />
                  </label>
                </div>
                <div className="checklist-grid">
                  {Object.entries(PROTOCOL_CHECKLIST_LABELS).map(([key, label]) => (
                    <label className="checklist-item" key={key}>
                      <input
                        checked={protocol.checklist[key as ProtocolChecklistKey]}
                        type="checkbox"
                        onChange={(event) =>
                          updateProtocolChecklist(
                            key as ProtocolChecklistKey,
                            event.target.checked,
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <label className="control">
                  <span>備考</span>
                  <textarea
                    className="protocol-notes"
                    value={protocol.notes}
                    onChange={(event) => updateProtocol('notes', event.target.value)}
                    placeholder="測定時の気づき、遮蔽物、端末固定方法など"
                  />
                </label>
              </div>

              <div className="case-panel">
                <div className="subsection-heading">
                  <h3>試験ケース保存</h3>
                  <span>ブラウザ内に最大12件保存</span>
                </div>
                <div className="case-controls">
                  <label className="control">
                    <span>ケース名</span>
                    <input
                      value={caseName}
                      onChange={(event) => setCaseName(event.target.value)}
                      placeholder="Low-E窓 ナミゲート20cm 室内8m"
                    />
                  </label>
                  <label className="control">
                    <span>保存済みケース</span>
                    <select
                      value={selectedCaseId}
                      onChange={(event) => setSelectedCaseId(event.target.value)}
                    >
                      <option value="">選択してください</option>
                      {savedCases.map((savedCase) => (
                        <option key={savedCase.id} value={savedCase.id}>
                          {savedCase.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="action-row">
                    <button type="button" onClick={handleSaveCase}>
                      保存
                    </button>
                    <button type="button" onClick={handleLoadCase}>
                      読み込み
                    </button>
                    <button type="button" onClick={handleDeleteCase}>
                      削除
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </section>
          ) : null}

          {activeView === 'visualization' ? (
            <section className="position-section">
            <div className="section-heading">
              <h2>送信機・窓・受信機の3D位置関係</h2>
              <span className="label-with-help">
                入力条件に連動した3Dビュー
                <HelpTip text="屋外距離、窓サイズ、ナミゲートサイズ、室内距離、実測点を同じ座標感で確認できます。" />
              </span>
            </div>
            <PositionScene3D
              settings={settings}
              angleLossDb={angleLossDb}
              areaGainDb={areaGainDb}
              measurementPoints={measurementPoints}
            />
            <PositionDiagram
              settings={settings}
              angleLossDb={angleLossDb}
              areaGainDb={areaGainDb}
            />
            </section>
          ) : null}

          {activeView === 'overview' ? (
            <section className="coverage-section">
            <div className="section-heading">
              <h2>接続可能面積と最大到達距離</h2>
              <span className="label-with-help">
                部屋面積 {formatArea(roomAreaM2)}
                <HelpTip text="RSRPが接続しきい値以上になる室内面積と、窓から奥方向へ届く最大距離です。" />
              </span>
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
          ) : null}

          {activeView === 'visualization' ? (
            <section className="heatmap-section">
            <div className="section-heading">
              <h2>室内ヒートマップ</h2>
              <span className="label-with-help">
                RSRP / しきい値 {formatDbm(settings.connectionThresholdDbm)}
                <HelpTip text="色が明るいほど受信が強く、実測点を取り込むと推定とのズレを重ねて確認できます。" />
              </span>
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
                    measurementPoints={measurementPoints}
                  />
                </article>
              ))}
            </div>
            </section>
          ) : null}

          {activeView === 'charts' ? (
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
          ) : null}
        </section>
      </section>

      <footer className="app-footer">
        これは厳密な電磁界解析ではなく、営業・技術検討用の簡易シミュレータである
      </footer>
    </main>
  )
}

export default App
