CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`series` text DEFAULT '' NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`year` text NOT NULL,
	`sku` text NOT NULL,
	`barcode` text NOT NULL,
	`description` text NOT NULL,
	`accent` text DEFAULT '#f97316' NOT NULL,
	`image_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "category", "series", "brand", "model", "year", "sku", "barcode", "description", "accent", "image_url", "created_at", "updated_at") SELECT "id", "name", "category", "series", "brand", "model", "year", "sku", "barcode", "description", "accent", "image_url", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;