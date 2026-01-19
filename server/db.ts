import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import mysql from 'mysql2/promise';
import { 
  InsertUser, users, 
  skus, InsertSku, Sku,
  syncHistory, InsertSyncHistory,
  transportConfig, InsertTransportConfig,
  shipments, InsertShipment,
  shipmentItems, InsertShipmentItem,
  promotions, InsertPromotion,
  promotionSales, InsertPromotionSale,
  springFestivalConfig, InsertSpringFestivalConfig,
  shippingPlans, InsertShippingPlan,
  actualShipments, InsertActualShipment,
  factoryInventory, InsertFactoryInventory
} from "../drizzle/schema";
import { ENV } from './_core/env';
import * as crypto from 'crypto';
import { localDb } from './localDb';

let _db: ReturnType<typeof drizzleMysql> | null = null;
let _useLocalDb = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const dbUrl = process.env.DATABASE_URL;
      // 检测数据库类型
      if (dbUrl.startsWith('postgres')) {
        // PostgreSQL (Supabase)
        const client = postgres(dbUrl);
        _db = drizzlePostgres(client) as any;
        console.log("[Database] Connected to PostgreSQL");
      } else {
        // MySQL - 使用连接池支持并发
        const pool = await mysql.createPool({
          uri: dbUrl,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
        });
        _db = drizzleMysql(pool) as any;
        console.log("[Database] Connected to MySQL with connection pool");
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (!_db) {
    _useLocalDb = true;
    console.log("[Database] Using local memory database");
  }
  return _db;
}

// 检查是否使用本地数据库
function useLocal(): boolean {
  return !process.env.DATABASE_URL || _useLocalDb;
}

