/** Formatea un timestamp como hora local HH:mm */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formatea un timestamp como fecha y hora corta */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Hace cuánto ocurrió algo, en texto humano */
export function timeAgo(ts: number | undefined): string {
  if (!ts) return "nunca";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min === 1) return "hace 1 min";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h === 1) return "hace 1 h";
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

/** Un dispositivo está "en línea" si reportó hace menos de 10 minutos */
export function isOnline(lastSeenAt: number | undefined): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt < 10 * 60 * 1000;
}

/** Elige el icono según la clave de telemetría */
export function unitSuffix(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("temp")) return "°C";
  if (k.includes("hum")) return "%";
  if (k.includes("bat")) return "%";
  if (k.includes("rssi")) return "dBm";
  return "";
}
