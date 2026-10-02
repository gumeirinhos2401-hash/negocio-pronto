import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import CalendarPage from './pages/CalendarPage'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import More from './pages/More'
import NotFound from './pages/NotFound'
import Plans from './pages/Plans'
import PostGenerator from './pages/PostGenerator'
import Quotes from './pages/Quotes'
import Replies from './pages/Replies'
import Settings from './pages/Settings'

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<ShellLayout />}>
            <Route path="/painel" element={<Dashboard />} />
            <Route path="/publicacoes" element={<PostGenerator />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/respostas" element={<Replies />} />
            <Route path="/orcamentos" element={<Quotes />} />
            <Route path="/definicoes" element={<Settings />} />
            <Route path="/planos" element={<Plans />} />
            <Route path="/mais" element={<More />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  )
}
