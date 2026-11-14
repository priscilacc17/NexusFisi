-- Base para las pruebas de integración de la API (npm test).
CREATE DATABASE IF NOT EXISTS nexusfisi_test;
GRANT ALL ON nexusfisi_test.* TO 'nexusfisi'@'%';
