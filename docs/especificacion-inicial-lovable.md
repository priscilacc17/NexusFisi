# NexusFisi Hub

Desarrolla una aplicación web responsive llamada **NexusFisi**, una plataforma para gestionar y dar seguimiento a solicitudes y trámites académicos de la Facultad de Ingeniería de Sistemas e Informática (FISI) de la Universidad Nacional Mayor de San Marcos (UNMSM).

### 1. Objetivo
Crear un MVP funcional, moderno y fácil de usar para estudiantes y personal administrativo. Prioriza las funciones esenciales y evita implementar características innecesarias que aumenten la complejidad.

### 2. Diseño visual
- Interfaz universitaria profesional, limpia y moderna.
- Diseño responsive para computadoras, tablets y celulares.
- Barra lateral de navegación en escritorio y menú adaptable en móvil.
- Tarjetas informativas, tablas claras, formularios accesibles y estados visuales.
- Utiliza una paleta coherente de azul oscuro, turquesa, blanco y grises suaves.
- Toda la interfaz debe estar en español.
- Usa componentes reutilizables y mantén una apariencia consistente.

### 3. Roles de usuario
Implementa interfaces diferenciadas para:

**Estudiante**
- Ver su panel principal.
- Consultar los trámites disponibles y sus requisitos.
- Registrar una solicitud mediante un formulario.
- Adjuntar documentos de prueba.
- Consultar sus solicitudes, estados, fechas y observaciones.
- Ver el historial de movimientos de cada solicitud.
- Consultar mensajes relacionados con su solicitud.

**Personal administrativo**
- Ver una bandeja de solicitudes.
- Buscar y filtrar por código, tipo, estado y fecha.
- Abrir una solicitud y revisar sus datos y documentos.
- Cambiar el estado según las acciones permitidas.
- Registrar observaciones y solicitar correcciones.
- Asignar un responsable y registrar una respuesta.
- Comunicarse con el estudiante mediante mensajes asociados al expediente.

**Administrador**
- Consultar una pantalla básica de administración.
- Gestionar los tipos de trámite y visualizar usuarios de demostración.

### 4. Funcionalidades principales
1. Inicio de sesión y navegación según rol.
2. Dashboard con tarjetas de resumen.
3. Catálogo de trámites con descripción y requisitos.
4. Formulario para registrar solicitudes y validar campos obligatorios.
5. Listado de solicitudes con código único, fecha y estado.
6. Vista detallada con información, documentos, observaciones e historial.
7. Bandeja administrativa con filtros y acciones.
8. Mensajes asociados a cada solicitud.
9. Notificaciones visuales dentro de la aplicación.
10. Diseño preparado para incorporar posteriormente un asistente inteligente que oriente al estudiante sobre qué trámite elegir.

Estados iniciales: **Registrada, En evaluación, Observada, Asignada, En atención, Resuelta y Cerrada**. Permite cambios de estado coherentes y muestra el historial de cada cambio.

### 5. Datos y funcionamiento
Primero construye el frontend funcional con datos de demostración realistas. Si no hay backend conectado, usa un servicio de datos local claramente separado de los componentes visuales, con persistencia local cuando sea viable.

No simules que existe una API o una base de datos real. Organiza el código para permitir una integración posterior con React, Java Spring Boot, MySQL y una API REST.

Incluye datos de prueba para estudiantes, personal administrativo y varias solicitudes en diferentes estados. Si implementas acceso de demostración, indica claramente las credenciales de prueba y no lo presentes como autenticación segura de producción.

### 6. Reglas de calidad
- Los botones principales deben funcionar; no dejes controles decorativos que aparenten funcionar.
- Valida los formularios y muestra mensajes de error comprensibles.
- Incluye estados de carga, listas vacías y confirmaciones para acciones importantes.
- Usa componentes reutilizables y nombres claros.
- No inventes integraciones externas ni funciones de inteligencia artificial ya conectadas.
- No implementes pagos, firma digital ni integraciones con sistemas universitarios externos.
- Prioriza el flujo completo: registrar solicitud → revisarla → observarla si corresponde → corregirla → resolverla → consultar el resultado.

### 7. Forma de trabajo
Trabaja en etapas para reducir errores y consumo de créditos. Empieza por la estructura general, navegación, diseño visual, dashboards y datos de demostración. Después implementa el registro y seguimiento de solicitudes y, finalmente, la bandeja administrativa y los mensajes.

**En esta primera generación, céntrate en entregar una base visual navegable y funcional.** No intentes construir todo el backend en esta etapa. Conserva una estructura de proyecto ordenada y no reemplaces funcionalidades existentes sin necesidad.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8c0984ab-69f4-56e0-b43f-aa32efa91847).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
