import { expect, test, type Locator, type Page } from '@playwright/test'

const heatmapCellCount = 18 * 12 * 3
const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A'

function labelRegex(label: string) {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
}

function controlInput(page: Page, label: string): Locator {
  return page.getByRole('spinbutton', { name: labelRegex(label) })
}

function controlSelect(page: Page, label: string): Locator {
  return page.getByRole('combobox', { name: labelRegex(label) })
}

function sampleInput(root: Page | Locator, label: string): Locator {
  return root.getByRole('textbox', {
    name: labelRegex(`実測RSRPサンプル（${label}）`),
  })
}

function patternPanel(page: Page): Locator {
  return page.locator('.control-panel .pattern-switcher')
}

async function savedPatternValue(panel: Locator, patternName: string) {
  const options = await panel
    .getByRole('combobox', { name: labelRegex('保存済みパターン') })
    .locator('option')
    .evaluateAll((items) =>
      items.map((item) => ({
        text: item.textContent ?? '',
        value: (item as HTMLOptionElement).value,
      })),
    )
  const option = options.find((item) => item.text.includes(patternName))

  if (!option) {
    throw new Error(`Saved pattern option not found: ${patternName}`)
  }

  return option.value
}

function scenarioCard(page: Page, label: string): Locator {
  return page.locator('.rsrp-card').filter({
    has: page.getByText(label, { exact: true }),
  })
}

function metricCard(page: Page, label: string): Locator {
  return page.locator(`.metric-card[data-metric="${label}"]`)
}

async function openTab(page: Page, label: string) {
  await page.getByRole('tab', { name: new RegExp(label) }).click()
}

async function openInputStep(page: Page, label: string) {
  await page
    .getByRole('tab', { name: new RegExp(label) })
    .filter({ has: page.locator('small') })
    .click()
}

async function switchToTechnicalMode(page: Page) {
  await page.getByRole('button', { name: /技術詳細モード/ }).click()
}

async function rsrpValues(page: Page): Promise<number[]> {
  const values = await page.locator('.rsrp-card strong').allTextContents()

  return values.map((value) => Number(value.replace(/[^\d.-]/g, '')))
}

test('初期表示で3状態比較と主要可視化が表示される', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('ローカル5G 窓面電波改善シミュレータ')
  await expect(
    page.getByRole('heading', { name: 'ローカル5G 窓面電波改善シミュレータ' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /営業用簡易モード/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: '入力条件' })).toBeVisible()
  await expect(page.getByLabel('営業用簡易入力')).toBeVisible()
  await expect(page.getByLabel('営業用結果サマリー')).toBeVisible()
  await expect(page.getByLabel('実地試験準備サマリー')).toBeVisible()
  await expect(page.getByLabel('実地試験準備サマリー')).toContainText('準備度')
  await expect(page.getByRole('button', { name: 'PDFレポート出力' })).toBeVisible()
  await expect(page.getByText('実測前の仮説整理ツール')).toBeVisible()
  await expect(controlSelect(page, '営業用プリセット')).toHaveValue('lowEStandard')

  await expect(scenarioCard(page, '窓なし')).toBeVisible()
  await expect(scenarioCard(page, '窓あり')).toBeVisible()
  await expect(scenarioCard(page, '窓あり＋ナミゲート')).toBeVisible()

  const [noWindow, withWindow, withNamigate] = await rsrpValues(page)
  expect(noWindow).toBeGreaterThan(withNamigate)
  expect(withNamigate).toBeGreaterThan(withWindow)

  await switchToTechnicalMode(page)
  await expect(page.getByRole('tablist', { name: '入力ステップ' })).toBeVisible()
  await expect(page.getByText('迷わない入力順')).toBeVisible()
  await expect(page.getByRole('tablist', { name: '表示切り替え' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /概要/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: '読み方ガイド' })).toBeVisible()
  expect(await page.locator('.help-tip').count()).toBeGreaterThan(35)
  await expect(page.getByText('法規制メモ')).toBeVisible()
  await expect(controlSelect(page, '屋外伝搬モデル')).toHaveValue('fspl')
  await expect(page.locator('.propagation-note strong')).toHaveText(
    '自由空間損失（FSPL）',
  )
  const radioGuidance = page.getByLabel('無線・屋外の入力目安の解説')
  await expect(radioGuidance.getByText('入力目安と根拠')).toBeVisible()
  await expect(radioGuidance.getByText('日本のローカル5G検討ではSub6')).toBeVisible()

  await expect(metricCard(page, '窓損失')).toContainText('40 dB')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('31 dB')
  await expect(metricCard(page, '窓なし状態への回復率')).toContainText('%')

  await expect(page.locator('.coverage-card')).toHaveCount(3)

  await openTab(page, '位置・分布')

  const canvas = page.locator('.position-3d-canvas')
  await canvas.scrollIntoViewIfNeeded()
  await expect(canvas).toBeVisible()
  await expect.poll(async () => {
    return canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement
      return {
        dataUrlLength: canvasElement.toDataURL('image/png').length,
        height: canvasElement.height,
        width: canvasElement.width,
      }
    })
  }).toMatchObject({
    height: expect.any(Number),
    width: expect.any(Number),
  })

  const canvasInfo = await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement
    return {
      dataUrlLength: canvasElement.toDataURL('image/png').length,
      height: canvasElement.height,
      width: canvasElement.width,
    }
  })
  expect(canvasInfo.width).toBeGreaterThan(250)
  expect(canvasInfo.height).toBeGreaterThan(250)
  expect(canvasInfo.dataUrlLength).toBeGreaterThan(1_000)

  await expect(page.locator('.heatmap-card')).toHaveCount(3)
  await expect(page.locator('.heat-cell')).toHaveCount(heatmapCellCount)

  await openTab(page, 'グラフ')

  await expect(page.locator('.chart-card')).toHaveCount(4)
  await expect(page.locator('.chart-card .recharts-responsive-container')).toHaveCount(4)

  await openTab(page, '根拠')
  await expect(page.getByRole('heading', { name: 'モデルとUI設計の根拠' })).toBeVisible()
  await expect(page.getByText('短いコラム')).toBeVisible()
  await expect(page.getByText('N=1で判断しない理由')).toBeVisible()
  await expect(
    page.getByText('IEEE Communications Society RIS Best Readings'),
  ).toBeVisible()
  await expect(
    page
      .getByLabel('免責・利用範囲')
      .getByText('本シミュレータは、ローカル5Gの窓面透過改善効果を概算するための技術検討ツールです'),
  ).toBeVisible()
})

