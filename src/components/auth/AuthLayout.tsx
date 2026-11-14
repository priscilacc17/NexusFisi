import type { ReactNode } from "react";
import { BellRing, Building2, FileCheck2, Route as RouteIcon } from "lucide-react";

// Marco común de inicio de sesión y registro: panel de marca a la izquierda.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand lg:block">
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <p className="mb-6 text-sm font-semibold uppercase tracking-widest opacity-80">Universidad Nacional Mayor de San Marcos</p>
          <h2 className="text-4xl font-bold leading-tight">Tus trámites académicos,<br />claros y a tiempo.</h2>
          <p className="mt-4 max-w-md opacity-85">Registra solicitudes, adjunta documentos y sigue cada paso de tu expediente en tu facultad, desde cualquier lugar.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: Building2, text: "Cada facultad gestiona sus propios trámites y su personal" },
              { icon: FileCheck2, text: "Consulta los requisitos y registra tu solicitud en línea" },
              { icon: RouteIcon, text: "Sigue el estado, el plazo y el historial de tu expediente" },
              { icon: BellRing, text: "Recibe avisos y mensajes del personal a cargo" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15"><f.icon className="h-4 w-4" /></span>{f.text}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand font-bold text-primary-foreground">NF</div>
            <div><h1 className="text-2xl font-bold">NexusFisi</h1><p className="text-sm text-muted-foreground">Trámites académicos · UNMSM</p></div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
