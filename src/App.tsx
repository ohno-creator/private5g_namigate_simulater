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
type ActiveView =
  | 'overview'
  | 'visualization'
  | 'charts'
  | 'measurement'
  | 'analysis'
  | 'evidence'
type InputStepId = 'radio' | 'windowRoom' | 'namigate' | 'measurement' | 'review'
type AppMode = 'sales' | 'technical'
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
type TheoryRsrpValues = Record<ScenarioKey, string>

type RsrpSampleStats = {
  samples: number[]
  count: number
  meanDbm: number | null
  medianDbm: number | null
  minDbm: number | null
  maxDbm: number | null
  stddevDb: number | null
}

type MeasuredComparison = ScenarioResult & {
  measuredRsrpDbm: number | null
  residualDb: number | null
}

type TheoryComparison = MeasuredComparison & {
  theoryRsrpDbm: number | null
  measuredVsTheoryDb: number | null
  estimatedVsTheoryDb: number | null
}

type EffectSummaryRow = {
  label: string
  model: string
  measured: string
  theory: string
  delta: string
  memo: string
}

type FieldAidStatus = 'ok' | 'warn' | 'risk' | 'info'

type FieldAidItem = {
  id: string
  label: string
  value: string
  status: FieldAidStatus
  memo: string
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
  observationCount: number
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
  theoryRsrpValues?: TheoryRsrpValues
  measurementCsvText?: string
  measurementPoints: MeasurementPoint[]
  protocol: TestProtocol
}

type ProtocolDraft = Partial<Omit<TestProtocol, 'checklist'>> & {
  checklist?: Partial<Record<ProtocolChecklistKey, boolean>>
}

type AutoSaveDraft = {
  version: 1
  savedAt: string
  appMode: AppMode
  settings: Settings
  measuredRsrpValues: MeasuredRsrpValues
  theoryRsrpValues: TheoryRsrpValues
  measurementCsvText: string
  measurementPoints: MeasurementPoint[]
  protocol: TestProtocol
  caseName: string
  activeInputStep: InputStepId
  activeView: ActiveView
}

const MAIN_COLOR = '#0071BD'
const CONNECTED_THRESHOLD_DEFAULT = -100
const REPORT_TITLE = 'ローカル5G 窓面透過改善シミュレーションレポート'
const DISCLAIMER_FULL =
  '本シミュレータは、ローカル5Gの窓面透過改善効果を概算するための技術検討ツールです。表示結果は保証値ではなく、実際の通信品質は基地局仕様、端末、アンテナ、窓材、設置条件、周辺反射、干渉、測定方法により変動します。正式評価には現地実測による確認が必要です。現地実測値を入力して校正することで、検討条件に近い仮説へ精度を高められます。'
const DISCLAIMER_SHORT =
  '表示結果は保証値ではなく、実測前の仮説整理用です。現地実測を入力すると、条件に合わせて精度を高められます。'

const DISPLAY_MODES: {
  id: AppMode
  label: string
  description: string
}[] = [
  {
    id: 'sales',
    label: '営業用簡易モード',
    description: '初回説明・展示会向け',
  },
  {
    id: 'technical',
    label: '技術詳細モード',
    description: '実測比較・校正向け',
  },
]

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
const AUTOSAVE_STORAGE_KEY = 'private5g-namigate-autosave-draft-v1'

const INPUT_STEPS: {
  id: InputStepId
  label: string
  description: string
  objective: string
}[] = [
  {
    id: 'radio',
    label: '無線・屋外',
    description: '電波が窓へ届くまで',
    objective: '周波数、EIRP、アンテナ高、屋外距離を先に固定します。',
  },
  {
    id: 'windowRoom',
    label: '窓・室内',
    description: '窓損失と室内の広がり',
    objective: '窓の材質、寸法、入射角、部屋寸法、受信位置を入れます。',
  },
  {
    id: 'namigate',
    label: 'ナミゲート',
    description: '改善仮説を調整',
    objective: '改善量、サイズ、設置効率を変えて、窓なしとの差をどこまで埋めるか見ます。',
  },
  {
    id: 'measurement',
    label: '実測・保存',
    description: '現場データと条件記録',
    objective: '実測RSRP、CSV、測定プロトコル、入力パターンを記録します。',
  },
  {
    id: 'review',
    label: '確認',
    description: '結果の読み方を選ぶ',
    objective: 'サマリー、3D、グラフ、校正、根拠へ迷わず移動します。',
  },
]

const STEP_INSIGHTS: Record<InputStepId, string[]> = {
  radio: [
    '5Gの屋外区間は、見通し、アンテナ高、周波数、建物侵入損失の扱いで結果が大きく変わります。まず送信側条件を固定すると、後続の窓損失やナミゲート効果を分離して見られます。',
    '奥村-秦モデルは古典的なマクロセル経験式で、ローカル5Gの4.7GHzや28GHzでは適用範囲外になりやすいため、比較用のプリセットとして扱います。',
  ],
  windowRoom: [
    '建物侵入損失の標準モデルでは、従来型建物と熱効率の高い建物を分けて扱います。Low-Eや金属膜入りガラスは、窓損失の主因になりやすい入力です。',
    '入射角、偏波、室内奥行、受信高さは実測ばらつきに効くため、図と同じ座標感で入力すると現場で説明しやすくなります。',
  ],
  namigate: [
    '窓面の透過改善は、周波数、偏波、入射角、開口・面積、設置ずれに強く依存します。このMVPでは改善量を仮説値として置き、実測で校正する設計です。',
    '判断軸は「窓ありから何dB上がったか」だけでなく、「窓なしとの差を何%埋めたか」です。',
  ],
  measurement: [
    '実測比較では、同じ測定点、同じ高さ、同じ端末向き、十分な平均化時間を揃えるほど、窓損失と改善量を切り分けやすくなります。',
    'RSRPだけでなくSINR、RSRQ、DL/ULを残すと、強度改善と通信品質改善が一致しているか確認できます。',
  ],
  review: [
    '商用ダッシュボードでは、入力を小さなステップに分け、結果サマリーを常時見せる構成が迷いを減らします。',
    'まず3状態カードで差を掴み、次に3D/ヒートマップ、最後にグラフと校正を見る順番にすると、非専門家にも説明しやすくなります。',
  ],
}

const EVIDENCE_ITEMS: {
  category: string
  title: string
  summary: string
  url: string
}[] = [
  {
    category: '自由空間損失',
    title: 'ITU-R P.525 自由空間減衰',
    summary:
      'FSPL式の一次情報です。アプリでは f[MHz] と d[km] の形に換算した 32.44 + 20log10(f) + 20log10(d) を使います。',
    url: 'https://www.itu.int/rec/R-REC-P.525/en',
  },
  {
    category: '電波標準',
    title: '3GPP TR 38.901 チャネルモデル',
    summary:
      '0.5-100GHz帯の屋外、屋内、屋外-屋内モデルを扱う標準資料です。窓、建物侵入、室内距離損失を分けて考える根拠にしています。',
    url: 'https://portal.3gpp.org/desktopmodules/Specifications/SpecificationDetails.aspx?specificationId=3173',
  },
  {
    category: '電波標準',
    title: '3GPP Release 19のチャネルモデル更新',
    summary:
      'Release 19では7-24GHz帯の検討や屋外-屋内モデルの更新議論が進み、4.7GHzと28GHzの間の周波数帯も標準化上の関心領域になっています。',
    url: 'https://www.3gpp.org/ftp/Specs/archive/38_series/38.901/38901-j20.zip',
  },
  {
    category: '建物侵入損失',
    title: '建物侵入損失の国際推奨モデル',
    summary:
      '80MHz-100GHzの建物侵入損失を、従来型建物と熱効率の高い建物で分けて扱う考え方を参照しています。',
    url: 'https://www.itu.int/rec/R-REC-P.2109/en',
  },
  {
    category: '建材・窓材',
    title: 'ITU-R P.2040 建材・構造物の伝搬影響',
    summary:
      '100MHz超の建築材料・構造物による伝搬影響を扱う資料です。窓材、金属膜、壁材の違いを実測校正前提で扱う根拠にしています。',
    url: 'https://www.itu.int/rec/R-REC-P.2040/en',
  },
  {
    category: '測定計画',
    title: '室内伝搬モデルの国際推奨',
    summary:
      '2025年版では300MHz-450GHzの屋内伝搬を扱い、送受信位置、偏波、什器、人の移動などが室内評価に効くことを整理しています。',
    url: 'https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.1238-13-202509-I%21%21PDF-E.pdf',
  },
  {
    category: '測定計画',
    title: 'NTIA-ITS 電波伝搬モデリング',
    summary:
      '標準モデルと現場測定の差を扱う実務的な入口です。測定高さ、位置、環境条件を残す設計の根拠にしています。',
    url: 'https://its.ntia.gov/research/prop/propagation-modeling/',
  },
  {
    category: 'ローカル5G',
    title: 'ローカル5G免許申請支援マニュアル',
    summary:
      '日本のローカル5G制度、SA/NSA、免許申請、自己土地/他者土地、周波数利用条件を確認するための基礎資料です。',
    url: 'https://5gmf.jp/case/6326/',
  },
  {
    category: '窓・メタサーフェス',
    title: '窓面透過改善メタサーフェス研究',
    summary:
      '窓に取り付ける透過型メタサーフェスでO2Iカバレッジ改善を狙う研究です。角度、偏波、単板/複層ガラスへの実装が論点になります。',
    url: 'https://www.nature.com/articles/s41598-024-51447-3',
  },
  {
    category: 'IEEE動向',
    title: 'IEEE Communications Society RIS Best Readings',
    summary:
      'RIS/IRSのモデリング、設計、実装、標準化議論を追う入口です。ナミゲートのような窓面改善仮説を、厳密解析とは分けて扱う根拠にしています。',
    url: 'https://www.comsoc.org/publications/best-readings/reconfigurable-intelligent-surfaces',
  },
  {
    category: 'IEEE動向',
    title: 'IEEE Communications Standards Magazine RIS特集',
    summary:
      '5G-Advancedから6Gへ向かう中で、RISが伝搬環境を再構成する技術として議論されていることを示すIEEE ComSocの案内です。',
    url: 'https://www.comsoc.org/publications/magazines/ieee-communications-standards-magazine/cfp/reconfigurable-intelligent',
  },
  {
    category: 'UI設計',
    title: '段階的開示とフォーム設計',
    summary:
      '複雑な入力を一度に見せず、必要な順番で出すことで認知負荷を下げる設計原則を参照しています。',
    url: 'https://www.nngroup.com/articles/progressive-disclosure/',
  },
  {
    category: 'UI設計',
    title: '入力フォームの補足説明とエラー予防',
    summary:
      '商用フォームで、説明文、近接した補足、入力のまとまりを使って迷いを減らす設計原則を参照しています。',
    url: 'https://baymard.com/blog/form-field-descriptions',
  },
]

const PARAMETER_GUIDANCE: Record<
  InputStepId,
  {
    title: string
    items: Array<{
      label: string
      guideline: string
      basis: string
    }>
  }
> = {
  radio: {
    title: '無線・屋外の入力目安',
    items: [
      {
        label: '周波数',
        guideline:
          '日本のローカル5G検討ではSub6は4.6-4.9GHz、ミリ波は28.2-29.1GHzをまず候補にします。実証値と合わせる場合は実際の中心周波数を入れます。',
        basis:
          'ローカル5G制度資料と3GPP TR 38.901の0.5-100GHzモデルを参照。Release 19では7-24GHz帯の議論も進んでいます。',
      },
      {
        label: 'EIRP/送信出力',
        guideline:
          '免許・機器仕様に基づく値を優先します。仕様不明ならEIRP直接入力、構成が分かるなら送信出力＋アンテナ利得−給電損失で詳細計算します。',
        basis:
          'ローカル5Gは免許制で、アプリは法令適合判定ではありません。申請値、空中線電力、給電損失の管理が必要です。',
      },
      {
        label: '屋外伝搬モデル',
        guideline:
          '短距離・見通しの窓面評価はFSPLから開始します。奥村-秦は150-1500MHz・km級・高い基地局の経験式なので、4.7GHz/28GHzでは比較用に留めます。',
        basis:
          '3GPP/ITU系モデルでは屋外、建物侵入、室内を分けます。奥村-秦はローカル5Gの窓面近距離評価そのものではありません。',
      },
      {
        label: 'アンテナ高・指向・偏波',
        guideline:
          '送信高、受信高、窓中心高を実測条件に合わせ、指向ずれや偏波不整合は0-3dB程度から現場に合わせて調整します。',
        basis:
          'ITU-R P.1238は送受信位置、アンテナ放射、偏波、室内物体の影響を屋内伝搬評価の要素として扱います。',
      },
    ],
  },
  windowRoom: {
    title: '窓・室内の入力目安',
    items: [
      {
        label: '窓損失',
        guideline:
          '通常ガラスは数dB、複層は10dB級、Low-E/金属膜入りは30-40dB級を初期仮説にし、実測で校正します。',
        basis:
          'ITU-R P.2109は従来型建物と熱効率の高い建物を分けます。Low-Eや金属膜は熱効率と電波透過の両方に関係します。',
      },
      {
        label: '入射角',
        guideline:
          '90度を正面入射、60度で軽微、45度以下で悪化が目立つ仮定から始めます。窓面に対する基地局方向を図と合わせます。',
        basis:
          '建物侵入損失の測定では周波数だけでなく入射角、偏波、建物構成の違いがばらつき要因になります。',
      },
      {
        label: '屋内伝搬指数',
        guideline:
          '見通しの良い室内は2前後、什器・人・間仕切りが多い環境は2.5-3以上から確認します。',
        basis:
          'ITU-R P.1238は家具、壁、人や物体の移動、送受信位置が屋内伝搬に影響することを整理しています。',
      },
      {
        label: '室内距離と部屋寸法',
        guideline:
          '代表受信点だけでなく、実際に使いたい奥行・横幅を入れます。接続可能面積はこの寸法に強く依存します。',
        basis:
          '屋外-屋内評価では窓通過後の室内奥行損失を別に見ると、窓損失と室内減衰を切り分けやすくなります。',
      },
    ],
  },
  namigate: {
    title: 'ナミゲート仮説の入力目安',
    items: [
      {
        label: '改善量',
        guideline:
          '保守3dB、標準10dB、Low-E改善例25dBは仮説値です。実証では窓ありとの差分と窓なしへの回復率で評価します。',
        basis:
          'RIS/メタサーフェス研究では伝搬環境の再構成が論点ですが、実装、損失、偏波、角度で効果が変わるため実測校正が必要です。',
      },
      {
        label: 'サイズ・面積補正',
        guideline:
          '10cm×10cmを基準に、面積を増やすと改善余地が増える仮定です。上限を設定して過大評価を防ぎます。',
        basis:
          '窓面メタサーフェス研究では単位セル、周期構造、有効開口、ガラス実装が性能を左右します。',
      },
      {
        label: '設置効率・追加損失',
        guideline:
          '位置ずれ、貼付状態、偏波ずれが疑わしい場合は設置効率を70-90%、追加損失を1-3dBから試します。',
        basis:
          '実験室値と現場値の差を吸収するための実務パラメータです。AI分析時もこの値を明示します。',
      },
    ],
  },
  measurement: {
    title: '実測・N数の入力目安',
    items: [
      {
        label: '観測N数',
        guideline:
          'N=1は瞬間確認です。比較評価ではN=10以上、できればN=30以上の平均または中央値を使います。',
        basis:
          'フェージング、人の移動、端末測定更新周期でRSRPは揺れます。N数と平均化時間を残すと再現性を説明できます。',
      },
      {
        label: '平均化時間',
        guideline:
          '静的な窓面評価は30秒程度から開始します。人流や移動体がある場合は長め、または時間帯を分けて測ります。',
        basis:
          '測定ばらつきを小さくするには、同一端末、同一高さ、同一向き、同一点の条件を固定する必要があります。',
      },
      {
        label: 'SINR/RSRQ/DL/UL',
        guideline:
          'RSRPが改善してもSINRやスループットが伸びない場合があります。CSVでは品質指標も残します。',
        basis:
          'ローカル5Gの実証では、受信強度だけでなく干渉、品質、アップリンク/ダウンリンク用途を合わせて判断します。',
      },
    ],
  },
  review: {
    title: '結果確認の目安',
    items: [
      {
        label: '回復率',
        guideline:
          '窓ありで落ちた分のうち、ナミゲートで何%戻せたかを主指標にします。100%に近いほど窓なし相当です。',
        basis:
          'このアプリの重要コンセプトは「窓ありと窓なしの差をどれだけ埋めたか」です。',
      },
      {
        label: '接続可能面積',
        guideline:
          '代表点だけでなく部屋全体の面積で確認します。商談・実証では図と面積の説明が伝わりやすいです。',
        basis:
          '屋内利用価値は1点のRSRPより、使える面積と到達距離で判断されやすいためです。',
      },
    ],
  },
}

