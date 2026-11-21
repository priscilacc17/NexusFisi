import { expect, type Page } from "@playwright/test";

export const CLAVE = "Demo1234";

// Espera a que la página esté hidratada (React ya maneja los formularios).
export async function abrir(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle");
}

export async function ingresar(page: Page, email: string, clave = CLAVE) {
  await abrir(page, "/");
  await page.fill("#email", email);
  await page.fill("#pw", clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/app");
  await expect(page.getByRole("heading", { name: "Panel principal" })).toBeVisible();
}

export async function salir(page: Page) {
  await page
    .getByRole("button", { name: "Cerrar sesión" })
    .first()
    .click({ trial: false })
    .catch(async () => {
      // En pantallas pequeñas el botón está dentro del menú.
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await page.getByRole("button", { name: "Cerrar sesión" }).click();
    });
  await page.waitForURL((u) => new URL(u).pathname === "/");
}

// Ejecuta una acción del flujo que abre un diálogo de confirmación.
export async function confirmar(
  page: Page,
  boton: string,
  rellenar?: (d: ReturnType<Page["getByRole"]>) => Promise<void>,
) {
  await page.getByRole("button", { name: boton, exact: true }).first().click();
  const dialogo = page.getByRole("alertdialog");
  await dialogo.waitFor();
  if (rellenar) await rellenar(dialogo);
  await dialogo.getByRole("button").last().click();
  await dialogo.waitFor({ state: "detached" });
}

export const pdf = (nombre: string) => ({
  name: nombre,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4\n% ${nombre}\n%%EOF\n`),
});
