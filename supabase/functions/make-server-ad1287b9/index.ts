import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();
app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// Supabase admin client (uses service role key from env)
function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ── Health check ──────────────────────────────────────────────────────────
app.get("/make-server-ad1287b9/health", (c) => c.json({ status: "ok" }));

// ── AUTH: Sign Up ────────────────────────────────────────────────────────────
app.post("/make-server-ad1287b9/signup", async (c) => {
  const body = await c.req.json();
  const { name, age, city, vehicle_id, password } = body;

  if (!name || !age || !city || !vehicle_id || !password) {
    return c.json({ error: "All fields are required." }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters." }, 400);
  }

  const supabase = getAdminClient();

  // Check if vehicle_id already registered
  const { data: existing } = await supabase
    .from("drivers")
    .select("id")
    .eq("vehicle_id", vehicle_id.toUpperCase())
    .single();

  if (existing) {
    return c.json({ error: "Vehicle ID is already registered." }, 409);
  }

  // Hash password using Web Crypto (SHA-256 + salt)
  const salt = crypto.randomUUID();
  const hash = await hashPassword(password, salt);

  const { data, error } = await supabase.from("drivers").insert({
    name: name.trim(),
    age: parseInt(age),
    city: city.trim(),
    vehicle_id: vehicle_id.toUpperCase().trim(),
    password_hash: hash,
    password_salt: salt,
    registered_at: new Date().toISOString(),
  }).select().single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true, driver: { id: data.id, name: data.name, vehicle_id: data.vehicle_id, city: data.city } });
});

// ── AUTH: Log In ─────────────────────────────────────────────────────────────
app.post("/make-server-ad1287b9/login", async (c) => {
  const body = await c.req.json();
  const { vehicle_id, password } = body;

  if (!vehicle_id || !password) {
    return c.json({ error: "Vehicle ID and password are required." }, 400);
  }

  const supabase = getAdminClient();

  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("vehicle_id", vehicle_id.toUpperCase().trim())
    .single();

  if (!driver) {
    return c.json({ error: "No account found for this Vehicle ID. Please sign up first." }, 404);
  }

  const hash = await hashPassword(password, driver.password_salt);
  if (hash !== driver.password_hash) {
    return c.json({ error: "Incorrect password. Please try again." }, 401);
  }

  // Update last login
  await supabase.from("drivers").update({ last_login: new Date().toISOString() }).eq("id", driver.id);

  return c.json({
    success: true,
    driver: { id: driver.id, name: driver.name, vehicle_id: driver.vehicle_id, city: driver.city, age: driver.age },
  });
});
//What is happening
// ── ESP32: Ingest battery reading ─────────────────────────────────────────────
app.post("/make-server-ad1287b9/ingest", async (c) => {
  const apiKey = c.req.header("x-api-key");
  if (apiKey !== Deno.env.get("ESP32_API_KEY") && apiKey !== "TUKBMS-ESP32-2024") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const supabase = getAdminClient();
  const now = new Date();

  const record = {
    vehicle_id: (body.vehicle_id || "UNKNOWN").toUpperCase(),
    recorded_at: body.timestamp || now.toISOString(),
    month_year: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    pack_voltage: Number(body.pack_voltage) || 0,
    current_amps: Number(body.current_amps) || 0,
    is_charging: Boolean(body.is_charging),
    pack_soc: Number(body.pack_soc) || 0,
    pack_soh: Number(body.pack_soh) || 0,
    temperature_c: Number(body.temperature_c) || 0,
    solar_radiation_wm2: Number(body.solar_radiation_wm2) || 0,
    latitude: Number(body.latitude) || 0,
    longitude: Number(body.longitude) || 0,
    speed_kmh: Number(body.speed_kmh) || 0,
    cell1_voltage: Number(body.cell1_voltage) || 0,
    cell2_voltage: Number(body.cell2_voltage) || 0,
    cell3_voltage: Number(body.cell3_voltage) || 0,
    cell4_voltage: Number(body.cell4_voltage) || 0,
    cell1_soc: Number(body.cell1_soc) || 0,
    cell2_soc: Number(body.cell2_soc) || 0,
    cell3_soc: Number(body.cell3_soc) || 0,
    cell4_soc: Number(body.cell4_soc) || 0,
    cell1_soh: Number(body.cell1_soh) || 0,
    cell2_soh: Number(body.cell2_soh) || 0,
    cell3_soh: Number(body.cell3_soh) || 0,
    cell4_soh: Number(body.cell4_soh) || 0,
  };

  const { error } = await supabase.from("battery_readings").insert(record);
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ success: true, recorded_at: record.recorded_at });
});