const RESEARCH_COLUMNS: Array<{
  title: string
  summary: string
  body: string
}> = [
  {
    title: 'N=1で判断しない理由',
    summary: 'RSRPは静止測定でも揺れるため、N数と平均化時間を残すと説明力が上がります。',
    body:
      '窓面のように反射や透過が絡む環境では、端末のわずかな位置差、人の移動、測定周期で数dBの差が出ます。N=1はその瞬間の値としては有用ですが、窓あり/ナミゲートありの比較には弱いです。まずN=10以上、判断資料ではN=30以上を目安にし、可能なら平均値だけでなく中央値、最小/最大、標準偏差も残します。',
  },
  {
    title: 'Low-E窓はなぜ要注意か',
    summary: '熱効率の高い窓は金属膜などにより建物侵入損失が大きくなる場合があります。',
    body:
      'ITU-R P.2109では建物侵入損失を従来型建物と熱効率の高い建物に分けて扱います。Low-Eや金属膜入りガラスは、熱を制御する層が電波透過にも効くことがあり、通常ガラスより大きな損失仮説を置く方が現場説明に向いています。ただし窓メーカー、膜構成、周波数、入射角で差が出るため、実測校正が前提です。',
  },
  {
    title: '奥村-秦と3GPPモデルの使い分け',
    summary: '奥村-秦は古典的なマクロセル経験式で、ローカル5G窓面近距離では比較用に留めます。',
    body:
      '奥村-秦モデルは150-1500MHz、km級距離、比較的高い基地局を前提にした経験式です。ローカル5Gの4.7GHzや28GHz、建物窓面への短距離入射では適用範囲外になりやすいため、FSPLや3GPP/ITU系の考え方と併用し、実測で補正してください。',
  },
  {
    title: 'ナミゲートとRIS/メタサーフェス動向',
    summary: 'IEEEや学術論文ではRIS/メタサーフェスが6Gに向けた伝搬環境制御技術として議論されています。',
    body:
      'RIS/IRSや透過型メタサーフェスは、反射・透過・位相制御により通信環境を改善する研究テーマです。一方で実用効果は周波数、偏波、角度、サイズ、損失、設置条件に依存します。このアプリでは「改善量」を物理定数として固定せず、仮説値として入力し、窓なしへの回復率と実測校正で判断する構成にしています。',
  },
  {
    title: 'ローカル5G実証で残すべき条件',
    summary: '免許条件とは別に、測定の再現性を支えるメタ情報が重要です。',
    body:
      'ローカル5Gは周波数、設置場所、自己土地/他者土地、同期条件、空中線電力など制度面の確認が必要です。実証ではさらに、端末、アンテナ向き、測定高さ、N数、平均化時間、人流、遮蔽物、天候、窓位置を残すと、後からAI分析や再測定で原因を切り分けやすくなります。',
  },
  {
    title: '日本の制度確認は最初に分ける',
    summary: 'シミュレーション値と免許・運用条件の適合判断は別タスクとして扱います。',
    body:
      '日本のローカル5Gは免許制で、主な周波数候補、設置場所、自己土地/他者土地、同期条件、空中線電力、EIRP、干渉調整を個別に確認します。このアプリはリンクバジェットの仮説整理用であり、法令上限や免許条件への適合を判定しません。商談では「技術的に届く可能性」と「制度上設置できる条件」を分けて説明すると誤解が減ります。',
  },
  {
    title: 'EIRPは営業資料で誤解されやすい',
    summary: 'EIRPは送信出力だけでなく、アンテナ利得や給電損失を含む実効値です。',
    body:
      '同じ送信出力でも、高利得アンテナを使うと特定方向のEIRPは大きくなります。一方、ケーブル、分配器、コネクタ、実装状態で損失が入ります。実地測定では、申請値、機器仕様、実際の給電構成、アンテナ方向をそろえて記録しないと、窓損失やナミゲート効果と送信条件の差が混ざってしまいます。',
  },
  {
    title: '7-24GHzと6G前段の議論',
    summary: '3GPP Release 19以降では、Sub6とミリ波の間の周波数帯もチャネルモデル上の関心が高まっています。',
    body:
      'ローカル5Gの代表帯域は4.7GHz帯と28GHz帯ですが、標準化や研究ではFR3相当の中間周波数帯、屋外-屋内、RIS/メタサーフェス、NTN/AI支援などが議論されています。窓面透過は周波数と建材に強く依存するため、入力周波数を固定して比較し、周波数を変える場合は別パターンとして保存する運用が向いています。',
  },
  {
    title: '実測の3状態は同じ場所でそろえる',
    summary: '窓開放、窓閉鎖、窓閉鎖＋ナミゲートは、端末位置と向きを固定して差分で読みます。',
    body:
      'ナミゲート効果は「窓ありから何dB上がったか」と「窓なしとの差を何%戻したか」です。位置が数十cm変わるだけでマルチパスが変わるため、三脚や治具で測定高さ・向き・窓面からの距離を固定し、各状態でN数と平均化時間をそろえると、dB差分の説明が強くなります。',
  },
  {
    title: '窓面改善はSINRまで見る',
    summary: 'RSRP改善があっても、干渉や反射でSINRが追従しないことがあります。',
    body:
      'RSRPは信号の強さを見やすい一方、通信品質やスループットはSINR、RSRQ、端末カテゴリ、基地局負荷、UL条件にも依存します。展示会ではRSRPと回復率を大きく見せ、技術検討ではCSVにSINR、RSRQ、DL/ULを入れて、強度改善が品質改善に結びついたかを確認します。',
  },
]

const VIEW_TABS: {
  id: ActiveView
  label: string
  description: string
}[] = [
  {
    id: 'overview',
    label: '概要',
    description: '3状態の差と到達性',
  },
  {
    id: 'visualization',
    label: '位置・分布',
    description: '3Dとヒートマップ',
  },
  {
    id: 'charts',
    label: 'グラフ',
    description: '距離、角度、面積',
  },
  {
    id: 'measurement',
    label: '実測データ',
    description: '現場値とCSV比較',
  },
  {
    id: 'analysis',
    label: '分析・校正',
    description: '誤差、校正候補、レポートを作成',
  },
  {
    id: 'evidence',
    label: '根拠',
    description: 'モデルとUIの考え方',
  },
]

