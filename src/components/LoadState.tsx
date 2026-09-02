export function LoadingState({ label = '티어표를 불러오는 중입니다.' }: { label?: string }) {
  return (
    <div className="load-state" role="status">
      <span className="load-state__line" />
      <span className="load-state__line load-state__line--short" />
      <span className="visually-hidden">{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <strong>불러오지 못했습니다.</strong>
      <p>{message}</p>
      {onRetry ? (
        <button className="text-button" type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  )
}
