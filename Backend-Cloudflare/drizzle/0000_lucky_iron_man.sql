CREATE TABLE `documents` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`file_key` text NOT NULL,
	`size` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`year` text NOT NULL,
	`sku` text NOT NULL,
	`barcode` text NOT NULL,
	`description` text NOT NULL,
	`accent` text DEFAULT '#0866e8' NOT NULL,
	`image_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);