const HELP_TEXT: Record<string, string> = {
  RSRP:
    '端末が受け取る5G基準信号の強さです。このアプリでは厳密なNR測定定義ではなく、リンクバジェットから見たRSRP相当の受信電力近似として扱います。',
  SINR:
    '信号と干渉・雑音の比です。RSRPが高くてもSINRが低いとスループットが伸びにくくなります。',
  RSRQ:
    '受信品質の指標です。電波の強さだけでは見えない混雑や干渉の影響を見る補助指標です。',
  RMSE:
    '推定と実測のズレを二乗平均平方根で表した値です。小さいほどモデルが現場に合っています。',
  '無線機プリセット': '汎用的な基地局・通信モジュール構成の初期値です。メーカー仕様や免許条件を保証するものではありません。',
  '周波数': '電波の周波数です。日本のローカル5G検討では4.6-4.9GHz帯、28.2-29.1GHz帯をまず確認します。標準的な5Gチャネルモデルでは周波数が建物侵入損失、回折、反射、窓透過に強く効くため、実証で使う中心周波数に合わせます。',
  'EIRP計算方式': 'EIRPを直接入れるか、送信出力やアンテナ利得から計算するかを選びます。',
  'EIRP直接入力': '送信出力、アンテナ利得、給電損失をまとめた実効的な送信電力です。仕様書や免許申請条件にEIRPがある場合はその値を優先します。法制度上の上限適合は本アプリでは判定せず、最新の総務省資料と免許条件で確認してください。',
  '送信出力': '無線機から出る空中線電力相当の入力値です。詳細EIRP計算方式のときに使います。機器仕様、設定値、実際の出力制限が異なることがあるため、実証前に無線機設定と申請条件を照合します。',
  '送信アンテナ利得': '送信アンテナが特定方向へ電波を集中させる効果です。EIRPは概ね送信出力＋アンテナ利得−給電損失で大きくなります。窓面へ正しく向いていない場合は指向ずれ損失も合わせて入れます。',
  '送信アンテナ高': '屋外側の送信アンテナ中心の地上高です。屋外-屋内リンクでは高さ差が見通し、入射角、屋外3D距離に効くため、仮値ではなく現地の設置高を入れると比較が安定します。',
  '送信給電損失': '無線機からアンテナまでのケーブルなどで失われる量です。',
  'その他送信損失': 'コネクタ、分配器、設置条件など送信側の追加損失です。',
  '受信アンテナ利得': '受信側アンテナの利得です。端末内蔵アンテナなら0dBi付近から始めると扱いやすいです。',
  '受信アンテナ高': '屋内側の代表受信点の高さです。端末高さやアンテナ向きは実測ばらつきの大きな要因なので、机上、手持ち、三脚などの測定条件に合わせて固定します。',
  '受信給電損失': '受信側のケーブルや接続部で失われる量です。',
  '受信機内部損失': '端末筐体や人体保持など、受信系で見込む追加損失です。',
  'アンテナ指向ずれ損失': '送受信アンテナの方位・チルト・ビーム方向が理想から外れる分を追加損失として見込みます。',
  '偏波不整合損失': '送受信アンテナの偏波向きがずれることで発生する損失です。',
  'フェージングマージン': '反射や人体遮蔽などのばらつきを保守的に見込む余裕です。',
  '屋外伝搬モデル': '送信機から窓までの屋外区間をどう見積もるかを選びます。FSPLは見通し基準、奥村-秦は市街地/郊外/開放地の経験式です。ローカル5Gでは適用範囲外表示を必ず確認してください。',
  '屋外距離': '送信機から窓面までの水平距離です。展示会デモでは100mなどの仮値で十分ですが、実証では図面、地図、レーザー距離計で確認した値を入れます。送信アンテナ高と窓中心高を加味して屋外3D斜距離へ変換します。',
  '屋外遮蔽損失': '屋外側の樹木、車両、仮設物、見通し悪化などを追加損失として見込む値です。',
  '地面反射補正': '地面反射などで強め/弱めに見込む補正値です。まず0dBから始めます。',
  '窓種別': '代表的な窓損失をプリセットから選べます。建物侵入損失の標準モデルでは、従来型建物と熱効率の高い建物を分けて扱うため、Low-Eや金属膜入りは別カテゴリとして見ます。',
  '窓損失': '窓ガラスを通過するときに失われる量です。通常ガラスは数dB、複層は10dB級、Low-Eや金属膜入りは30-40dB級を初期仮説にし、窓開放/窓閉鎖の実測差で校正します。',
  '窓幅': '窓の横幅です。図示とヒートマップの窓表示に使います。',
  '窓高さ': '窓の高さです。3D図の窓サイズに使います。',
  '窓中心高': '窓またはナミゲート中心の地上高です。送信・受信アンテナ高との差から3D距離と入射の説明を合わせます。',
  '入射角': '電波が窓へ入る角度です。90度が正面入射で、60度は軽微、45度以下は悪化が目立つ仮定から始めます。実測では基地局方位、窓面方位、偏波をそろえて記録します。',
  '部屋幅': '窓に沿った横方向の部屋寸法です。接続可能面積の計算に使います。',
  '部屋奥行': '窓から室内奥方向の部屋寸法です。ヒートマップ範囲と到達距離評価に使います。',
  '室内距離': '窓から受信点までの水平距離です。商談では代表点、実証では窓際・中央・奥側の複数点を測ると到達距離を説明しやすくなります。受信アンテナ高と窓中心高を加味して室内3D距離へ変換します。',
  '屋内伝搬指数': '室内で距離が伸びたときの減衰の強さです。屋外-屋内モデルでは、窓通過後の室内奥行損失を別に見ます。什器や間仕切りが多いほど大きめに置きます。',
  '屋内遮蔽損失': '什器、壁、人体、パーティションなど室内側で一律に見込む追加損失です。',
  '改善量プリセット': 'ナミゲート改善量の仮定値を選びます。実測に合わせる場合は改善量を直接変更します。',
  'ナミゲート改善量': 'ナミゲートで窓あり状態から上積みする改善量の仮定値です。保守3dB、標準10dB、Low-E改善例25dBは比較用の初期値で、保証値ではありません。周波数、偏波、入射角、設置位置に依存するため、実測比較で校正します。',
  'サイズ幅': 'ナミゲートの幅です。面積補正と図示に使います。',
  'サイズ高さ': 'ナミゲートの高さです。面積補正と図示に使います。',
  '面積補正係数': 'ナミゲート面積による改善量の効き具合を調整します。開口・周期構造・有効面積の影響を簡易的に表す係数です。',
  '面積補正上限': '面積補正が大きくなりすぎないようにする上限です。',
  '入射角回復率': '入射角損失のうち、ナミゲートがどれだけ回復できると仮定するかです。',
  '設置効率': '理想的な改善量に対して、実際の設置で得られる割合です。',
  '追加損失': '取り付け状態や位置ずれなどで差し引く損失です。',
  '最大総改善量': 'ナミゲートによる総改善量の上限です。',
  '接続しきい値': 'このRSRP以上なら接続可能とみなす判定基準です。実運用ではRSRPだけでなくSINR、RSRQ、スループットも合わせて確認します。',
  '測定高さ': '実測時の端末またはアンテナ高さです。机上測定なら約1.0-1.2m、手持ちなら実際の保持高さ、設備アンテナなら設置高を入れます。比較時は高さを固定すると誤差を読みやすくなります。',
  '観測N数': '手入力する実測RSRPを作る元データ数です。N=1は瞬間値に近く、比較評価ではN=10以上、できればN=30以上の平均または中央値を使います。各状態で同じN数にすると差分説明が安定します。',
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

const DEFAULT_THEORY_RSRP: TheoryRsrpValues = {
  noWindow: '',
  withWindow: '',
  withNamigate: '',
}

const DEFAULT_PROTOCOL: TestProtocol = {
  siteName: '',
  operatorName: '',
  deviceName: '',
  measurementHeightM: 1.2,
  observationCount: 30,
  averagingSeconds: 30,
  samplesPerPoint: 30,
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

function parseRsrpSamples(value: string) {
  return value
    .split(/[\s,、，;；]+/)
    .map((sample) => Number(sample.trim()))
    .filter((sample) => Number.isFinite(sample))
}

function calculateRsrpSampleStats(value: string): RsrpSampleStats {
  const samples = parseRsrpSamples(value)

  if (samples.length === 0) {
    return {
      samples,
      count: 0,
      meanDbm: null,
      medianDbm: null,
      minDbm: null,
      maxDbm: null,
      stddevDb: null,
    }
  }

  const sortedSamples = [...samples].sort((a, b) => a - b)
  const meanDbm =
    samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  const medianDbm =
    sortedSamples.length % 2 === 0
      ? (sortedSamples[sortedSamples.length / 2 - 1] +
          sortedSamples[sortedSamples.length / 2]) /
        2
      : sortedSamples[Math.floor(sortedSamples.length / 2)]
  const variance =
    samples.reduce((sum, sample) => sum + (sample - meanDbm) ** 2, 0) /
    samples.length

  return {
    samples,
    count: samples.length,
    meanDbm,
    medianDbm,
    minDbm: sortedSamples[0],
    maxDbm: sortedSamples[sortedSamples.length - 1],
    stddevDb: Math.sqrt(variance),
  }
}

function getObservationCountGuidance(count: number) {
  if (count <= 1) {
    return 'N=1は瞬間値の確認向けです。比較評価では最低でも複数回測定し、平均または中央値を使うことを推奨します。'
  }

  if (count < 10) {
    return 'Nが少ないため、フェージングや人の移動によるばらつきが残りやすい条件です。簡易確認として扱います。'
  }

  if (count < 30) {
    return '簡易な現場比較として使いやすいN数です。重要判断ではN=30以上、または複数地点での再測定を検討します。'
  }

  return '一般的な比較評価に使いやすいN数です。平均値に加えて標準偏差や外れ値も残すと、AI分析の精度が上がります。'
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
    normalized.includes('nowindow') ||
    normalized.includes('withoutwindow') ||
    normalized.includes('openwindow') ||
    normalized.includes('windowopen') ||
    normalized.includes('窓なし') ||
    normalized.includes('窓無し') ||
    normalized.includes('窓開放')
  ) {
    return 'noWindow'
  }

  if (
    normalized.includes('withwindow') ||
    normalized.includes('closedwindow') ||
    normalized.includes('windowclosed') ||
    normalized === 'window' ||
    normalized.includes('窓あり') ||
    normalized.includes('窓有') ||
    normalized.includes('窓閉鎖')
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
  const mobileHeightM = Math.max(settings.windowCenterHeightM, 0.1)
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

  if (settings.windowCenterHeightM < 1 || settings.windowCenterHeightM > 10) {
    messages.push('屋外リンク終点高1-10m外')
  }

  return messages
}

function getOutdoorModelNotice(settings: Settings) {
  if (!isHataModel(settings.outdoorModelId)) {
    return 'FSPLは見通し基準の単純モデルです。市街地の回折・建物群・地形による追加損失は、屋外遮蔽損失や実測校正で見込んでください。'
  }

  const validityMessages = getHataValidityMessages(settings)
  const baseText =
    '奥村-秦モデルは、周波数150-1500MHz、距離1-20km、基地局高30-200m、移動局高1-10m程度を前提にした経験式です。このアプリでは屋外区間の終点を窓中心高として扱います。'

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

function getEffectiveWindowLossDb(settings: Settings) {
  return settings.windowPresetId === 'none'
    ? 0
    : Math.max(settings.windowLossDb, 0)
}

function getRecoverableWindowGapDb(settings: Settings, angleDeg = settings.incidentAngleDeg) {
  return getEffectiveWindowLossDb(settings) + getEffectiveAngleLossDb(settings, angleDeg)
}

function calculateAppliedNamigateGainDb(
  settings: Settings,
  widthCm = settings.namigateWidthCm,
  heightCm = settings.namigateHeightCm,
  angleDeg = settings.incidentAngleDeg,
) {
  return Math.min(
    calculateNamigateTotalGainDb(settings, widthCm, heightCm, angleDeg),
    getRecoverableWindowGapDb(settings, angleDeg),
  )
}

function getScenarioAdjustmentDb(settings: Settings, scenario: ScenarioKey) {
  if (scenario === 'noWindow') {
    return 0
  }

  const windowAndAngleLossDb = getRecoverableWindowGapDb(settings)

  if (scenario === 'withWindow') {
    return -windowAndAngleLossDb
  }

  return (
    -windowAndAngleLossDb +
    calculateAppliedNamigateGainDb(settings)
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

function subtractNullable(
  minuend: number | null,
  subtrahend: number | null,
): number | null {
  return minuend === null || subtrahend === null ? null : minuend - subtrahend
}

function recoveryPercentNullable(
  recoveredDb: number | null,
  gapDb: number | null,
): number | null {
  if (recoveredDb === null || gapDb === null || Math.abs(gapDb) < 0.001) {
    return null
  }

  return (recoveredDb / gapDb) * 100
}

function formatRecordRatio(recorded: number, total: number) {
  return total === 0 ? '0/0' : `${numberFormatter.format(recorded)}/${numberFormatter.format(total)}`
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
    ]) ?? getEffectiveWindowLossDb(settings),
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
    Math.min(
      Math.max(settings.namigateMaxTotalGainDb, 0),
      getRecoverableWindowGapDb(windowCalibratedSettings),
    ),
  )
  const efficiency = Math.max(settings.namigateInstallationEfficiencyPercent, 0.001) / 100
  const recommendedNamigateGainDb = clamp(
    (recommendedTotalNamigateGainDb + settings.namigateAdditionalLossDb) / efficiency -
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

function buildFieldAidItems({
  settings,
  protocol,
  measuredComparisons,
  theoryComparisons,
  pointComparisons,
  pointErrorStats,
  qualityStats,
  measuredAverageResidualDb,
  measuredVsTheoryAverageGapDb,
  measuredWindowLossDb,
  measuredGlassOnlyLossDb,
  angleLossDb,
  measuredNamigateGainDb,
  measuredNamigateGapDb,
  measuredRecoveryRate,
}: {
  settings: Settings
  protocol: TestProtocol
  measuredComparisons: MeasuredComparison[]
  theoryComparisons: TheoryComparison[]
  pointComparisons: PointComparison[]
  pointErrorStats: ErrorStats
  qualityStats: QualityStats
  measuredAverageResidualDb: number | null
  measuredVsTheoryAverageGapDb: number | null
  measuredWindowLossDb: number | null
  measuredGlassOnlyLossDb: number | null
  angleLossDb: number
  measuredNamigateGainDb: number | null
  measuredNamigateGapDb: number | null
  measuredRecoveryRate: number | null
}) {
  const manualMeasuredCount = measuredComparisons.filter(
    (comparison) => comparison.measuredRsrpDbm !== null,
  ).length
  const theoryCount = theoryComparisons.filter(
    (comparison) => comparison.theoryRsrpDbm !== null,
  ).length
  const pointCountByScenario = SCENARIOS.reduce(
    (accumulator, scenario) => ({
      ...accumulator,
      [scenario.key]: pointComparisons.filter(
        (point) => point.scenario === scenario.key,
      ).length,
    }),
    {} as Record<ScenarioKey, number>,
  )
  const minScenarioPointCount = Math.min(...Object.values(pointCountByScenario))
  const checklistCount = Object.values(protocol.checklist).filter(Boolean).length
  const fixedConditionCount = [
    protocol.checklist.sameDevice,
    protocol.checklist.sameHeight,
    protocol.checklist.sameAntennaDirection,
    protocol.checklist.fixedWindowPosition,
  ].filter(Boolean).length
  const maxMeasuredY = pointComparisons.reduce(
    (maxValue, point) => Math.max(maxValue, point.yM),
    0,
  )
  const depthCoveragePercent =
    pointComparisons.length === 0
      ? null
      : (maxMeasuredY / Math.max(settings.roomDepthM, 1)) * 100
  const sinrRecordedCount = pointComparisons.filter((point) => point.sinrDb !== null).length
  const throughputRecordedCount = pointComparisons.filter(
    (point) => point.dlMbps !== null || point.ulMbps !== null,
  ).length
  const connectedRatioText = formatOptionalPercent(qualityStats.connectedRatio)
  const maxAbsResidualDb = pointErrorStats.maxAbsDb
  const sampleStatus: FieldAidStatus =
    protocol.observationCount >= 30 ? 'ok' : protocol.observationCount >= 10 ? 'warn' : 'risk'
  const averagingStatus: FieldAidStatus =
    protocol.averagingSeconds >= 30 ? 'ok' : protocol.averagingSeconds >= 10 ? 'warn' : 'risk'
  const residualStatus: FieldAidStatus =
    measuredAverageResidualDb === null
      ? 'info'
      : Math.abs(measuredAverageResidualDb) <= 3
        ? 'ok'
        : Math.abs(measuredAverageResidualDb) <= 8
          ? 'warn'
          : 'risk'
  const rmseStatus: FieldAidStatus =
    pointErrorStats.rmseDb === null
      ? 'info'
      : pointErrorStats.rmseDb <= 4
        ? 'ok'
        : pointErrorStats.rmseDb <= 8
          ? 'warn'
          : 'risk'

  return [
    {
      id: 'manual-three-state',
      label: '1. 3状態の手入力',
      value: `${manualMeasuredCount}/3`,
      status: manualMeasuredCount === 3 ? 'ok' : manualMeasuredCount > 0 ? 'warn' : 'risk',
      memo: '窓開放相当、窓閉鎖、窓閉鎖＋ナミゲートを同一点で揃えると、dB差分を直接読めます。',
    },
    {
      id: 'theory-three-state',
      label: '2. 外部理論値',
      value: `${theoryCount}/3`,
      status: theoryCount === 3 ? 'ok' : theoryCount > 0 ? 'warn' : 'info',
      memo: '外部計算値を3状態で入れると、実測-理論、推定-理論のズレを分離できます。',
    },
    {
      id: 'csv-point-count',
      label: '3. CSV実測点数',
      value: `${numberFormatter.format(pointComparisons.length)}点`,
      status: pointComparisons.length >= 9 ? 'ok' : pointComparisons.length >= 3 ? 'warn' : 'info',
      memo: `代表点だけでなく複数点を入れると、室内の場所依存と外れ値が見えます。接続可能率 ${connectedRatioText}。`,
    },
    {
      id: 'scenario-balance',
      label: '4. 状態別点数バランス',
      value: `開${pointCountByScenario.noWindow}/閉${pointCountByScenario.withWindow}/NG${pointCountByScenario.withNamigate}`,
      status: minScenarioPointCount >= 3 ? 'ok' : minScenarioPointCount >= 1 ? 'warn' : 'risk',
      memo: '各状態で同じ測定点数に近づけると、窓とナミゲートの寄与比較が安定します。',
    },
    {
      id: 'observation-count',
      label: '5. 観測N数',
      value: `N=${numberFormatter.format(protocol.observationCount)}`,
      status: sampleStatus,
      memo: 'N=30以上なら比較評価の説明がしやすく、N=1は瞬間確認として扱います。',
    },
    {
      id: 'averaging-time',
      label: '6. 平均化時間',
      value: `${numberFormatter.format(protocol.averagingSeconds)}秒`,
      status: averagingStatus,
      memo: '静的評価は30秒程度を目安にし、人流がある場合は時間帯を分けます。',
    },
    {
      id: 'checklist-completion',
      label: '7. 測定条件チェック',
      value: `${checklistCount}/6`,
      status: checklistCount >= 5 ? 'ok' : checklistCount >= 3 ? 'warn' : 'risk',
      memo: '端末、測定高、向き、環境記録が揃うほど再現性を説明できます。',
    },
    {
      id: 'fixed-condition',
      label: '8. 同一条件固定',
      value: `${fixedConditionCount}/4`,
      status: fixedConditionCount === 4 ? 'ok' : fixedConditionCount >= 2 ? 'warn' : 'risk',
      memo: '3状態比較では端末、測定高、向き、窓/ナミゲート位置を固定します。',
    },
    {
      id: 'measured-window-loss',
      label: '9. 実測窓損失',
      value: formatOptionalDb(measuredWindowLossDb),
      status: measuredWindowLossDb === null ? 'info' : measuredWindowLossDb >= 0 ? 'ok' : 'risk',
      memo: '窓開放相当と窓閉鎖の差です。負値なら測定条件のずれを確認します。',
    },
    {
      id: 'glass-loss',
      label: '10. ガラス由来損失',
      value: formatOptionalDb(measuredGlassOnlyLossDb),
      status:
        measuredGlassOnlyLossDb === null
          ? 'info'
          : measuredGlassOnlyLossDb >= 0
            ? 'ok'
            : 'risk',
      memo: '実測窓損失から現在モデルの入射角損失を差し引いた概算です。',
    },
    {
      id: 'angle-loss',
      label: '11. 入射角仮説',
      value: formatDb(angleLossDb),
      status: settings.incidentAngleDeg >= 45 ? 'ok' : 'warn',
      memo: '浅い角度では窓面透過のばらつきが大きくなります。角度別再測の候補です。',
    },
    {
      id: 'namigate-gain',
      label: '12. ナミゲート実効改善',
      value: formatOptionalDb(measuredNamigateGainDb),
      status:
        measuredNamigateGainDb === null
          ? 'info'
          : measuredNamigateGainDb > 0
            ? 'ok'
            : 'risk',
      memo: '閉鎖＋ナミゲートありと閉鎖＋なしの差です。効果の主指標です。',
    },
    {
      id: 'namigate-model-gap',
      label: '13. ナミゲート推定差',
      value: formatOptionalDb(measuredNamigateGapDb),
      status:
        measuredNamigateGapDb === null
          ? 'info'
          : Math.abs(measuredNamigateGapDb) <= 3
            ? 'ok'
            : Math.abs(measuredNamigateGapDb) <= 8
              ? 'warn'
              : 'risk',
      memo: '実測改善量とアプリ推定改善量の差です。面積補正や設置効率の校正に使います。',
    },
    {
      id: 'recovery-rate',
      label: '14. 実測回復率',
      value: formatOptionalPercent(measuredRecoveryRate),
      status:
        measuredRecoveryRate === null
          ? 'info'
          : measuredRecoveryRate >= 70
            ? 'ok'
            : measuredRecoveryRate >= 30
              ? 'warn'
              : 'risk',
      memo: '窓で落ちた分のうち、ナミゲートで何%戻せたかです。',
    },
    {
      id: 'model-bias',
      label: '15. 実測-推定 平均',
      value: formatOptionalDb(measuredAverageResidualDb),
      status: residualStatus,
      memo: '3状態に共通するオフセットならEIRP、アンテナ利得、追加損失を見直します。',
    },
    {
      id: 'csv-rmse',
      label: '16. CSV RMSE',
      value: formatOptionalDb(pointErrorStats.rmseDb),
      status: rmseStatus,
      memo: 'CSV点別のモデル誤差です。地点差が大きい場合は室内伝搬指数や遮蔽を見ます。',
    },
    {
      id: 'max-outlier',
      label: '17. 最大外れ値',
      value: formatOptionalDb(maxAbsResidualDb),
      status:
        maxAbsResidualDb === null
          ? 'info'
          : maxAbsResidualDb <= 6
            ? 'ok'
            : maxAbsResidualDb <= 12
              ? 'warn'
              : 'risk',
      memo: '大きな外れ値は人体遮蔽、端末向き、マルチパス、測定点記録ミスの候補です。',
    },
    {
      id: 'theory-bias',
      label: '18. 実測-理論 平均',
      value: formatOptionalDb(measuredVsTheoryAverageGapDb),
      status:
        measuredVsTheoryAverageGapDb === null
          ? 'info'
          : Math.abs(measuredVsTheoryAverageGapDb) <= 3
            ? 'ok'
            : Math.abs(measuredVsTheoryAverageGapDb) <= 8
              ? 'warn'
              : 'risk',
      memo: '外部理論値との差です。全状態同方向なら共通条件、特定状態だけなら窓/NG条件を疑います。',
    },
    {
      id: 'quality-records',
      label: '19. 品質指標記録',
      value: `SINR ${formatRecordRatio(sinrRecordedCount, pointComparisons.length)} / DLUL ${formatRecordRatio(throughputRecordedCount, pointComparisons.length)}`,
      status:
        pointComparisons.length === 0
          ? 'info'
          : sinrRecordedCount === pointComparisons.length &&
              throughputRecordedCount === pointComparisons.length
            ? 'ok'
            : sinrRecordedCount > 0 || throughputRecordedCount > 0
              ? 'warn'
              : 'risk',
      memo: 'RSRPが改善してもSINRやスループットが伸びない場合があります。',
    },
    {
      id: 'depth-coverage',
      label: '20. 室内奥行カバー',
      value: depthCoveragePercent === null ? '未入力' : `${numberFormatter.format(depthCoveragePercent)}%`,
      status:
        depthCoveragePercent === null
          ? 'info'
          : depthCoveragePercent >= 80
            ? 'ok'
            : depthCoveragePercent >= 45
              ? 'warn'
              : 'risk',
      memo: '奥側まで測れているかの目安です。到達距離評価には窓際、中央、奥側の点が必要です。',
    },
  ] satisfies FieldAidItem[]
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

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getConnectionLabel(rsrpDbm: number, thresholdDbm: number) {
  return rsrpDbm >= thresholdDbm ? '接続可能の目安' : 'しきい値未満'
}

function buildSalesComment({
  noWindowRsrp,
  withWindowRsrp,
  withNamigateRsrp,
  recoveryRate,
  thresholdDbm,
}: {
  noWindowRsrp: number
  withWindowRsrp: number
  withNamigateRsrp: number
  recoveryRate: number
  thresholdDbm: number
}) {
  const windowDropDb = Math.max(noWindowRsrp - withWindowRsrp, 0)
  const namigateGainDb = Math.max(withNamigateRsrp - withWindowRsrp, 0)
  const connectionText = getConnectionLabel(withNamigateRsrp, thresholdDbm)

  if (namigateGainDb <= 0.1) {
    return `本条件では窓による低下が約${formatDb(
      windowDropDb,
    )}見込まれます。ナミゲート改善量を0dBにしているため、まず現地実測で窓損失と入射角の影響を確認する条件です。`
  }

  return `本条件では、窓損失により屋内側の受信レベルが約${formatDb(
    windowDropDb,
  )}低下しますが、ナミゲートにより約${formatDb(
    namigateGainDb,
  )}の回復を想定できます。窓なし状態への回復率は約${numberFormatter.format(
    clamp(recoveryRate, 0, 100),
  )}%で、判定は「${connectionText}」です。正式評価では現地実測を入れて校正します。`
}

function buildPrintReportHtml({
  settings,
  protocol,
  scenarioResults,
  fieldEffectRows,
  fieldAidItems,
  effectiveWindowLossDb,
  angleLossDb,
  totalNamigateGainDb,
  appliedNamigateGainDb,
  recoveryRate,
  effectiveEirpDbm,
  detailedEirpDbm,
  receiverAdjustmentDb,
  currentOutdoorPathLossDb,
  currentIndoorLossDb,
  salesComment,
}: {
  settings: Settings
  protocol: TestProtocol
  scenarioResults: ScenarioResult[]
  fieldEffectRows: EffectSummaryRow[]
  fieldAidItems: FieldAidItem[]
  effectiveWindowLossDb: number
  angleLossDb: number
  totalNamigateGainDb: number
  appliedNamigateGainDb: number
  recoveryRate: number
  effectiveEirpDbm: number
  detailedEirpDbm: number
  receiverAdjustmentDb: number
  currentOutdoorPathLossDb: number
  currentIndoorLossDb: number
  salesComment: string
}) {
  const createdAt = new Date().toLocaleString('ja-JP')
  const windowLabel =
    WINDOW_PRESETS.find((preset) => preset.id === settings.windowPresetId)?.label ??
    '任意'
  const namigateLabel =
    NAMIGATE_PRESETS.find((preset) => preset.id === settings.namigatePresetId)
      ?.label ?? '任意'
  const rows = scenarioResults
    .map(
      (scenario) => `
        <tr>
          <td>${escapeHtml(scenario.label)}</td>
          <td>${escapeHtml(formatDbm(scenario.rsrpDbm))}</td>
          <td>${escapeHtml(formatArea(scenario.connectedAreaM2))}</td>
          <td>${escapeHtml(formatMeters(scenario.maxReachM))}</td>
          <td>${escapeHtml(getConnectionLabel(scenario.rsrpDbm, settings.connectionThresholdDbm))}</td>
        </tr>`,
    )
    .join('')
  const fieldRows = fieldEffectRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.model)}</td>
          <td>${escapeHtml(row.measured)}</td>
          <td>${escapeHtml(row.theory)}</td>
          <td>${escapeHtml(row.memo)}</td>
        </tr>`,
    )
    .join('')
  const checklistRows = fieldAidItems
    .slice(0, 12)
    .map(
      (item) => `
        <li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(
          item.memo,
        )}</li>`,
    )
    .join('')

  return `<!doctype html>
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(REPORT_TITLE)}</title>
      <style>
        :root { color: #17202a; font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif; }
        body { margin: 0; background: #eef3f8; }
        main { max-width: 960px; margin: 0 auto; padding: 28px; background: #fff; }
        header { border-bottom: 4px solid ${MAIN_COLOR}; padding-bottom: 16px; margin-bottom: 20px; }
        h1 { font-size: 26px; margin: 6px 0; color: #0f3047; }
        h2 { font-size: 17px; color: ${MAIN_COLOR}; margin: 22px 0 10px; }
        .brand { color: #52616f; font-size: 12px; font-weight: 700; letter-spacing: .04em; }
        .meta, .note { color: #52616f; font-size: 12px; line-height: 1.7; }
        .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
        .summary article { border: 1px solid #d8e3ec; border-radius: 8px; padding: 12px; }
        .summary span { display: block; color: #5c6d7a; font-size: 11px; }
        .summary strong { display: block; font-size: 20px; margin-top: 4px; color: #12364f; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0 14px; }
        th, td { border: 1px solid #d8e3ec; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #eef7fc; color: #15354a; }
        ul { margin-top: 6px; padding-left: 18px; font-size: 12px; line-height: 1.7; }
        .comment { border-left: 4px solid ${MAIN_COLOR}; background: #f1f8fc; padding: 12px 14px; line-height: 1.7; }
        .disclaimer { border: 1px solid #cbdbe7; border-radius: 8px; padding: 12px 14px; background: #f7fafc; line-height: 1.7; }
        .actions { margin: 16px 0 22px; }
        button { background: ${MAIN_COLOR}; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
        @media print {
          body { background: #fff; }
          main { max-width: none; padding: 0; }
          .actions { display: none; }
          h2 { break-after: avoid; }
          table, article, .comment, .disclaimer { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <main>
        <header>
          <div class="brand">スタッフ株式会社 / 未来へつなぐ共創パートナー</div>
          <h1>${escapeHtml(REPORT_TITLE)}</h1>
          <div class="meta">作成日時: ${escapeHtml(createdAt)}</div>
        </header>
        <div class="actions">
          <button type="button" onclick="window.print()">PDFとして保存</button>
          <span class="meta">ブラウザの印刷画面で「PDFに保存」を選択してください。</span>
        </div>
        <section class="summary">
          <article><span>窓なし</span><strong>${escapeHtml(formatDbm(scenarioResults[0].rsrpDbm))}</strong></article>
          <article><span>窓あり</span><strong>${escapeHtml(formatDbm(scenarioResults[1].rsrpDbm))}</strong></article>
          <article><span>窓あり＋ナミゲート</span><strong>${escapeHtml(formatDbm(scenarioResults[2].rsrpDbm))}</strong></article>
          <article><span>回復率</span><strong>${escapeHtml(`${numberFormatter.format(clamp(recoveryRate, 0, 100))}%`)}</strong></article>
        </section>
        <h2>入力条件</h2>
        <table>
          <tbody>
            <tr><th>周波数</th><td>${escapeHtml(numberFormatter.format(settings.frequencyMHz))} MHz</td><th>屋外距離</th><td>${escapeHtml(formatMeters(settings.outdoorDistanceM))}</td></tr>
            <tr><th>室内距離</th><td>${escapeHtml(formatMeters(settings.indoorDistanceM))}</td><th>屋外伝搬モデル</th><td>${escapeHtml(getOutdoorModelLabel(settings.outdoorModelId))}</td></tr>
            <tr><th>窓種別</th><td>${escapeHtml(windowLabel)}</td><th>実効窓損失</th><td>${escapeHtml(formatDb(effectiveWindowLossDb))}</td></tr>
            <tr><th>入射角</th><td>${escapeHtml(`${numberFormatter.format(settings.incidentAngleDeg)}° / 損失 ${formatDb(angleLossDb)}`)}</td><th>ナミゲート</th><td>${escapeHtml(`${namigateLabel} / 仮説 ${formatDb(totalNamigateGainDb)} / 適用 ${formatDb(appliedNamigateGainDb)}`)}</td></tr>
            <tr><th>EIRP</th><td>${escapeHtml(formatDbm(effectiveEirpDbm))}</td><th>詳細EIRP</th><td>${escapeHtml(formatDbm(detailedEirpDbm))}</td></tr>
            <tr><th>送信/受信高</th><td>${escapeHtml(`${formatMeters(settings.txAntennaHeightM)} / ${formatMeters(settings.rxAntennaHeightM)}`)}</td><th>窓中心高</th><td>${escapeHtml(formatMeters(settings.windowCenterHeightM))}</td></tr>
            <tr><th>伝搬損失</th><td>${escapeHtml(`屋外 ${formatDb(currentOutdoorPathLossDb)} / 室内 ${formatDb(currentIndoorLossDb)}`)}</td><th>受信系補正</th><td>${escapeHtml(formatDb(receiverAdjustmentDb))}</td></tr>
            <tr><th>接続しきい値</th><td>${escapeHtml(formatDbm(settings.connectionThresholdDbm))}</td><th>測定条件</th><td>${escapeHtml(`高さ ${formatMeters(protocol.measurementHeightM)} / N=${numberFormatter.format(protocol.observationCount)} / ${numberFormatter.format(protocol.averagingSeconds)}秒`)}</td></tr>
          </tbody>
        </table>
        <h2>3状態比較</h2>
        <table>
          <thead><tr><th>状態</th><th>推定RSRP</th><th>接続可能面積</th><th>最大到達距離</th><th>接続可能性</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <h2>主要KPI</h2>
        <table>
          <tbody>
            <tr><th>改善量</th><td>${escapeHtml(formatDb(scenarioResults[2].rsrpDbm - scenarioResults[1].rsrpDbm))}</td><th>窓損失の回復率</th><td>${escapeHtml(`${numberFormatter.format(clamp(recoveryRate, 0, 100))}%`)}</td></tr>
            <tr><th>フェードマージン</th><td>${escapeHtml(formatDb(settings.fadeMarginDb))}</td><th>接続可能性</th><td>${escapeHtml(getConnectionLabel(scenarioResults[2].rsrpDbm, settings.connectionThresholdDbm))}</td></tr>
          </tbody>
        </table>
        <h2>営業説明用コメント</h2>
        <p class="comment">${escapeHtml(salesComment)}</p>
        <h2>技術メモ</h2>
        <table>
          <thead><tr><th>項目</th><th>アプリモデル</th><th>実測</th><th>外部理論</th><th>読み方</th></tr></thead>
          <tbody>${fieldRows}</tbody>
        </table>
        <p class="note">実測時はRSRP、SINR、RSRQ、DL/ULスループット、測定高さ、端末向き、窓・ナミゲート位置、N数、平均化時間を同じ条件で残すことを推奨します。</p>
        <h2>実測前チェックリスト</h2>
        <ul>${checklistRows}</ul>
        <h2>免責・利用範囲</h2>
        <p class="disclaimer">${escapeHtml(DISCLAIMER_FULL)}</p>
      </main>
    </body>
  </html>`
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

function ParameterGuidance({ stepId }: { stepId: InputStepId }) {
  const guidance = PARAMETER_GUIDANCE[stepId]

  return (
    <section className="guidance-panel" aria-label={`${guidance.title}の解説`}>
      <div className="guidance-heading">
        <strong>入力目安と根拠</strong>
        <span>{guidance.title}</span>
      </div>
      <div className="guidance-grid">
        {guidance.items.map((item) => (
          <details className="guidance-card" key={item.label}>
            <summary>
              <span>{item.label}</span>
              <small>{item.guideline}</small>
            </summary>
            <p>{item.basis}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function ResearchColumns() {
  return (
    <section className="column-section" aria-label="研究動向コラム">
      <div className="subsection-heading">
        <h3>短いコラム</h3>
        <span>必要な項目だけ開いて確認</span>
      </div>
      <div className="column-list">
        {RESEARCH_COLUMNS.map((column) => (
          <details className="column-card" key={column.title}>
            <summary>
              <strong>{column.title}</strong>
              <span>{column.summary}</span>
            </summary>
            <p>{column.body}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FieldAidPanel({ items }: { items: FieldAidItem[] }) {
  const okCount = items.filter((item) => item.status === 'ok').length
  const riskCount = items.filter((item) => item.status === 'risk').length

  return (
    <section className="field-aid-panel" aria-label="実地測定レビュー20項目">
      <div className="subsection-heading">
        <h3>実地測定レビュー20項目</h3>
        <span>
          良好 {numberFormatter.format(okCount)} / 要確認{' '}
          {numberFormatter.format(riskCount)}
        </span>
      </div>
      <div className="field-aid-grid">
        {items.map((item) => (
          <article className={`field-aid-card is-${item.status}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.memo}</small>
          </article>
        ))}
      </div>
    </section>
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

function isInputStepId(value: unknown): value is InputStepId {
  return (
    typeof value === 'string' &&
    INPUT_STEPS.some((step) => step.id === value)
  )
}

function isActiveView(value: unknown): value is ActiveView {
  return (
    typeof value === 'string' &&
    VIEW_TABS.some((tab) => tab.id === value)
  )
}

function isAppMode(value: unknown): value is AppMode {
  return (
    typeof value === 'string' &&
    DISPLAY_MODES.some((mode) => mode.id === value)
  )
}

function mergeMeasuredRsrpValues(
  values: Partial<MeasuredRsrpValues> | undefined,
): MeasuredRsrpValues {
  return {
    ...DEFAULT_MEASURED_RSRP,
    ...(values ?? {}),
  }
}

function mergeTheoryRsrpValues(
  values: Partial<TheoryRsrpValues> | undefined,
): TheoryRsrpValues {
  return {
    ...DEFAULT_THEORY_RSRP,
    ...(values ?? {}),
  }
}

function mergeProtocolDraft(protocol: ProtocolDraft | undefined): TestProtocol {
  return {
    ...DEFAULT_PROTOCOL,
    ...(protocol ?? {}),
    checklist: {
      ...DEFAULT_PROTOCOL.checklist,
      ...(protocol?.checklist ?? {}),
    },
  }
}

function loadAutoSaveDraft(): Partial<AutoSaveDraft> {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Partial<AutoSaveDraft>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistAutoSaveDraft(draft: AutoSaveDraft) {
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

function savedCasePatternSignature(savedCase: SavedTestCase) {
  return JSON.stringify({
    settings: { ...DEFAULT_SETTINGS, ...savedCase.settings },
    measuredRsrpValues: mergeMeasuredRsrpValues(savedCase.measuredRsrpValues),
    theoryRsrpValues: mergeTheoryRsrpValues(savedCase.theoryRsrpValues),
    measurementCsvText:
      savedCase.measurementCsvText ??
      (savedCase.measurementPoints?.length
        ? buildMeasurementCsv(savedCase.measurementPoints)
        : SAMPLE_MEASUREMENT_CSV),
    measurementPoints: savedCase.measurementPoints ?? [],
    protocol: mergeProtocolDraft(savedCase.protocol),
  })
}

function currentPatternSignature({
  settings,
  measuredRsrpValues,
  theoryRsrpValues,
  measurementCsvText,
  measurementPoints,
  protocol,
}: {
  settings: Settings
  measuredRsrpValues: MeasuredRsrpValues
  theoryRsrpValues: TheoryRsrpValues
  measurementCsvText: string
  measurementPoints: MeasurementPoint[]
  protocol: TestProtocol
}) {
  return JSON.stringify({
    settings,
    measuredRsrpValues,
    theoryRsrpValues,
    measurementCsvText,
    measurementPoints,
    protocol,
  })
}

function createUniquePatternName(
  baseName: string,
  cases: SavedTestCase[],
  ignoredCaseId = '',
) {
  let candidate = baseName
  let index = 2

  while (
    cases.some(
      (savedCase) =>
        savedCase.id !== ignoredCaseId && savedCase.name === candidate,
    )
  ) {
    candidate = `${baseName} (${index})`
    index += 1
  }

  return candidate
}

function formatAutoSaveTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '時刻不明'
  }

  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildExperimentReport({
  settings,
  protocol,
  scenarioResults,
  theoryComparisons,
  fieldEffectRows,
  fieldAidItems,
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
  theoryComparisons: TheoryComparison[]
  fieldEffectRows: EffectSummaryRow[]
  fieldAidItems: FieldAidItem[]
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
  const theoryRowsText = theoryComparisons
    .map(
      (row) =>
        `| ${row.label} | ${formatDbm(row.rsrpDbm)} | ${formatOptionalDbm(
          row.measuredRsrpDbm,
        )} | ${formatOptionalDbm(row.theoryRsrpDbm)} | ${formatOptionalDb(
          row.measuredVsTheoryDb,
        )} | ${formatOptionalDb(row.estimatedVsTheoryDb)} |`,
    )
    .join('\n')
  const effectRowsText = fieldEffectRows
    .map(
      (row) =>
        `| ${row.label} | ${row.model} | ${row.measured} | ${row.theory} | ${row.delta} | ${row.memo} |`,
    )
    .join('\n')
  const fieldAidRowsText = fieldAidItems
    .map(
      (item) =>
        `| ${item.label} | ${item.value} | ${item.status} | ${item.memo} |`,
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
    `- 観測N数: N=${numberFormatter.format(protocol.observationCount)}`,
    `- N数メモ: ${getObservationCountGuidance(protocol.observationCount)}`,
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
	    `- 実効窓損失: ${formatDb(getEffectiveWindowLossDb(settings))}`,
	    `- 入射角: ${numberFormatter.format(settings.incidentAngleDeg)}°`,
	    `- 屋内伝搬指数: ${numberFormatter.format(settings.indoorPathLossExponent)}`,
	    `- ナミゲート改善仮説: ${formatDb(calculateNamigateTotalGainDb(settings))}`,
	    `- ナミゲート適用改善量: ${formatDb(calculateAppliedNamigateGainDb(settings))}`,
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
    '## 実測と外部理論計算値の比較',
    '| 状態 | アプリ推定RSRP | 実測RSRP | 外部理論RSRP | 実測-理論 | 推定-理論 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    theoryRowsText,
    '',
    '## dB寄与分解',
    '| 項目 | アプリモデル | 実測 | 外部理論 | 実測-理論 | 読み方 |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    effectRowsText,
    '',
    '## 実地測定レビュー20項目',
    '| 項目 | 値 | 状態 | 確認ポイント |',
    '| --- | ---: | --- | --- |',
    fieldAidRowsText,
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
    '## 免責・利用範囲',
    DISCLAIMER_FULL,
  ].join('\n')
}

function buildAiAnalysisText({
  settings,
  protocol,
  scenarioResults,
  measuredComparisons,
  measuredSampleStats,
  theoryComparisons,
  fieldEffectRows,
  fieldAidItems,
  angleLossDb,
  areaGainDb,
  totalNamigateGainDb,
  recoveryRate,
  measuredAverageResidualDb,
  measuredVsTheoryAverageGapDb,
  measuredWindowLossDb,
  measuredNamigateGainDb,
}: {
  settings: Settings
  protocol: TestProtocol
  scenarioResults: ScenarioResult[]
  measuredComparisons: MeasuredComparison[]
  measuredSampleStats: Record<ScenarioKey, RsrpSampleStats>
  theoryComparisons: TheoryComparison[]
  fieldEffectRows: EffectSummaryRow[]
  fieldAidItems: FieldAidItem[]
  angleLossDb: number
  areaGainDb: number
  totalNamigateGainDb: number
  recoveryRate: number
  measuredAverageResidualDb: number | null
  measuredVsTheoryAverageGapDb: number | null
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
    .map((comparison) => {
      const stats = measuredSampleStats[comparison.key]

      return (
        `| ${comparison.label} | ${formatDbm(comparison.rsrpDbm)} | ${formatOptionalDbm(
          comparison.measuredRsrpDbm,
        )} | N=${numberFormatter.format(stats.count)} | ${formatOptionalDb(
          comparison.residualDb,
        )} | ${describeResidual(
          comparison.residualDb,
        )} |`
      )
    })
    .join('\n')
  const theoryRows = theoryComparisons
    .map(
      (comparison) =>
        `| ${comparison.label} | ${formatDbm(comparison.rsrpDbm)} | ${formatOptionalDbm(
          comparison.measuredRsrpDbm,
        )} | ${formatOptionalDbm(comparison.theoryRsrpDbm)} | ${formatOptionalDb(
          comparison.measuredVsTheoryDb,
        )} | ${formatOptionalDb(comparison.estimatedVsTheoryDb)} |`,
    )
    .join('\n')
  const effectRows = fieldEffectRows
    .map(
      (row) =>
        `| ${row.label} | ${row.model} | ${row.measured} | ${row.theory} | ${row.delta} | ${row.memo} |`,
    )
    .join('\n')
  const fieldAidRows = fieldAidItems
    .map(
      (item) =>
        `| ${item.label} | ${item.value} | ${item.status} | ${item.memo} |`,
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
	    `- 観測N数: N=${numberFormatter.format(protocol.observationCount)}`,
	    `- N数メモ: ${getObservationCountGuidance(protocol.observationCount)}`,
	    `- 平均化時間: ${numberFormatter.format(protocol.averagingSeconds)} 秒`,
	    `- CSVサンプル数/点: ${numberFormatter.format(protocol.samplesPerPoint)}`,
	    `- 地面反射補正: ${formatDb(settings.groundReflectionDb)}`,
	    `- 屋外遮蔽損失: ${formatDb(settings.outdoorObstructionLossDb)}`,
	    `- 窓種別: ${windowLabel}`,
	    `- 実効窓損失: ${formatDb(getEffectiveWindowLossDb(settings))}`,
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
	    `- ナミゲート改善仮説: ${formatDb(totalNamigateGainDb)}`,
	    `- ナミゲート適用改善量: ${formatDb(calculateAppliedNamigateGainDb(settings))}`,
	    `- 法規制メモ: このコピー内容は技術検討用であり、EIRP、空中線電力、設置場所、周波数帯の法令適合を判定するものではありません。`,
    '',
    '## ナミゲート効果モデルの根拠',
    '- 現状は厳密な電磁界解析や測定校正済みモデルではなく、MVP仕様に基づく簡易リンクバジェットです。',
    '- プリセットの +3 / +10 / +25 dB は、保守的・標準・Low-E改善例を比較するための仮定値です。',
    '- 面積補正は 10cm x 10cm を基準に 10log10(面積倍率) で計算し、上限と係数で調整します。',
    '- ナミゲートの効果は、窓ありと窓なしの差をどれだけ埋めるかという回復量で評価します。',
    '',
    '## 推定値と実測値',
    '| 状態 | 推定RSRP | 実測RSRP（平均） | 手入力N | 差分 実測-推定 | 判定 |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    rows,
    '',
    '## 外部理論計算値との比較',
    '| 状態 | アプリ推定RSRP | 実測RSRP | 外部理論RSRP | 実測-理論 | 推定-理論 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    theoryRows,
    '',
    '## dB寄与分解',
    '| 項目 | アプリモデル | 実測 | 外部理論 | 実測-理論 | 読み方 |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    effectRows,
    '',
    '## 現地測定レビュー20項目',
    '| 項目 | 値 | 状態 | 確認ポイント |',
    '| --- | ---: | --- | --- |',
    fieldAidRows,
    '',
    '## 改善効果',
    `- 推定の窓なし-窓あり差: ${formatDb(estimatedWindowLossDb)}`,
    `- 実測の窓なし-窓あり差: ${formatOptionalDb(measuredWindowLossDb)}`,
    `- 推定のナミゲート改善量: ${formatDb(estimatedNamigateGainDb)}`,
    `- 実測のナミゲート改善量: ${formatOptionalDb(measuredNamigateGainDb)}`,
    `- 窓なし状態への推定回復率: ${numberFormatter.format(clamp(recoveryRate, 0, 100))}%`,
    `- 平均誤差 実測-推定: ${formatOptionalDb(measuredAverageResidualDb)}`,
    `- 平均差 実測-外部理論: ${formatOptionalDb(measuredVsTheoryAverageGapDb)}`,
    '',
    '## 解析観点',
    '- 3状態に共通するオフセットがあるか',
    '- 窓ありだけ誤差が大きい場合、窓損失または入射角損失をどう補正すべきか',
    '- ナミゲートありだけ誤差が大きい場合、改善量または面積補正をどう見直すべきか',
    '- 外部理論計算値との差が全状態で同方向か、窓閉鎖またはナミゲート時だけ大きいか',
    '- 角度別に再測定した場合、入射角損失とガラス由来損失を分離できるか',
    '- 観測N数と平均化時間が、フェージングや人流によるばらつきを十分ならしているか',
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

function MeasurementSampleInput({
  scenario,
  value,
  stats,
  observationCount,
  onChange,
}: {
  scenario: ScenarioDefinition
  value: string
  stats: RsrpSampleStats
  observationCount: number
  onChange: (value: string) => void
}) {
  const countStatus =
    stats.count === 0
      ? 'is-empty'
      : stats.count < observationCount
        ? 'is-warn'
        : 'is-ok'

  return (
    <label className="control measurement-input sample-input">
      <span className="label-with-help">
        実測RSRPサンプル（{scenario.label}）
        <HelpTip text="改行、スペース、カンマ区切りで複数のRSRPを入れられます。比較表では平均値を実測RSRPとして使います。" />
      </span>
      <textarea
        aria-label={`実測RSRPサンプル（${scenario.label}）`}
        className="sample-textarea"
        rows={5}
        value={value}
        placeholder={'例:\n-64.1\n-63.8\n-64.3'}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
      <div className="sample-stats">
        <span className={countStatus}>
          N={numberFormatter.format(stats.count)} / 推奨
          {numberFormatter.format(observationCount)}
        </span>
        <span>平均 {formatOptionalDbm(stats.meanDbm)}</span>
        <span>中央値 {formatOptionalDbm(stats.medianDbm)}</span>
        <span>σ {formatOptionalDb(stats.stddevDb)}</span>
        <span>
          範囲{' '}
          {stats.minDbm === null || stats.maxDbm === null
            ? '未入力'
            : `${formatDbm(stats.minDbm)} - ${formatDbm(stats.maxDbm)}`}
        </span>
      </div>
      <small>1値だけでも使用できます。N=30評価では30個程度を貼り付けます。</small>
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
    controls.autoRotate = false
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

    const addLeaderLine = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      color = 0x6f7f8d,
    ) => {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, end]),
        new THREE.LineBasicMaterial({
          color,
          depthTest: false,
          transparent: true,
          opacity: 0.74,
        }),
      )
      line.renderOrder = 12
      scene.add(line)
    }

    const drawRoundedRect = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => {
      context.beginPath()
      context.moveTo(x + radius, y)
      context.lineTo(x + width - radius, y)
      context.quadraticCurveTo(x + width, y, x + width, y + radius)
      context.lineTo(x + width, y + height - radius)
      context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
      context.lineTo(x + radius, y + height)
      context.quadraticCurveTo(x, y + height, x, y + height - radius)
      context.lineTo(x, y + radius)
      context.quadraticCurveTo(x, y, x + radius, y)
      context.closePath()
    }

    const makeLabel = (text: string, color = '#172330') => {
      const canvas = document.createElement('canvas')
      canvas.width = 768
      canvas.height = 192
      const context = canvas.getContext('2d')

      if (context) {
        context.shadowColor = 'rgba(16,24,32,0.18)'
        context.shadowBlur = 18
        context.shadowOffsetY = 6
        drawRoundedRect(context, 16, 34, 736, 124, 22)
        context.fillStyle = 'rgba(255,255,255,0.96)'
        context.fill()
        context.shadowColor = 'transparent'
        context.strokeStyle = color === '#172330' ? 'rgba(0,113,189,0.34)' : color
        context.lineWidth = 6
        context.stroke()
        context.fillStyle = color
        context.font = '800 58px system-ui, sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(text, 384, 96, 688)
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
      sprite.renderOrder = 20
      sprite.scale.set(Math.min(5.6, Math.max(2.6, text.length * 0.32)), 0.72, 1)
      return sprite
    }

    const leftLabelX = -roomWidthM / 2 + 0.88
    const rightLabelX = roomWidthM / 2 - 0.88
    const topLabelY = wallHeightM + 0.44
    const outdoorMidPoint = new THREE.Vector3(transmitterX / 2, 0.16, transmitterZ / 2)
    const indoorMidPoint = new THREE.Vector3(0, 0.16, receiverZ / 2)
    const windowTopPoint = new THREE.Vector3(0, windowBottomM + windowHeightM, -0.08)
    const namigatePoint = new THREE.Vector3(0, windowCenterY, -0.13)

    const labels = [
      {
        label: makeLabel('送信機'),
        position: new THREE.Vector3(leftLabelX, Math.min(topLabelY, transmitterHeightY + 1.3), transmitterZ),
        target: transmitterPoint,
      },
      {
        label: makeLabel(`送信高 ${formatMeters(settings.txAntennaHeightM)}`),
        position: new THREE.Vector3(leftLabelX, Math.max(1.35, transmitterHeightY * 0.58), transmitterZ + 0.55),
        target: new THREE.Vector3(transmitterX, transmitterHeightY / 2, transmitterZ),
      },
      {
        label: makeLabel(`屋外3D ${formatMeters(calculateOutdoorLinkDistanceM(settings))}`),
        position: new THREE.Vector3(leftLabelX, 0.86, transmitterZ / 2),
        target: outdoorMidPoint,
      },
      {
        label: makeLabel(`入射角 ${numberFormatter.format(safeAngle)}°`, '#c96c34'),
        position: new THREE.Vector3(-windowWidthM / 2 - 1.05, windowCenterY + 1.08, -0.76),
        target: windowPoint,
        color: 0xc96c34,
      },
      {
        label: makeLabel(`窓 ${numberFormatter.format(settings.windowWidthM)}×${numberFormatter.format(settings.windowHeightM)}m`, '#0071BD'),
        position: new THREE.Vector3(0, topLabelY, -0.18),
        target: windowTopPoint,
        color: 0x0071bd,
      },
      {
        label: makeLabel(`中心高 ${formatMeters(settings.windowCenterHeightM)}`, '#0071BD'),
        position: new THREE.Vector3(-windowWidthM / 2 - 1.12, windowCenterY - 0.55, -0.22),
        target: windowPoint,
        color: 0x0071bd,
      },
      {
        label: makeLabel(`ナミゲート ${numberFormatter.format(settings.namigateWidthCm)}×${numberFormatter.format(settings.namigateHeightCm)}cm`, '#0071BD'),
        position: new THREE.Vector3(windowWidthM / 2 + 1.24, windowCenterY + 0.34, -0.24),
        target: namigatePoint,
        color: 0x0071bd,
      },
      {
        label: makeLabel('受信機'),
        position: new THREE.Vector3(rightLabelX, Math.min(topLabelY, receiverPoint.y + 1.65), receiverZ + 0.1),
        target: receiverPoint,
      },
      {
        label: makeLabel(`受信高 ${formatMeters(settings.rxAntennaHeightM)}`),
        position: new THREE.Vector3(rightLabelX, Math.max(1.25, receiverPoint.y + 0.5), receiverZ + 0.78),
        target: new THREE.Vector3(receiverPoint.x, receiverPoint.y / 2, receiverPoint.z),
      },
      {
        label: makeLabel(`室内3D ${formatMeters(calculateIndoorLinkDistanceM(settings))}`),
        position: new THREE.Vector3(rightLabelX, 0.86, receiverZ / 2),
        target: indoorMidPoint,
      },
      {
        label: makeLabel(`部屋幅 ${numberFormatter.format(settings.roomWidthM)}m`),
        position: new THREE.Vector3(0, 0.72, roomWidthLineZ + 0.34),
        target: new THREE.Vector3(0, 0.12, roomWidthLineZ),
      },
      {
        label: makeLabel(`奥行 ${numberFormatter.format(settings.roomDepthM)}m`),
        position: new THREE.Vector3(roomDepthLineX + 0.82, 0.72, roomDepthM / 2),
        target: new THREE.Vector3(roomDepthLineX, 0.12, roomDepthM / 2),
      },
    ]

    labels.forEach(({ label, position, target, color }) => {
      label.position.copy(position)
      scene.add(label)
      addLeaderLine(position, target, color)
    })

    measurementPoints.slice(0, 24).forEach((point) => {
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
        <div className="position-3d-callout-panel" aria-label="3D寸法サマリー">
          <div>
            <span>屋外リンク</span>
            <strong>{formatMeters(calculateOutdoorLinkDistanceM(settings))}</strong>
            <small>
              水平 {formatMeters(settings.outdoorDistanceM)} / 送信高{' '}
              {formatMeters(settings.txAntennaHeightM)}
            </small>
          </div>
          <div>
            <span>入射角</span>
            <strong>{numberFormatter.format(settings.incidentAngleDeg)}°</strong>
            <small>角度損失 {formatDb(angleLossDb)}</small>
          </div>
          <div>
            <span>窓・ナミゲート</span>
            <strong>
              {numberFormatter.format(settings.windowWidthM)}×
              {numberFormatter.format(settings.windowHeightM)}m
            </strong>
            <small>
              NG {numberFormatter.format(settings.namigateWidthCm)}×
              {numberFormatter.format(settings.namigateHeightCm)}cm
            </small>
          </div>
          <div>
            <span>室内リンク</span>
            <strong>{formatMeters(calculateIndoorLinkDistanceM(settings))}</strong>
            <small>
              室内 {formatMeters(settings.indoorDistanceM)} / 受信高{' '}
              {formatMeters(settings.rxAntennaHeightM)}
            </small>
          </div>
        </div>
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
            {formatDb(getEffectiveWindowLossDb(settings))} / 入射角損失 {formatDb(angleLossDb)}
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
  const autoSaveDraft = useMemo(() => loadAutoSaveDraft(), [])
  const [appMode, setAppMode] = useState<AppMode>(() =>
    isAppMode(autoSaveDraft.appMode) ? autoSaveDraft.appMode : 'sales',
  )
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(autoSaveDraft.settings ?? {}),
  }))
  const [measuredRsrpValues, setMeasuredRsrpValues] =
    useState<MeasuredRsrpValues>(() =>
      mergeMeasuredRsrpValues(autoSaveDraft.measuredRsrpValues),
    )
  const [theoryRsrpValues, setTheoryRsrpValues] =
    useState<TheoryRsrpValues>(() =>
      mergeTheoryRsrpValues(autoSaveDraft.theoryRsrpValues),
    )
  const [measurementCsvText, setMeasurementCsvText] = useState(
    autoSaveDraft.measurementCsvText ?? SAMPLE_MEASUREMENT_CSV,
  )
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>(
    () => autoSaveDraft.measurementPoints ?? [],
  )
  const [importStatus, setImportStatus] = useState('')
  const [protocol, setProtocol] = useState<TestProtocol>(() =>
    mergeProtocolDraft(autoSaveDraft.protocol),
  )
  const [savedCases, setSavedCases] = useState<SavedTestCase[]>(loadSavedTestCases)
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [caseName, setCaseName] = useState(autoSaveDraft.caseName ?? '')
  const [activeInputStep, setActiveInputStep] = useState<InputStepId>(() =>
    isInputStepId(autoSaveDraft.activeInputStep)
      ? autoSaveDraft.activeInputStep
      : 'radio',
  )
  const [activeView, setActiveView] = useState<ActiveView>(() =>
    isActiveView(autoSaveDraft.activeView) ? autoSaveDraft.activeView : 'overview',
  )
  const [copyStatus, setCopyStatus] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState(
    autoSaveDraft.savedAt
      ? `自動保存から復元 ${formatAutoSaveTime(autoSaveDraft.savedAt)}`
      : '自動保存は有効です',
  )

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

  const updateTheoryRsrp = (key: ScenarioKey, value: string) => {
    setTheoryRsrpValues((current) => ({ ...current, [key]: value }))
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

  useEffect(() => {
    const savedAt = new Date().toISOString()
    const timeoutId = window.setTimeout(() => {
      const persisted = persistAutoSaveDraft({
        version: 1,
        savedAt,
        appMode,
        settings,
        measuredRsrpValues,
        theoryRsrpValues,
        measurementCsvText,
        measurementPoints,
        protocol,
        caseName,
        activeInputStep,
        activeView,
      })

      setAutoSaveStatus(
        persisted
          ? `自動保存済み ${formatAutoSaveTime(savedAt)}`
          : '自動保存できませんでした',
      )
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [
    appMode,
    activeInputStep,
    activeView,
    caseName,
    measuredRsrpValues,
    measurementCsvText,
    measurementPoints,
    protocol,
    settings,
    theoryRsrpValues,
  ])

  const selectedSavedCase = useMemo(
    () => savedCases.find((savedCase) => savedCase.id === selectedCaseId) ?? null,
    [savedCases, selectedCaseId],
  )

  const currentPatternStateSignature = useMemo(
    () =>
      currentPatternSignature({
        settings,
        measuredRsrpValues,
        theoryRsrpValues,
        measurementCsvText,
        measurementPoints,
        protocol,
      }),
    [
      measuredRsrpValues,
      measurementCsvText,
      measurementPoints,
      protocol,
      settings,
      theoryRsrpValues,
    ],
  )

  const hasUnsavedPatternChanges =
    selectedSavedCase === null
      ? false
      : currentPatternStateSignature !== savedCasePatternSignature(selectedSavedCase)

  const activeInputStepIndex = INPUT_STEPS.findIndex(
    (step) => step.id === activeInputStep,
  )
  const activeInputStepMeta =
    INPUT_STEPS[activeInputStepIndex] ?? INPUT_STEPS[0]

  const moveInputStep = (direction: -1 | 1) => {
    const nextIndex = clamp(
      activeInputStepIndex + direction,
      0,
      INPUT_STEPS.length - 1,
    )
    setActiveInputStep(INPUT_STEPS[nextIndex].id)
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

  const angleLossDb = useMemo(
    () => getEffectiveAngleLossDb(settings),
    [settings],
  )

  const effectiveWindowLossDb = useMemo(
    () => getEffectiveWindowLossDb(settings),
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

  const measuredSampleStats = useMemo<Record<ScenarioKey, RsrpSampleStats>>(
    () =>
      SCENARIOS.reduce(
        (accumulator, scenario) => ({
          ...accumulator,
          [scenario.key]: calculateRsrpSampleStats(
            measuredRsrpValues[scenario.key],
          ),
        }),
        {} as Record<ScenarioKey, RsrpSampleStats>,
      ),
    [measuredRsrpValues],
  )

  const measuredComparisons = useMemo<MeasuredComparison[]>(
    () =>
      scenarioResults.map((scenario) => {
        const measuredRsrpDbm = measuredSampleStats[scenario.key].meanDbm

        return {
          ...scenario,
          measuredRsrpDbm,
          residualDb:
            measuredRsrpDbm === null ? null : measuredRsrpDbm - scenario.rsrpDbm,
        }
      }),
    [measuredSampleStats, scenarioResults],
  )

  const theoryComparisons = useMemo<TheoryComparison[]>(
    () =>
      measuredComparisons.map((comparison) => {
        const theoryRsrpDbm = parseOptionalNumber(theoryRsrpValues[comparison.key])

        return {
          ...comparison,
          theoryRsrpDbm,
          measuredVsTheoryDb:
            comparison.measuredRsrpDbm === null || theoryRsrpDbm === null
              ? null
              : comparison.measuredRsrpDbm - theoryRsrpDbm,
          estimatedVsTheoryDb:
            theoryRsrpDbm === null ? null : comparison.rsrpDbm - theoryRsrpDbm,
        }
      }),
    [measuredComparisons, theoryRsrpValues],
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
  const appliedNamigateGainDb = calculateAppliedNamigateGainDb(settings)
  const powerMultiplier = Math.pow(10, appliedNamigateGainDb / 10)
  const fieldMultiplier = Math.pow(10, appliedNamigateGainDb / 20)
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
  const manualMeasuredSampleCount = Object.values(measuredSampleStats).reduce(
    (sum, stats) => sum + stats.count,
    0,
  )
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
  const theoryNoWindowRsrp = theoryComparisons[0].theoryRsrpDbm
  const theoryWithWindowRsrp = theoryComparisons[1].theoryRsrpDbm
  const theoryWithNamigateRsrp = theoryComparisons[2].theoryRsrpDbm
  const theoryWindowLossDb = subtractNullable(theoryNoWindowRsrp, theoryWithWindowRsrp)
  const theoryNamigateGainDb = subtractNullable(
    theoryWithNamigateRsrp,
    theoryWithWindowRsrp,
  )
  const measuredGlassOnlyLossDb =
    measuredWindowLossDb === null ? null : measuredWindowLossDb - angleLossDb
  const theoryGlassOnlyLossDb =
    theoryWindowLossDb === null ? null : theoryWindowLossDb - angleLossDb
  const measuredRecoveryRate = recoveryPercentNullable(
    measuredNamigateGainDb,
    measuredWindowLossDb,
  )
  const theoryRecoveryRate = recoveryPercentNullable(
    theoryNamigateGainDb,
    theoryWindowLossDb,
  )
  const measuredVsTheoryAverageGapDb = averageNullable(
    theoryComparisons.map((comparison) => comparison.measuredVsTheoryDb),
  )
  const fieldEffectRows = useMemo<EffectSummaryRow[]>(
    () => [
      {
        label: '窓を閉めた影響',
        model: formatDb(effectiveWindowLossDb + angleLossDb),
        measured: formatOptionalDb(measuredWindowLossDb),
        theory: formatOptionalDb(theoryWindowLossDb),
        delta: formatOptionalDb(subtractNullable(measuredWindowLossDb, theoryWindowLossDb)),
        memo: '窓開放相当から閉鎖状態へ落ちた量。窓材、入射角、施工条件を含みます。',
      },
      {
        label: '入射角の影響',
        model: formatDb(angleLossDb),
        measured: '角度別再測で分離',
        theory: '角度別計算で比較',
        delta: '-',
        memo: '同じ窓で角度を振ると、窓材由来の損失と角度由来の損失を分けやすくなります。',
      },
      {
        label: 'ガラス由来の損失推定',
        model: formatDb(effectiveWindowLossDb),
        measured: formatOptionalDb(measuredGlassOnlyLossDb),
        theory: formatOptionalDb(theoryGlassOnlyLossDb),
        delta: formatOptionalDb(
          subtractNullable(measuredGlassOnlyLossDb, theoryGlassOnlyLossDb),
        ),
        memo: '窓を閉めた影響から、現在モデルの入射角損失を差し引いた概算です。',
      },
      {
        label: 'ナミゲート実効改善',
        model: formatDb(estimatedNamigateGainDb),
        measured: formatOptionalDb(measuredNamigateGainDb),
        theory: formatOptionalDb(theoryNamigateGainDb),
        delta: formatOptionalDb(
          subtractNullable(measuredNamigateGainDb, theoryNamigateGainDb),
        ),
        memo: '閉鎖＋ナミゲートありが、閉鎖＋ナミゲートなしから何dB上がったかです。',
      },
      {
        label: '窓なしへの回復率',
        model: `${numberFormatter.format(clamp(recoveryRate, 0, 100))}%`,
        measured: formatOptionalPercent(measuredRecoveryRate),
        theory: formatOptionalPercent(theoryRecoveryRate),
        delta: formatOptionalPercent(
          subtractNullable(measuredRecoveryRate, theoryRecoveryRate),
        ),
        memo: '窓で落ちた分のうち、ナミゲートで何%戻せたかを示します。',
      },
    ],
    [
      angleLossDb,
      estimatedNamigateGainDb,
      measuredGlassOnlyLossDb,
      measuredNamigateGainDb,
      measuredRecoveryRate,
      measuredWindowLossDb,
      recoveryRate,
      effectiveWindowLossDb,
      theoryGlassOnlyLossDb,
      theoryNamigateGainDb,
      theoryRecoveryRate,
      theoryWindowLossDb,
    ],
  )

  const fieldAidItems = useMemo(
    () =>
      buildFieldAidItems({
        settings,
        protocol,
        measuredComparisons,
        theoryComparisons,
        pointComparisons,
        pointErrorStats,
        qualityStats,
        measuredAverageResidualDb,
        measuredVsTheoryAverageGapDb,
        measuredWindowLossDb,
        measuredGlassOnlyLossDb,
        angleLossDb,
        measuredNamigateGainDb,
        measuredNamigateGapDb,
        measuredRecoveryRate,
      }),
    [
      angleLossDb,
      measuredAverageResidualDb,
      measuredComparisons,
      measuredGlassOnlyLossDb,
      measuredNamigateGainDb,
      measuredNamigateGapDb,
      measuredRecoveryRate,
      measuredVsTheoryAverageGapDb,
      measuredWindowLossDb,
      pointComparisons,
      pointErrorStats,
      protocol,
      qualityStats,
      settings,
      theoryComparisons,
    ],
  )

  const aiAnalysisText = useMemo(
    () =>
      buildAiAnalysisText({
        settings,
        protocol,
        scenarioResults,
        measuredComparisons,
        measuredSampleStats,
        theoryComparisons,
        fieldEffectRows,
        fieldAidItems,
        angleLossDb,
        areaGainDb,
        totalNamigateGainDb,
        recoveryRate,
        measuredAverageResidualDb,
        measuredVsTheoryAverageGapDb,
        measuredWindowLossDb,
        measuredNamigateGainDb,
      }),
    [
      settings,
      protocol,
      scenarioResults,
      measuredComparisons,
      measuredSampleStats,
      theoryComparisons,
      fieldEffectRows,
      fieldAidItems,
      angleLossDb,
      areaGainDb,
      totalNamigateGainDb,
      recoveryRate,
      measuredAverageResidualDb,
      measuredVsTheoryAverageGapDb,
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
        const gapDb = effectiveWindowLossDb + lossDb
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
    [effectiveWindowLossDb, settings],
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
        settings: {
          ...settings,
          windowPresetId: 'custom',
          windowLossDb: effectiveWindowLossDb + 5,
        },
      },
      {
        label: '窓損失 -5dB',
        settings: {
          ...settings,
          windowPresetId: 'custom',
          windowLossDb: Math.max(effectiveWindowLossDb - 5, 0),
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
  }, [effectiveWindowLossDb, scenarioResults, settings])

  const confidenceRows = useMemo(() => {
    const cases: Array<{ label: string; settings: Settings }> = [
      {
        label: '保守',
        settings: {
          ...settings,
          windowPresetId: 'custom',
          windowLossDb: effectiveWindowLossDb + 5,
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
          windowPresetId: 'custom',
          windowLossDb: Math.max(effectiveWindowLossDb - 3, 0),
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
  }, [effectiveWindowLossDb, settings])

  const experimentReportText = useMemo(
    () =>
      buildExperimentReport({
        settings,
        protocol,
        scenarioResults,
        theoryComparisons,
        fieldEffectRows,
        fieldAidItems,
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
      fieldEffectRows,
      fieldAidItems,
      pointComparisons,
      pointErrorStats,
      protocol,
      qualityStats,
      scenarioResults,
      sensitivityRows,
      settings,
      theoryComparisons,
    ],
  )

  const salesComment = useMemo(
    () =>
      buildSalesComment({
        noWindowRsrp,
        withWindowRsrp,
        withNamigateRsrp,
        recoveryRate,
        thresholdDbm: settings.connectionThresholdDbm,
      }),
    [
      noWindowRsrp,
      recoveryRate,
      settings.connectionThresholdDbm,
      withNamigateRsrp,
      withWindowRsrp,
    ],
  )

  const printReportHtml = useMemo(
    () =>
      buildPrintReportHtml({
        settings,
        protocol,
        scenarioResults,
        fieldEffectRows,
        fieldAidItems,
        effectiveWindowLossDb,
        angleLossDb,
        totalNamigateGainDb,
        appliedNamigateGainDb,
        recoveryRate,
        effectiveEirpDbm,
        detailedEirpDbm,
        receiverAdjustmentDb,
        currentOutdoorPathLossDb,
        currentIndoorLossDb,
        salesComment,
      }),
    [
      angleLossDb,
      appliedNamigateGainDb,
      currentIndoorLossDb,
      currentOutdoorPathLossDb,
      detailedEirpDbm,
      effectiveEirpDbm,
      effectiveWindowLossDb,
      fieldAidItems,
      fieldEffectRows,
      protocol,
      receiverAdjustmentDb,
      recoveryRate,
      salesComment,
      scenarioResults,
      settings,
      totalNamigateGainDb,
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

  const handlePrintPdfReport = () => {
    const reportWindow = window.open('', '_blank')

    if (!reportWindow) {
      setCopyStatus('レポート画面を開けませんでした。ポップアップ許可を確認してください')
      return
    }

    reportWindow.document.open()
    reportWindow.document.write(printReportHtml)
    reportWindow.document.close()
    reportWindow.focus()
    setCopyStatus('PDFレポート画面を開きました')
  }

  const buildCurrentSavedCase = (id: string, name: string): SavedTestCase => ({
    id,
    name,
    savedAt: new Date().toISOString(),
    settings,
    measuredRsrpValues,
    theoryRsrpValues,
    measurementCsvText,
    measurementPoints,
    protocol,
  })

  const applySavedCase = (savedCase: SavedTestCase) => {
    setSettings({ ...DEFAULT_SETTINGS, ...savedCase.settings })
    setMeasuredRsrpValues(mergeMeasuredRsrpValues(savedCase.measuredRsrpValues))
    setTheoryRsrpValues(mergeTheoryRsrpValues(savedCase.theoryRsrpValues))
    setMeasurementCsvText(
      savedCase.measurementCsvText ??
        (savedCase.measurementPoints?.length
          ? buildMeasurementCsv(savedCase.measurementPoints)
          : SAMPLE_MEASUREMENT_CSV),
    )
    setMeasurementPoints(savedCase.measurementPoints ?? [])
    setProtocol(mergeProtocolDraft(savedCase.protocol))
    setSelectedCaseId(savedCase.id)
    setCaseName(savedCase.name)
  }

  const handleSaveCase = () => {
    const name =
      caseName.trim() ||
      protocol.siteName.trim() ||
      `入力パターン ${new Date().toLocaleString('ja-JP')}`
    const existingCase =
      selectedSavedCase ?? savedCases.find((item) => item.name === name) ?? null
    const uniqueName = createUniquePatternName(
      name,
      savedCases,
      existingCase?.id,
    )
    const savedCase = buildCurrentSavedCase(
      existingCase?.id ?? `${Date.now()}`,
      uniqueName,
    )
    const nextCases = [
      savedCase,
      ...savedCases.filter((item) => item.id !== savedCase.id),
    ].slice(0, 12)

    setSavedCases(nextCases)
    persistSavedTestCases(nextCases)
    setSelectedCaseId(savedCase.id)
    setCaseName(uniqueName)
    setCopyStatus(
      existingCase
        ? '入力パターンを更新しました'
        : '入力パターンを保存しました',
    )
  }

  const handleSaveAsNewCase = () => {
    const baseName =
      caseName.trim() ||
      protocol.siteName.trim() ||
      `入力パターン ${new Date().toLocaleString('ja-JP')}`
    const duplicatedName = createUniquePatternName(baseName, savedCases)
    const savedCase = buildCurrentSavedCase(`${Date.now()}`, duplicatedName)
    const nextCases = [savedCase, ...savedCases].slice(0, 12)

    setSavedCases(nextCases)
    persistSavedTestCases(nextCases)
    setSelectedCaseId(savedCase.id)
    setCaseName(duplicatedName)
    setCopyStatus('別パターンとして保存しました')
  }

  const handleCaseSelectionChange = (caseId: string) => {
    if (!caseId) {
      setSelectedCaseId('')
      setCopyStatus('パターン選択を解除しました')
      return
    }

    const savedCase = savedCases.find((item) => item.id === caseId)

    if (!savedCase) {
      setCopyStatus('読み込む入力パターンが見つかりません')
      return
    }

    applySavedCase(savedCase)
    setCopyStatus('入力パターンを切り替えました')
  }

  const handleLoadCase = () => {
    const savedCase = savedCases.find((item) => item.id === selectedCaseId)

    if (!savedCase) {
      setCopyStatus('読み込む入力パターンを選択してください')
      return
    }

    applySavedCase(savedCase)
    setCopyStatus('入力パターンを再適用しました')
  }

  const handleDeleteCase = () => {
    if (!selectedCaseId) {
      setCopyStatus('削除する入力パターンを選択してください')
      return
    }

    const nextCases = savedCases.filter((item) => item.id !== selectedCaseId)
    setSavedCases(nextCases)
    persistSavedTestCases(nextCases)
    setSelectedCaseId('')
    setCopyStatus('入力パターンを削除しました')
  }

  const renderPatternManager = (variant: 'compact' | 'full') => (
    <section
      aria-label={variant === 'compact' ? '入力パターン管理' : '入力パターン管理 詳細'}
      className={`pattern-switcher pattern-switcher-${variant}`}
    >
      <div className="subsection-heading pattern-heading">
        <h3>入力パターン管理</h3>
        <span>入力・実測・CSV・プロトコルを一括切替</span>
      </div>
      <p className="pattern-note">
        保存済みパターンを選ぶと、無線条件、窓/室内条件、ナミゲート条件、手入力実測サンプル、外部理論値、CSV実測点、測定プロトコルをまとめて反映します。
      </p>
      <div className="case-controls pattern-controls">
        <label className="control">
          <span>パターン名</span>
          <input
            value={caseName}
            onChange={(event) => setCaseName(event.target.value)}
            placeholder="Low-E窓 ナミゲート20cm 室内8m"
          />
        </label>
        <label className="control">
          <span>保存済みパターン</span>
          <select
            value={selectedCaseId}
            onChange={(event) => handleCaseSelectionChange(event.target.value)}
          >
            <option value="">未選択</option>
            {savedCases.map((savedCase) => (
              <option key={savedCase.id} value={savedCase.id}>
                {savedCase.name} / {formatAutoSaveTime(savedCase.savedAt)}
              </option>
            ))}
          </select>
        </label>
        <div className="pattern-actions">
          <button type="button" onClick={handleSaveCase}>
            {selectedSavedCase ? '選択中を更新' : '新規保存'}
          </button>
          <button type="button" onClick={handleSaveAsNewCase}>
            別パターンとして保存
          </button>
          <button
            disabled={!selectedCaseId}
            type="button"
            onClick={handleLoadCase}
          >
            再適用
          </button>
          <button
            className="secondary-button"
            disabled={!selectedCaseId}
            type="button"
            onClick={handleDeleteCase}
          >
            削除
          </button>
        </div>
      </div>
      <div className="pattern-status-grid">
        <span>
          保存済み <strong>{numberFormatter.format(savedCases.length)}/12</strong>
        </span>
        <span>
          適用中 <strong>{selectedSavedCase?.name ?? '未選択'}</strong>
        </span>
        <span className={hasUnsavedPatternChanges ? 'is-warn' : 'is-ok'}>
          {selectedSavedCase
            ? hasUnsavedPatternChanges
              ? '未保存変更あり'
              : '保存内容と一致'
            : '新規入力中'}
        </span>
        <span>
          手入力実測 <strong>N={numberFormatter.format(manualMeasuredSampleCount)}</strong>
        </span>
        <span>
          CSV実測点 <strong>{numberFormatter.format(measurementPoints.length)}点</strong>
        </span>
      </div>
      {copyStatus ? <span className="pattern-message">{copyStatus}</span> : null}
    </section>
  )

  return (
    <main
      className={`app-shell ${
        appMode === 'sales' ? 'is-sales-mode' : 'is-technical-mode'
      }`}
    >
      <header className="app-header">
        <div>
          <p className="eyebrow">Local 5G Window Link MVP</p>
          <h1>ローカル5G 窓面電波改善シミュレータ</h1>
        </div>
        <div className="header-actions">
          <div className="mode-switch" role="group" aria-label="表示モード切り替え">
            {DISPLAY_MODES.map((mode) => (
              <button
                aria-pressed={appMode === mode.id}
                className={appMode === mode.id ? 'is-active' : ''}
                key={mode.id}
                type="button"
                onClick={() => setAppMode(mode.id)}
              >
                <strong>{mode.label}</strong>
                <span>{mode.description}</span>
              </button>
            ))}
          </div>
          <div className="header-summary">
            <span>基準しきい値</span>
            <strong>{formatDbm(settings.connectionThresholdDbm)}</strong>
          </div>
        </div>
      </header>

      <section className="top-disclaimer" aria-label="免責・利用範囲">
        <strong>
          {appMode === 'sales' ? '実測前の仮説整理ツール' : '免責・利用範囲'}
        </strong>
        <p>{appMode === 'sales' ? DISCLAIMER_SHORT : DISCLAIMER_FULL}</p>
      </section>

      <section className="layout-grid">
        <aside className="control-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">
                {appMode === 'sales' ? '商談用クイック入力' : '迷わない入力順'}
              </p>
              <h2>入力条件</h2>
            </div>
            <span className="step-count">
              {appMode === 'sales'
                ? '簡易'
                : `${activeInputStepIndex + 1}/${INPUT_STEPS.length}`}
            </span>
          </div>

          <nav className="input-step-tabs" role="tablist" aria-label="入力ステップ">
            {INPUT_STEPS.map((step, index) => (
              <button
                aria-selected={activeInputStep === step.id}
                className={activeInputStep === step.id ? 'is-active' : ''}
                key={step.id}
                role="tab"
                type="button"
                onClick={() => setActiveInputStep(step.id)}
              >
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <small>{step.description}</small>
              </button>
            ))}
          </nav>

          <section className="input-step-overview" aria-label="現在の入力ステップ">
            <span>今やること</span>
            <strong>{activeInputStepMeta.objective}</strong>
          </section>

          <section className="autosave-strip" aria-label="入力内容の自動保存">
            <strong>{autoSaveStatus}</strong>
            <span>このブラウザに作業中の入力内容を自動保存します</span>
          </section>

          <section className="sales-control-panel" aria-label="営業用簡易入力">
            <div className="sales-mode-note">
              <strong>まずは8項目だけで概算</strong>
              <span>
                詳細条件は現在値を使います。必要になったら技術詳細モードでEIRP、アンテナ利得、実測比較まで確認できます。
              </span>
            </div>
            <div className="sales-control-grid">
              <NumberInput
                label="周波数"
                value={settings.frequencyMHz}
                min={1}
                step={10}
                unit="MHz"
                onChange={(value) => updateSetting('frequencyMHz', value)}
              />
              <NumberInput
                label="屋外距離"
                value={settings.outdoorDistanceM}
                min={1}
                step={1}
                unit="m"
                help="屋外基地局・送信アンテナから窓面までの水平距離です。展示会デモでは100m、実地検討では図面または地図で確認した距離を入れます。"
                onChange={(value) => updateSetting('outdoorDistanceM', value)}
              />
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
                label="入射角"
                value={settings.incidentAngleDeg}
                min={15}
                max={90}
                step={1}
                unit="°"
                onChange={(value) => updateSetting('incidentAngleDeg', value)}
              />
              <NumberInput
                label="室内距離"
                value={settings.indoorDistanceM}
                min={1}
                step={0.5}
                unit="m"
                onChange={(value) => updateSetting('indoorDistanceM', value)}
              />
              <label className="checklist-item sales-toggle">
                <input
                  checked={settings.namigateGainDb > 0}
                  type="checkbox"
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSettings((current) => ({
                        ...current,
                        namigatePresetId: 'standard',
                        namigateGainDb:
                          current.namigateGainDb > 0 ? current.namigateGainDb : 10,
                      }))
                    } else {
                      setSettings((current) => ({
                        ...current,
                        namigatePresetId: 'custom',
                        namigateGainDb: 0,
                      }))
                    }
                  }}
                />
                <span>
                  ナミゲート有無
                  <HelpTip text="オフにするとナミゲート改善量を0dBとして、窓あり状態との差が見やすくなります。" />
                </span>
              </label>
              <NumberInput
                label="ナミゲート改善量"
                value={settings.namigateGainDb}
                min={0}
                step={1}
                unit="dB"
                onChange={(value) => {
                  updateSetting('namigatePresetId', 'custom')
                  updateSetting('namigateGainDb', value)
                }}
              />
              <NumberInput
                label="測定高さ"
                value={protocol.measurementHeightM}
                min={0.2}
                step={0.1}
                unit="m"
                onChange={(value) => {
                  updateProtocol('measurementHeightM', value)
                  updateSetting('rxAntennaHeightM', value)
                }}
              />
            </div>
            <div className="sales-mode-note is-light">
              <strong>営業説明の読み方</strong>
              <span>
                窓なし、窓あり、窓あり＋ナミゲートの差を見て、窓で落ちた分をどれだけ戻せるかを説明します。
              </span>
            </div>
          </section>

          {renderPatternManager('compact')}

          <details
            className={`control-group input-step-panel ${
              activeInputStep === 'radio' ? 'is-active' : 'is-hidden'
            }`}
            open
          >
            <summary>
              <span>1. 無線・屋外</span>
              <HelpTip text="送信機から窓面へ届くまでの条件です。まずは周波数、EIRP、屋外距離を確認します。" />
            </summary>
            <p className="control-group-note">
              送信側の強さ、アンテナ高、屋外距離を決めます。EIRPが分かる場合は直接入力、無線機構成が分かる場合は詳細計算を使います。
            </p>
            <div className="research-note">
              <strong>研究・実務メモ</strong>
              {STEP_INSIGHTS.radio.map((text) => (
                <span key={text}>{text}</span>
              ))}
            </div>
            <ParameterGuidance stepId="radio" />
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

          <details
            className={`control-group input-step-panel ${
              activeInputStep === 'windowRoom' ? 'is-active' : 'is-hidden'
            }`}
            open
          >
            <summary>
              <span>2. 窓・室内</span>
              <HelpTip text="窓ガラスで失われる量と、電波が窓に入る角度を設定します。Low-Eでは損失が大きくなりやすいです。" />
            </summary>
            <p className="control-group-note">
              窓あり状態の悪化量を決める中心条件です。窓中心高は送信/受信アンテナ高との差から3D距離を出すために使います。
            </p>
            <div className="research-note">
              <strong>研究・実務メモ</strong>
              {STEP_INSIGHTS.windowRoom.map((text) => (
                <span key={text}>{text}</span>
              ))}
            </div>
            <ParameterGuidance stepId="windowRoom" />
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

          <details
            className={`control-group input-step-panel ${
              activeInputStep === 'windowRoom' ? 'is-active' : 'is-hidden'
            }`}
            open
          >
            <summary>
              <span>2-2. 室内条件</span>
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

          <details
            className={`control-group input-step-panel ${
              activeInputStep === 'namigate' ? 'is-active' : 'is-hidden'
            }`}
            open
          >
            <summary>
              <span>3. ナミゲート</span>
              <HelpTip text="窓あり状態からどれだけ回復できるかを仮定します。実測後は校正候補を反映できます。" />
            </summary>
            <p className="control-group-note">
              ナミゲートの効果は「窓なしとの差をどれだけ埋めたか」で見ます。面積、設置効率、追加損失で現場条件を調整します。
            </p>
            <div className="research-note">
              <strong>研究・実務メモ</strong>
              {STEP_INSIGHTS.namigate.map((text) => (
                <span key={text}>{text}</span>
              ))}
            </div>
            <ParameterGuidance stepId="namigate" />
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

          <details
            className={`control-group input-step-panel ${
              activeInputStep === 'measurement' ? 'is-active' : 'is-hidden'
            }`}
            open
          >
            <summary>
              <span>4. 実測・保存</span>
              <HelpTip text="実測値と測定条件を同じ場所で記録します。CSVの詳細比較は右側の実測データタブで確認できます。" />
            </summary>
            <p className="control-group-note">
              机上値だけで判断せず、同じ測定点で3状態をそろえて入力します。入力パターン保存を使うと条件比較がしやすくなります。
            </p>
            <div className="research-note">
              <strong>研究・実務メモ</strong>
              {STEP_INSIGHTS.measurement.map((text) => (
                <span key={text}>{text}</span>
              ))}
            </div>
            <ParameterGuidance stepId="measurement" />
            <div className="measurement-input-grid sample-input-grid">
              {SCENARIOS.map((scenario) => (
                <MeasurementSampleInput
                  key={scenario.key}
                  scenario={scenario}
                  value={measuredRsrpValues[scenario.key]}
                  stats={measuredSampleStats[scenario.key]}
                  observationCount={protocol.observationCount}
                  onChange={(value) => updateMeasuredRsrp(scenario.key, value)}
                />
              ))}
            </div>
            <div className="model-note theory-note">
              <strong>外部理論計算値</strong>
              <span>
                別途計算した理論RSRPを入力すると、実測値との差分とdB寄与分解を右側の実測データタブで比較できます。
                社名・顧客名などの固有名は入れず、計算条件だけを残してください。
              </span>
            </div>
            <div className="protocol-mini-grid">
              {SCENARIOS.map((scenario) => (
                <label className="control measurement-input" key={scenario.key}>
                  <span>理論RSRP（{scenario.label}）</span>
                  <div className="input-row">
                    <input
                      type="number"
                      value={theoryRsrpValues[scenario.key]}
                      step={0.1}
                      placeholder="-80"
                      onChange={(event) =>
                        updateTheoryRsrp(scenario.key, event.target.value)
                      }
                    />
                    <small>dBm</small>
                  </div>
                </label>
              ))}
            </div>
            <div className="model-note sample-note">
              <strong>観測N数の考え方</strong>
              <span>{getObservationCountGuidance(protocol.observationCount)}</span>
            </div>
            <div className="protocol-mini-grid">
              <NumberInput
                label="測定高さ"
                value={protocol.measurementHeightM}
                min={0.2}
                step={0.1}
                unit="m"
                onChange={(value) => updateProtocol('measurementHeightM', value)}
              />
              <NumberInput
                label="観測N数"
                value={protocol.observationCount}
                min={1}
                step={1}
                onChange={(value) => updateProtocol('observationCount', value)}
                help={HELP_TEXT['観測N数']}
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
            </div>
            <label className="control">
              <span>パターン名</span>
              <input
                value={caseName}
                onChange={(event) => setCaseName(event.target.value)}
                placeholder="Low-E窓 ナミゲート20cm 室内8m"
              />
            </label>
            <div className="action-row">
              <button type="button" onClick={handleSaveCase}>
                入力パターンを保存
              </button>
              <button type="button" onClick={() => setActiveView('measurement')}>
                実測タブを開く
              </button>
              <button type="button" onClick={() => setActiveView('analysis')}>
                校正タブを開く
              </button>
              {copyStatus ? <span>{copyStatus}</span> : null}
            </div>
          </details>

          <section
            className={`control-group input-step-panel review-panel ${
              activeInputStep === 'review' ? 'is-active' : 'is-hidden'
            }`}
          >
            <div className="review-heading">
              <span>5. 確認</span>
              <strong>入力後は、この順番で結果を確認します</strong>
            </div>
            <div className="research-note">
              <strong>UI設計メモ</strong>
              {STEP_INSIGHTS.review.map((text) => (
                <span key={text}>{text}</span>
              ))}
            </div>
            <ParameterGuidance stepId="review" />
            <div className="review-action-grid">
              <button type="button" onClick={() => setActiveView('overview')}>
                概要を見る
              </button>
              <button type="button" onClick={() => setActiveView('visualization')}>
                位置・分布を見る
              </button>
              <button type="button" onClick={() => setActiveView('charts')}>
                グラフを見る
              </button>
              <button type="button" onClick={() => setActiveView('evidence')}>
                根拠を見る
              </button>
            </div>
            <div className="mini-result-grid">
              <article>
                <span>回復率</span>
                <strong>{numberFormatter.format(clamp(recoveryRate, 0, 100))}%</strong>
              </article>
              <article>
                <span>改善量</span>
                <strong>{formatDb(totalNamigateGainDb)}</strong>
              </article>
              <article>
                <span>到達距離</span>
                <strong>{formatMeters(scenarioResults[2].maxReachM)}</strong>
              </article>
            </div>
          </section>

          <div className="input-step-footer">
            <button
              disabled={activeInputStepIndex === 0}
              type="button"
              onClick={() => moveInputStep(-1)}
            >
              前へ
            </button>
            <button
              disabled={activeInputStepIndex === INPUT_STEPS.length - 1}
              type="button"
              onClick={() => moveInputStep(1)}
            >
              次へ
            </button>
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

          <section className="sales-results-section" aria-label="営業用結果サマリー">
            <div className="sales-result-header">
              <div>
                <p className="panel-kicker">商談用サマリー</p>
                <h2>ナミゲートによる回復効果</h2>
              </div>
              <button type="button" onClick={handlePrintPdfReport}>
                PDFレポート出力
              </button>
            </div>
            <div className="sales-kpi-grid">
              <article>
                <span>改善量</span>
                <strong>{formatDb(estimatedNamigateGainDb)}</strong>
                <small>窓あり比</small>
              </article>
              <article>
                <span>窓損失の回復率</span>
                <strong>{numberFormatter.format(clamp(recoveryRate, 0, 100))}%</strong>
                <small>{formatDb(recoveredGapDb)} 回復</small>
              </article>
              <article>
                <span>接続可能性</span>
                <strong>
                  {getConnectionLabel(
                    scenarioResults[2].rsrpDbm,
                    settings.connectionThresholdDbm,
                  )}
                </strong>
                <small>しきい値 {formatDbm(settings.connectionThresholdDbm)}</small>
              </article>
              <article>
                <span>接続可能面積</span>
                <strong>{formatArea(scenarioResults[2].connectedAreaM2)}</strong>
                <small>部屋面積 {formatArea(roomAreaM2)}</small>
              </article>
            </div>
            <div className="sales-comment-card">
              <span>営業説明用コメント</span>
              <p>{salesComment}</p>
            </div>
            <div className="sales-detail-list" aria-label="簡易モードの主要条件">
              <span>窓損失 {formatDb(effectiveWindowLossDb)}</span>
              <span>入射角損失 {formatDb(angleLossDb)}</span>
              <span>ナミゲート適用改善 {formatDb(appliedNamigateGainDb)}</span>
              <span>最大到達距離 {formatMeters(scenarioResults[2].maxReachM)}</span>
            </div>
            <p className="result-disclaimer">{DISCLAIMER_SHORT}</p>
            {copyStatus ? <span className="report-status">{copyStatus}</span> : null}
          </section>

          <section className="technical-report-toolbar" aria-label="レポート出力">
            <div>
              <strong>PDFレポート</strong>
              <span>入力条件、3状態比較、主要KPI、免責文を印刷用レポートにまとめます。</span>
              <p>{DISCLAIMER_FULL}</p>
            </div>
            <button type="button" onClick={handlePrintPdfReport}>
              PDFレポート出力
            </button>
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
                    実効窓損失
                    <HelpTip text={HELP_TEXT['窓損失']} />
                  </span>
                  <strong>{formatDb(effectiveWindowLossDb)}</strong>
                  <small>入射角損失 {formatDb(angleLossDb)}</small>
                </article>
                <article className="metric-card" data-metric="ナミゲート総改善量">
                  <span className="label-with-help">
                    ナミゲート適用改善量
                    <HelpTip text="改善仮説を、窓なしとの差を埋める範囲に上限処理した、RSRP計算へ実際に適用する改善量です。" />
                  </span>
                  <strong>{formatDb(appliedNamigateGainDb)}</strong>
                  <small>
                    改善仮説 {formatDb(totalNamigateGainDb)} / 面積{' '}
                    {formatDb(areaGainDb)}
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
                  <MeasurementSampleInput
                    key={scenario.key}
                    scenario={scenario}
                    value={measuredRsrpValues[scenario.key]}
                    stats={measuredSampleStats[scenario.key]}
                    observationCount={protocol.observationCount}
                    onChange={(value) => updateMeasuredRsrp(scenario.key, value)}
                  />
                ))}
              </div>

              <div className="theory-input-panel">
                <div className="subsection-heading">
                  <h3>外部理論計算値</h3>
                  <span>実測値と同じ3状態のRSRPを入力</span>
                </div>
                <p>
                  窓開放相当、窓閉鎖、窓閉鎖＋ナミゲートの理論RSRPを入れると、
                  実測値との差と、窓・入射角・ナミゲートの寄与をdBで比較できます。
                </p>
                <div className="measurement-input-grid">
                  {SCENARIOS.map((scenario) => (
                    <label className="control measurement-input" key={scenario.key}>
                      <span>理論RSRP（{scenario.label}）</span>
                      <div className="input-row">
                        <input
                          type="number"
                          value={theoryRsrpValues[scenario.key]}
                          step={0.1}
                          placeholder="-80"
                          onChange={(event) =>
                            updateTheoryRsrp(scenario.key, event.target.value)
                          }
                        />
                        <small>dBm</small>
                      </div>
                    </label>
                  ))}
                </div>
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

              <div
                className="measurement-table theory-table"
                role="table"
                aria-label="外部理論計算値との比較"
              >
                <div className="measurement-row theory-row is-head" role="row">
                  <span role="columnheader">状態</span>
                  <span role="columnheader">実測</span>
                  <span role="columnheader">外部理論</span>
                  <span role="columnheader">実測-理論</span>
                  <span role="columnheader">推定-理論</span>
                </div>
                {theoryComparisons.map((comparison) => (
                  <div className="measurement-row theory-row" key={comparison.key} role="row">
                    <span data-label="状態" role="cell">
                      {comparison.label}
                    </span>
                    <strong data-label="実測" role="cell">
                      {formatOptionalDbm(comparison.measuredRsrpDbm)}
                    </strong>
                    <strong data-label="外部理論" role="cell">
                      {formatOptionalDbm(comparison.theoryRsrpDbm)}
                    </strong>
                    <strong
                      className={
                        comparison.measuredVsTheoryDb === null
                          ? 'is-muted'
                          : comparison.measuredVsTheoryDb >= 0
                            ? 'is-positive'
                            : 'is-negative'
                      }
                      data-label="実測-理論"
                      role="cell"
                    >
                      {formatOptionalDb(comparison.measuredVsTheoryDb)}
                    </strong>
                    <span data-label="推定-理論" role="cell">
                      {formatOptionalDb(comparison.estimatedVsTheoryDb)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="measurement-summary">
                <article>
                  <span>観測N数</span>
                  <strong>N={numberFormatter.format(protocol.observationCount)}</strong>
                  <small>{getObservationCountGuidance(protocol.observationCount)}</small>
                </article>
                <article>
                  <span>手入力サンプル</span>
                  <strong>N={numberFormatter.format(manualMeasuredSampleCount)}</strong>
                  <small>各状態の平均RSRPを比較に使用</small>
                </article>
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
                <article>
                  <span>実測-理論 平均差</span>
                  <strong>{formatOptionalDb(measuredVsTheoryAverageGapDb)}</strong>
                  <small>3状態の入力済み理論値との差</small>
                </article>
                <article>
                  <span>実測回復率</span>
                  <strong>{formatOptionalPercent(measuredRecoveryRate)}</strong>
                  <small>窓で落ちた分を何%戻したか</small>
                </article>
              </div>

              <div className="field-effect-panel">
                <div className="subsection-heading">
                  <h3>実地調査で見積もれるdB寄与</h3>
                  <span>窓開放・窓閉鎖・ナミゲート有無を分解</span>
                </div>
                <div className="effect-table" role="table" aria-label="dB寄与分解">
                  <div className="effect-row is-head" role="row">
                    <span role="columnheader">項目</span>
                    <span role="columnheader">アプリモデル</span>
                    <span role="columnheader">実測</span>
                    <span role="columnheader">外部理論</span>
                    <span role="columnheader">実測-理論</span>
                    <span role="columnheader">読み方</span>
                  </div>
                  {fieldEffectRows.map((row) => (
                    <div className="effect-row" key={row.label} role="row">
                      <strong data-label="項目" role="cell">
                        {row.label}
                      </strong>
                      <span data-label="アプリモデル" role="cell">
                        {row.model}
                      </span>
                      <span data-label="実測" role="cell">
                        {row.measured}
                      </span>
                      <span data-label="外部理論" role="cell">
                        {row.theory}
                      </span>
                      <span data-label="実測-理論" role="cell">
                        {row.delta}
                      </span>
                      <small data-label="読み方" role="cell">
                        {row.memo}
                      </small>
                    </div>
                  ))}
                </div>
              </div>

              <FieldAidPanel items={fieldAidItems} />

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
                <article>
                  <span>実測-理論 平均差</span>
                  <strong>{formatOptionalDb(measuredVsTheoryAverageGapDb)}</strong>
                  <small>3状態の外部理論RSRPと比較</small>
                </article>
                <article>
                  <span>実測回復率</span>
                  <strong>{formatOptionalPercent(measuredRecoveryRate)}</strong>
                  <small>窓損失を何%戻したか</small>
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

              <FieldAidPanel items={fieldAidItems} />

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
                    label="観測N数"
                    value={protocol.observationCount}
                    min={1}
                    step={1}
                    onChange={(value) => updateProtocol('observationCount', value)}
                    help={HELP_TEXT['観測N数']}
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
                <div className="model-note sample-note">
                  <strong>N数メモ</strong>
                  <span>{getObservationCountGuidance(protocol.observationCount)}</span>
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

              {renderPatternManager('full')}
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

          {activeView === 'evidence' ? (
            <section className="evidence-section">
              <div className="section-heading">
                <h2>モデルとUI設計の根拠</h2>
                <span className="label-with-help">
                  簡易シミュレータとしての前提
                  <HelpTip text="この画面で使っている標準モデル、測定上の注意、UI設計原則をまとめています。" />
                </span>
              </div>
              <div className="evidence-body">
                <section className="model-principle">
                  <h3>このMVPの考え方</h3>
                  <p>
                    厳密な電磁界解析ではなく、屋外リンク、窓損失、室内距離損失、ナミゲート改善仮説を分けて入力し、
                    実測で校正するための営業・技術検討用モデルです。
                  </p>
                  <div className="principle-grid">
                    <article>
                      <span>1</span>
                      <strong>屋外条件を固定</strong>
                      <small>周波数、EIRP、距離、アンテナ高を先に決める</small>
                    </article>
                    <article>
                      <span>2</span>
                      <strong>窓と室内を分離</strong>
                      <small>Low-E、入射角、室内奥行を別々に見る</small>
                    </article>
                    <article>
                      <span>3</span>
                      <strong>改善は回復率で読む</strong>
                      <small>窓ありと窓なしの差をどれだけ埋めたか</small>
                    </article>
                    <article>
                      <span>4</span>
                      <strong>実測で校正</strong>
                      <small>同一点、同じ高さ、同じ向きで3状態を比較</small>
                    </article>
                  </div>
                </section>

                <ResearchColumns />

                <section className="evidence-grid" aria-label="参考資料">
                  {EVIDENCE_ITEMS.map((item) => (
                    <article className="evidence-card" key={item.url}>
                      <span>{item.category}</span>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                      <a href={item.url} rel="noreferrer" target="_blank">
                        参照資料を開く
                      </a>
                    </article>
                  ))}
                </section>
              </div>
            </section>
          ) : null}
        </section>
      </section>

      <footer className="app-footer">
        {DISCLAIMER_FULL} RSRPはリンクバジェット近似として扱う。
      </footer>
    </main>
  )
}

export default App