// 密码哈希函数
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ==================== 用户相关 ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  if (useLocal()) {
    return localDb.getUserByOpenId(openId);
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 用户名密码登录
export async function getUserByUsername(username: string) {
  if (useLocal()) {
    return localDb.getUserByUsername(username);
  }
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 注册新用户
export async function createUserWithPassword(username: string, password: string, brandName?: string) {
  if (useLocal()) {
    return localDb.createUser(username, password, brandName);
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const hashedPassword = hashPassword(password);
  const openId = `local_${username}_${Date.now()}`;
  
  await db.insert(users).values({
    openId,
    username,
    password: hashedPassword,
    brandName: brandName || username,
    name: username,
    loginMethod: 'password',
  });
  
  return getUserByUsername(username);
}

// 更新密码
export async function updateUserPassword(userId: number, newPassword: string) {
  if (useLocal()) {
    localDb.updateUserPassword(userId, newPassword);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const hashedPassword = hashPassword(newPassword);
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}

// ==================== SKU相关 ====================
export async function getSkusByBrand(brandName: string) {
  if (useLocal()) {
    return localDb.getSkusByBrand(brandName);
  }
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(skus).where(eq(skus.brandName, brandName)).orderBy(desc(skus.updatedAt));
}

export async function getSkuById(id: number) {
  if (useLocal()) {
    return localDb.getSkuById(id);
  }
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(skus).where(eq(skus.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSkuBySku(sku: string, brandName: string) {
  if (useLocal()) {
    return localDb.getSkuBySku(sku, brandName);
  }
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(skus)
    .where(and(eq(skus.sku, sku), eq(skus.brandName, brandName)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSku(data: InsertSku) {
  if (useLocal()) {
    return localDb.createSku(data as any);
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(skus).values(data);
  return result;
}

export async function updateSku(id: number, data: Partial<InsertSku>) {
  if (useLocal()) {
    localDb.updateSku(id, data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(skus).set(data).where(eq(skus.id, id));
}

export async function deleteSku(id: number) {
  if (useLocal()) {
    localDb.deleteSku(id);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(skus).where(eq(skus.id, id));
}

export async function batchUpdateSkus(ids: number[], updates: { dailySales?: string | number; isDiscontinued?: boolean }) {
  if (useLocal()) {
    ids.forEach(id => {
      localDb.updateSku(id, updates as any);
    });
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = {};
  if (updates.dailySales !== undefined) {
    updateData.dailySales = updates.dailySales;
  }
  if (updates.isDiscontinued !== undefined) {
    updateData.isDiscontinued = updates.isDiscontinued;
  }
  updateData.updatedAt = new Date();
  
  if (ids.length === 0) return;
  
  await db.update(skus).set(updateData).where(inArray(skus.id, ids));
}

export async function clearAllSkus(brandName: string) {
  if (useLocal()) {
    localDb.clearAllSkus(brandName);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(skus).where(eq(skus.brandName, brandName));
}

export async function batchUpsertSkus(items: InsertSku[]) {
  if (useLocal()) {
    for (const item of items) {
      const existing = localDb.getSkuBySku(item.sku, item.brandName);
      if (existing) {
        localDb.updateSku(existing.id, item as any);
      } else {
        localDb.createSku(item as any);
      }
    }
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 优化：使用批量查询和批量插入
  if (items.length === 0) return;
  
  const brandName = items[0].brandName;
  const skuNames = items.map(item => item.sku);
  
  // 批量查询现有SKU
  const existingSkus = await db.select().from(skus)
    .where(and(
      eq(skus.brandName, brandName),
      inArray(skus.sku, skuNames)
    ));
  
  const existingMap = new Map(existingSkus.map((s: any) => [s.sku, s]));
  
  const toInsert: InsertSku[] = [];
  const toUpdate: { id: number; data: Partial<InsertSku> }[] = [];
  
  for (const item of items) {
    const existing = existingMap.get(item.sku);
    if (existing) {
      toUpdate.push({ id: existing.id, data: item });
    } else {
      toInsert.push(item);
    }
  }
  
  // 批量插入
  if (toInsert.length > 0) {
    await db.insert(skus).values(toInsert);
  }
  
  // 批量更新（逐个更新，但已经减少了查询次数）
  for (const { id, data } of toUpdate) {
    await updateSku(id, data);
  }
}

// ==================== 库存同步历史 ====================
export async function createSyncHistory(data: InsertSyncHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(syncHistory).values(data);
  return result;
}

export async function updateSyncHistory(id: number, data: Partial<InsertSyncHistory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(syncHistory).set(data).where(eq(syncHistory.id, id));
}

export async function getSyncHistoryByBrand(brandName: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(syncHistory)
    .where(eq(syncHistory.brandName, brandName))
    .orderBy(desc(syncHistory.createdAt))
    .limit(50);
}

// ==================== 运输配置 ====================
export async function getTransportConfig(brandName: string) {
  if (useLocal()) {
    return localDb.getTransportConfig(brandName) || {
      id: 1,
      brandName,
      standardShippingDays: 25,
      standardShelfDays: 10,
      oversizedShippingDays: 35,
      oversizedShelfDays: 10,
      updatedAt: new Date(),
    };
  }
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(transportConfig)
    .where(eq(transportConfig.brandName, brandName))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertTransportConfig(brandName: string, data: Partial<InsertTransportConfig>) {
  if (useLocal()) {
    localDb.upsertTransportConfig(brandName, data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getTransportConfig(brandName);
  if (existing) {
    await db.update(transportConfig).set(data).where(eq(transportConfig.id, existing.id));
  } else {
    await db.insert(transportConfig).values({ ...data, brandName });
  }
}

// ==================== 货件管理 ====================
export async function getShipmentsByBrand(brandName: string) {
  if (useLocal()) {
    return localDb.getShipmentsByBrand(brandName);
  }
  const db = await getDb();
  if (!db) return [];
  
  const shipmentList = await db.select().from(shipments)
    .where(eq(shipments.brandName, brandName))
    .orderBy(desc(shipments.createdAt));
  
  // 为每个货件添加总数量字段
  const shipmentsWithTotal = await Promise.all(shipmentList.map(async (shipment) => {
    const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipment.id));
    const totalQuantity = items      .reduce((sum: any, item: any) => sum + item.quantity, 0);;
    return { ...shipment, totalQuantity };
  }));
  
  return shipmentsWithTotal;
}

export async function getShipmentById(id: number) {
  if (useLocal()) {
    return localDb.getShipmentById(id);
  }
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createShipment(data: InsertShipment) {
  if (useLocal()) {
    return localDb.createShipment(data as any);
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(shipments).values(data);
  return result;
}

export async function updateShipment(id: number, data: Partial<InsertShipment>) {
  if (useLocal()) {
    localDb.updateShipment(id, data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(shipments).set(data).where(eq(shipments.id, id));
}

export async function deleteShipment(id: number) {
  if (useLocal()) {
    localDb.deleteShipment(id);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(shipmentItems).where(eq(shipmentItems.shipmentId, id));
  await db.delete(shipments).where(eq(shipments.id, id));
}

export async function clearAllShipments(brandName: string) {
  if (useLocal()) {
    localDb.clearAllShipments(brandName);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const brandShipments = await getShipmentsByBrand(brandName);
  for (const s of brandShipments) {
    await db.delete(shipmentItems).where(eq(shipmentItems.shipmentId, s.id));
  }
  await db.delete(shipments).where(eq(shipments.brandName, brandName));
}

// 货件明细
export async function getShipmentItems(shipmentId: number) {
  if (useLocal()) {
    return localDb.getShipmentItems(shipmentId);
  }
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
}

export async function createShipmentItem(data: InsertShipmentItem) {
  if (useLocal()) {
    localDb.createShipmentItem(data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(shipmentItems).values(data);
}

export async function getAllShipmentItems(brandName: string) {
  if (useLocal()) {
    return localDb.getAllShipmentItems(brandName);
  }
  const db = await getDb();
  if (!db) return [];
  
  // 获取该品牌的所有货件
  const brandShipments = await getShipmentsByBrand(brandName);
  const shipmentIds = brandShipments.map(s => s.id);
  
  // 获取所有货件明细
  const allItems = [];
  for (const shipmentId of shipmentIds) {
    const items = await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
    allItems.push(...items);
  }
  
  return allItems;
}

export async function getShipmentItemsBySku(skuId: number) {
  if (useLocal()) {
    return localDb.getShipmentItemsBySkuId(skuId);
  }
  const db = await getDb();
  if (!db) return [];
  
  // 获取该SKU的所有货件明细，并关联货件信息
  const items = await db.select().from(shipmentItems).where(eq(shipmentItems.skuId, skuId));
  const result = [];
  for (const item of items) {
    const shipment = await getShipmentById(item.shipmentId);
    // 只返回运输中的货件
    if (shipment && shipment.status === 'shipping') {
      result.push({ item, shipment });
    }
  }
  return result;
}

// ==================== 促销管理 ====================
export async function getPromotionsByBrand(brandName: string) {
  if (useLocal()) {
    return localDb.getPromotionsByBrand(brandName);
  }
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(promotions)
    .where(eq(promotions.brandName, brandName))
    .orderBy(promotions.thisYearStartDate);
}

export async function getPromotionById(id: number) {
  if (useLocal()) {
    return localDb.getPromotionById(id);
  }
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPromotion(data: InsertPromotion) {
  if (useLocal()) {
    return localDb.createPromotion(data as any);
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(promotions).values(data);
  return result;
}

export async function updatePromotion(id: number, data: Partial<InsertPromotion>) {
  if (useLocal()) {
    localDb.updatePromotion(id, data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(promotions).set(data).where(eq(promotions.id, id));
}

export async function deletePromotion(id: number) {
  if (useLocal()) {
    localDb.deletePromotion(id);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(promotionSales).where(eq(promotionSales.promotionId, id));
  await db.delete(promotions).where(eq(promotions.id, id));
}

export async function clearAllPromotions(brandName: string) {
  if (useLocal()) {
    localDb.clearAllPromotions(brandName);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const brandPromotions = await getPromotionsByBrand(brandName);
  for (const p of brandPromotions) {
    await db.delete(promotionSales).where(eq(promotionSales.promotionId, p.id));
  }
  await db.delete(promotions).where(eq(promotions.brandName, brandName));
}

// 促销销量
export async function getPromotionSales(promotionId: number) {
  if (useLocal()) {
    return localDb.getPromotionSales(promotionId);
  }
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(promotionSales).where(eq(promotionSales.promotionId, promotionId));
}

export async function createPromotionSale(data: InsertPromotionSale) {
  if (useLocal()) {
    localDb.createPromotionSale(data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(promotionSales).values(data);
}

export async function updatePromotionSale(id: number, data: Partial<InsertPromotionSale>) {
  if (useLocal()) {
    localDb.updatePromotionSale(id, data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(promotionSales).set(data).where(eq(promotionSales.id, id));
}

export async function upsertPromotionSale(data: { promotionId: number; skuId: number; sku: string; lastYearSales: number }) {
  if (useLocal()) {
    localDb.upsertPromotionSale(data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 检查是否已存在
  const existing = await db.select().from(promotionSales)
    .where(
      and(
        eq(promotionSales.promotionId, data.promotionId),
        eq(promotionSales.skuId, data.skuId)
      )
    );
  
  if (existing.length > 0) {
    // 更新
    await db.update(promotionSales)
      .set({ lastYearSales: data.lastYearSales })
      .where(eq(promotionSales.id, existing[0].id));
  } else {
    // 插入
    await db.insert(promotionSales).values({
      promotionId: data.promotionId,
      skuId: data.skuId,
      sku: data.sku,
      lastYearSales: data.lastYearSales,
    });
  }
}

export async function deletePromotionSalesByPromotion(promotionId: number) {
  if (useLocal()) {
    localDb.deletePromotionSalesByPromotion(promotionId);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(promotionSales).where(eq(promotionSales.promotionId, promotionId));
}

// ==================== 春节配置 ====================
export async function getSpringFestivalConfig(brandName: string, year: number) {
  if (useLocal()) {
    return localDb.getSpringFestivalConfig(brandName, year);
  }
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(springFestivalConfig)
    .where(and(
      eq(springFestivalConfig.brandName, brandName),
      eq(springFestivalConfig.year, year)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertSpringFestivalConfig(
  brandName: string, 
  year: number, 
  data: {
    holidayStartDate?: string;
    holidayEndDate?: string;
    lastShipDate?: string;
    returnToWorkDate?: string;
    firstShipDate?: string;
  }
) {
  if (useLocal()) {
    localDb.upsertSpringFestivalConfig(brandName, year, {
      holidayStartDate: data.holidayStartDate || null,
      holidayEndDate: data.holidayEndDate || null,
      lastShipDate: data.lastShipDate || null,
      returnToWorkDate: data.returnToWorkDate || null,
      firstShipDate: data.firstShipDate || null,
    });
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getSpringFestivalConfig(brandName, year);
  const updateData: any = {
    holidayStartDate: data.holidayStartDate ? new Date(data.holidayStartDate) : null,
    holidayEndDate: data.holidayEndDate ? new Date(data.holidayEndDate) : null,
    lastShipDate: data.lastShipDate ? new Date(data.lastShipDate) : null,
    returnToWorkDate: data.returnToWorkDate ? new Date(data.returnToWorkDate) : null,
    firstShipDate: data.firstShipDate ? new Date(data.firstShipDate) : null,
  };
  
  if (existing) {
    await db.update(springFestivalConfig)
      .set(updateData)
      .where(eq(springFestivalConfig.id, existing.id));
  } else {
    await db.insert(springFestivalConfig).values({ 
      brandName, 
      year, 
      ...updateData
    });
  }
}

export async function deleteSpringFestivalConfig(brandName: string, year: number) {
  if (useLocal()) {
    localDb.deleteSpringFestivalConfig(brandName, year);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(springFestivalConfig)
    .where(and(
      eq(springFestivalConfig.brandName, brandName),
      eq(springFestivalConfig.year, year)
    ));
}

// ==================== 发货计划 ====================
export async function getShippingPlansByBrand(brandName: string) {
  if (useLocal()) {
    return localDb.getShippingPlans(brandName);
  }
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(shippingPlans)
    .where(eq(shippingPlans.brandName, brandName))
    .orderBy(shippingPlans.planDate);
}

export async function upsertShippingPlan(data: InsertShippingPlan) {
  if (useLocal()) {
    localDb.upsertShippingPlan(data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(shippingPlans)
    .where(and(
      eq(shippingPlans.brandName, data.brandName),
      eq(shippingPlans.skuId, data.skuId),
      eq(shippingPlans.planDate, data.planDate as any)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(shippingPlans)
      .set({ planQuantity: data.planQuantity })
      .where(eq(shippingPlans.id, existing[0].id));
  } else {
    await db.insert(shippingPlans).values(data);
  }
}

// ==================== 实际发货 ====================
export async function getActualShipmentsByBrand(brandName: string) {
  if (useLocal()) {
    return localDb.getActualShipments(brandName);
  }
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(actualShipments)
    .where(eq(actualShipments.brandName, brandName))
    .orderBy(actualShipments.shipDate);
}

export async function upsertActualShipment(data: InsertActualShipment) {
  if (useLocal()) {
    localDb.upsertActualShipment(data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(actualShipments)
    .where(and(
      eq(actualShipments.brandName, data.brandName),
      eq(actualShipments.skuId, data.skuId),
      eq(actualShipments.shipDate, data.shipDate)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(actualShipments)
      .set({ quantity: data.quantity })
      .where(eq(actualShipments.id, existing[0].id));
  } else {
    await db.insert(actualShipments).values(data);
  }
}

export async function createActualShipment(data: InsertActualShipment) {
  if (useLocal()) {
    localDb.upsertActualShipment(data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 检查是否已存在相同的记录（同一SKU、同一发货日期）
  const existing = await db.select().from(actualShipments)
    .where(
      and(
        eq(actualShipments.brandName, data.brandName),
        eq(actualShipments.skuId, data.skuId),
        eq(actualShipments.shipDate, data.shipDate)
      )
    );
  
  if (existing.length > 0) {
    // 更新现有记录
    await db.update(actualShipments)
      .set({ quantity: data.quantity, notes: data.notes })
      .where(eq(actualShipments.id, existing[0].id));
  } else {
    // 插入新记录
    await db.insert(actualShipments).values(data);
  }
}

export async function deleteActualShipment(id: number) {
  if (useLocal()) {
    // 本地数据库不支持删除，直接返回
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(actualShipments).where(eq(actualShipments.id, id));
}

// ==================== 工厂库存 ====================
export async function getFactoryInventoryByBrand(brandName: string, month?: string) {
  if (useLocal()) {
    return localDb.getFactoryInventory(brandName);
  }
  const db = await getDb();
  if (!db) return [];
  
  if (month) {
    return db.select().from(factoryInventory)
      .where(and(
        eq(factoryInventory.brandName, brandName),
        eq(factoryInventory.month, month)
      ));
  }
  return db.select().from(factoryInventory)
    .where(eq(factoryInventory.brandName, brandName))
    .orderBy(desc(factoryInventory.month));
}

export async function upsertFactoryInventory(data: InsertFactoryInventory) {
  if (useLocal()) {
    localDb.upsertFactoryInventory(data as any);
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(factoryInventory)
    .where(and(
      eq(factoryInventory.brandName, data.brandName),
      eq(factoryInventory.skuId, data.skuId),
      eq(factoryInventory.month, data.month)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // 构建更新对象，只更新提供的字段
    const updateData: any = {};
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.pendingOrders !== undefined) updateData.pendingOrders = data.pendingOrders;
    if (data.additionalOrder !== undefined) updateData.additionalOrder = data.additionalOrder;
    if (data.suggestedOrder !== undefined) updateData.suggestedOrder = data.suggestedOrder;
    if (data.sku !== undefined) updateData.sku = data.sku;
    
    if (Object.keys(updateData).length > 0) {
      await db.update(factoryInventory)
        .set(updateData)
        .where(eq(factoryInventory.id, existing[0].id));
    }
  } else {
    await db.insert(factoryInventory).values(data);
  }
}

// 初始化默认用户
export async function initDefaultUser() {
  if (useLocal()) {
    // 本地数据库在构造时已初始化默认用户
    console.log('[Database] Using local memory database with default user ELYONA');
    return;
  }
  const db = await getDb();
  if (!db) return;
  
  const existing = await getUserByUsername('ELYONA');
  if (!existing) {
    await createUserWithPassword('ELYONA', '123456', 'ELYONA');
    console.log('[Database] Default user ELYONA created');
  }
}