test('営業用簡易モードからPDFレポート画面を開ける', async ({ page }) => {
  await page.goto('/')

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'PDFレポート出力' }).click()
  const reportPage = await popupPromise

  await expect(
    reportPage.getByRole('heading', {
      name: 'ローカル5G 窓面透過改善シミュレーションレポート',
    }),
  ).toBeVisible()
  await expect(reportPage.getByText('スタッフ株式会社')).toBeVisible()
  await expect(reportPage.getByText('実地試験準備サマリー')).toBeVisible()
  await expect(reportPage.getByText('免責・利用範囲')).toBeVisible()
  await expect(reportPage.getByText('RSRP、SINR、RSRQ')).toBeVisible()
  await reportPage.close()
})

test('営業用簡易モードで入力プリセットを選択できる', async ({ page }) => {
  await page.goto('/')

  const presetSelect = controlSelect(page, '営業用プリセット')
  await presetSelect.selectOption('fieldTestRu100MhzTdd')
  await expect(presetSelect).toHaveValue('fieldTestRu100MhzTdd')
  await expect(controlInput(page, '周波数')).toHaveValue('4700')
  await expect(page.getByLabel('営業用簡易入力')).toContainText(
    'DL 4x4MIMO/256QAM',
  )
  await page.getByRole('button', { name: '周波数を10MHz上げる' }).click()
  await expect(controlInput(page, '周波数')).toHaveValue('4710')
  await expect(presetSelect).toHaveValue('custom')

  await presetSelect.selectOption('fieldTestRu100MhzTdd')
  await expect(controlInput(page, '周波数')).toHaveValue('4700')
  await expect(controlSelect(page, '間取りプリセット')).toHaveValue('rectangle')
  await expect(controlSelect(page, '窓サイズプリセット')).toHaveValue('standard')
  await expect(controlSelect(page, '建物材質')).toHaveValue('reinforcedConcrete')

  await presetSelect.selectOption('notchedCornerRuTest')
  await expect(presetSelect).toHaveValue('notchedCornerRuTest')
  await expect(controlSelect(page, '間取りプリセット')).toHaveValue(
    'notchedCornerWindow',
  )
  await expect(controlSelect(page, '窓サイズプリセット')).toHaveValue('standard')
  await expect(controlSelect(page, '建物材質')).toHaveValue('reinforcedConcrete')
  await expect(page.getByText('前面左角が欠けた部屋')).toBeVisible()

  await switchToTechnicalMode(page)
  await expect(controlSelect(page, '無線機プリセット')).toHaveValue(
    'fieldTestRu100MhzTdd',
  )
  await openInputStep(page, '窓・室内')
  await expect(controlInput(page, '角欠け幅')).toHaveValue('3')
  await expect(controlInput(page, '角欠け奥行')).toHaveValue('3')

  await openTab(page, '位置・分布')
  await expect(page.locator('.heat-cell.is-outside').first()).toBeVisible()
  await expect(page.locator('.heatmap-plan-legend').first()).toContainText(
    '角欠け',
  )
  await expect(page.locator('.position-3d-facts')).toContainText('角欠け')

  await page.getByRole('button', { name: /営業用簡易モード/ }).click()
  await presetSelect.selectOption('diagonalCornerRuTest')
  await expect(presetSelect).toHaveValue('diagonalCornerRuTest')
  await expect(controlSelect(page, '間取りプリセット')).toHaveValue(
    'diagonalCornerWindow',
  )
  await expect(controlSelect(page, '窓サイズプリセット')).toHaveValue('wide')
  await expect(controlInput(page, '屋外距離')).toHaveValue('336.04')
  await expect(controlInput(page, '入射角')).toHaveValue('45')
  await expect(controlInput(page, '室内距離')).toHaveValue('1')
  await expect(controlInput(page, '測定高さ')).toHaveValue('4.5')
  await expect(controlInput(page, '部屋幅')).toHaveValue('10')
  await expect(controlInput(page, '部屋奥行')).toHaveValue('12')
  await expect(controlInput(page, '窓幅')).toHaveValue('3.6')
  await expect(controlInput(page, '窓中心高')).toHaveValue('4.5')
  await expect(page.getByText(/斜め窓面長/)).toBeVisible()
  await expect(page.getByLabel('実地試験準備サマリー')).toContainText('約336m')
  await expect(page.getByLabel('実地試験準備サマリー')).toContainText('方位91.35°')
  await controlInput(page, '部屋幅').fill('11')
  await expect(presetSelect).toHaveValue('custom')
  await expect(controlSelect(page, '間取りプリセット')).toHaveValue(
    'diagonalCornerWindow',
  )

  await switchToTechnicalMode(page)
  await openInputStep(page, '窓・室内')
  await expect(controlSelect(page, '間取りプリセット')).toHaveValue(
    'diagonalCornerWindow',
  )
  await expect(controlInput(page, '部屋幅')).toHaveValue('11')
  await expect(controlInput(page, '角欠け幅')).toHaveValue('3')
  await expect(controlInput(page, '角欠け奥行')).toHaveValue('3')
  await expect(controlInput(page, '窓中心高')).toHaveValue('4.5')

  await openTab(page, '位置・分布')
  await expect(page.locator('.heatmap-plan-legend').first()).toContainText(
    '斜め角欠け',
  )
  await expect(page.getByLabel('斜め窓の入射角補助図')).toHaveCount(3)
  await expect(page.getByText('窓面基準線（水平化）').first()).toBeVisible()
  await expect(page.getByText('窓面との角度 45°').first()).toBeVisible()
  await expect(page.getByText('法線ずれ 45°').first()).toBeVisible()
  await expect(page.getByText('法線基準')).toHaveCount(0)
  await expect(page.locator('.heatmap-left-wall-line')).toHaveCount(3)
  await expect(page.locator('.heatmap-notch').first()).toBeVisible()
  await expect(page.locator('.position-3d-facts')).toContainText('斜め角欠け')
  const diagonalCanvasInfo = await page
    .locator('.position-3d-canvas')
    .evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement
      return {
        dataUrlLength: canvasElement.toDataURL('image/png').length,
        height: canvasElement.height,
        width: canvasElement.width,
      }
    })
  expect(diagonalCanvasInfo.width).toBeGreaterThan(250)
  expect(diagonalCanvasInfo.height).toBeGreaterThan(250)
  expect(diagonalCanvasInfo.dataUrlLength).toBeGreaterThan(1_000)

  await page.getByRole('button', { name: /営業用簡易モード/ }).click()
  await presetSelect.selectOption('singleGlassNear')
  await expect(presetSelect).toHaveValue('singleGlassNear')
  await expect(controlInput(page, '屋外距離')).toHaveValue('50')
  await expect(controlSelect(page, '窓種別')).toHaveValue('single')
  await expect(controlInput(page, '窓損失')).toHaveValue('3')
  await expect(controlInput(page, '入射角')).toHaveValue('90')
  await expect(controlInput(page, '室内距離')).toHaveValue('5')
  await expect(controlInput(page, 'ナミゲート改善量')).toHaveValue('10')
  await expect(controlInput(page, '測定高さ')).toHaveValue('1.2')
  await expect(page.getByText('通常ガラスでは影響が軽いケース')).toBeVisible()

  await presetSelect.selectOption('noNamigateCompare')
  await expect(controlInput(page, 'ナミゲート改善量')).toHaveValue('0')
  const [, withWindow, withNamigate] = await rsrpValues(page)
  expect(withNamigate).toBeCloseTo(withWindow, 1)

  await controlInput(page, '室内距離').fill('6')
  await expect(presetSelect).toHaveValue('custom')
})

