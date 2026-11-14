import type { Logger } from "pino";
import type { Env } from "../config/env.js";
import type { Db } from "../db/client.js";
import type { Rol } from "../db/schema.js";
import type { Actor } from "../domain/workflow.js";
import type { Mailer } from "./mailer.js";
import type { Almacen } from "./storage.js";

export interface Sesion extends Actor {
  nombre: string;
  email: string;
  rol: Rol;
}

export interface AppEnv {
  Variables: {
    usuario: Sesion;
    requestId: string;
  };
}

// Dependencias de la aplicación. `now` se inyecta para poder probar plazos y
// vencimientos sin depender del reloj real.
export interface Deps {
  db: Db;
  env: Env;
  logger: Logger;
  now: () => Date;
  almacen: Almacen;
  mailer: Mailer;
}
