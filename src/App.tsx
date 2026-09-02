import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BoardPage } from './pages/BoardPage'
import { HomePage } from './pages/HomePage'
import { NewBoardPage } from './pages/NewBoardPage'
import { NotFoundPage } from './pages/NotFoundPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/new" element={<NewBoardPage />} />
          <Route path="/t/:slug" element={<BoardPage />} />
          <Route path="/create" element={<Navigate to="/new" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