test('入力変更でプリセット値と可視化ラベルが更新される', async ({ page }) => {
  await page.goto('/')
  await switchToTechnicalMode(page)

  await openInputStep(page, '窓・室内')
  const activeInputPanel = page.locator('.control-group.input-step-panel.is-active')

  await controlSelect(page, '窓種別').selectOption('jisInsulatingR3209')
  await expect(controlInput(page, '窓損失')).toHaveValue('10')
  await expect(activeInputPanel.getByText('2枚以上の板ガラスと密封中空層')).toBeVisible()

  await controlSelect(page, '窓種別').selectOption('jisSolarReflectiveR3221')
  await expect(controlInput(page, '窓損失')).toHaveValue('30')
  await expect(activeInputPanel.getByText('日射熱遮蔽用の薄膜')).toBeVisible()

  await controlSelect(page, '窓種別').selectOption('single')
  await expect(controlInput(page, '窓損失')).toHaveValue('3')
  await expect(metricCard(page, '窓損失')).toContainText('3 dB')

  await openInputStep(page, 'ナミゲート')
  await controlSelect(page, '改善量プリセット').selectOption('standard')
  await expect(controlInput(page, 'ナミゲート改善量')).toHaveValue('10')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('4 dB')

  const cappedNamigateValues = await rsrpValues(page)
  expect(cappedNamigateValues[2]).toBeLessThanOrEqual(cappedNamigateValues[0])
  expect(cappedNamigateValues[2]).toBeGreaterThan(cappedNamigateValues[1])

  const beforeDistanceChange = await rsrpValues(page)
  await openInputStep(page, '窓・室内')
  await controlInput(page, '室内距離').fill('10')
  await openTab(page, '位置・分布')
  await expect(page.locator('.position-3d-facts')).toContainText('室内 10 m')

  const afterDistanceChange = await rsrpValues(page)
  expect(afterDistanceChange[0]).toBeLessThan(beforeDistanceChange[0])
  expect(afterDistanceChange[1]).toBeLessThan(beforeDistanceChange[1])
  expect(afterDistanceChange[2]).toBeLessThan(beforeDistanceChange[2])

  await openInputStep(page, '窓・室内')
  await controlInput(page, '入射角').fill('90')
  await openTab(page, '位置・分布')
  await expect(page.getByText('窓面との角度 90°')).toBeVisible()
  const rayPath = await page.locator('.diagram-ray').getAttribute('d')
  const rayCoords = rayPath?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  expect(rayCoords).toHaveLength(6)
  expect(rayCoords[1]).toBeCloseTo(rayCoords[3], 1)
  expect(rayCoords[3]).toBeCloseTo(rayCoords[5], 1)
})

