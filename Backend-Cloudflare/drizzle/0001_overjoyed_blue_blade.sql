CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
DROP INDEX `products_sku_unique`;--> statement-breakpoint
ALTER TABLE `products` ADD `series` text DEFAULT '' NOT NULL;