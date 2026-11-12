import { useEffect, useState } from 'react'
import api, { useAction } from '../api'
import { TextField } from './form'
import { Alert, Button } from './ui'

const digitsOnly = (v) => v.replace(/\D/g, '')

// WhatsApp OTP: mobile number -> code -> name (first login only)
export default function OtpLogin({ onLoggedIn }) {
  const [step, setStep] = useState('mobile')
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [signupToken, setSignupToken] = useState('')
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const send = useAction(async () => {
    const res = await api.post('/app/auth/otp/send', { mobile })
    setCode('')
    setResendIn(res.data.resendAfter)
    setStep('code')
  })

  const verify = useAction(async () => {
    const res = await api.post('/app/auth/otp/verify', { mobile, code })
    if (res.data.consumer) return onLoggedIn(res.data.consumer)
    setSignupToken(res.data.signupToken)
    setStep('name')
  })

  const signup = useAction(async () => {
    const res = await api.post('/app/auth/otp/signup', { signupToken, name })
    onLoggedIn(res.data.consumer)
  })

  if (step === 'mobile') {
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); send.run() }}>
        <Alert>{send.error}</Alert>
        <TextField label="WhatsApp number" required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10}
          prefix="+91" inputClassName="m-phone" placeholder="98765 43210"
          value={mobile} onChange={(e) => setMobile(digitsOnly(e.target.value))} />
        <Button type="submit" size="lg" className="btn-block" loading={send.loading}>Send code on WhatsApp</Button>
      </form>
    )
  }

  if (step === 'code') {
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); verify.run() }}>
        <Alert>{verify.error || send.error}</Alert>
        <TextField label={`Code sent to +91 ${mobile}`} required type="text" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} placeholder="6-digit code" autoFocus
          value={code} onChange={(e) => setCode(digitsOnly(e.target.value))} />
        <Button type="submit" size="lg" className="btn-block" loading={verify.loading}>Verify and log in</Button>
        <p className="m-switch">
          {resendIn > 0
            ? `Resend code in ${resendIn}s`
            : <button type="button" disabled={send.loading} onClick={() => { verify.setError(''); send.run() }}>Resend code</button>}
          {' · '}
          <button type="button" onClick={() => { verify.setError(''); send.setError(''); setStep('mobile') }}>Change number</button>
        </p>
      </form>
    )
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); signup.run() }}>
      <Alert>{signup.error}</Alert>
      <TextField label="Your name" required autoComplete="name" placeholder="Full name" maxLength={100} autoFocus
        value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" size="lg" className="btn-block" loading={signup.loading}>Create account</Button>
    </form>
  )
}
