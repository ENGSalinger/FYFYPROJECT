import { useState, useEffect, useCallback } from 'react'
import { useBatteryData } from '../hooks/useBatteryData'
import {
  SOCGauge, CellVoltageBar, CellSOCBar, CurrentWidget,
  TemperatureWidget, SolarWidget, PackVoltageWidget, PackSOHWidget,
  LocationWidget, TimeSeriesChart,
} from '../components/Widgets'
import { getLatestReading, getHistory, downloadCSV, type BatteryReading, type HistoryReading } from '../lib/api'

interface Props {
  user: { name: string; vehicleId: string; city: string; age?: number }
  onLogout: () => void
}

function buildBatteryDataFromReading(reading: BatteryReading, simData: ReturnType<typeof useBatteryData>) {
  // Merge live ESP32 data with simulated fallback
  return {
    cells: [
      { id: 1, voltage: reading.cell1_voltage || simData.cells[0].voltage, soc: reading.cell1_soc || simData.cells[0].soc, soh: reading.cell1_soh || simData.cells[0].soh },
      { id: 2, voltage: reading.cell2_voltage || simData.cells[1].voltage, soc: reading.cell2_soc || simData.cells[1].soc, soh: reading.cell2_soh || simData.cells[1].soh },
      { id: 3, voltage: reading.cell3_voltage || simData.cells[2].voltage, soc: reading.cell3_soc || simData.cells[2].soc, soh: reading.cell3_soh || simData.cells[2].soh },
      { id: 4, voltage: reading.cell4_voltage || simData.cells[3].voltage, soc: reading.cell4_soc || simData.cells[3].soc, soh: reading.cell4_soh || simData.cells[3].soh },
    ],
    packVoltage: reading.pack_voltage || simData.packVoltage,
    current: reading.current_amps || simData.current,
    temperature: reading.temperature_c || simData.temperature,
    packSOC: reading.pack_soc || simData.packSOC,
    packSOH: reading.pack_soh || simData.packSOH,
    solarRadiation: reading.solar_radiation_wm2 || simData.solarRadiation,
    isCharging: reading.is_charging ?? simData.isCharging,
    location: {
      lat: reading.latitude || simData.location.lat,
      lng: reading.longitude || simData.location.lng,
      address: simData.location.address,
      speed: reading.speed_kmh || simData.location.speed,
    },
    timestamp: new Date(reading.recorded_at),
    connectionStatus: 'online' as const,
  }
}

function buildHistoryFromDB(dbHistory: HistoryReading[], simHistory: ReturnType<typeof useBatteryData>['history']) {
  if (!dbHistory.length) return simHistory
  return dbHistory.map(h => ({
    timestamp: new Date(h.recorded_at),
    packVoltage: h.pack_voltage,
    current: h.current_amps,
    packSOC: h.pack_soc,
    packSOH: 96,
    temperature: h.temperature_c,
    solarRadiation: h.solar_radiation_wm2,
  }))
}