test('シミュレーション結果が角度・窓・距離・改善量の組み合わせで一貫する', async ({
  page,
}) => {
  await page.goto('/')
  await switchToTechnicalMode(page)

  await openInputStep(page, '窓・室内')
  await controlSelect(page, '窓種別').selectOption('single')
  await controlInput(page, '室内距離').fill('8')
  await controlInput(page, '入射角').fill('90')
  const angle90 = await rsrpValues(page)

  await controlInput(page, '入射角').fill('60')
  const angle60 = await rsrpValues(page)
  expect(angle60[0]).toBeCloseTo(angle90[0], 1)
  expect(angle60[1]).toBeCloseTo(angle90[1] - 1, 1)

  await controlInput(page, '入射角').fill('45')
  const angle45 = await rsrpValues(page)
  expect(angle45[1]).toBeCloseTo(angle90[1] - 3, 1)

  await controlInput(page, '入射角').fill('30')
  const angle30 = await rsrpValues(page)
  expect(angle30[1]).toBeCloseTo(angle90[1] - 6, 1)

  await controlInput(page, '入射角').fill('15')
  const angle15 = await rsrpValues(page)
  expect(angle15[1]).toBeCloseTo(angle90[1] - 10, 1)
  expect(angle15[2]).toBeGreaterThanOrEqual(angle15[1])
  expect(angle15[2]).toBeLessThanOrEqual(angle15[0] + 0.1)

  await controlSelect(page, '窓種別').selectOption('none')
  const noWindowPreset = await rsrpValues(page)
  expect(noWindowPreset[1]).toBeCloseTo(noWindowPreset[0], 1)
  expect(noWindowPreset[2]).toBeCloseTo(noWindowPreset[0], 1)

  await controlInput(page, '入射角').fill('45')
  await controlSelect(page, '窓種別').selectOption('single')
  const singleGlass = await rsrpValues(page)
  await controlSelect(page, '窓種別').selectOption('lowE')
  const lowEGlass = await rsrpValues(page)
  expect(lowEGlass[0]).toBeCloseTo(singleGlass[0], 1)
  expect(lowEGlass[1]).toBeCloseTo(singleGlass[1] - 37, 1)

  await controlSelect(page, '窓種別').selectOption('single')
  await controlInput(page, '入射角').fill('90')
  await controlInput(page, '室内距離').fill('3')
  const nearPoint = await rsrpValues(page)
  await controlInput(page, '室内距離').fill('12')
  const farPoint = await rsrpValues(page)
  expect(farPoint[0]).toBeLessThan(nearPoint[0])
  expect(farPoint[1]).toBeLessThan(nearPoint[1])

  await controlSelect(page, '窓種別').selectOption('lowE')
  await controlInput(page, '入射角').fill('45')
  await openInputStep(page, 'ナミゲート')
  await controlInput(page, 'ナミゲート改善量').fill('0')
  const noNamigateGain = await rsrpValues(page)
  await controlInput(page, 'ナミゲート改善量').fill('10')
  const withNamigateGain = await rsrpValues(page)
  expect(withNamigateGain[2]).toBeGreaterThan(noNamigateGain[2])
  expect(withNamigateGain[2]).toBeLessThanOrEqual(withNamigateGain[0] + 0.1)
})

