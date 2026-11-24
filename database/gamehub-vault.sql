-- Additive migration for the encrypted GameHub credential vault.
-- Run this against the same MySQL database used by the NestJS API (defaultdb).
USE `defaultdb`;

CREATE TABLE IF NOT EXISTS `game_hub_games` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_game_hub_games_owner_name` (`owner_id`, `name`),
  KEY `ix_game_hub_games_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `game_hub_accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_id` BIGINT UNSIGNED NOT NULL,
  `game_name` VARCHAR(80) NOT NULL,
  `username` VARCHAR(120) NOT NULL,
  `email` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `password_ciphertext` LONGTEXT NOT NULL,
  `password_iv` CHAR(24) NOT NULL,
  `password_auth_tag` CHAR(32) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_game_hub_accounts_owner` (`owner_id`),
  KEY `ix_game_hub_accounts_owner_game` (`owner_id`, `game_name`),
  KEY `ix_game_hub_accounts_owner_username` (`owner_id`, `username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