// ── Readings: latest for vehicle ──────────────────────────────────────────────
app.get("/make-server-ad1287b9/readings/latest/:vehicle_id", async (c) => {
  const vid = c.req.param("vehicle_id").toUpperCase();
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("battery_readings")
    .select("*")
    .eq("vehicle_id", vid)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();
  return c.json({ data });
});

// ── Readings: history for chart ───────────────────────────────────────────────
app.get("/make-server-ad1287b9/readings/history/:vehicle_id", async (c) => {
  const vid = c.req.param("vehicle_id").toUpperCase();
  const limit = parseInt(c.req.query("limit") || "40");
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("battery_readings")
    .select("recorded_at,pack_voltage,current_amps,pack_soc,temperature_c,solar_radiation_wm2")
    .eq("vehicle_id", vid)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  return c.json({ data: (data || []).reverse() });
});

// ── Export: monthly CSV data ──────────────────────────────────────────────────
app.get("/make-server-ad1287b9/export/:vehicle_id/:month_year", async (c) => {
  const vid = c.req.param("vehicle_id").toUpperCase();
  const my = c.req.param("month_year"); // e.g. "2024-09"
  const supabase = getAdminClient();

  const { data } = await supabase
    .from("battery_readings")
    .select("*")
    .eq("vehicle_id", vid)
    .eq("month_year", my)
    .order("recorded_at", { ascending: true });

  if (!data || data.length === 0) {
    return c.json({ error: "No data for this month." }, 404);
  }

  const headers = [
    "Date", "Time",
    "Pack Voltage (V)", "Current (A)", "Charging",
    "Pack SOC (%)", "Pack SOH (%)",
    "Temperature (°C)", "Solar Radiation (W/m²)",
    "Latitude", "Longitude", "Speed (km/h)",
    "Cell1 V", "Cell2 V", "Cell3 V", "Cell4 V",
    "Cell1 SOC%", "Cell2 SOC%", "Cell3 SOC%", "Cell4 SOC%",
    "Cell1 SOH%", "Cell2 SOH%", "Cell3 SOH%", "Cell4 SOH%",
  ].join(",");

  const rows = data.map(r => {
    const dt = new Date(r.recorded_at);
    const date = dt.toLocaleDateString("en-GB");
    const time = dt.toLocaleTimeString("en-GB");
    return [
      date, time,
      r.pack_voltage, r.current_amps, r.is_charging ? "Yes" : "No",
      r.pack_soc, r.pack_soh,
      r.temperature_c, r.solar_radiation_wm2,
      r.latitude, r.longitude, r.speed_kmh,
      r.cell1_voltage, r.cell2_voltage, r.cell3_voltage, r.cell4_voltage,
      r.cell1_soc, r.cell2_soc, r.cell3_soc, r.cell4_soc,
      r.cell1_soh, r.cell2_soh, r.cell3_soh, r.cell4_soh,
    ].join(",");
  });

  const csv = [headers, ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="TUKBMS_${vid}_${my}.csv"`,
    },
  });
});

// ── Drivers log (admin view of sign-ups) ─────────────────────────────────────
app.get("/make-server-ad1287b9/drivers", async (c) => {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("drivers")
    .select("id, name, age, city, vehicle_id, registered_at, last_login")
    .order("registered_at", { ascending: false });
  return c.json({ data });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(app.fetch);
