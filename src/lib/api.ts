import { projectId, publicAnonKey } from '../../utils/supabase/info'

// Edge function base URL
export const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ad1287b9`

// Direct Supabase REST API base (for realtime & direct queries)
export const SUPABASE_URL = `https://${projectId}.supabase.co`
export const SUPABASE_ANON_KEY = publicAnonKey

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      ...(options?.headers || {}),
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface Driver {
  id: string
  name: string
  age: number
  vehicle_id: string
  city: string
}

export async function signUp(data: {
  name: string; age: string; city: string; vehicle_id: string; password: string
}): Promise<Driver> {
  const res = await apiFetch('/signup', { method: 'POST', body: JSON.stringify(data) })
  return res.driver
}

export async function logIn(vehicle_id: string, password: string): Promise<Driver> {
  const res = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ vehicle_id, password }) })
  return res.driver
}

// ── Readings ─────────────────────────────────────────────────────────────────

export interface BatteryReading {
  id: number
  vehicle_id: string
  recorded_at: string
  month_year: string
  pack_voltage: number
  current_amps: number
  is_charging: boolean
  pack_soc: number
  pack_soh: number
  temperature_c: number
  solar_radiation_wm2: number
  latitude: number
  longitude: number
  speed_kmh: number
  cell1_voltage: number
  cell2_voltage: number
  cell3_voltage: number
  cell4_voltage: number
  cell1_soc: number
  cell2_soc: number
  cell3_soc: number
  cell4_soc: number
  cell1_soh: number
  cell2_soh: number
  cell3_soh: number
  cell4_soh: number
}

export interface HistoryReading {
  recorded_at: string
  pack_voltage: number
  current_amps: number
  pack_soc: number
  temperature_c: number
  solar_radiation_wm2: number
}

export async function getLatestReading(vehicle_id: string): Promise<BatteryReading | null> {
  try {
    const res = await apiFetch(`/readings/latest/${encodeURIComponent(vehicle_id)}`)
    return res.data
  } catch {
    return null
  }
}

export async function getHistory(vehicle_id: string, limit = 40): Promise<HistoryReading[]> {
  try {
    const res = await apiFetch(`/readings/history/${encodeURIComponent(vehicle_id)}?limit=${limit}`)
    return res.data || []
  } catch {
    return []
  }
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export function exportCSVUrl(vehicle_id: string, month_year: string): string {
  return `${SERVER_URL}/export/${encodeURIComponent(vehicle_id)}/${month_year}?authorization=Bearer ${publicAnonKey}`
}

export async function downloadCSV(vehicle_id: string, month_year: string) {
  const url = `${SERVER_URL}/export/${encodeURIComponent(vehicle_id)}/${month_year}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error((j as { error?: string }).error || 'No data for this month')
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `TUKBMS_${vehicle_id}_${month_year}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Supabase Realtime subscription (raw REST polling fallback) ────────────────
export function subscribeToReadings(
  vehicle_id: string,
  onData: (reading: BatteryReading) => void
): () => void {
  let active = true

  const poll = async () => {
    while (active) {
      const reading = await getLatestReading(vehicle_id).catch(() => null)
      if (reading) onData(reading)
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  poll()
  return () => { active = false }
}
