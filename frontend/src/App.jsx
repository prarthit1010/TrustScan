import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import api, { setUnauthorizedHandler } from './api'
import Layout from './components/Layout'
import { ToastProvider } from './components/ui'
import AssignNew from './pages/AssignNew'
import AssignProgram from './pages/AssignProgram'
import CampaignEdit from './pages/CampaignEdit'
import Campaigns from './pages/Campaigns'
import Login from './pages/Login'
import Overview from './pages/Overview'
import ProductEdit from './pages/ProductEdit'
import Products from './pages/Products'
import QrBatchNew from './pages/QrBatchNew'
import QrDetails from './pages/QrDetails'
import QrGeneration from './pages/QrGeneration'
import Settings from './pages/Settings'

const Boot = () => <div className="boot"><span className="spinner lg" /></div>

function App() {
  // undefined = still checking the session, null = logged out
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
  }, [])

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {})
    setUser(null)
  }

  if (user === undefined) return <Boot />
  const guestOnly = (el) => (user ? <Navigate to="/" replace /> : el)

  // The customer mobile app (QR scanning, wallet) is a separate project in ../customer-app
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={guestOnly(<Login mode="login" onAuthed={setUser} />)} />
          <Route path="/register" element={guestOnly(<Login mode="register" onAuthed={setUser} />)} />
          <Route path="/" element={user ? <Layout user={user} onLogout={logout} /> : <Navigate to="/login" replace />}>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductEdit />} />
            <Route path="products/:id/edit" element={<ProductEdit />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/new" element={<CampaignEdit />} />
            <Route path="campaigns/:id/edit" element={<CampaignEdit />} />
            <Route path="qr-generation" element={<QrGeneration />} />
            <Route path="qr-generation/new" element={<QrBatchNew />} />
            <Route path="assign" element={<AssignProgram />} />
            <Route path="assign/new" element={<AssignNew />} />
            <Route path="qr-codes" element={<QrDetails />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
