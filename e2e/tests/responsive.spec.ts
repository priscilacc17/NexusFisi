import { expect, test } from "@playwright/test";
import { ingresar } from "./apoyo";

// Prueba de usabilidad en celular: el menú lateral se vuelve desplegable.
test("Responsive · en celular el menú se abre y navega", async ({ page }) => {
  await ingresar(page, "estudiante.fisi@unmsm.edu.pe");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeHidden();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Mis solicitudes" }).click();
  await expect(page.getByRole("heading", { name: "Mis solicitudes" })).toBeVisible();
});