test('数値パラメータをキーボードで直接入力できる', async ({ page }) => {
  await page.goto('/')
  await switchToTechnicalMode(page)

  await openInputStep(page, '窓・室内')
  const indoorDistanceInput = controlInput(page, '室内距離')
  await expect(indoorDistanceInput).toHaveValue('8')

  await indoorDistanceInput.click()
  await indoorDistanceInput.press(selectAllShortcut)
  await indoorDistanceInput.press('Backspace')
  await expect(indoorDistanceInput).toHaveValue('')

  await page.keyboard.type('10.5')
  await expect(indoorDistanceInput).toHaveValue('10.5')
  await openTab(page, '位置・分布')
  await expect(page.locator('.position-3d-facts')).toContainText('室内 10.5 m')

  await indoorDistanceInput.press('Enter')
  await expect(indoorDistanceInput).toHaveValue('10.5')

  await openInputStep(page, 'ナミゲート')
  const thresholdInput = controlInput(page, '接続しきい値')
  await thresholdInput.click()
  await thresholdInput.press(selectAllShortcut)
  await page.keyboard.type('-95.5')
  await expect(thresholdInput).toHaveValue('-95.5')
})

test('無線機詳細とナミゲート効果パラメータで推定値が変わる', async ({ page }) => {
  await page.goto('/')
  await switchToTechnicalMode(page)

  await expect(controlSelect(page, '無線機プリセット')).toHaveValue('custom')
  await controlSelect(page, '無線機プリセット').selectOption('sub6ExternalAntennaModule')
  await expect(controlSelect(page, '無線機プリセット')).toHaveValue(
    'sub6ExternalAntennaModule',
  )
  await expect(controlInput(page, '周波数')).toHaveValue('4700')
  await expect(controlInput(page, '送信出力')).toHaveValue('23')
  await expect(controlInput(page, '受信アンテナ利得')).toHaveValue('3')
  await expect(page.getByText('汎用例であり')).toBeVisible()

  await controlInput(page, '送信出力').fill('30')
  await expect(controlSelect(page, '無線機プリセット')).toHaveValue('custom')

  await controlSelect(page, '無線機プリセット').selectOption('sub6OutdoorMicro')
  await expect(controlInput(page, '送信アンテナ利得')).toHaveValue('15')

  const beforeRadioChange = await rsrpValues(page)
  await controlSelect(page, 'EIRP計算方式').selectOption('detailed')
  await controlInput(page, '送信出力').fill('20')
  await expect(metricCard(page, '実効EIRP')).toContainText('33 dBm')

  const afterRadioChange = await rsrpValues(page)
  expect(afterRadioChange[0]).toBeCloseTo(beforeRadioChange[0] - 10, 1)
  expect(afterRadioChange[1]).toBeCloseTo(beforeRadioChange[1] - 10, 1)
  expect(afterRadioChange[2]).toBeCloseTo(beforeRadioChange[2] - 10, 1)

  const beforeOutdoorModelChange = await rsrpValues(page)
  await controlSelect(page, '屋外伝搬モデル').selectOption('hataUrbanSmall')
  await expect(controlSelect(page, '屋外伝搬モデル')).toHaveValue('hataUrbanSmall')
  await expect(metricCard(page, '計算損失')).toContainText('奥村-秦 都市（中小都市）')
  await expect(page.locator('.propagation-note')).toContainText('適用範囲外')
  await expect(page.locator('.propagation-note')).toContainText('窓中心高')

  const afterOutdoorModelChange = await rsrpValues(page)
  expect(afterOutdoorModelChange[0]).not.toBeCloseTo(beforeOutdoorModelChange[0], 1)

  await controlSelect(page, '屋外伝搬モデル').selectOption('fspl')

  await expect(controlInput(page, '送信アンテナ高')).toHaveValue('5')
  await openInputStep(page, '窓・室内')
  await expect(controlInput(page, '窓中心高')).toHaveValue('1.6')
  await expect(controlInput(page, '受信アンテナ高')).toHaveValue('1.2')

  const beforeAdditionalLosses = await rsrpValues(page)
  await openInputStep(page, '無線・屋外')
  await controlInput(page, 'アンテナ指向ずれ損失').fill('3')
  await controlInput(page, '屋外遮蔽損失').fill('2')
  await openInputStep(page, '窓・室内')
  await controlInput(page, '屋内遮蔽損失').fill('1')
  await expect(metricCard(page, '追加損失')).toContainText('6 dB')

  const afterAdditionalLosses = await rsrpValues(page)
  expect(afterAdditionalLosses[0]).toBeCloseTo(beforeAdditionalLosses[0] - 6, 1)
  expect(afterAdditionalLosses[1]).toBeCloseTo(beforeAdditionalLosses[1] - 6, 1)
  expect(afterAdditionalLosses[2]).toBeCloseTo(beforeAdditionalLosses[2] - 6, 1)

  await openInputStep(page, '無線・屋外')
  await controlInput(page, '送信アンテナ高').fill('9')
  await openInputStep(page, '窓・室内')
  await controlInput(page, '窓中心高').fill('2')
  await controlInput(page, '受信アンテナ高').fill('1.5')
  await expect(metricCard(page, '3Dリンク距離')).toContainText('室内3D')

  await openTab(page, '位置・分布')
  await expect(page.locator('.position-3d-facts')).toContainText('送信高 9 m')
  await expect(page.locator('.position-3d-facts')).toContainText('受信高 1.5 m')
  await openTab(page, '概要')

  await openInputStep(page, 'ナミゲート')
  await controlInput(page, '入射角回復率').fill('100')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('32 dB')

  await controlInput(page, '設置効率').fill('50')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('16 dB')
})

