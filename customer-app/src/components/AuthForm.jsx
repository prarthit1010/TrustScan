import { useState } from 'react'
import { useEffect } from 'react' // TEST LOGIN
import api from '../api' // TEST LOGIN
import OtpLogin from './OtpLogin'
import TestLogin from './TestLogin' // TEST LOGIN
import { useConsumer } from './ConsumerContext'

// Customer login, used on its own page and inline on the scan result page. A first login creates the account.
export default function AuthForm({ onAuthed }) {
  const { setConsumer } = useConsumer()
  const [method, setMethod] = useState('whatsapp')
  const [testEnabled, setTestEnabled] = useState(false) // TEST LOGIN

  useEffect(() => { api.get('/app/auth/test-login').then((r) => setTestEnabled(r.data.enabled)).catch(() => {}) }, []) // TEST LOGIN

  const handleLoggedIn = (consumer) => {
    setConsumer(consumer)
    onAuthed?.(consumer)
  }

  return (
    <div className="stack">
      <div className="m-tabs">
        <button type="button" className={method === 'whatsapp' ? 'active' : ''} onClick={() => setMethod('whatsapp')}>WhatsApp</button>
        {/* SMS OTP is waiting on a provider */}
        <button type="button" disabled>SMS (soon)</button>
        {testEnabled && <button type="button" className={method === 'test' ? 'active' : ''} onClick={() => setMethod('test')}>Test</button> /* TEST LOGIN */}
      </div>
      {method === 'whatsapp' && <OtpLogin onLoggedIn={handleLoggedIn} />}
      {method === 'test' && <TestLogin onLoggedIn={handleLoggedIn} /> /* TEST LOGIN */}
    </div>
  )
}
