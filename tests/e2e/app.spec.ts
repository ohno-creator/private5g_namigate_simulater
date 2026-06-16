import { expect, test, type Locator, type Page } from '@playwright/test'

const heatmapCellCount = 18 * 12 * 3
const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A'

function controlInput(page: Page, label: string): Locator {
  return page.locator('label.control').filter({ hasText: label }).locator('input')
}

function controlSelect(page: Page, label: string): Locator {
  return page.locator('label.control').filter({ hasText: label }).locator('select')
}

function scenarioCard(page: Page, label: string): Locator {
  return page.locator('.rsrp-card').filter({
    has: page.getByText(label, { exact: true }),
  })
}

function metricCard(page: Page, label: string): Locator {
  return page.locator('.metric-card').filter({ hasText: label })
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

  await expect(scenarioCard(page, '窓なし')).toBeVisible()
  await expect(scenarioCard(page, '窓あり')).toBeVisible()
  await expect(scenarioCard(page, '窓あり＋ナミゲート')).toBeVisible()

  const [noWindow, withWindow, withNamigate] = await rsrpValues(page)
  expect(noWindow).toBeGreaterThan(withNamigate)
  expect(withNamigate).toBeGreaterThan(withWindow)

  await expect(metricCard(page, '窓損失')).toContainText('40 dB')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('31 dB')
  await expect(metricCard(page, '窓なし状態への回復率')).toContainText('%')

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
  await expect(page.locator('.chart-card')).toHaveCount(4)
  await expect(page.locator('.chart-card .recharts-responsive-container')).toHaveCount(4)
  await expect(
    page.getByText('これは厳密な電磁界解析ではなく、営業・技術検討用の簡易シミュレータである'),
  ).toBeVisible()
})

test('入力変更でプリセット値と可視化ラベルが更新される', async ({ page }) => {
  await page.goto('/')

  await controlSelect(page, '窓種別').selectOption('single')
  await expect(controlInput(page, '窓損失')).toHaveValue('3')
  await expect(metricCard(page, '窓損失')).toContainText('3 dB')

  await controlSelect(page, '改善量プリセット').selectOption('standard')
  await expect(controlInput(page, 'ナミゲート改善量')).toHaveValue('10')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('16 dB')

  const beforeDistanceChange = await rsrpValues(page)
  await controlInput(page, '室内距離').fill('10')
  await expect(page.locator('.position-3d-facts')).toContainText('室内 10 m')

  const afterDistanceChange = await rsrpValues(page)
  expect(afterDistanceChange[0]).toBeLessThan(beforeDistanceChange[0])
  expect(afterDistanceChange[1]).toBeLessThan(beforeDistanceChange[1])
  expect(afterDistanceChange[2]).toBeLessThan(beforeDistanceChange[2])
})

test('数値パラメータをキーボードで直接入力できる', async ({ page }) => {
  await page.goto('/')

  const indoorDistanceInput = controlInput(page, '室内距離')
  await expect(indoorDistanceInput).toHaveValue('8')

  await indoorDistanceInput.click()
  await indoorDistanceInput.press(selectAllShortcut)
  await indoorDistanceInput.press('Backspace')
  await expect(indoorDistanceInput).toHaveValue('')

  await page.keyboard.type('10.5')
  await expect(indoorDistanceInput).toHaveValue('10.5')
  await expect(page.locator('.position-3d-facts')).toContainText('室内 10.5 m')

  await indoorDistanceInput.press('Enter')
  await expect(indoorDistanceInput).toHaveValue('10.5')

  const thresholdInput = controlInput(page, '接続しきい値')
  await thresholdInput.click()
  await thresholdInput.press(selectAllShortcut)
  await page.keyboard.type('-95.5')
  await expect(thresholdInput).toHaveValue('-95.5')
})

test('無線機詳細とナミゲート効果パラメータで推定値が変わる', async ({ page }) => {
  await page.goto('/')

  const beforeRadioChange = await rsrpValues(page)
  await controlSelect(page, 'EIRP計算方式').selectOption('detailed')
  await controlInput(page, '送信出力').fill('20')
  await expect(metricCard(page, '実効EIRP')).toContainText('33 dBm')

  const afterRadioChange = await rsrpValues(page)
  expect(afterRadioChange[0]).toBeCloseTo(beforeRadioChange[0] - 10, 1)
  expect(afterRadioChange[1]).toBeCloseTo(beforeRadioChange[1] - 10, 1)
  expect(afterRadioChange[2]).toBeCloseTo(beforeRadioChange[2] - 10, 1)

  await controlInput(page, '入射角回復率').fill('100')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('32 dB')

  await controlInput(page, '設置効率').fill('50')
  await expect(metricCard(page, 'ナミゲート総改善量')).toContainText('16 dB')
})

test('実測値を比較しAI分析用データをコピーできる', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  })
  await page.goto('/')

  await controlInput(page, '実測RSRP（窓なし）').fill('-64')
  await controlInput(page, '実測RSRP（窓あり）').fill('-106.5')
  await controlInput(page, '実測RSRP（窓あり＋ナミゲート）').fill('-79.5')

  const comparisonTable = page.getByRole('table', {
    name: '推定値と実測値の比較',
  })
  await expect(comparisonTable).toContainText('-64 dBm')
  await expect(comparisonTable).toContainText('-106.5 dBm')
  await expect(comparisonTable).toContainText('-79.5 dBm')
  await expect(page.locator('.measurement-summary')).toContainText('実測のナミゲート改善')

  await page.getByRole('button', { name: 'AI分析用データをコピー' }).click()
  await expect(page.getByText('AI分析用データをコピーしました')).toBeVisible()

  const copiedText = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiedText).toContain('# ローカル5G 窓面電波改善シミュレータ 実測比較データ')
  expect(copiedText).toContain('| 窓あり＋ナミゲート |')
  expect(copiedText).toContain('-79.5 dBm')
  expect(copiedText).toContain('## 改善効果')
})

test('モバイル幅でも3Dビューと主要カードが横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const canvas = page.locator('.position-3d-canvas')
  await canvas.scrollIntoViewIfNeeded()
  await expect(canvas).toBeVisible()

  const canvasBox = await canvas.boundingBox()
  expect(canvasBox?.width).toBeGreaterThan(280)
  expect(canvasBox?.height).toBeGreaterThan(330)

  await expect(page.locator('.position-3d-facts div')).toHaveCount(3)
  await expect(page.locator('.heatmap-card')).toHaveCount(3)

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)
})
