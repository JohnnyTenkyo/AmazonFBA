// 本地内存数据库 - 用于开发测试
import * as crypto from 'crypto';

// 密码哈希函数
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 内存数据存储
interface LocalUser {
  id: number;
  openId: string;
  username: string;
  password: string;
  brandName: string;
  name: string | null;
  email: string | null;
  loginMethod: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

interface LocalSku {
  id: number;
  sku: string;
  category: 'standard' | 'oversized';
  dailySales: string;
  notes: string | null;
  brandName: string;
  isDiscontinued: boolean;
  fbaStock: number;
  inTransitStock: number;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalShipment {
  id: number;
  brandName: string;
  trackingNumber: string;
  warehouse: string | null;
  shipDate: string | null;
  expectedArrivalDate: string | null;
  actualArrivalDate: string | null;
  status: 'shipping' | 'arrived' | 'early' | 'delayed';
  category: 'standard' | 'oversized';
  createdAt: Date;
  updatedAt: Date;
}

interface LocalShipmentItem {
  id: number;
  shipmentId: number;
  skuId: number;
  sku: string;
  quantity: number;
  createdAt: Date;
}

interface LocalPromotion {
  id: number;
  brandName: string;
  name: string;
  lastYearStartDate: string | null;
  lastYearEndDate: string | null;
  thisYearStartDate: string | null;
  thisYearEndDate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalPromotionSale {
  id: number;
  promotionId: number;
  skuId: number;
  sku: string;
  expectedSales: number;
  actualSales: number | null;
  createdAt: Date;
}

interface LocalTransportConfig {
  id: number;
  brandName: string;
  standardShippingDays: number;
  standardShelfDays: number;
  oversizedShippingDays: number;
  oversizedShelfDays: number;
  updatedAt: Date;
}

interface LocalSpringFestivalConfig {
  id: number;
  brandName: string;
  year: number;
  holidayStartDate: string | null;
  holidayEndDate: string | null;
  lastShipDate: string | null;
  returnToWorkDate: string | null;
  firstShipDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalShippingPlan {
  id: number;
  brandName: string;
  skuId: number;
  sku: string;
  month: string;
  plannedQuantity: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalActualShipment {
  id: number;
  brandName: string;
  skuId: number;
  sku: string;
  month: string;
  actualQuantity: number;
  shipmentDate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalFactoryInventory {
  id: number;
  brandName: string;
  skuId: number;
  sku: string;
  quantity: number;
  pendingOrders: number;
  month: string;
  additionalOrder: number;
  suggestedOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// 内存数据库
class LocalDatabase {
  private users: LocalUser[] = [];
  private skus: LocalSku[] = [];
  private shipments: LocalShipment[] = [];
  private shipmentItems: LocalShipmentItem[] = [];
  private promotions: LocalPromotion[] = [];
  private promotionSales: LocalPromotionSale[] = [];
  private transportConfigs: LocalTransportConfig[] = [];
  private springFestivalConfigs: LocalSpringFestivalConfig[] = [];
  private shippingPlans: LocalShippingPlan[] = [];
  private actualShipments: LocalActualShipment[] = [];
  private factoryInventory: LocalFactoryInventory[] = [];
  
  private nextUserId = 1;
  private nextSkuId = 1;
  private nextShipmentId = 1;
  private nextShipmentItemId = 1;
  private nextPromotionId = 1;
  private nextPromotionSaleId = 1;
  private nextTransportConfigId = 1;
  private nextSpringFestivalConfigId = 1;
  private nextShippingPlanId = 1;
  private nextActualShipmentId = 1;
  private nextFactoryInventoryId = 1;

  constructor() {
    // 初始化默认用户
    this.createUser('ELYONA', '123456', 'ELYONA');
  }

  // ==================== 用户相关 ====================
  createUser(username: string, password: string, brandName?: string): LocalUser {
    const user: LocalUser = {
      id: this.nextUserId++,
      openId: `local_${username}_${Date.now()}`,
      username,
      password: hashPassword(password),
      brandName: brandName || username,
      name: username,
      email: null,
      loginMethod: 'password',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    this.users.push(user);
    return user;
  }

  getUserByUsername(username: string): LocalUser | undefined {
    return this.users.find(u => u.username === username);
  }

  getUserByOpenId(openId: string): LocalUser | undefined {
    return this.users.find(u => u.openId === openId);
  }

  updateUserPassword(userId: number, newPassword: string): void {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.password = hashPassword(newPassword);
      user.updatedAt = new Date();
    }
  }

  // ==================== SKU相关 ====================
  getSkusByBrand(brandName: string): LocalSku[] {
    return this.skus
      .filter(s => s.brandName === brandName)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getSkuById(id: number): LocalSku | undefined {
    return this.skus.find(s => s.id === id);
  }

  getSkuBySku(sku: string, brandName: string): LocalSku | undefined {
    return this.skus.find(s => s.sku === sku && s.brandName === brandName);
  }

  createSku(data: Partial<LocalSku> & { sku: string; brandName: string; category: 'standard' | 'oversized' }): LocalSku {
    const sku: LocalSku = {
      id: this.nextSkuId++,
      sku: data.sku,
      category: data.category,
      dailySales: data.dailySales || '0',
      notes: data.notes || null,
      brandName: data.brandName,
      isDiscontinued: data.isDiscontinued || false,
      fbaStock: data.fbaStock || 0,
      inTransitStock: data.inTransitStock || 0,
      lastSyncAt: data.lastSyncAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.skus.push(sku);
    return sku;
  }

  updateSku(id: number, data: Partial<LocalSku>): void {
    const sku = this.skus.find(s => s.id === id);
    if (sku) {
      Object.assign(sku, data, { updatedAt: new Date() });
    }
  }

  deleteSku(id: number): void {
    const index = this.skus.findIndex(s => s.id === id);
    if (index !== -1) {
      this.skus.splice(index, 1);
    }
  }

  clearAllSkus(brandName: string): void {
    this.skus = this.skus.filter(s => s.brandName !== brandName);
  }

  // ==================== 货件相关 ====================
  getShipmentsByBrand(brandName: string): (LocalShipment & { totalQuantity: number })[] {
    const shipmentList = this.shipments
      .filter(s => s.brandName === brandName)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // 为每个货件添加总数量字段
    return shipmentList.map(shipment => {
      const items = this.shipmentItems.filter(item => item.shipmentId === shipment.id);
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      return { ...shipment, totalQuantity };
    });
  }

  getShipmentById(id: number): LocalShipment | undefined {
    return this.shipments.find(s => s.id === id);
  }

  createShipment(data: Partial<LocalShipment> & { brandName: string; trackingNumber: string; category: 'standard' | 'oversized' }): LocalShipment {
    const shipment: LocalShipment = {
      id: this.nextShipmentId++,
      brandName: data.brandName,
      trackingNumber: data.trackingNumber,
      warehouse: data.warehouse || null,
      shipDate: data.shipDate || null,
      expectedArrivalDate: data.expectedArrivalDate || null,
      actualArrivalDate: data.actualArrivalDate || null,
      status: data.status || 'shipping',
      category: data.category,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.shipments.push(shipment);
    return shipment;
  }

  updateShipment(id: number, data: Partial<LocalShipment>): void {
    const shipment = this.shipments.find(s => s.id === id);
    if (shipment) {
      Object.assign(shipment, data, { updatedAt: new Date() });
    }
  }

  deleteShipment(id: number): void {
    const index = this.shipments.findIndex(s => s.id === id);
    if (index !== -1) {
      this.shipments.splice(index, 1);
      // 同时删除关联的货件明细
      this.shipmentItems = this.shipmentItems.filter(item => item.shipmentId !== id);
    }
  }

  clearAllShipments(brandName: string): void {
    const shipmentIds = this.shipments.filter(s => s.brandName === brandName).map(s => s.id);
    this.shipments = this.shipments.filter(s => s.brandName !== brandName);
    this.shipmentItems = this.shipmentItems.filter(item => !shipmentIds.includes(item.shipmentId));
  }

  // ==================== 货件明细相关 ====================
  getShipmentItems(shipmentId: number): LocalShipmentItem[] {
    return this.shipmentItems.filter(item => item.shipmentId === shipmentId);
  }

  getAllShipmentItems(brandName: string): LocalShipmentItem[] {
    const brandShipments = this.getShipmentsByBrand(brandName);
    const shipmentIds = brandShipments.map(s => s.id);
    return this.shipmentItems.filter(item => shipmentIds.includes(item.shipmentId));
  }

  createShipmentItem(data: { shipmentId: number; skuId: number; sku: string; quantity: number }): LocalShipmentItem {
    const item: LocalShipmentItem = {
      id: this.nextShipmentItemId++,
      shipmentId: data.shipmentId,
      skuId: data.skuId,
      sku: data.sku,
      quantity: data.quantity,
      createdAt: new Date(),
    };
    this.shipmentItems.push(item);
    return item;
  }

  getShipmentItemsBySkuId(skuId: number): { item: LocalShipmentItem; shipment: LocalShipment | undefined }[] {
    return this.shipmentItems
      .filter(item => item.skuId === skuId)
      .map(item => ({
        item,
        shipment: this.shipments.find(s => s.id === item.shipmentId),
      }))
      .filter(result => result.shipment && result.shipment.status === 'shipping');
  }

  // ==================== 促销相关 ====================
  getPromotionsByBrand(brandName: string): LocalPromotion[] {
    return this.promotions
      .filter(p => p.brandName === brandName)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getPromotionById(id: number): LocalPromotion | undefined {
    return this.promotions.find(p => p.id === id);
  }

  createPromotion(data: Partial<LocalPromotion> & { brandName: string; name: string }): LocalPromotion {
    const promotion: LocalPromotion = {
      id: this.nextPromotionId++,
      brandName: data.brandName,
      name: data.name,
      lastYearStartDate: data.lastYearStartDate || null,
      lastYearEndDate: data.lastYearEndDate || null,
      thisYearStartDate: data.thisYearStartDate || null,
      thisYearEndDate: data.thisYearEndDate || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      notes: data.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.promotions.push(promotion);
    return promotion;
  }

  updatePromotion(id: number, data: Partial<LocalPromotion>): void {
    const promotion = this.promotions.find(p => p.id === id);
    if (promotion) {
      Object.assign(promotion, data, { updatedAt: new Date() });
    }
  }

  deletePromotion(id: number): void {
    const index = this.promotions.findIndex(p => p.id === id);
    if (index !== -1) {
      this.promotions.splice(index, 1);
      // 同时删除关联的促销销量
      this.promotionSales = this.promotionSales.filter(s => s.promotionId !== id);
    }
  }

  clearAllPromotions(brandName: string): void {
    const promotionIds = this.promotions.filter(p => p.brandName === brandName).map(p => p.id);
    this.promotions = this.promotions.filter(p => p.brandName !== brandName);
    this.promotionSales = this.promotionSales.filter(s => !promotionIds.includes(s.promotionId));
  }

  // ==================== 促销销量相关 ====================
  getPromotionSales(promotionId: number): LocalPromotionSale[] {
    return this.promotionSales.filter(s => s.promotionId === promotionId);
  }

  createPromotionSale(data: { promotionId: number; skuId: number; sku: string; expectedSales: number }): LocalPromotionSale {
    const sale: LocalPromotionSale = {
      id: this.nextPromotionSaleId++,
      promotionId: data.promotionId,
      skuId: data.skuId,
      sku: data.sku,
      expectedSales: data.expectedSales,
      actualSales: null,
      createdAt: new Date(),
    };
    this.promotionSales.push(sale);
    return sale;
  }

  updatePromotionSale(id: number, data: Partial<LocalPromotionSale>): void {
    const sale = this.promotionSales.find(s => s.id === id);
    if (sale) {
      Object.assign(sale, data);
    }
  }

  upsertPromotionSale(data: { promotionId: number; skuId: number; sku: string; lastYearSales: number }): void {
    const existing = this.promotionSales.find(s => s.promotionId === data.promotionId && s.skuId === data.skuId);
    if (existing) {
      existing.expectedSales = data.lastYearSales;
    } else {
      const sale: LocalPromotionSale = {
        id: this.nextPromotionSaleId++,
        promotionId: data.promotionId,
        skuId: data.skuId,
        sku: data.sku,
        expectedSales: data.lastYearSales,
        actualSales: null,
        createdAt: new Date(),
      };
      this.promotionSales.push(sale);
    }
  }

  deletePromotionSalesByPromotion(promotionId: number): void {
    this.promotionSales = this.promotionSales.filter(s => s.promotionId !== promotionId);
  }

  // ==================== 运输配置相关 ====================
  getTransportConfig(brandName: string): LocalTransportConfig | undefined {
    return this.transportConfigs.find(c => c.brandName === brandName);
  }

  upsertTransportConfig(brandName: string, data: Partial<LocalTransportConfig>): LocalTransportConfig {
    let config = this.transportConfigs.find(c => c.brandName === brandName);
    if (config) {
      Object.assign(config, data, { updatedAt: new Date() });
    } else {
      config = {
        id: this.nextTransportConfigId++,
        brandName,
        standardShippingDays: data.standardShippingDays || 25,
        standardShelfDays: data.standardShelfDays || 10,
        oversizedShippingDays: data.oversizedShippingDays || 35,
        oversizedShelfDays: data.oversizedShelfDays || 10,
        updatedAt: new Date(),
      };
      this.transportConfigs.push(config);
    }
    return config;
  }

  // ==================== 春节配置相关 ====================
  getSpringFestivalConfig(brandName: string, year: number): LocalSpringFestivalConfig | undefined {
    return this.springFestivalConfigs.find(c => c.brandName === brandName && c.year === year);
  }

  upsertSpringFestivalConfig(brandName: string, year: number, data: Partial<LocalSpringFestivalConfig>): LocalSpringFestivalConfig {
    let config = this.springFestivalConfigs.find(c => c.brandName === brandName && c.year === year);
    if (config) {
      Object.assign(config, data, { updatedAt: new Date() });
    } else {
      config = {
        id: this.nextSpringFestivalConfigId++,
        brandName,
        year,
        holidayStartDate: data.holidayStartDate || null,
        holidayEndDate: data.holidayEndDate || null,
        lastShipDate: data.lastShipDate || null,
        returnToWorkDate: data.returnToWorkDate || null,
        firstShipDate: data.firstShipDate || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.springFestivalConfigs.push(config);
    }
    return config;
  }

  deleteSpringFestivalConfig(brandName: string, year: number): void {
    const index = this.springFestivalConfigs.findIndex(c => c.brandName === brandName && c.year === year);
    if (index !== -1) {
      this.springFestivalConfigs.splice(index, 1);
    }
  }

  // ==================== 发货计划相关 ====================
  getShippingPlans(brandName: string): LocalShippingPlan[] {
    return this.shippingPlans.filter(p => p.brandName === brandName);
  }

  upsertShippingPlan(data: { brandName: string; skuId: number; sku: string; month: string; plannedQuantity: number; notes?: string }): LocalShippingPlan {
    let plan = this.shippingPlans.find(p => p.brandName === data.brandName && p.skuId === data.skuId && p.month === data.month);
    if (plan) {
      plan.plannedQuantity = data.plannedQuantity;
      plan.notes = data.notes || null;
      plan.updatedAt = new Date();
    } else {
      plan = {
        id: this.nextShippingPlanId++,
        brandName: data.brandName,
        skuId: data.skuId,
        sku: data.sku,
        month: data.month,
        plannedQuantity: data.plannedQuantity,
        notes: data.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.shippingPlans.push(plan);
    }
    return plan;
  }

  // ==================== 实际发货相关 ====================
  getActualShipments(brandName: string): LocalActualShipment[] {
    return this.actualShipments.filter(s => s.brandName === brandName);
  }

  upsertActualShipment(data: { brandName: string; skuId: number; sku: string; month: string; actualQuantity: number; shipmentDate?: string; notes?: string }): LocalActualShipment {
    let shipment = this.actualShipments.find(s => s.brandName === data.brandName && s.skuId === data.skuId && s.month === data.month);
    if (shipment) {
      shipment.actualQuantity = data.actualQuantity;
      shipment.shipmentDate = data.shipmentDate || null;
      shipment.notes = data.notes || null;
      shipment.updatedAt = new Date();
    } else {
      shipment = {
        id: this.nextActualShipmentId++,
        brandName: data.brandName,
        skuId: data.skuId,
        sku: data.sku,
        month: data.month,
        actualQuantity: data.actualQuantity,
        shipmentDate: data.shipmentDate || null,
        notes: data.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.actualShipments.push(shipment);
    }
    return shipment;
  }

  // ==================== 工厂库存相关 ====================
  getFactoryInventory(brandName: string): LocalFactoryInventory[] {
    return this.factoryInventory.filter(i => i.brandName === brandName);
  }

  upsertFactoryInventory(data: { brandName: string; skuId: number; sku: string; quantity?: number; pendingOrders?: number; month: string; additionalOrder?: number; suggestedOrder?: number }): LocalFactoryInventory {
    let inventory = this.factoryInventory.find(i => i.brandName === data.brandName && i.skuId === data.skuId && i.month === data.month);
    if (inventory) {
      if (data.quantity !== undefined) inventory.quantity = data.quantity;
      if (data.pendingOrders !== undefined) inventory.pendingOrders = data.pendingOrders;
      if (data.additionalOrder !== undefined) inventory.additionalOrder = data.additionalOrder;
      if (data.suggestedOrder !== undefined) inventory.suggestedOrder = data.suggestedOrder;
      inventory.updatedAt = new Date();
    } else {
      inventory = {
        id: this.nextFactoryInventoryId++,
        brandName: data.brandName,
        skuId: data.skuId,
        sku: data.sku,
        quantity: data.quantity || 0,
        pendingOrders: data.pendingOrders || 0,
        month: data.month,
        additionalOrder: data.additionalOrder || 0,
        suggestedOrder: data.suggestedOrder || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.factoryInventory.push(inventory);
    }
    return inventory;
  }
}

// 单例实例
export const localDb = new LocalDatabase();
