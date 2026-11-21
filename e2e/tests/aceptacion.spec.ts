import { expect, test } from "@playwright/test";
import { abrir, confirmar, ingresar, pdf, salir } from "./apoyo";

// Criterios de aceptación de las historias de usuario, ejecutados en un navegador
// real contra la aplicación completa (interfaz + API + MySQL).
test.describe.configure({ mode: "serial" });

const sufijo = Date.now().toString().slice(-6);
const estudiante = {
  nombre: "Mariana Soto Ruiz",
  email: `mariana.soto${sufijo}@unmsm.edu.pe`,
  codigo: `24${sufijo}`,
  clave: "Segura2026",
};
let codigo = "";

test("HU01 · registro de estudiante: valida los datos y crea la cuenta", async ({ page }) => {
  await abrir(page, "/registro");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Ingresa tu nombre completo.")).toBeVisible();
  await page.fill("#nombre", estudiante.nombre);
  await page.fill("#email", estudiante.email);
  await page.fill("#codigo", estudiante.codigo);
  await page.selectOption("#facultad", {
    label: "Facultad de Ingeniería de Sistemas e Informática",
  });
  await page.selectOption("#escuela", { label: "Ingeniería de Software" });
  await page.fill("#pw", estudiante.clave);
  await page.fill("#pw2", estudiante.clave);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
});

test("HU04 · datos incompletos: muestra validación y no registra", async ({ page }) => {
  await ingresar(page, estudiante.email, estudiante.clave);
  await abrir(page, "/app/nueva");
  await page.getByRole("button", { name: "Registrar solicitud" }).click();
  await expect(page.getByText("Selecciona un tipo de trámite.")).toBeVisible();
  await expect(page.getByText("Adjunta al menos un documento.")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/nueva/);
});

test("HU04 · registro correcto: código único y estado Registrada", async ({ page }) => {
  await ingresar(page, estudiante.email, estudiante.clave);
  await abrir(page, "/app/nueva");
  await page.selectOption("#type", { label: "Constancia de estudios" });
  await page.fill("#subject", "Constancia para beca de investigación");
  await page.fill(
    "#desc",
    "Necesito la constancia de estudios para postular a la beca de investigación del semestre.",
  );
  await page.setInputFiles('input[type="file"]', pdf("dni.pdf"));
  await page.getByRole("button", { name: "Registrar solicitud" }).click();
  await page.waitForURL(/\/app\/solicitudes\/FISI-\d{4}-\d{5}/);
  codigo = page.url().split("/").pop()!;
  await expect(page.getByText("Registrada").first()).toBeVisible();
  await expect(page.getByText("dni.pdf")).toBeVisible();
});

test("HU05 · el supervisor evalúa y observa (la nota es obligatoria)", async ({ page }) => {
  await ingresar(page, "supervisor.fisi@unmsm.edu.pe");
  await abrir(page, `/app/solicitudes/${codigo}`);
  await confirmar(page, "Iniciar evaluación");
  await page.getByRole("button", { name: "Observar / pedir corrección" }).click();
  const dialogo = page.getByRole("alertdialog");
  await dialogo.getByRole("button").last().click();
  await expect(dialogo.getByText("Escribe al menos 10 caracteres.")).toBeVisible();
  await dialogo
    .locator("textarea")
    .fill("El DNI adjunto no es legible. Adjunta una versión escaneada en mejor calidad.");
  await dialogo.getByRole("button").last().click();
  await dialogo.waitFor({ state: "detached" });
  await expect(page.getByText("Observada").first()).toBeVisible();
});