test('CSV実測点を取り込み校正とレポート作成ができる', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  })
  await page.goto('/')
  await switchToTechnicalMode(page)

  await openTab(page, '実測データ')
  await expect(
    page.getByRole('region', { name: '実地試験準備', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('現地測定手順')).toContainText('窓開放相当を測る')
  await page.getByRole('button', { name: 'サンプルCSVを読み込み' }).click()
  await expect(page.getByText('4点の実測データを取り込みました')).toBeVisible()
  const csvComparisonTable = page.getByRole('table', {
    name: 'CSV実測点ごとの推定誤差',
  })
  await expect(csvComparisonTable).toContainText('P1')
  await expect(csvComparisonTable).toContainText('窓なし')
  await expect(page.getByLabel('実地測定レビュー20項目')).toContainText('開1/閉1/NG2')

  await openTab(page, '位置・分布')
  await expect(page.locator('.heatmap-measured-point')).toHaveCount(4)
  await expect(page.locator('.position-3d-facts')).toContainText('実測点')

  await openTab(page, '分析・校正')
  await expect(page.getByText('推奨 窓損失')).toBeVisible()
  await page.getByRole('button', { name: '校正候補を入力へ反映' }).click()
  await expect(page.locator('.results-panel')).toContainText(
    '校正候補を入力条件へ反映しました',
  )

  await page.getByRole('button', { name: '実証レポートをコピー' }).click()
  await expect(page.locator('.results-panel')).toContainText(
    '実証レポートをコピーしました',
  )
  const reportText = await page.evaluate(() => navigator.clipboard.readText())
  expect(reportText).toContain('# ローカル5G 窓面電波改善 実証試験レポート')
  expect(reportText).toContain('## 感度分析')

  const resultsPanel = page.locator('.results-panel')
  await resultsPanel
    .getByPlaceholder('Low-E窓 ナミゲート20cm 室内8m')
    .fill('E2E実証ケース')
  await resultsPanel.getByRole('button', { name: '新規保存', exact: true }).click()
  await expect(resultsPanel).toContainText('入力パターンを保存しました')
  await expect(page.locator('select').filter({ hasText: 'E2E実証ケース' })).toHaveCount(2)
})

