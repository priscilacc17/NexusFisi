CREATE TABLE `archivos` (
	`nombre_almacenado` varchar(80) NOT NULL,
	`datos` longblob NOT NULL,
	CONSTRAINT `archivos_nombre_almacenado` PRIMARY KEY(`nombre_almacenado`)
);
--> statement-breakpoint
CREATE TABLE `restablecimientos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuario_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expira_at` datetime(3) NOT NULL,
	`usado_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `restablecimientos_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_restablecimientos_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `restablecimientos` ADD CONSTRAINT `restablecimientos_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_restablecimientos_usuario` ON `restablecimientos` (`usuario_id`);