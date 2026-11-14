CREATE TABLE `adjuntos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`solicitud_id` int NOT NULL,
	`nombre_original` varchar(200) NOT NULL,
	`nombre_almacenado` varchar(80) NOT NULL,
	`mime` varchar(60) NOT NULL,
	`tamano` int NOT NULL,
	`etapa` enum('REGISTRO','CORRECCION','ATENCION') NOT NULL,
	`subido_por` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `adjuntos_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_adjuntos_almacenado` UNIQUE(`nombre_almacenado`)
);
--> statement-breakpoint
CREATE TABLE `areas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facultad_id` int NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`ubicacion` varchar(200) NOT NULL,
	`activa` boolean NOT NULL DEFAULT true,
	CONSTRAINT `areas_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_areas_facultad_nombre` UNIQUE(`facultad_id`,`nombre`)
);
--> statement-breakpoint
CREATE TABLE `escuelas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facultad_id` int NOT NULL,
	`nombre` varchar(160) NOT NULL,
	`activa` boolean NOT NULL DEFAULT true,
	CONSTRAINT `escuelas_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_escuelas_facultad_nombre` UNIQUE(`facultad_id`,`nombre`)
);
--> statement-breakpoint
CREATE TABLE `facultades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(12) NOT NULL,
	`nombre` varchar(160) NOT NULL,
	`activa` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `facultades_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_facultades_codigo` UNIQUE(`codigo`),
	CONSTRAINT `uq_facultades_nombre` UNIQUE(`nombre`)
);
--> statement-breakpoint
CREATE TABLE `mensajes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`solicitud_id` int NOT NULL,
	`autor_id` int NOT NULL,
	`texto` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `mensajes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimientos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`solicitud_id` int NOT NULL,
	`usuario_id` int NOT NULL,
	`accion` varchar(120) NOT NULL,
	`estado_desde` enum('REGISTRADA','EN_EVALUACION','OBSERVADA','ASIGNADA','EN_ATENCION','RESUELTA','CERRADA'),
	`estado_hasta` enum('REGISTRADA','EN_EVALUACION','OBSERVADA','ASIGNADA','EN_ATENCION','RESUELTA','CERRADA'),
	`nota` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `movimientos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuario_id` int NOT NULL,
	`solicitud_id` int,
	`texto` varchar(255) NOT NULL,
	`leida` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `notificaciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `observaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`solicitud_id` int NOT NULL,
	`autor_id` int NOT NULL,
	`texto` text NOT NULL,
	`resuelta` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`resuelta_at` datetime(3),
	CONSTRAINT `observaciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `secuencias` (
	`facultad_id` int NOT NULL,
	`anio` int NOT NULL,
	`ultimo` int NOT NULL,
	CONSTRAINT `secuencias_facultad_id_anio_pk` PRIMARY KEY(`facultad_id`,`anio`)
);
--> statement-breakpoint
CREATE TABLE `solicitudes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(24) NOT NULL,
	`facultad_id` int NOT NULL,
	`tipo_id` int NOT NULL,
	`estudiante_id` int NOT NULL,
	`responsable_id` int,
	`asunto` varchar(120) NOT NULL,
	`descripcion` text NOT NULL,
	`estado` enum('REGISTRADA','EN_EVALUACION','OBSERVADA','ASIGNADA','EN_ATENCION','RESUELTA','CERRADA') NOT NULL DEFAULT 'REGISTRADA',
	`estado_previo` enum('REGISTRADA','EN_EVALUACION','OBSERVADA','ASIGNADA','EN_ATENCION','RESUELTA','CERRADA'),
	`prioridad` enum('BAJA','MEDIA','ALTA','URGENTE') NOT NULL DEFAULT 'MEDIA',
	`respuesta` text,
	`tipo_cierre` enum('CONFORME','DESISTIDA','SUPERVISOR'),
	`reaperturas` int NOT NULL DEFAULT 0,
	`fecha_limite` datetime(3) NOT NULL,
	`resuelta_at` datetime(3),
	`cerrada_at` datetime(3),
	`version` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `solicitudes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_solicitudes_codigo` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `tipos_tramite` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facultad_id` int NOT NULL,
	`area_id` int NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`descripcion` varchar(500) NOT NULL,
	`requisitos` json NOT NULL,
	`plazo_dias` int NOT NULL,
	`activo` boolean NOT NULL DEFAULT true,
	CONSTRAINT `tipos_tramite_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_tipos_facultad_nombre` UNIQUE(`facultad_id`,`nombre`)
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`email` varchar(160) NOT NULL,
	`password_hash` varchar(100) NOT NULL,
	`rol` enum('ESTUDIANTE','TECNICO','SUPERVISOR','ADMIN') NOT NULL,
	`facultad_id` int,
	`escuela_id` int,
	`area_id` int,
	`codigo_estudiante` varchar(10),
	`activo` boolean NOT NULL DEFAULT true,
	`intentos_fallidos` int NOT NULL DEFAULT 0,
	`bloqueado_hasta` datetime(3),
	`token_version` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `usuarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_usuarios_email` UNIQUE(`email`),
	CONSTRAINT `uq_usuarios_codigo_estudiante` UNIQUE(`codigo_estudiante`)
);
--> statement-breakpoint
ALTER TABLE `adjuntos` ADD CONSTRAINT `adjuntos_solicitud_id_solicitudes_id_fk` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adjuntos` ADD CONSTRAINT `adjuntos_subido_por_usuarios_id_fk` FOREIGN KEY (`subido_por`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `areas` ADD CONSTRAINT `areas_facultad_id_facultades_id_fk` FOREIGN KEY (`facultad_id`) REFERENCES `facultades`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `escuelas` ADD CONSTRAINT `escuelas_facultad_id_facultades_id_fk` FOREIGN KEY (`facultad_id`) REFERENCES `facultades`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensajes` ADD CONSTRAINT `mensajes_solicitud_id_solicitudes_id_fk` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensajes` ADD CONSTRAINT `mensajes_autor_id_usuarios_id_fk` FOREIGN KEY (`autor_id`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `movimientos` ADD CONSTRAINT `movimientos_solicitud_id_solicitudes_id_fk` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `movimientos` ADD CONSTRAINT `movimientos_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_solicitud_id_solicitudes_id_fk` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `observaciones` ADD CONSTRAINT `observaciones_solicitud_id_solicitudes_id_fk` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `observaciones` ADD CONSTRAINT `observaciones_autor_id_usuarios_id_fk` FOREIGN KEY (`autor_id`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `secuencias` ADD CONSTRAINT `secuencias_facultad_id_facultades_id_fk` FOREIGN KEY (`facultad_id`) REFERENCES `facultades`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_facultad_id_facultades_id_fk` FOREIGN KEY (`facultad_id`) REFERENCES `facultades`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_tipo_id_tipos_tramite_id_fk` FOREIGN KEY (`tipo_id`) REFERENCES `tipos_tramite`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_estudiante_id_usuarios_id_fk` FOREIGN KEY (`estudiante_id`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `solicitudes` ADD CONSTRAINT `solicitudes_responsable_id_usuarios_id_fk` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tipos_tramite` ADD CONSTRAINT `tipos_tramite_facultad_id_facultades_id_fk` FOREIGN KEY (`facultad_id`) REFERENCES `facultades`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tipos_tramite` ADD CONSTRAINT `tipos_tramite_area_id_areas_id_fk` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_facultad_id_facultades_id_fk` FOREIGN KEY (`facultad_id`) REFERENCES `facultades`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_escuela_id_escuelas_id_fk` FOREIGN KEY (`escuela_id`) REFERENCES `escuelas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_area_id_areas_id_fk` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_adjuntos_solicitud` ON `adjuntos` (`solicitud_id`);--> statement-breakpoint
CREATE INDEX `ix_mensajes_solicitud` ON `mensajes` (`solicitud_id`);--> statement-breakpoint
CREATE INDEX `ix_movimientos_solicitud` ON `movimientos` (`solicitud_id`);--> statement-breakpoint
CREATE INDEX `ix_notificaciones_usuario` ON `notificaciones` (`usuario_id`,`leida`);--> statement-breakpoint
CREATE INDEX `ix_observaciones_solicitud` ON `observaciones` (`solicitud_id`);--> statement-breakpoint
CREATE INDEX `ix_solicitudes_facultad_estado` ON `solicitudes` (`facultad_id`,`estado`);--> statement-breakpoint
CREATE INDEX `ix_solicitudes_estudiante` ON `solicitudes` (`estudiante_id`);--> statement-breakpoint
CREATE INDEX `ix_solicitudes_responsable` ON `solicitudes` (`responsable_id`);--> statement-breakpoint
CREATE INDEX `ix_usuarios_facultad_rol` ON `usuarios` (`facultad_id`,`rol`);