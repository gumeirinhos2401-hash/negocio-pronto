import { HashRouter, Route, Routes } from 'react-router-dom'

// Placeholder until the app shell and pages are added.
function Placeholder() {
  return (
    <main>
      <h1>Negócio Pronto</h1>
      <p>A aplicação está a ser preparada.</p>
    </main>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </HashRouter>
  )
}
