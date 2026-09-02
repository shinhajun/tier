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
  await expect(page.getByRole('heading', { name: '좋아하는 것들을, 내 기준대로.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /우주와 미래를 그린 영화/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.getByRole('link', { name: /우주와 미래를 그린 영화/ }).click()
  await expect(page.getByRole('heading', { name: '우주와 미래를 그린 영화' })).toBeVisible()
  await expect(page.getByText('인터스텔라', { exact: true })).toBeVisible()
  await expect(page.getByText('프로젝트 헤일메리', { exact: true })).toBeVisible()
  await expect(page.getByText('스파이더맨: 브랜드 뉴 데이', { exact: true })).toBeVisible()
  await expect(page.getByText('아바타: 불과 재', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.screenshot({
    path: `test-results/${testInfo.project.name}-movie-board.png`,
    fullPage: true,
  })

  await page.evaluate(() => {
    const longText = '아'.repeat(300)
    const description = document.querySelector<HTMLElement>('.board-header__copy > p:not(.eyebrow)')
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
  await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toBeVisible({ timeout: 15_000 })
})
