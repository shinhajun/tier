import { useEffect, useRef, useState } from 'react'

type TurnstileOptions = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  theme: 'light'
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loader: Promise<TurnstileApi> | null = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loader) return loader

  loader = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tier-turnstile]')
    const script = existing ?? document.createElement('script')

    const ready = () => {
      if (window.turnstile) resolve(window.turnstile)
      else {
        loader = null
        script.remove()
        reject(new Error('보안 확인 모듈을 불러오지 못했습니다.'))
      }
    }
    const failed = () => {
      loader = null
      script.remove()
      reject(new Error('보안 확인 모듈을 불러오지 못했습니다.'))
    }
    script.addEventListener('load', ready, { once: true })
    script.addEventListener('error', failed, { once: true })

    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.defer = true
      script.dataset.tierTurnstile = 'true'
      document.head.append(script)
    }
  })

  return loader
}

export function TurnstileGate({
  onToken,
}: {
  onToken: (token: string | null) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
  const configurationError = sitekey ? '' : '보안 확인 사이트 키가 설정되지 않았습니다.'

  useEffect(() => {
    let widgetId: string | null = null
    let active = true

    if (!sitekey) {
      return undefined
    }

    void loadTurnstile()
      .then((turnstile) => {
        if (!active || !host.current) return
        widgetId = turnstile.render(host.current, {
          sitekey,
          theme: 'light',
          callback: (token) => {
            setError('')
            onToken(token)
          },
          'expired-callback': () => {
            onToken(null)
            setError('보안 확인이 만료되었습니다. 다시 확인해 주세요.')
          },
          'error-callback': () => {
            onToken(null)
            setError('보안 확인을 완료하지 못했습니다.')
          },
        })
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : '보안 확인을 시작하지 못했습니다.')
      })

    return () => {
      active = false
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [attempt, onToken, sitekey])

  return (
    <div className="turnstile-gate">
      <div ref={host} />
      {error || configurationError ? (
        <div className="turnstile-gate__error" role="alert">
          <p>{error || configurationError}</p>
          {sitekey ? (
            <button
              type="button"
              onClick={() => {
                setError('')
                onToken(null)
                setAttempt((current) => current + 1)
              }}
            >
              다시 시도
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