test('複数入力パターンを保存して実測値ごと切り替えられる', async ({ page }) => {
  await page.goto('/')
  await switchToTechnicalMode(page)

  const panel = patternPanel(page)
  await expect(panel).toContainText('入力・実測・CSV・プロトコルを一括切替')

  await controlInput(page, '周波数').fill('4700')
  await openInputStep(page, '実測・保存')
  await sampleInput(page, '窓なし').fill('-70\n-71')
  await panel.getByRole('textbox', { name: labelRegex('パターン名') }).fill('パターンA')
  await panel.getByRole('button', { name: '新規保存', exact: true }).click()
  await expect(panel).toContainText('入力パターンを保存しました')

  await openInputStep(page, '無線・屋外')
  await controlInput(page, '周波数').fill('4820')
  await openInputStep(page, '実測・保存')
  await sampleInput(page, '窓なし').fill('-80\n-81')
  await panel.getByRole('textbox', { name: labelRegex('パターン名') }).fill('パターンB')
  await panel.getByRole('button', { name: '別パターンとして保存' }).click()
  await expect(panel).toContainText('別パターンとして保存しました')

  const patternSelect = panel.getByRole('combobox', {
    name: labelRegex('保存済みパターン'),
  })
  await patternSelect.selectOption(await savedPatternValue(panel, 'パターンA'))
  await expect(panel).toContainText('入力パターンを切り替えました')
  await openInputStep(page, '無線・屋外')
  await expect(controlInput(page, '周波数')).toHaveValue('4700')
  await openInputStep(page, '実測・保存')
  await expect(sampleInput(page, '窓なし')).toHaveValue('-70\n-71')

  await patternSelect.selectOption(await savedPatternValue(panel, 'パターンB'))
  await expect(panel).toContainText('入力パターンを切り替えました')
  await openInputStep(page, '無線・屋外')
  await expect(controlInput(page, '周波数')).toHaveValue('4820')
  await openInputStep(page, '実測・保存')
  await expect(sampleInput(page, '窓なし')).toHaveValue('-80\n-81')
})

