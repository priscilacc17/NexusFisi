// Plazos en días hábiles, contados con el calendario de Lima (lunes a viernes).
// Los feriados no se descuentan todavía: el plazo es una estimación que se
// comunica como tal, no un vencimiento legal.

export const ZONA = "America/Lima";
const DIA_MS = 24 * 60 * 60 * 1000;

const diaSemana = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, weekday: "short" });
const anioLima = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, year: "numeric" });

export function esDiaHabil(fecha: Date): boolean {
  const d = diaSemana.format(fecha);
  return d !== "Sat" && d !== "Sun";
}

export function sumarDiasHabiles(desde: Date, dias: number): Date {
  if (!Number.isInteger(dias) || dias < 0) throw new Error("dias debe ser un entero >= 0");
  let fecha = new Date(desde.getTime());
  let contados = 0;
  while (contados < dias) {
    fecha = new Date(fecha.getTime() + DIA_MS);
    if (esDiaHabil(fecha)) contados++;
  }
  return fecha;
}

export function anioEnLima(fecha: Date): number {
  return Number(anioLima.format(fecha));
}

export function estaVencida(fechaLimite: Date, estado: string, ahora: Date): boolean {
  return estado !== "RESUELTA" && estado !== "CERRADA" && ahora.getTime() > fechaLimite.getTime();
}
