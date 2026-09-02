import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '../components/Icons'

export function NotFoundPage() {
  return (
    <section className="status-page page-width">
      <p className="eyebrow">404</p>
      <h1>이 티어표는 찾을 수 없습니다.</h1>
      <p>주소가 바뀌었거나 삭제된 티어표일 수 있어요.</p>
      <Link className="text-link" to="/">
        <ArrowLeftIcon />
        둘러보기로 돌아가기
      </Link>
    </section>
  )
}
