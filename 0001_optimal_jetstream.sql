CREATE TABLE `actual_shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`skuId` int NOT NULL,
	`sku` varchar(128) NOT NULL,
	`shipDate` date NOT NULL,
	`quantity` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actual_shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `factory_inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`skuId` int NOT NULL,
	`sku` varchar(128) NOT NULL,
	`quantity` int DEFAULT 0,
	`month` varchar(7) NOT NULL,
	`additionalOrder` int DEFAULT 0,
	`suggestedOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `factory_inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotion_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promotionId` int NOT NULL,
	`skuId` int NOT NULL,
	`sku` varchar(128) NOT NULL,
	`lastYearSales` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promotion_sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`name` varchar(256) NOT NULL,
	`lastYearStartDate` date,
	`lastYearEndDate` date,
	`thisYearStartDate` date,
	`thisYearEndDate` date,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipment_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipmentId` int NOT NULL,
	`skuId` int NOT NULL,
	`sku` varchar(128) NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipment_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`trackingNumber` varchar(128) NOT NULL,
	`warehouse` varchar(128),
	`shipDate` date,
	`expectedArrivalDate` date,
	`actualArrivalDate` date,
	`status` enum('shipping','arrived','early','delayed') DEFAULT 'shipping',
	`category` enum('standard','oversized') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipping_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`skuId` int NOT NULL,
	`sku` varchar(128) NOT NULL,
	`category` enum('standard','oversized') NOT NULL,
	`planDate` date,
	`planQuantity` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(128) NOT NULL,
	`category` enum('standard','oversized') NOT NULL,
	`dailySales` decimal(10,2) DEFAULT '0',
	`notes` text,
	`brandName` varchar(128) NOT NULL,
	`isDiscontinued` boolean DEFAULT false,
	`fbaStock` int DEFAULT 0,
	`inTransitStock` int DEFAULT 0,
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spring_festival_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`year` int NOT NULL,
	`holidayStartDate` date,
	`holidayEndDate` date,
	`lastShipDate` date,
	`returnToWorkDate` date,
	`firstShipDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spring_festival_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`totalRecords` int DEFAULT 0,
	`successCount` int DEFAULT 0,
	`failCount` int DEFAULT 0,
	`status` enum('processing','completed','failed') DEFAULT 'processing',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transport_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandName` varchar(128) NOT NULL,
	`standardShippingDays` int DEFAULT 25,
	`standardShelfDays` int DEFAULT 10,
	`oversizedShippingDays` int DEFAULT 35,
	`oversizedShelfDays` int DEFAULT 10,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transport_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `brandName` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);