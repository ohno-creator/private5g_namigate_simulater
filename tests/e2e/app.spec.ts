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
  await expect(page.getByRole('heading', { name: '入力条件' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: '入力ステップ' })).toBeVisible()
  await expect(page.getByText('迷わない入力順')).toBeVisible()

  await expect(scenarioCard(page, '窓なし')).toBeVisible()
  await expect(scenarioCard(page, '窓あり')).toBeVisible()
  await expect(scenarioCard(page, '窓あり＋ナミゲート')).toBeVisible()

  const [noWindow, withWindow, withNamigate] = await rsrpValues(page)
  expect(noWindow).toBeGreaterThan(withNamigate)
  expect(withNamigate).toBeGreaterThan(withWindow)

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
    page.getByText('これは厳密な電磁界解析ではなく、営業・技術検討用の簡易シミュレータである'),
  ).toBeVisible()
})

test('入力変更でプリセット値と可視化ラベルが更新される', async ({ page }) => {
  await page.goto('/')

  await openInputStep(page, '窓・室内')
  await controlSelect(page, '窓種別').selectOption('single')
  await expect(controlInput(page, '窓損失')).toHaveValue('3')
  await expect(metricCard(page, '窓損失')).toContainText('3 dB')

  await openInputStep(page, 'ナミゲート')
  await controlSelect(page, '改善量プリセット').selectOption('standard')
  await expect(controlInput(page, 'ナミゲート改善量')).toHaveValue('10')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('16 dB')

  const beforeDistanceChange = await rsrpValues(page)
  await openInputStep(page, '窓・室内')
  await controlInput(page, '室内距離').fill('10')
  await openTab(page, '位置・分布')
  await expect(page.locator('.position-3d-facts')).toContainText('室内 10 m')

  const afterDistanceChange = await rsrpValues(page)
  expect(afterDistanceChange[0]).toBeLessThan(beforeDistanceChange[0])
  expect(afterDistanceChange[1]).toBeLessThan(beforeDistanceChange[1])
  expect(afterDistanceChange[2]).toBeLessThan(beforeDistanceChange[2])
})

test('数値パラメータをキーボードで直接入力できる', async ({ page }) => {
  await page.goto('/')

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

  await openTab(page, '実測データ')
  await page.getByRole('button', { name: 'サンプルCSVを読み込み' }).click()
  await expect(page.getByText('4点の実測データを取り込みました')).toBeVisible()
  await expect(page.getByRole('table', { name: 'CSV実測点ごとの推定誤差' })).toContainText(
    'P1',
  )

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
  await resultsPanel.getByRole('button', { name: '保存', exact: true }).click()
  await expect(resultsPanel).toContainText('試験ケースを保存しました')
  await expect(page.locator('select').filter({ hasText: 'E2E実証ケース' })).toHaveCount(1)
})

test('実測値を比較しAI分析用データをコピーできる', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  })
  await page.goto('/')

  await openInputStep(page, '実測・保存')
  await controlInput(page, '観測N数').fill('25')

  await openTab(page, '実測データ')
  const resultsPanel = page.locator('.results-panel')
  await resultsPanel
    .getByRole('spinbutton', { name: labelRegex('実測RSRP（窓なし）') })
    .fill('-64')
  await resultsPanel
    .getByRole('spinbutton', { name: labelRegex('実測RSRP（窓あり）') })
    .fill('-106.5')
  await resultsPanel
    .getByRole('spinbutton', {
      name: labelRegex('実測RSRP（窓あり＋ナミゲート）'),
    })
    .fill('-79.5')
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

test('モバイル幅でも3Dビューと主要カードが横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await openTab(page, '位置・分布')
  const canvas = page.locator('.position-3d-canvas')
  await canvas.scrollIntoViewIfNeeded()
  await expect(canvas).toBeVisible()

  const canvasBox = await canvas.boundingBox()
  expect(canvasBox?.width).toBeGreaterThan(280)
  expect(canvasBox?.height).toBeGreaterThan(330)

  await expect(page.locator('.position-3d-facts div')).toHaveCount(4)
  await expect(page.locator('.position-3d-callout-panel div')).toHaveCount(4)
  await expect(page.locator('.heatmap-card')).toHaveCount(3)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)
})
