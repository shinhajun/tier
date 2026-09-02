import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',
  reporter: 'line',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
        url: 'http://127.0.0.1:4175',
        reuseExistingServer: false,
        timeout: 30_000,
      },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        channel: 'chrome',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'small-mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        channel: 'chrome',
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
      },
    },
  ],
})
