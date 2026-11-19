import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, selectClass } from "@/components/app/common";
import { AreasTab, TramitesTab } from "@/components/app/admin/CatalogoTabs";
import { FacultadesTab, FlujoReferencia } from "@/components/app/admin/FacultadesTab";
import { UsuariosTab } from "@/components/app/admin/UsuariosTab";
import { useFacultadesAdmin } from "@/lib/api/queries";
import { useUsuario } from "@/lib/session";

export const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Administración · NexusFisi" },
      { name: "description", content: "Usuarios, roles, trámites, áreas y facultades." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const user = useUsuario();
  const central = user.rol === "ADMIN" && !user.facultad;
  const facs = useFacultadesAdmin(central);
  const [facSel, setFacSel] = useState<number | undefined>();
  const [tab, setTab] = useState("usuarios");

  if (user.rol !== "ADMIN")
    return (
      <EmptyState
        title="Sección exclusiva para administradores"
        action={
          <Button asChild size="sm">
            <Link to="/app">Ir al panel</Link>
          </Button>
        }
      />
    );

  // El administrador de facultad siempre trabaja sobre la suya. El central elige;
  // trámites y áreas necesitan una facultad concreta.
  const facultadId = central ? facSel : user.facultad?.id;
  const necesitaFacultad = central && !facSel && (tab === "tramites" || tab === "areas");

  return (
    <>
      <PageHeader
        title="Administración"
        subtitle={
          central
            ? "Administración central · Universidad Nacional Mayor de San Marcos"
            : user.facultad?.nombre
        }
        action={
          central ? (
            <select
              aria-label="Facultad a administrar"
              className={`${selectClass} sm:w-80`}
              value={facSel ?? ""}
              onChange={(e) => setFacSel(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Todas las facultades</option>
              {facs.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codigo} · {f.nombre}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="usuarios">Usuarios y roles</TabsTrigger>
          <TabsTrigger value="tramites">Tipos de trámite</TabsTrigger>
          <TabsTrigger value="areas">Áreas responsables</TabsTrigger>
          <TabsTrigger value="facultades">{central ? "Facultades" : "Mi facultad"}</TabsTrigger>
          <TabsTrigger value="flujo">Estados y prioridades</TabsTrigger>
        </TabsList>
        {necesitaFacultad ? (
          <EmptyState
            title="Elige una facultad"
            text="Los trámites y las áreas pertenecen a una facultad. Selecciónala arriba a la derecha."
          />
        ) : (
          <>
            <TabsContent value="usuarios">
              <UsuariosTab yo={user} facultadId={facultadId} />
            </TabsContent>
            <TabsContent value="tramites">
              <TramitesTab key={facultadId} facultadId={facultadId} />
            </TabsContent>
            <TabsContent value="areas">
              <AreasTab key={facultadId} facultadId={facultadId} />
            </TabsContent>
          </>
        )}
        <TabsContent value="facultades">
          <FacultadesTab central={central} />
        </TabsContent>
        <TabsContent value="flujo">
          <FlujoReferencia />
        </TabsContent>
      </Tabs>
    </>
  );
}
