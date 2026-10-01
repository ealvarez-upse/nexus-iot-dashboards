import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Bell,
  BatteryCharging,
  Building2,
  CheckCircle2,
  Droplets,
  Fan,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogIn,
  Moon,
  RadioTower,
  Server,
  ShieldCheck,
  Snowflake,
  Sun,
  Table2,
  Terminal,
  Thermometer,
  Waves,
  Wifi,
  Wind,
  Warehouse,
} from "lucide-react";

const ROTATING = ["Temperatura", "Humedad", "Refrigeración", "Aire acondicionado"];

const MOCK_24H = Array.from({ length: 48 }, (_, i) => ({
  ts: i,
  temperature: +(4 + 1.6 * Math.sin((i / 96) * Math.PI * 6)).toFixed(2),
  humidity: +(62 + 6 * Math.sin((i / 60) * Math.PI * 4 + 1)).toFixed(1),
}));

const APPLICATIONS = [
  { icon: Snowflake, title: "Habitaciones frías", desc: "Cadena de frío bajo control con umbrales claros y alarmas automáticas." },
  { icon: Building2, title: "Oficinas y locales", desc: "Confort térmico y humedad para tus espacios de trabajo." },
  { icon: Server, title: "Cuartos de servidores", desc: "Vigila temperatura crítica de racks y cuartos técnicos." },
  { icon: Warehouse, title: "Almacenes y bodegas", desc: "Cobertura total de zonas de almacenamiento sin cableado." },
  { icon: Fan, title: "Cuartos técnicos HVAC", desc: "Estado de equipos de climatización y ventilación." },
  { icon: Waves, title: "Piscinas y spas", desc: "Temperatura del agua y humedad ambiental en tiempo real." },
];

const STEPS = [
  { icon: Thermometer, title: "1 · Sensor BLE", desc: "Los sensores Joyway miden temperatura y humedad y transmiten por Bluetooth." },
  { icon: RadioTower, title: "2 · Gateway", desc: "El gateway JW1602G4 recibe todos los sensores y publica vía HTTP." },
  { icon: LayoutDashboard, title: "3 · Plataforma", desc: "Imind IoT ingresa la telemetría, evalúa umbrales y dibuja gráficas en vivo." },
  { icon: Bell, title: "4 · Alarmas", desc: "Si algo sale de rango, tu equipo recibe una alarma y actúa a tiempo." },
];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % ROTATING.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block text-primary">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="inline-block"
        >
          {ROTATING[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <img src="/imind-logo.png" alt="Imind IoT" className={className} />
  );
}

function DashboardMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className="card-layered rounded-2xl border border-border/60 bg-card p-4"
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutDashboard className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Cuarto Frío 1 · En vivo</p>
            <p className="text-[11px] text-muted-foreground">Actualizado ahora</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <Wifi className="size-3" /> En línea
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {[
          { icon: Thermometer, label: "Temperatura", value: "4.2", unit: "°C", color: "#0891b2" },
          { icon: Droplets, label: "Humedad", value: "62", unit: "%", color: "#0d9488" },
          { icon: BatteryCharging, label: "Batería", value: "87", unit: "%", color: "#ca8a04" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl bg-secondary/60 p-3">
            <div className="flex items-center gap-1.5">
              <m.icon className="size-3.5" style={{ color: m.color }} />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
            </div>
            <p className="mt-1 font-mono text-xl font-bold">
              {m.value}
              <span className="ml-0.5 text-xs font-medium text-muted-foreground">{m.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-secondary/40 p-3">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">Temperatura · últimas 24 h · límite 6 °C</p>
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MOCK_24H} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="hero-temp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="temperature"
                stroke="#0891b2"
                strokeWidth={2}
                fill="url(#hero-temp)"
                isAnimationActive={false}
                dot={false}
              />
              <ReferenceLine
                y={6}
                stroke="#dc2626"
                strokeDasharray="5 4"
                label={{ value: "límite", fill: "#dc2626", fontSize: 10, position: "insideTopRight" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const { isDark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-auto" />
            <div className="leading-tight">
              <p className="font-bold tracking-tight">Imind IoT</p>
              <p className="text-[11px] text-muted-foreground">Monitoreo HVAC</p>
            </div>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
            <a href="#aplicaciones" className="transition hover:text-foreground">Aplicaciones</a>
            <a href="#datos" className="transition hover:text-foreground">Datos</a>
            <a href="#hardware" className="transition hover:text-foreground">Hardware</a>
            <a href="#plataforma" className="transition hover:text-foreground">Plataforma</a>
            <a href="#como-funciona" className="transition hover:text-foreground">Cómo funciona</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {isAuthenticated ? (
              <Button asChild>
                <Link to="/app">
                  Ir a la plataforma <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link to="/auth">Crear cuenta</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">
                    <LogIn className="mr-1.5 size-4" /> Iniciar sesión
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-dotgrid relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                <Wifi className="size-3.5" /> Monitoreo remoto 24/7 · Sensores BLE + Gateway
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl"
            >
              Monitoreo remoto para ambientes HVAC
              <br />
              <RotatingWord />
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
            >
              Sensores inalámbricos de temperatura y humedad, gateways con conexión
              directa y dashboards en tiempo real. Una plataforma propia, simple de
              operar y pensada para tu equipo.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link to="/auth">
                  Iniciar sesión <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#aplicaciones">¿Qué quieres monitorear?</a>
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-10 grid max-w-lg grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4"
            >
              {[
                { v: "24/7", l: "Monitoreo continuo" },
                { v: "-20~+60°C", l: "Rango de medición" },
                { v: "0~100%", l: "Humedad relativa" },
                { v: "100 m", l: "Alcance BLE" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-mono text-lg font-bold text-foreground">{s.v}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </motion.div>
          </div>
          <DashboardMock />
        </div>
      </section>

      {/* Aplicaciones */}
      <section id="aplicaciones" className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">¿Qué quieres monitorear?</h2>
            <p className="mt-3 text-muted-foreground">
              Un mismo sistema, infinidad de aplicaciones. Estos son los ambientes
              que nuestros clientes ya vigilan con Imind IoT.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {APPLICATIONS.map((a, i) => (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              >
                <Card className="card-layered h-full p-6 transition hover:border-primary/40">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <a.icon className="size-5" />
                  </div>
                  <p className="mt-4 font-semibold">{a.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{a.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tus datos son tuyos */}
      <section id="datos" className="relative overflow-hidden bg-zinc-950 text-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-300">
              <ShieldCheck className="size-3.5" /> Plataforma propia
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Tus datos son tuyos. Punto.
            </h2>
            <p className="mt-4 max-w-lg leading-7 text-zinc-400">
              A diferencia de plataformas cerradas, Imind IoT corre sobre tu
              infraestructura: controlas el acceso, el historial y la información
              generada por tus sensores.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Historial completo de telemetría, sin muestreos ocultos",
                "Roles de administrador y equipo con acceso controlado",
                "API HTTP abierta compatible con tus integraciones",
                "Alarmas por umbral con registro y confirmación",
                "Sin dependencia de proveedores para ver tus propios datos",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-400" />
                  <span className="text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: "100%", l: "Propiedad de tus datos" },
              { v: "1 min", l: "Frecuencia de actualización" },
              { v: "∞", l: "Dispositivos según tu plan" },
              { v: "HTTP", l: "API de ingesta abierta" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="font-mono text-3xl font-bold text-teal-300">{s.v}</p>
                <p className="mt-1.5 text-sm text-zinc-400">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hardware */}
      <section id="hardware" className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Hardware que ya conoces</h2>
            <p className="mt-3 text-muted-foreground">
              Sensores y gateways de Joyway, integrados de fábrica con nuestra plataforma.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {[
              {
                icon: Thermometer,
                name: "Joyway JW1407HT",
                tag: "Sensor BLE",
                specs: [
                  "Temperatura: -20 a +60 °C",
                  "Humedad: 0 a 100 %HR",
                  "Bluetooth 5.0 · hasta 100 m",
                  "Batería de larga duración (años)",
                ],
              },
              {
                icon: RadioTower,
                name: "Joyway JW1602G4",
                tag: "Gateway WiFi / 4G",
                specs: [
                  "Recibe todos los sensores BLE cercanos",
                  "Publica telemetría vía HTTP a la plataforma",
                  "WiFi y respaldo 4G opcional",
                  "Instalación en minutos, sin cableado de datos",
                ],
              },
            ].map((p) => (
              <Card key={p.name} className="card-layered p-7">
                <div className="flex items-start justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <p.icon className="size-6" />
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {p.tag}
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold">{p.name}</p>
                <ul className="mt-3 space-y-2">
                  {p.specs.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {s}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="mt-5" asChild>
                  <Link to="/auth">Consultar <ArrowRight className="ml-1.5 size-4" /></Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Plataforma */}
      <section id="plataforma" className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">La plataforma</h2>
            <p className="mt-3 text-muted-foreground">
              Todo lo que tu equipo necesita para operar el monitoreo día a día.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Gauge,
                title: "Dashboards en tiempo real",
                desc: "Constructor visual de widgets: series temporales, valores actuales, indicadores y estado de batería, con colores y tamaños configurables.",
              },
              {
                icon: Table2,
                title: "Gestión tipo ThingsBoard",
                desc: "Tablas de dispositivos y alarmas con búsqueda, filtros y acciones rápidas. Familiares para quien ya usaba ThingsBoard, con mejores gráficas.",
              },
              {
                icon: Terminal,
                title: "API HTTP compatible",
                desc: "Publica telemetría con un simple POST /api/v1/{token}/telemetry. Formato compatible con ThingsBoard: tu gateway no cambia.",
              },
              {
                icon: KeyRound,
                title: "Equipo y roles",
                desc: "El administrador gestiona usuarios y roles; tu equipo construye dashboards y conecta dispositivos sin fricción.",
              },
            ].map((f) => (
              <Card key={f.title} className="card-layered p-7">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <p className="mt-4 font-semibold">{f.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona + API */}
      <section id="como-funciona" className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Cómo funciona</h2>
            <p className="mt-3 text-muted-foreground">
              De la sonda al dashboard en cuatro pasos.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <Card key={s.title} className="card-layered p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <p className="mt-3.5 text-sm font-semibold">{s.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>

          <div className="card-layered mt-12 overflow-hidden rounded-2xl border border-border/60">
            <div className="grid lg:grid-cols-2">
              <div className="p-7 md:p-9">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Wind className="size-3.5" /> API de ingesta
                </span>
                <h3 className="mt-4 text-2xl font-bold tracking-tight">
                  Compatible con tu instalación actual
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Tu gateway ya sabe publicar telemetría vía HTTP. Solo cambia la URL
                  de destino por la de Imind IoT con el token de tu dispositivo — el
                  payload no necesita ningún cambio.
                </p>
              </div>
              <div className="relative bg-zinc-950 p-5 md:p-7">
                <pre className="overflow-x-auto font-mono text-[12px] leading-6 text-zinc-100">
{`curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"temperature":23.5,"humidity":54}' \\
  https://TU-DOMINIO/api/v1/TU_TOKEN/telemetry

# {"status":"ok","count":2}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="card-layered relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-10 text-center md:p-14">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Empieza a monitorear en minutos
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Crea tu cuenta, registra tu gateway y tus sensores BLE, y construye tu
              primer dashboard hoy mismo.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Iniciar sesión <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#hardware">Conocer el hardware</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-auto" />
            <div className="leading-tight">
              <p className="text-sm font-bold">Imind IoT</p>
              <p className="text-[11px] text-muted-foreground">Monitoreo HVAC</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Imind IoT · Plataforma propia de monitoreo y control HVAC
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="#aplicaciones" className="hover:text-foreground">Aplicaciones</a>
            <a href="#plataforma" className="hover:text-foreground">Plataforma</a>
            <Link to="/auth" className="hover:text-foreground">Iniciar sesión</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
