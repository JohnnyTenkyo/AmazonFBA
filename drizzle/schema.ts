import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, date } from "drizzle-orm/mysql-core";

// 用户表 - 支持用户名密码登录和多品牌管理
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // 用户名密码登录字段
  username: varchar("username", { length: 64 }).unique(),
  password: varchar("password", { length: 256 }),
  // 品牌名称 - 用于数据隔离
  brandName: varchar("brandName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// SKU管理表
export const skus = mysqlTable("skus", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 128 }).notNull(),
  category: mysqlEnum("category", ["standard", "oversized"]).notNull(), // 标准件/大件
  dailySales: decimal("dailySales", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
  brandName: varchar("brandName", { length: 128 }).notNull(), // 品牌名称用于数据隔离
  isDiscontinued: boolean("isDiscontinued").default(false), // 淘汰状态
  // FBA库存数据
  fbaStock: int("fbaStock").default(0), // 在售库存
  inTransitStock: int("inTransitStock").default(0), // 在途库存
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sku = typeof skus.$inferSelect;
export type InsertSku = typeof skus.$inferInsert;

// FBA库存同步历史记录
export const syncHistory = mysqlTable("sync_history", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  totalRecords: int("totalRecords").default(0),
  successCount: int("successCount").default(0),
  failCount: int("failCount").default(0),
  status: mysqlEnum("status", ["processing", "completed", "failed"]).default("processing"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SyncHistory = typeof syncHistory.$inferSelect;
export type InsertSyncHistory = typeof syncHistory.$inferInsert;

// 运输配置表
export const transportConfig = mysqlTable("transport_config", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  // 标准件配置
  standardShippingDays: int("standardShippingDays").default(25),
  standardShelfDays: int("standardShelfDays").default(10),
  // 大件配置
  oversizedShippingDays: int("oversizedShippingDays").default(35),
  oversizedShelfDays: int("oversizedShelfDays").default(10),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TransportConfig = typeof transportConfig.$inferSelect;
export type InsertTransportConfig = typeof transportConfig.$inferInsert;

// 货件表
export const shipments = mysqlTable("shipments", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  trackingNumber: varchar("trackingNumber", { length: 128 }).notNull(), // 货运号
  warehouse: varchar("warehouse", { length: 128 }), // 到达仓库
  shipDate: date("shipDate"), // 发货日期
  expectedArrivalDate: date("expectedArrivalDate"), // 预计到货日期
  actualArrivalDate: date("actualArrivalDate"), // 实际到货日期
  status: mysqlEnum("status", ["shipping", "arrived", "early", "delayed"]).default("shipping"),
  category: mysqlEnum("category", ["standard", "oversized"]).notNull(), // 标准件/大件
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

// 货件明细表 - 每个货件包含的SKU
export const shipmentItems = mysqlTable("shipment_items", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId").notNull(),
  skuId: int("skuId").notNull(),
  sku: varchar("sku", { length: 128 }).notNull(),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShipmentItem = typeof shipmentItems.$inferSelect;
export type InsertShipmentItem = typeof shipmentItems.$inferInsert;

// 促销项目表
export const promotions = mysqlTable("promotions", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(), // 促销名称如"春季prime day"
  lastYearStartDate: date("lastYearStartDate"), // 去年促销开始时间
  lastYearEndDate: date("lastYearEndDate"), // 去年促销结束时间
  thisYearStartDate: date("thisYearStartDate"), // 今年促销开始时间
  thisYearEndDate: date("thisYearEndDate"), // 今年促销结束时间
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = typeof promotions.$inferInsert;

// 促销历史销量表
export const promotionSales = mysqlTable("promotion_sales", {
  id: int("id").autoincrement().primaryKey(),
  promotionId: int("promotionId").notNull(),
  skuId: int("skuId").notNull(),
  sku: varchar("sku", { length: 128 }).notNull(),
  lastYearSales: int("lastYearSales").default(0), // 去年促销销量
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PromotionSale = typeof promotionSales.$inferSelect;
export type InsertPromotionSale = typeof promotionSales.$inferInsert;

// 春节配置表
export const springFestivalConfig = mysqlTable("spring_festival_config", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  year: int("year").notNull(),
  holidayStartDate: date("holidayStartDate"), // 放假开始日期
  holidayEndDate: date("holidayEndDate"), // 放假结束日期
  lastShipDate: date("lastShipDate"), // 最后发货日期
  returnToWorkDate: date("returnToWorkDate"), // 复工日期
  firstShipDate: date("firstShipDate"), // 最早出货日期
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SpringFestivalConfig = typeof springFestivalConfig.$inferSelect;
export type InsertSpringFestivalConfig = typeof springFestivalConfig.$inferInsert;

// 发货计划表 - 实际发货记录
export const shippingPlans = mysqlTable("shipping_plans", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  skuId: int("skuId").notNull(),
  sku: varchar("sku", { length: 128 }).notNull(),
  category: mysqlEnum("category", ["standard", "oversized"]).notNull(),
  planDate: date("planDate"), // 计划发货日期
  planQuantity: int("planQuantity").default(0), // 计划发货数量
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShippingPlan = typeof shippingPlans.$inferSelect;
export type InsertShippingPlan = typeof shippingPlans.$inferInsert;

// 实际发货列表 - 用于记录每个SKU的多次实际发货
export const actualShipments = mysqlTable("actual_shipments", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  skuId: int("skuId").notNull(),
  sku: varchar("sku", { length: 128 }).notNull(),
  shipDate: date("shipDate").notNull(), // 实际发货日期
  quantity: int("quantity").notNull(), // 发货数量
  notes: text("notes"), // 备注
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActualShipment = typeof actualShipments.$inferSelect;
export type InsertActualShipment = typeof actualShipments.$inferInsert;

// 工厂库存表
export const factoryInventory = mysqlTable("factory_inventory", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 128 }).notNull(),
  skuId: int("skuId").notNull(),
  sku: varchar("sku", { length: 128 }).notNull(),
  quantity: int("quantity").default(0), // 工厂成品库存数量
  pendingOrders: int("pendingOrders").default(0), // 工厂已下单未完成数量
  month: varchar("month", { length: 7 }).notNull(), // 月份 YYYY-MM
  additionalOrder: int("additionalOrder").default(0), // 加单数量
  suggestedOrder: int("suggestedOrder").default(0), // 建议加单数量
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FactoryInventory = typeof factoryInventory.$inferSelect;
export type InsertFactoryInventory = typeof factoryInventory.$inferInsert;
