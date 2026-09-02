import { chromium } from '@playwright/test'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL
const supabaseUrl = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!baseUrl || !supabaseUrl || !publishableKey) {
  throw new Error('Production browser smoke environment is incomplete.')
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await context.addInitScript(() => {
  Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => undefined })
})
const page = await context.newPage()

const suffix = Date.now().toString(36)
const originalTitle = `배포 검증 ${suffix}`
const editedTitle = `${originalTitle} 수정`
let slug = ''

async function waitUntilEnabled(locator, timeout = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await locator.isEnabled()) return
    await page.waitForTimeout(500)
  }
  throw new Error('Turnstile did not produce a usable anonymous-auth token.')
}

try {
  await page.goto(new URL('/new', baseUrl).toString())
  await page.getByLabel('제목').fill(originalTitle)
  await page.getByLabel('카테고리').fill('검증')

  const create = page.getByRole('button', { name: '티어표 만들기' })
  await waitUntilEnabled(create)
  await create.click()

  await page.waitForURL((url) => url.pathname.startsWith('/t/'))
  slug = new URL(page.url()).pathname.split('/').pop() ?? ''
  if (!slug) throw new Error('Created board URL did not include a slug.')
  await page.getByRole('heading', { name: originalTitle }).waitFor({ state: 'visible' })

  await page.getByRole('button', { name: '편집' }).click()
  await page.getByRole('textbox', { name: '제목' }).fill(editedTitle)
  await page.getByPlaceholder('작품, 곡, 대상 이름').fill('연결 검증 항목')
  await page.getByRole('button', { name: '추가', exact: true }).click()

  const rowMoveTarget = await page.getByRole('combobox', { name: '행 이동' }).boundingBox()
  if (!rowMoveTarget || rowMoveTarget.height < 44) {
    throw new Error('Editor row-move target is smaller than 44px.')
  }

  await page.getByRole('button', { name: '변경 내용 저장' }).click()
  await page.getByRole('heading', { name: editedTitle }).waitFor({ state: 'visible' })
  await page.getByText('연결 검증 항목').waitFor({ state: 'visible' })
} finally {
  try {
    if (slug) await page.evaluate(async ({ key, slugToDelete, url }) => {
      const storageKey = Object.keys(localStorage).find((candidate) => candidate.endsWith('-auth-token'))
      const rawSession = storageKey ? localStorage.getItem(storageKey) : null
      const accessToken = rawSession ? JSON.parse(rawSession).access_token : null
      if (!accessToken) throw new Error('Cleanup could not read the owner session.')

      const headers = { apikey: key, Authorization: `Bearer ${accessToken}` }
      const boardResponse = await fetch(
        `${url}/rest/v1/tier_boards?slug=eq.${encodeURIComponent(slugToDelete)}&select=id`,
        { headers },
      )
      if (!boardResponse.ok) throw new Error(`Cleanup lookup failed: ${boardResponse.status}`)
      const boards = await boardResponse.json()
      if (!boards[0]?.id) throw new Error('Cleanup could not find the created board.')

      const deleteResponse = await fetch(`${url}/rest/v1/rpc/delete_tier_board`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_board_id: boards[0].id }),
      })
      if (!deleteResponse.ok) throw new Error(`Cleanup delete failed: ${deleteResponse.status}`)

      const verifyResponse = await fetch(
        `${url}/rest/v1/tier_boards?slug=eq.${encodeURIComponent(slugToDelete)}&select=id`,
        { headers },
      )
      if (!verifyResponse.ok) throw new Error(`Cleanup verification failed: ${verifyResponse.status}`)
      if ((await verifyResponse.json()).length !== 0) throw new Error('Cleanup board still exists.')
    }, { key: publishableKey, slugToDelete: slug, url: supabaseUrl })
  } finally {
    await browser.close()
  }
}

console.log(JSON.stringify({ captchaAuth: true, create: true, edit: true, cleanup: true }))
