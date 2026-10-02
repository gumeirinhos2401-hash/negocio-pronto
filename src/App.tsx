import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { ForgotPassword, ResetPassword, SignIn, SignUp, VerifyEmail } from './pages/Auth'
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
import { DataProvider } from './storage/DataProvider'

// Everything inside the shell belongs to an account: no session, no page.
function ShellLayout() {
  const { user } = useAuth()
  if (user === undefined) return <p className="estado-pagina" role="status">A carregar…</p>
  if (user === null) return <Navigate to="/entrar" replace />
  return (
    <DataProvider key={user.id}>
      <AppShell>
        <Outlet />
      </AppShell>
    </DataProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/entrar" element={<SignIn />} />
            <Route path="/criar-conta" element={<SignUp />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route path="/repor" element={<ResetPassword />} />
            <Route path="/verificar" element={<VerifyEmail />} />
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
      </AuthProvider>
    </ToastProvider>
  )
}