export default function Dashboard({ user, onLogout }: Props) {
  const simData = useBatteryData()
  const [liveReading, setLiveReading] = useState<BatteryReading | null>(null)
  const [dbHistory, setDbHistory] = useState<HistoryReading[]>([])
  const [esp32Connected, setEsp32Connected] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportMonth, setExportMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState('')
  const [time, setTime] = useState(new Date())

  // Fetch live data from Supabase (ESP32 data)
  const fetchLive = useCallback(async () => {
    const reading = await getLatestReading(user.vehicleId)
    if (reading) {
      setLiveReading(reading)
      setEsp32Connected(true)
    }
  }, [user.vehicleId])

  const fetchHistory = useCallback(async () => {
    const hist = await getHistory(user.vehicleId, 40)
    if (hist.length > 0) setDbHistory(hist)
  }, [user.vehicleId])

  useEffect(() => {
    fetchLive()
    fetchHistory()
    const liveTimer = setInterval(fetchLive, 5000)
    const histTimer = setInterval(fetchHistory, 30000)
    const clockTimer = setInterval(() => setTime(new Date()), 1000)
    return () => { clearInterval(liveTimer); clearInterval(histTimer); clearInterval(clockTimer) }
  }, [fetchLive, fetchHistory])

  const data = liveReading ? buildBatteryDataFromReading(liveReading, simData) : simData
  const history = buildHistoryFromDB(dbHistory, simData.history)

  const alertLevel = data.packSOC < 20 ? 'critical' : data.temperature > 45 ? 'critical' : data.packSOC < 35 ? 'warn' : 'normal'

  const handleExportCSV = async () => {
    setExportLoading(true)
    setExportError('')
    try {
      await downloadCSV(user.vehicleId, exportMonth)
      setShowExport(false)
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  // Available months: last 12 months
  const availableMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' })
    return { value: `${y}-${m}`, label }
  })

  return (
    <div style={{ minHeight: '100vh', background: '#05080D', color: '#E8F4FD', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #1A2E42', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', gap: '14px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,13,0.95)', backdropFilter: 'blur(8px)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="8" width="18" height="12" rx="2" stroke="#00E676" strokeWidth="1.5" fill="rgba(0,230,118,0.05)" />
            <rect x="22" y="11" width="3" height="6" rx="1" fill="#00E676" opacity="0.7" />
            <path d="M15 10l-4 4h3l-2 4 6-6h-3l2-2z" fill="#00E676" />
          </svg>
          <span className="font-display shimmer-text" style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.12em' }}>TUKBMS</span>
        </div>

        {/* Vehicle ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#0B1117', border: '1px solid #1A2E42', borderRadius: '6px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5A7A94" strokeWidth="1.5">
            <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14l4 4v4a2 2 0 01-2 2h-2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
          </svg>
          <span className="font-mono" style={{ fontSize: '12px', color: '#00B8D9', letterSpacing: '0.08em' }}>{user.vehicleId}</span>
        </div>

        {/* Driver */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5A7A94', fontSize: '12px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          <span style={{ color: '#E8F4FD' }}>{user.name}</span>
          <span style={{ color: '#2A4464' }}>·</span>
          <span>{user.city}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* ESP32 connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: '#0B1117', border: `1px solid ${esp32Connected ? 'rgba(0,230,118,0.3)' : '#1A2E42'}`, borderRadius: '6px' }}>
          <div className={esp32Connected ? 'animate-blink' : ''} style={{ width: '6px', height: '6px', borderRadius: '50%', background: esp32Connected ? '#00E676' : '#3A5A74' }} />
          <span style={{ color: esp32Connected ? '#00E676' : '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.1em' }}>
            {esp32Connected ? 'ESP32 LIVE' : 'DEMO MODE'}
          </span>
        </div>

        {/* Alert */}
        {alertLevel !== 'normal' && (
          <div style={{ padding: '3px 10px', borderRadius: '6px', background: alertLevel === 'critical' ? 'rgba(255,61,0,0.1)' : 'rgba(255,179,0,0.1)', border: `1px solid ${alertLevel === 'critical' ? '#FF3D00' : '#FFB300'}`, color: alertLevel === 'critical' ? '#FF3D00' : '#FFB300', fontSize: '10px', fontFamily: 'Exo 2', fontWeight: '700', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className="animate-blink" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
            {data.packSOC < 20 ? 'LOW BATTERY' : 'HIGH TEMP'}
          </div>
        )}

        {/* Export CSV button */}
        <button onClick={() => setShowExport(true)} style={{ background: 'none', border: '1px solid #1A2E42', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#5A7A94', fontSize: '11px', fontFamily: 'Exo 2', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          CSV
        </button>

        {/* Clock */}
        <div className="font-mono" style={{ fontSize: '12px', color: '#5A7A94', letterSpacing: '0.05em' }}>
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        {/* Logout */}
        <button onClick={onLogout} style={{ background: 'none', border: '1px solid #1A2E42', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#5A7A94', fontSize: '11px', fontFamily: 'Exo 2', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          LOGOUT
        </button>
      </header>

      {/* Dashboard grid */}
      <main style={{ flex: 1, padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Row 1: Primary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
          <div className="oled-card glow-green" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={wt}>STATE OF CHARGE</div>
            <SOCGauge soc={data.packSOC} size={148} />
            <div style={{ color: '#5A7A94', fontSize: '11px', textAlign: 'center' }}>
              {data.isCharging ? '⚡ Solar charging active' : '→ Discharging · driving'}
            </div>
          </div>

          <div className="oled-card" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
            <div style={wt}>PACK VOLTAGE</div>
            <PackVoltageWidget voltage={data.packVoltage} />
            <Stat label="Config" value="4S NMC Li-ion" />
          </div>

          <div className="oled-card" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={wt}>CURRENT FLOW</div>
            <CurrentWidget current={data.current} isCharging={data.isCharging} />
          </div>

          <div className="oled-card" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={wt}>TEMPERATURE</div>
            <TemperatureWidget temp={data.temperature} />
            <Stat label="Ambient" value="28.0°C" />
          </div>

          <div className="oled-card" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={wt}>SOLAR RADIATION</div>
            <SolarWidget radiation={data.solarRadiation} />
            <Stat label="Panel" value="1.2 m²" />
          </div>

          <div className="oled-card" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={wt}>STATE OF HEALTH</div>
            <PackSOHWidget soh={data.packSOH} cells={data.cells} />
          </div>
        </div>

        {/* Row 2: Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '10px' }}>
          <div className="oled-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={wt}>CELL VOLTAGES</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#5A7A94', fontSize: '10px' }}>
                  ΔV: <span className="font-mono" style={{ color: '#00B8D9' }}>
                    {(Math.max(...data.cells.map(c => c.voltage)) - Math.min(...data.cells.map(c => c.voltage))).toFixed(3)}V
                  </span>
                </span>
                <div style={{ fontSize: '9px', color: '#3A5A74', fontFamily: 'Exo 2', padding: '2px 6px', border: '1px solid #1A2E42', borderRadius: '4px' }}>4S PACK</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'flex-end' }}>
              {data.cells.map(cell => <CellVoltageBar key={cell.id} cell={cell} />)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '12px', padding: '8px 10px', background: '#080F18', borderRadius: '6px', border: '1px solid #1A2E42' }}>
              <Stat label="Max" value={`${Math.max(...data.cells.map(c => c.voltage)).toFixed(3)}V`} color="#00E676" />
              <Stat label="Min" value={`${Math.min(...data.cells.map(c => c.voltage)).toFixed(3)}V`} color="#FFB300" />
              <Stat label="Avg" value={`${(data.cells.reduce((s, c) => s + c.voltage, 0) / 4).toFixed(3)}V`} color="#00B8D9" />
            </div>
          </div>

          <div className="oled-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={wt}>CELL STATE OF CHARGE</div>
              <div style={{ fontSize: '9px', color: '#3A5A74', fontFamily: 'Exo 2', padding: '2px 6px', border: '1px solid #1A2E42', borderRadius: '4px' }}>INDIVIDUAL</div>
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'flex-end', marginBottom: '14px' }}>
              {data.cells.map(cell => <CellSOCBar key={cell.id} cell={cell} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
              {data.cells.map(cell => {
                const color = cell.soc < 20 ? '#FF3D00' : cell.soc < 40 ? '#FFB300' : '#00E676'
                return (
                  <div key={cell.id} style={{ background: '#080F18', border: '1px solid #1A2E42', borderRadius: '6px', padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ color: '#3A5A74', fontSize: '9px', fontFamily: 'Exo 2' }}>CELL {cell.id}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '14px', color, fontWeight: '600' }}>{Math.round(cell.soc)}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Row 3: Location + chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '10px' }}>
          <div className="oled-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={wt}>VEHICLE LOCATION</div>
              <span className="font-mono" style={{ fontSize: '11px', color: '#00E676' }}>{data.location.speed.toFixed(1)} km/h</span>
            </div>
            <LocationWidget location={data.location} />
          </div>

          <div className="oled-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={wt}>HISTORICAL DATA — {esp32Connected ? 'SUPABASE DB' : 'SIMULATED'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="animate-blink" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00E676' }} />
                <span style={{ color: '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2', letterSpacing: '0.1em' }}>EVERY 2.5 MIN</span>
              </div>
            </div>
            <TimeSeriesChart history={history} />
          </div>
        </div>

        {/* Footer status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 14px', background: '#0B1117', borderRadius: '8px', border: '1px solid #1A2E42', fontSize: '10px', fontFamily: 'JetBrains Mono', flexWrap: 'wrap' }}>
          <Pill label="ESP32" value={esp32Connected ? 'CONNECTED' : 'AWAITING'} color={esp32Connected ? '#00E676' : '#5A7A94'} />
          <Sep />
          <Pill label="DATABASE" value="SUPABASE" color="#00B8D9" />
          <Sep />
          <Pill label="CELLS" value="4S NMC" color="#00B8D9" />
          <Sep />
          <Pill label="BMS" value="ACTIVE" color="#00E676" />
          <Sep />
          <Pill label="SOLAR" value={data.solarRadiation > 100 ? 'ACTIVE' : 'IDLE'} color={data.solarRadiation > 100 ? '#FFB300' : '#5A7A94'} />
          <Sep />
          <Pill label="SYNC" value={data.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} color="#5A7A94" />
          <div style={{ flex: 1 }} />
          <span style={{ color: '#2A4464' }}>TUKBMS · {user.vehicleId} · {user.city}</span>
        </div>
      </main>

      {/* CSV Export Modal */}
      {showExport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowExport(false) }}>
          <div className="oled-card animate-slide-up" style={{ width: '100%', maxWidth: '420px', padding: '32px', position: 'relative' }}>
            <div className="scan-overlay" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div className="font-display" style={{ fontSize: '18px', fontWeight: '700', color: '#E8F4FD' }}>Export Monthly Data</div>
                <div style={{ color: '#5A7A94', fontSize: '12px', marginTop: '4px' }}>Download as CSV — {user.vehicleId}</div>
              </div>
              <button onClick={() => setShowExport(false)} style={{ background: 'none', border: 'none', color: '#5A7A94', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>

            {/* Month selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#5A7A94', fontSize: '11px', fontFamily: 'Exo 2', letterSpacing: '0.15em', marginBottom: '8px' }}>SELECT MONTH</label>
              <div style={{ position: 'relative' }}>
                <select className="oled-select" value={exportMonth} onChange={e => setExportMonth(e.target.value)}>
                  {availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5A7A94" strokeWidth="2" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>

            {/* Schema preview */}
            <div style={{ background: '#080F18', border: '1px solid #1A2E42', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ color: '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2', letterSpacing: '0.12em', marginBottom: '8px' }}>CSV COLUMNS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['Date', 'Time', 'Pack V', 'Current', 'SOC%', 'SOH%', 'Temp°C', 'Solar W/m²', 'Lat', 'Lng', 'Speed', 'C1-C4 V', 'C1-C4 SOC', 'C1-C4 SOH'].map(col => (
                  <span key={col} style={{ background: 'rgba(0,184,217,0.08)', border: '1px solid rgba(0,184,217,0.15)', borderRadius: '4px', padding: '2px 6px', color: '#00B8D9', fontSize: '10px', fontFamily: 'JetBrains Mono' }}>{col}</span>
                ))}
              </div>
              <div style={{ color: '#3A5A74', fontSize: '10px', marginTop: '8px', fontFamily: 'Inter' }}>
                One row per 2.5-minute reading · 24 entries/hour · ~576 rows/day
              </div>
            </div>

            {exportError && (
              <div style={{ background: 'rgba(255,61,0,0.07)', border: '1px solid rgba(255,61,0,0.3)', borderRadius: '8px', padding: '10px 12px', color: '#FF6B3D', fontSize: '12px', marginBottom: '12px' }}>
                {exportError}
              </div>
            )}

            <button className="btn-primary" onClick={handleExportCSV} disabled={exportLoading}>
              {exportLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#05080D', borderRadius: '50%', animation: 'spin-slow 0.7s linear infinite' }} />
                  DOWNLOADING...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  DOWNLOAD CSV
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const wt: React.CSSProperties = { color: '#5A7A94', fontSize: '10px', fontFamily: 'Exo 2', fontWeight: '600', letterSpacing: '0.2em' }

function Stat({ label, value, color = '#5A7A94' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ color: '#3A5A74', fontSize: '9px', fontFamily: 'Exo 2', letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color, fontWeight: '500', marginTop: '1px' }}>{value}</span>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ color: '#3A5A74' }}>{label}</span>
      <span style={{ color: '#2A4464' }}>·</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

function Sep() {
  return <div style={{ width: '1px', height: '14px', background: '#1A2E42' }} />
}