test('実測値を比較しAI分析用データをコピーできる', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  })
  await page.goto('/')
  await switchToTechnicalMode(page)

  await openInputStep(page, '実測・保存')
  await controlInput(page, '観測N数').fill('25')

  await openTab(page, '実測データ')
  const resultsPanel = page.locator('.results-panel')
  await sampleInput(resultsPanel, '窓なし').fill('-63.5\n-64\n-64.5')
  await sampleInput(resultsPanel, '窓あり').fill('-106\n-106.5\n-107')
  await sampleInput(resultsPanel, '窓あり＋ナミゲート').fill('-79\n-79.5\n-80')
  await resultsPanel
    .getByRole('spinbutton', { name: labelRegex('理論RSRP（窓なし）') })
    .fill('-65')
  await resultsPanel
    .getByRole('spinbutton', { name: labelRegex('理論RSRP（窓あり）') })
    .fill('-108')
  await resultsPanel
    .getByRole('spinbutton', {
      name: labelRegex('理論RSRP（窓あり＋ナミゲート）'),
    })
    .fill('-81')

  const comparisonTable = page.getByRole('table', {
    name: '推定値と実測値の比較',
  })
  await expect(comparisonTable).toContainText('-64 dBm')
  await expect(comparisonTable).toContainText('-106.5 dBm')
  await expect(comparisonTable).toContainText('-79.5 dBm')
  await expect(resultsPanel).toContainText('N=3 / 推奨25')
  await expect(page.getByText('実測のナミゲート改善')).toBeVisible()
  await expect(page.getByRole('table', { name: '外部理論計算値との比較' })).toContainText(
    '-108 dBm',
  )
  await expect(page.getByRole('table', { name: 'dB寄与分解' })).toContainText(
    'ナミゲート実効改善',
  )
  await expect(page.getByLabel('実地測定レビュー20項目')).toContainText(
    '室内奥行カバー',
  )
  await expect(page.locator('.field-aid-card')).toHaveCount(20)

  await page.getByRole('button', { name: 'AI分析用データをコピー' }).click()
  await expect(resultsPanel).toContainText('AI分析用データをコピーしました')

  const copiedText = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiedText).toContain('# ローカル5G 窓面電波改善シミュレータ 実測比較データ')
  expect(copiedText).toContain('- 観測N数: N=25')
  expect(copiedText).toContain('手入力N')
  expect(copiedText).toContain('N=3')
  expect(copiedText).toContain('## 外部理論計算値との比較')
  expect(copiedText).toContain('| 窓あり |')
  expect(copiedText).toContain('-108 dBm')
  expect(copiedText).toContain('## dB寄与分解')
  expect(copiedText).toContain('## 現地測定レビュー20項目')
  expect(copiedText).toContain('20. 室内奥行カバー')
  expect(copiedText).toContain('| 窓あり＋ナミゲート |')
  expect(copiedText).toContain('-79.5 dBm')
  expect(copiedText).toContain('## 改善効果')
})

test('入力内容を自動保存してリロード後も復元できる', async ({ page }) => {
  await page.goto('/')
  await switchToTechnicalMode(page)

  await controlInput(page, '周波数').fill('4820')
  await openInputStep(page, '実測・保存')
  await controlInput(page, '観測N数').fill('30')
  await sampleInput(page, '窓なし').fill('-70\n-69.5\n-70.5')
  await patternPanel(page)
    .getByPlaceholder('Low-E窓 ナミゲート20cm 室内8m')
    .fill('自動保存確認')
  await expect(page.getByLabel('入力内容の自動保存')).toContainText('自動保存済み', {
    timeout: 5000,
  })

  await page.reload()

  await expect(page.getByLabel('入力内容の自動保存')).toContainText('自動保存')
  await expect(controlInput(page, '観測N数')).toHaveValue('30')
  await expect(sampleInput(page, '窓なし')).toHaveValue('-70\n-69.5\n-70.5')
  await expect(
    patternPanel(page).getByPlaceholder('Low-E窓 ナミゲート20cm 室内8m'),
  ).toHaveValue('自動保存確認')

  await openInputStep(page, '無線・屋外')
  await expect(controlInput(page, '周波数')).toHaveValue('4820')
})

test('モバイル幅でも3Dビューと主要カードが横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await switchToTechnicalMode(page)

  await openTab(page, '位置・分布')
  const canvas = page.locator('.position-3d-canvas')
  await canvas.scrollIntoViewIfNeeded()
  await expect(canvas).toBeVisible()

  const canvasBox = await canvas.boundingBox()
  expect(canvasBox?.width).toBeGreaterThan(280)
  expect(canvasBox?.height).toBeGreaterThan(330)

  await expect(page.locator('.position-3d-facts div')).toHaveCount(5)
  await expect(page.locator('.position-3d-callout-panel div')).toHaveCount(5)
  await expect(page.locator('.heatmap-card')).toHaveCount(3)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)
})
