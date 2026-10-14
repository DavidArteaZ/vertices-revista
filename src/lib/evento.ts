/**
 * Cómo se escriben los datos del evento de lanzamiento, igual en /registro y
 * en el correo de confirmación: si uno cambia y el otro no, la persona lee dos
 * versiones del mismo evento.
 */

export function fechaEvento(fecha: string | null): string {
  if (!fecha) return "fecha por definir";
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(anio, mes - 1, dia, 12)));
}

/** "15:00:00" → "3:00 pm". A mano porque Intl escribe "p.m." con espacios raros según el motor. */
export function horaEvento(hora: string | null): string | null {
  const m = hora?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

export function ubicacionEvento(ubicacion: string | null): string {
  return ubicacion?.trim() || "ubicación por definir";
}
