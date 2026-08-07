import { useState, type FormEvent } from 'react'
import { signUp } from '../lib/api'

interface Props {
  onSignUp: (data: { name: string; vehicleId: string; city: string }) => void
  onBack: () => void
}

const CITIES = [
  'Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha',
  'Bloemfontein', 'Soweto', 'East London', 'Polokwane', 'Nelspruit',
]

export default function SignUp({ onSignUp, onBack }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', age: '', city: '', vehicleId: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const validateStep1 = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Enter your full name (min 2 characters)'
    const age = parseInt(form.age)
    if (!form.age || isNaN(age) || age < 18 || age > 70) errs.age = 'Age must be between 18 and 70'
    if (!form.city) errs.city = 'Please select your city of operation'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep2 = () => {
    const errs: Record<string, string> = {}
    if (!form.vehicleId.trim()) errs.vehicleId = 'Vehicle ID is required'
    else if (!/^[A-Z0-9-]{4,}$/i.test(form.vehicleId)) errs.vehicleId = 'Invalid format — use e.g. TUK-JHB-2847'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'Minimum 8 characters required'
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => { if (validateStep1()) setStep(2) }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateStep2()) return
    setLoading(true)
    setServerError('')
    try {
      const driver = await signUp({
        name: form.name.trim(),
        age: form.age,
        city: form.city,
        vehicle_id: form.vehicleId.toUpperCase().trim(),
        password: form.password,
      })
      onSignUp({ name: driver.name, vehicleId: driver.vehicle_id, city: driver.city })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      if (msg.includes('already registered')) {
        setErrors(prev => ({ ...prev, vehicleId: 'This Vehicle ID is already registered. Try logging in.' }))
        setStep(2)
      } else {
        setServerError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#05080D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div className="circuit-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '25%', right: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(0,230,118,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '25%', left: '10%', width: '260px', height: '260px', background: 'radial-gradient(circle, rgba(0,184,217,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="oled-card animate-slide-up" style={{ width: '100%', maxWidth: '460px', padding: '40px 36px', position: 'relative' }}>
        <div className="scan-overlay" />

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <button onClick={onBack} style={{ background: 'none', border: '1px solid #1A2E42', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#5A7A94', fontSize: '12px', fontFamily: 'Exo 2', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              Back to Login
            </button>
            <span className="font-display shimmer-text" style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.1em' }}>TUKBMS</span>
          </div>
          <div className="font-display" style={{ fontSize: '20px', fontWeight: '700', color: '#E8F4FD' }}>Register New Vehicle</div>
          <div style={{ color: '#5A7A94', fontSize: '13px', marginTop: '4px' }}>Your data is saved securely to the TUKBMS database</div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
          {[1, 2].map(s => (
            <div key={s} style={{ flex: 1, height: '3px', borderRadius: '2px', background: step >= s ? '#00E676' : '#1A2E42', transition: 'background 0.4s ease', boxShadow: step >= s ? '0 0 8px rgba(0,230,118,0.4)' : 'none' }} />
          ))}
        </div>
        <div style={{ color: '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2', letterSpacing: '0.12em', marginBottom: '22px' }}>
          STEP {step} OF 2 — {step === 1 ? 'DRIVER PROFILE' : 'VEHICLE CREDENTIALS'}
        </div>

        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="DRIVER NAME" error={errors.name}>
              <input className="oled-input" placeholder="e.g. Amani Mwangi" value={form.name} onChange={set('name')} />
            </Field>
            <Field label="DRIVER AGE" error={errors.age}>
              <input className="oled-input" type="number" placeholder="e.g. 28" min="18" max="70" value={form.age} onChange={set('age')} />
            </Field>
            <Field label="CITY OF OPERATION" error={errors.city}>
              <div style={{ position: 'relative' }}>
                <select className="oled-select" value={form.city} onChange={set('city')}>
                  <option value="">Select city of operation...</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5A7A94" strokeWidth="2" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </Field>
            <button className="btn-primary" style={{ marginTop: '8px' }} onClick={handleNext} type="button">CONTINUE →</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="VEHICLE ID" error={errors.vehicleId} hint="Assigned to your e-tuktuk (e.g. TUK-JHB-2847)">
              <input className="oled-input" placeholder="TUK-JHB-2847" value={form.vehicleId} onChange={set('vehicleId')}
                style={{ textTransform: 'uppercase', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em' }} />
            </Field>
            <Field label="PASSWORD" error={errors.password} hint="Minimum 8 characters">
              <input className="oled-input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} autoComplete="new-password" />
            </Field>
            <Field label="CONFIRM PASSWORD" error={errors.confirm}>
              <input className="oled-input" type="password" placeholder="Re-enter password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
            </Field>

            {/* Password strength */}
            {form.password && (
              <div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[0, 1, 2, 3].map(i => {
                    const s = getStrength(form.password)
                    const cols = ['#FF3D00', '#FFB300', '#00B8D9', '#00E676']
                    return <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i < s ? cols[s - 1] : '#1A2E42', transition: 'background 0.3s' }} />
                  })}
                </div>
                <span style={{ color: '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2' }}>
                  Strength: {['', 'Weak — add uppercase & numbers', 'Fair', 'Good', 'Strong'][getStrength(form.password)]}
                </span>
              </div>
            )}

            {serverError && (
              <div style={{ background: 'rgba(255,61,0,0.07)', border: '1px solid rgba(255,61,0,0.3)', borderRadius: '8px', padding: '12px 14px', color: '#FF6B3D', fontSize: '13px' }}>
                {serverError}
              </div>
            )}

            {/* What gets saved notice */}
            <div style={{ background: 'rgba(0,184,217,0.05)', border: '1px solid rgba(0,184,217,0.15)', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00B8D9" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              <span style={{ color: '#5A7A94', fontSize: '11px', lineHeight: 1.5 }}>
                Your name, age, city, and Vehicle ID will be saved to the TUKBMS database. Your password is hashed — never stored in plain text.
              </span>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '4px' }} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#05080D', borderRadius: '50%', animation: 'spin-slow 0.7s linear infinite' }} />
                  REGISTERING TO DATABASE...
                </span>
              ) : 'REGISTER & CONTINUE'}
            </button>
          </form>
        )}

        {/* Corner decorations */}
        {['tl', 'tr', 'bl', 'br'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            top: pos.startsWith('t') ? '8px' : 'auto', bottom: pos.startsWith('b') ? '8px' : 'auto',
            left: pos.endsWith('l') ? '8px' : 'auto', right: pos.endsWith('r') ? '8px' : 'auto',
            width: '12px', height: '12px',
            borderTop: pos.startsWith('t') ? '2px solid #00E676' : 'none',
            borderBottom: pos.startsWith('b') ? '2px solid #00E676' : 'none',
            borderLeft: pos.endsWith('l') ? '2px solid #00E676' : 'none',
            borderRight: pos.endsWith('r') ? '2px solid #00E676' : 'none',
          }} />
        ))}
      </div>
    </div>
  )
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#5A7A94', fontSize: '11px', fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.15em', marginBottom: '8px' }}>{label}</label>
      {children}
      {hint && !error && <span style={{ color: '#3A5A74', fontSize: '11px', marginTop: '4px', display: 'block' }}>{hint}</span>}
      {error && <span style={{ color: '#FF6B3D', fontSize: '11px', marginTop: '4px', display: 'block' }}>⚠ {error}</span>}
    </div>
  )
}

function getStrength(p: string): number {
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}
