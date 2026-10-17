import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/session";
import hero from "@/assets/login-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexusFisi · Trámites académicos de Fisioterapia" },
      { name: "description", content: "Registra y da seguimiento a tus solicitudes y trámites académicos de la Facultad de Fisioterapia." },
      { property: "og:title", content: "NexusFisi · Trámites académicos" },
      { property: "og:description", content: "Plataforma de solicitudes y trámites de la Facultad de Fisioterapia." },
    ],
  }),
  component: LoginPage,
});

const DEMO = [
  { role: "Estudiante", email: "estudiante@nexusfisi.edu" },
  { role: "Personal administrativo", email: "personal@nexusfisi.edu" },
  { role: "Administrador", email: "admin@nexusfisi.edu" },
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Ingresa tu correo y contraseña.");
    setLoading(true);
    setTimeout(() => {
      const u = login(email, password);
      setLoading(false);
      if (!u) return setError("Correo o contraseña incorrectos.");
      navigate({ to: "/app" });
    }, 400);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand lg:block">
        <img src={hero} alt="Estudiantes de fisioterapia en clase práctica" className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-luminosity" width={1280} height={1600} />
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <h2 className="text-4xl font-bold leading-tight">Tus trámites académicos,<br />claros y a tiempo.</h2>
          <p className="mt-4 max-w-md opacity-85">Registra solicitudes, adjunta documentos y sigue cada paso de tu expediente en la Facultad de Fisioterapia.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand font-bold text-primary-foreground">NF</div>
            <div><h1 className="text-2xl font-bold">NexusFisi</h1><p className="text-sm text-muted-foreground">Facultad de Fisioterapia</p></div>
          </div>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5"><Label htmlFor="email">Correo institucional</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@nexusfisi.edu" /></div>
            <div className="space-y-1.5"><Label htmlFor="pw">Contraseña</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Ingresar</Button>
          </form>
          <div className="mt-8 rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-warning" />Acceso de demostración</p>
            <p className="mt-1 text-xs text-muted-foreground">No es autenticación segura. Contraseña para todos: <span className="font-mono font-semibold text-foreground">demo123</span></p>
            <div className="mt-3 space-y-1.5">
              {DEMO.map((d) => (
                <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword("demo123"); setError(""); }} className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs hover:border-accent hover:bg-accent/10">
                  <span className="font-semibold">{d.role}</span><span className="font-mono text-muted-foreground">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