test("HU06 · el estudiante recibe la notificación y envía la corrección", async ({ page }) => {
  await ingresar(page, estudiante.email, estudiante.clave);
  await page.getByRole("button", { name: /Notificaciones/ }).click();
  await expect(page.getByText(`Tu solicitud ${codigo} fue observada`)).toBeVisible();
  await page.keyboard.press("Escape");
  await abrir(page, `/app/solicitudes/${codigo}`);
  await page.fill("#correction", "Adjunto nuevamente mi DNI escaneado en alta calidad.");
  await page.setInputFiles('input[type="file"]', pdf("dni_corregido.pdf"));
  await page.getByRole("button", { name: "Enviar corrección" }).click();
  await expect(page.getByText("Tu solicitud fue observada")).toBeHidden();
  await expect(page.getByText("En evaluación").first()).toBeVisible();
});

test("HU07 · el supervisor asigna con prioridad y el técnico resuelve con evidencia", async ({
  page,
}) => {
  await ingresar(page, "supervisor.fisi@unmsm.edu.pe");
  await abrir(page, `/app/solicitudes/${codigo}`);
  await confirmar(page, "Asignar responsable", async (d) => {
    const valor = await d
      .locator("#responsable option", { hasText: "Jorge Medina" })
      .getAttribute("value");
    await d.locator("#responsable").selectOption(valor!);
    await d.locator("#prioridad").selectOption("ALTA");
  });
  await expect(page.getByText("Asignada").first()).toBeVisible();
  await salir(page);

  await ingresar(page, "tecnico.fisi@unmsm.edu.pe");
  await abrir(page, `/app/solicitudes/${codigo}`);
  await confirmar(page, "Iniciar atención");
  await page.setInputFiles('input[type="file"]', pdf("constancia.pdf"));
  await page.getByRole("button", { name: "Subir documentos" }).click();
  await expect(page.getByText("constancia.pdf")).toBeVisible();
  await confirmar(page, "Resolver", async (d) => {
    await d
      .locator("#respuesta")
      .fill("Se emitió la constancia de estudios; la encontrarás adjunta en el expediente.");
  });
  await expect(page.getByText("Resultado del trámite")).toBeVisible();
});

test("HU08 · el estudiante descarga el resultado y da conformidad", async ({ page }) => {
  await ingresar(page, estudiante.email, estudiante.clave);
  await abrir(page, `/app/solicitudes/${codigo}`);
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar constancia.pdf" }).click();
  expect((await descarga).suggestedFilename()).toBe("constancia.pdf");
  await confirmar(page, "Estoy conforme · cerrar");
  await expect(page.getByText("Cerrada con conformidad del estudiante")).toBeVisible();
});

test("Autorización · un estudiante no abre expedientes ajenos ni la bandeja", async ({ page }) => {
  await ingresar(page, "estudiante2.fisi@unmsm.edu.pe");
  await abrir(page, `/app/solicitudes/${codigo}`);
  await expect(page.getByText("Solicitud no encontrada")).toBeVisible();
  await abrir(page, "/app/bandeja");
  await expect(page.getByText("Sección para el personal administrativo")).toBeVisible();
});

test("Autorización · el supervisor de otra facultad no ve la solicitud", async ({ page }) => {
  await ingresar(page, "supervisor.fm@unmsm.edu.pe");
  await abrir(page, `/app/solicitudes/${codigo}`);
  await expect(page.getByText("Solicitud no encontrada")).toBeVisible();
});

test("Seguridad · credenciales incorrectas muestran un mensaje genérico", async ({ page }) => {
  await abrir(page, "/");
  await page.fill("#email", "supervisor.fisi@unmsm.edu.pe");
  await page.fill("#pw", "Incorrecta1");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
});

test("Seguridad · la sesión viaja en una cookie HttpOnly, no en el navegador", async ({
  page,
  context,
}) => {
  await ingresar(page, "supervisor.fisi@unmsm.edu.pe");
  const cookie = (await context.cookies()).find((c) => c.name === "nexus_sesion");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const almacenado = await page.evaluate(() => JSON.stringify(localStorage));
  expect(almacenado).not.toMatch(/eyJ/); // ningún JWT en localStorage
});
