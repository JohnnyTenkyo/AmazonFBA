import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { hashPassword, initDefaultUser } from "./db";

// 初始化默认用户
initDefaultUser().catch(console.error);

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    // 用户名密码登录
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByUsername(input.username);
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '用户名或密码错误' });
        }
        
        const hashedPassword = hashPassword(input.password);
        if (user.password !== hashedPassword) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '用户名或密码错误' });
        }
        
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            brandName: user.brandName,
            name: user.name,
          }
        };
      }),
    
    // 注册
    register: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: '用户名已存在' });
        }
        
        const user = await db.createUserWithPassword(input.username, input.password);
        return {
          success: true,
          user: {
            id: user?.id,
            username: user?.username,
            brandName: user?.brandName,
          }
        };
      }),
    
    // 修改密码
    changePassword: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        oldPassword: z.string().min(1),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByUsername(input.username);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }
        
        const hashedOldPassword = hashPassword(input.oldPassword);
        if (user.password !== hashedOldPassword) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '旧密码错误' });
        }
        
        await db.updateUserPassword(user.id, input.newPassword);
        return { success: true };
      }),
  }),

  // SKU管理
  sku: router({
    list: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        return db.getSkusByBrand(input.brandName);
      }),
    
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSkuById(input.id);
      }),
    
    create: publicProcedure
      .input(z.object({
        sku: z.string().min(1),
        category: z.enum(['standard', 'oversized']),
        dailySales: z.string().optional(),
        notes: z.string().optional(),
        brandName: z.string().min(1),
        isDiscontinued: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getSkuBySku(input.sku, input.brandName);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'SKU已存在' });
        }
        await db.createSku(input);
        return { success: true };
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        sku: z.string().optional(),
        category: z.enum(['standard', 'oversized']).optional(),
        dailySales: z.string().optional(),
        notes: z.string().optional(),
        isDiscontinued: z.boolean().optional(),
        fbaStock: z.number().optional(),
        inTransitStock: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSku(id, data);
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSku(input.id);
        return { success: true };
      }),
    
    clearAll: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .mutation(async ({ input }) => {
        await db.clearAllSkus(input.brandName);
        return { success: true };
      }),
    
    batchImport: publicProcedure
      .input(z.object({
        brandName: z.string(),
        items: z.array(z.object({
          sku: z.string(),
          category: z.enum(['standard', 'oversized']),
          dailySales: z.string().optional(),
          notes: z.string().optional(),
          isDiscontinued: z.boolean().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        const items = input.items.map(item => ({
          ...item,
          brandName: input.brandName,
        }));
        await db.batchUpsertSkus(items);
        return { success: true, count: items.length };
      }),
  }),

  // FBA库存同步
  sync: router({
    history: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        return db.getSyncHistoryByBrand(input.brandName);
      }),
    
    upload: publicProcedure
      .input(z.object({
        brandName: z.string(),
        fileName: z.string(),
        records: z.array(z.object({
          msku: z.string(),
          fbaStock: z.number(),
          inTransitStock: z.number(),
        }))
      }))
      .mutation(async ({ input }) => {
        // 创建同步历史记录
        const historyResult = await db.createSyncHistory({
          brandName: input.brandName,
          fileName: input.fileName,
          totalRecords: input.records.length,
          status: 'processing',
        });
        
        let successCount = 0;
        let failCount = 0;
        
        for (const record of input.records) {
          try {
            const sku = await db.getSkuBySku(record.msku, input.brandName);
            if (sku) {
              await db.updateSku(sku.id, {
                fbaStock: record.fbaStock,
                inTransitStock: record.inTransitStock,
                lastSyncAt: new Date(),
              });
              successCount++;
            } else {
              failCount++;
            }
          } catch (e) {
            failCount++;
          }
        }
        
        // 更新同步历史
        const historyId = (historyResult as any)[0]?.insertId;
        if (historyId) {
          await db.updateSyncHistory(historyId, {
            successCount,
            failCount,
            status: 'completed',
          });
        }
        
        return { success: true, successCount, failCount };
      }),
  }),

  // 运输配置
  transport: router({
    get: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        const config = await db.getTransportConfig(input.brandName);
        if (!config) {
          // 返回默认配置
          return {
            standardShippingDays: 25,
            standardShelfDays: 10,
            oversizedShippingDays: 35,
            oversizedShelfDays: 10,
          };
        }
        return config;
      }),
    
    update: publicProcedure
      .input(z.object({
        brandName: z.string(),
        standardShippingDays: z.number().optional(),
        standardShelfDays: z.number().optional(),
        oversizedShippingDays: z.number().optional(),
        oversizedShelfDays: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { brandName, ...data } = input;
        await db.upsertTransportConfig(brandName, data);
        return { success: true };
      }),
  }),

  // 货件管理
  shipment: router({
    list: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        return db.getShipmentsByBrand(input.brandName);
      }),
    
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const shipment = await db.getShipmentById(input.id);
        if (!shipment) return null;
        
        const items = await db.getShipmentItems(input.id);
        return { ...shipment, items };
      }),
    
    create: publicProcedure
      .input(z.object({
        brandName: z.string(),
        trackingNumber: z.string(),
        warehouse: z.string().optional(),
        shipDate: z.string().optional(),
        expectedArrivalDate: z.string().optional(),
        category: z.enum(['standard', 'oversized']),
        items: z.array(z.object({
          skuId: z.number(),
          sku: z.string(),
          quantity: z.number(),
        }))
      }))
      .mutation(async ({ input }) => {
        const { items, ...shipmentData } = input;
        const result = await db.createShipment(shipmentData as any);
        const shipmentId = (result as any)[0]?.insertId;
        
        if (shipmentId) {
          for (const item of items) {
            await db.createShipmentItem({
              shipmentId,
              ...item,
            });
          }
        }
        
        return { success: true, shipmentId };
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['shipping', 'arrived', 'early', 'delayed']).optional(),
        actualArrivalDate: z.string().optional(),
        expectedArrivalDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateShipment(id, data as any);
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteShipment(input.id);
        return { success: true };
      }),
    
    clearAll: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .mutation(async ({ input }) => {
        await db.clearAllShipments(input.brandName);
        return { success: true };
      }),
    
    // 标记到达
    markArrived: publicProcedure
      .input(z.object({
        id: z.number(),
        actualArrivalDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        const shipment = await db.getShipmentById(input.id);
        if (!shipment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '货件不存在' });
        }
        
        // 判断是提前还是延迟到达
        let status: 'arrived' | 'early' | 'delayed' = 'arrived';
        if (shipment.expectedArrivalDate) {
          const expected = new Date(shipment.expectedArrivalDate);
          const actual = new Date(input.actualArrivalDate);
          if (actual < expected) {
            status = 'early';
          } else if (actual > expected) {
            status = 'delayed';
          }
        }
        
        await db.updateShipment(input.id, {
          status,
          actualArrivalDate: input.actualArrivalDate,
        } as any);
        
        // 更新SKU的在途库存到在售库存
        const items = await db.getShipmentItems(input.id);
        for (const item of items) {
          const sku = await db.getSkuById(item.skuId);
          if (sku) {
            await db.updateSku(item.skuId, {
              fbaStock: (sku.fbaStock || 0) + item.quantity,
              inTransitStock: Math.max(0, (sku.inTransitStock || 0) - item.quantity),
            });
          }
        }
        
        return { success: true, status };
      }),
    
    // 批量导入货件
    batchImport: publicProcedure
      .input(z.object({
        brandName: z.string(),
        items: z.array(z.object({
          sku: z.string(),
          trackingNumber: z.string(),
          warehouse: z.string().optional(),
          quantity: z.number(),
          shipDate: z.string().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        // 获取所有SKU信息用于匹配类别
        const allSkus = await db.getSkusByBrand(input.brandName);
        const skuMap = new Map(allSkus.map((s: any) => [s.sku, s]));
        
        // 按货运号分组
        const shipmentMap = new Map<string, { items: typeof input.items; category: 'standard' | 'oversized' }>();
        for (const item of input.items) {
          const skuRecord = skuMap.get(item.sku);
          const category = skuRecord?.category || 'standard';
          
          const existing = shipmentMap.get(item.trackingNumber);
          if (existing) {
            existing.items.push(item);
            // 如果有任何一个大件，整个货件按大件处理
            if (category === 'oversized') {
              existing.category = 'oversized';
            }
          } else {
            shipmentMap.set(item.trackingNumber, { items: [item], category });
          }
        }
        
        // 获取运输配置
        const config = await db.getTransportConfig(input.brandName);
        const standardDays = (config?.standardShippingDays || 25) + (config?.standardShelfDays || 10);
        const oversizedDays = (config?.oversizedShippingDays || 35) + (config?.oversizedShelfDays || 10);
        
        let createdCount = 0;
        
        for (const [trackingNumber, { items, category }] of Array.from(shipmentMap.entries())) {
          const firstItem = items[0];
          const totalDays = category === 'standard' ? standardDays : oversizedDays;
          
          // 计算预计到货日期
          let expectedArrivalDate: string | undefined;
          if (firstItem.shipDate) {
            const shipDate = new Date(firstItem.shipDate);
            const arrivalDate = new Date(shipDate);
            arrivalDate.setDate(arrivalDate.getDate() + totalDays);
            expectedArrivalDate = arrivalDate.toISOString().split('T')[0];
          }
          
          const result = await db.createShipment({
            brandName: input.brandName,
            trackingNumber,
            warehouse: firstItem.warehouse,
            shipDate: firstItem.shipDate,
            expectedArrivalDate,
            category,
          } as any);
          
          const shipmentId = (result as any)[0]?.insertId;
          if (shipmentId) {
            for (const item of items) {
              const skuRecord = skuMap.get(item.sku);
              await db.createShipmentItem({
                shipmentId,
                skuId: skuRecord?.id || 0,
                sku: item.sku,
                quantity: item.quantity,
              });
            }
            createdCount++;
          }
        }
        
        return { success: true, count: createdCount };
      }),
    
    // 按SKU获取在途货件
    getBySkuId: publicProcedure
      .input(z.object({ skuId: z.number() }))
      .query(async ({ input }) => {
        return db.getShipmentItemsBySku(input.skuId);
      }),
    
    // 获取货件明细
    getItems: publicProcedure
      .input(z.object({ shipmentId: z.number() }))
      .query(async ({ input }) => {
        return db.getShipmentItems(input.shipmentId);
      }),
    
    // 获取所有货件明细（用于发货计划页面）
    listAllItems: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        return db.getAllShipmentItems(input.brandName);
      }),
    
    // 更新预计到货日期 - 仅更新日期，不改变状态（除非是运输中状态）
    updateExpectedDate: publicProcedure
      .input(z.object({
        id: z.number(),
        expectedArrivalDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        const shipment = await db.getShipmentById(input.id);
        if (!shipment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '货件不存在' });
        }
        
        // 只更新预计到货日期，不改变状态
        // 状态只在确认到达时根据实际到达日期判断
        await db.updateShipment(input.id, {
          expectedArrivalDate: input.expectedArrivalDate,
        } as any);
        
        return { success: true, status: shipment.status };
      }),
    
    // 撤销到达状态
    undoArrival: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const shipment = await db.getShipmentById(input.id);
        if (!shipment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '货件不存在' });
        }
        
        // 检查是否已到达
        if (!['arrived', 'early', 'delayed'].includes(shipment.status as string) || !shipment.actualArrivalDate) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '货件尚未标记为到达' });
        }
        
        // 恢复SKU的库存数据
        const items = await db.getShipmentItems(input.id);
        for (const item of items) {
          const sku = await db.getSkuById(item.skuId);
          if (sku) {
            await db.updateSku(item.skuId, {
              fbaStock: Math.max(0, (sku.fbaStock || 0) - item.quantity),
              inTransitStock: (sku.inTransitStock || 0) + item.quantity,
            });
          }
        }
        
        // 更新货件状态为运输中
        await db.updateShipment(input.id, {
          status: 'shipping',
          actualArrivalDate: null,
        } as any);
        
        return { success: true };
      }),
  }),

  // 促销管理
  promotion: router({
    list: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        return db.getPromotionsByBrand(input.brandName);
      }),
    
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const promotion = await db.getPromotionById(input.id);
        if (!promotion) return null;
        
        const sales = await db.getPromotionSales(input.id);
        return { ...promotion, sales };
      }),
    
    create: publicProcedure
      .input(z.object({
        brandName: z.string(),
        name: z.string(),
        lastYearStartDate: z.string().optional(),
        lastYearEndDate: z.string().optional(),
        thisYearStartDate: z.string().optional(),
        thisYearEndDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createPromotion(input as any);
        return { success: true };
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        lastYearStartDate: z.string().optional(),
        lastYearEndDate: z.string().optional(),
        thisYearStartDate: z.string().optional(),
        thisYearEndDate: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePromotion(id, data as any);
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePromotion(input.id);
        return { success: true };
      }),
    
    // 获取促销项目的历史销量数据
    getSales: publicProcedure
      .input(z.object({ promotionId: z.number() }))
      .query(async ({ input }) => {
        return db.getPromotionSales(input.promotionId);
      }),
    
    // 导入历史销量
    importSales: publicProcedure
      .input(z.object({
        promotionId: z.number(),
        brandName: z.string(),
        items: z.array(z.object({
          sku: z.string(),
          sales: z.number(),
        }))
      }))
      .mutation(async ({ input }) => {
        let count = 0;
        for (const item of input.items) {
          // 通过SKU查找对应的skuId
          const skuRecord = await db.getSkuBySku(item.sku, input.brandName);
          if (skuRecord) {
            await db.upsertPromotionSale({
              promotionId: input.promotionId,
              skuId: skuRecord.id,
              sku: item.sku,
              lastYearSales: item.sales,
            });
            count++;
          }
        }
        return { success: true, count };
      }),
  }),

  // 春节配置
  springFestival: router({
    get: publicProcedure
      .input(z.object({ brandName: z.string(), year: z.number() }))
      .query(async ({ input }) => {
        const config = await db.getSpringFestivalConfig(input.brandName, input.year);
        return config || null;
      }),
    
    update: publicProcedure
      .input(z.object({
        brandName: z.string(),
        year: z.number(),
        holidayStartDate: z.string().optional(),
        holidayEndDate: z.string().optional(),
        lastShipDate: z.string().optional(),
        returnToWorkDate: z.string().optional(),
        firstShipDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { brandName, year, holidayStartDate, holidayEndDate, lastShipDate, returnToWorkDate, firstShipDate } = input;
        await db.upsertSpringFestivalConfig(brandName, year, {
          holidayStartDate,
          holidayEndDate,
          lastShipDate,
          returnToWorkDate,
          firstShipDate,
        });
        return { success: true };
      }),
    
    clear: publicProcedure
      .input(z.object({
        brandName: z.string(),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.deleteSpringFestivalConfig(input.brandName, input.year);
        return { success: true };
      }),
  }),

  // 实际发货记录
  actualShipment: router({
    list: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        return db.getActualShipmentsByBrand(input.brandName);
      }),
    
    getBySku: publicProcedure
      .input(z.object({ skuId: z.number(), brandName: z.string() }))
      .query(async ({ input }) => {
        // 返回该SKU的所有实际发货记录
        const allRecords = await db.getActualShipmentsByBrand(input.brandName);
        return allRecords.filter((r: any) => r.skuId === input.skuId);
      }),
    
    create: publicProcedure
      .input(z.object({
        brandName: z.string(),
        skuId: z.number(),
        sku: z.string(),
        shipDate: z.string(),
        quantity: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createActualShipment(input as any);
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteActualShipment(input.id);
        return { success: true };
      }),
  }),

  // 工厂库存
  factoryInventory: router({
    list: publicProcedure
      .input(z.object({ brandName: z.string(), month: z.string().optional() }))
      .query(async ({ input }) => {
        return db.getFactoryInventoryByBrand(input.brandName, input.month);
      }),
    
    upsert: publicProcedure
      .input(z.object({
        brandName: z.string(),
        skuId: z.number(),
        sku: z.string(),
        month: z.string(),
        quantity: z.number().optional(),
        pendingOrders: z.number().optional(),
        additionalOrder: z.number().optional(),
        suggestedOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertFactoryInventory(input as any);
        return { success: true };
      }),
    
    batchImport: publicProcedure
      .input(z.object({
        brandName: z.string(),
        month: z.string(),
        items: z.array(z.object({
          skuId: z.number(),
          sku: z.string(),
          quantity: z.number(),
          pendingOrders: z.number().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        for (const item of input.items) {
          await db.upsertFactoryInventory({
            brandName: input.brandName,
            month: input.month,
            ...item,
          });
        }
        return { success: true };
      }),
  }),

  // 概览数据
  dashboard: router({
    summary: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        const allSkus = await db.getSkusByBrand(input.brandName);
        const activeSkus = allSkus.filter((s: any) => !s.isDiscontinued);
        const shipments = await db.getShipmentsByBrand(input.brandName);
        const shippingShipments = shipments.filter((s: any) => s.status === 'shipping');
        
        // 计算库存预警
        let urgentCount = 0;
        let warningCount = 0;
        let sufficientCount = 0;
        
        for (const sku of activeSkus) {
          const dailySales = parseFloat(sku.dailySales?.toString() || '0');
          const fbaStock = sku.fbaStock || 0;
          const inTransitStock = sku.inTransitStock || 0;
          
          if (dailySales <= 0) {
            sufficientCount++;
            continue;
          }
          
          const daysOfStock = fbaStock / dailySales;
          const totalDaysOfStock = (fbaStock + inTransitStock) / dailySales;
          
          if (daysOfStock <= 7 && inTransitStock === 0) {
            urgentCount++;
          } else if (daysOfStock <= 35 && inTransitStock === 0) {
            warningCount++;
          } else if (totalDaysOfStock > 35) {
            sufficientCount++;
          } else {
            warningCount++;
          }
        }
        
        return {
          totalSkus: allSkus.length,
          activeSkus: activeSkus.length,
          discontinuedSkus: allSkus.length - activeSkus.length,
          shippingShipments: shippingShipments.length,
          urgentCount,
          warningCount,
          sufficientCount,
        };
      }),
    
    // 库存预警列表
    alerts: publicProcedure
      .input(z.object({ brandName: z.string() }))
      .query(async ({ input }) => {
        const allSkus = await db.getSkusByBrand(input.brandName);
        const activeSkus = allSkus.filter((s: any) => !s.isDiscontinued);
        
        const urgent: typeof activeSkus = [];
        const warning: typeof activeSkus = [];
        const sufficient: typeof activeSkus = [];
        
        for (const sku of activeSkus) {
          const dailySales = parseFloat(sku.dailySales?.toString() || '0');
          const fbaStock = sku.fbaStock || 0;
          const inTransitStock = sku.inTransitStock || 0;
          
          if (dailySales <= 0) {
            sufficient.push(sku);
            continue;
          }
          
          const daysOfStock = fbaStock / dailySales;
          const totalDaysOfStock = (fbaStock + inTransitStock) / dailySales;
          
          if (daysOfStock <= 7 && inTransitStock === 0) {
            urgent.push(sku);
          } else if (daysOfStock <= 35 && inTransitStock === 0) {
            warning.push(sku);
          } else if (totalDaysOfStock > 35) {
            sufficient.push(sku);
          } else {
            warning.push(sku);
          }
        }
        
        return { urgent, warning, sufficient };
      }),
  }),
});

export type AppRouter = typeof appRouter;
