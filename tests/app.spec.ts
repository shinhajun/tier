import { expect, test } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

async function expectSubmitBarDoesNotCoverRows(page: import('@playwright/test').Page) {
  for (const y of [320, 640, 960]) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
    const overlaps = await page.evaluate(() => {
      const submit = document.querySelector('.form-submit')?.getBoundingClientRect()
      if (!submit) return false
      return [...document.querySelectorAll('.row-setup__item input, .row-setup__item button')]
        .map((element) => element.getBoundingClientRect())
        .some((control) => (
          submit.left < control.right
          && submit.right > control.left
          && submit.top < control.bottom
          && submit.bottom > control.top
        ))
    })
    expect(overlaps).toBe(false)
  }
}

test('public movie board is readable from the gallery', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '티어표' })).toBeVisible()
  await expect(page.getByLabel('티어표 예시')).toHaveCount(0)
  const movieBoardLink = page.locator('a[href="/t/space-movie-scores"]')
  await expect(movieBoardLink).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: `test-results/${testInfo.project.name}-home.png`,
    fullPage: true,
  })

  // Board titles and items are user-editable; compare with current persisted data,
  // not the original seed copy. Keep the stable slug as the navigation contract.
  const boardResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === 'GET'
      && url.pathname === '/rest/v1/tier_boards'
      && url.searchParams.get('slug') === 'eq.space-movie-scores'
  })
  await movieBoardLink.click()
  const response = await boardResponse
  expect(response.ok()).toBe(true)
  const records = await response.json() as Array<{
    title: string
    tier_rows: Array<{
      label: string
      position: number
      tier_items: Array<{ title: string; position: number }>
    }>
  }>
  expect(records).toHaveLength(1)
  const board = records[0]
  expect(board.title.trim()).not.toBe('')
  expect(board.tier_rows.length).toBeGreaterThan(0)
  const rows = [...board.tier_rows].sort((a, b) => a.position - b.position)
  const itemTitles = rows.flatMap((row) => [...row.tier_items]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.title))
  await expect(page).toHaveURL(/\/t\/space-movie-scores$/)
  await expect(page.getByRole('heading', { name: board.title, exact: true })).toBeVisible()
  await expect(page.locator('.tier-row__label')).toHaveText(rows.map((row) => row.label))
  await expect(page.locator('.tier-item strong')).toHaveText(itemTitles)
  await page.reload()
  await expect(page.getByRole('heading', { name: board.title, exact: true })).toBeVisible()
  await expect(page.locator('.tier-item strong')).toHaveText(itemTitles)
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: `test-results/${testInfo.project.name}-movie-board.png`,
    fullPage: true,
  })

  await page.evaluate(() => {
    const longText = '아'.repeat(300)
    const description = document.querySelector<HTMLElement>('.board-header__copy > p:not(.board-meta)')
    const title = document.querySelector<HTMLElement>('.tier-item strong')
    const note = document.querySelector<HTMLElement>('.tier-item > span')
    if (description) description.textContent = longText
    if (title) title.textContent = longText.slice(0, 100)
    if (note) note.textContent = longText
  })
  await expectNoHorizontalOverflow(page)
})

test('new board controls fit and work without drag gestures', async ({ page }, testInfo) => {
  await page.goto('/new')
  await expect(page.getByRole('heading', { name: '새 티어표' })).toBeVisible()
  await page.getByLabel('제목').fill('테스트 음악 티어표')
  await page.getByLabel('카테고리').fill('음악')
  await page.getByRole('button', { name: /기본형/ }).click()
  await expect(page.getByLabel('1번째 행 이름')).toHaveValue('SS')
  await page.getByLabel('SS 아래로 이동').click()
  await expect(page.getByLabel('1번째 행 이름')).toHaveValue('S')
  await expectNoHorizontalOverflow(page)
  await expectSubmitBarDoesNotCoverRows(page)

  for (const locator of [
    page.locator('.wordmark'),
    page.getByRole('button', { name: /기본형/ }),
    page.getByLabel('S 아래로 이동', { exact: true }),
    page.getByLabel('1번째 행 색상'),
    page.getByLabel('SS 삭제'),
  ]) {
    const box = await locator.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }

  await page.screenshot({
    path: `test-results/${testInfo.project.name}-new-board.png`,
    fullPage: true,
  })
})

test('Turnstile gate renders on the production creation route', async ({ page }) => {
  test.skip(!externalBaseUrl, '운영 Turnstile 위젯 로드를 확인하는 배포 후 검증입니다.')

  await page.goto('/new')
  // Turnstile can put its iframe in a closed shadow root. Check the rendered
  // browser frame instead of depending on the provider's internal DOM layout.
  await expect.poll(async () => {
    const frame = page.frame({ url: /^https:\/\/challenges\.cloudflare\.com\// })
    return frame ? await frame.locator('body').isVisible() : false
  }, { timeout: 15_000 }).toBe(true)
})
