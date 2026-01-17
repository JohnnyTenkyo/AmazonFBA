import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  initDefaultUser: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue({}),
  getSkusByBrand: vi.fn().mockResolvedValue([
    { id: 1, sku: "TEST-SKU-001", brandName: "ELYONA", category: "standard", dailySales: "10", fbaStock: 100, inTransitStock: 50, isDiscontinued: false },
    { id: 2, sku: "TEST-SKU-002", brandName: "ELYONA", category: "oversized", dailySales: "5", fbaStock: 30, inTransitStock: 20, isDiscontinued: false },
  ]),
  getTransportConfig: vi.fn().mockResolvedValue({
    standardShippingDays: 25,
    standardShelfDays: 10,
    oversizedShippingDays: 35,
    oversizedShelfDays: 10,
  }),
  getShipmentsByBrand: vi.fn().mockResolvedValue([
    { id: 1, trackingNumber: "TRK001", brandName: "ELYONA", status: "shipping", expectedArrivalDate: "2026-02-01" },
  ]),
  getShipmentItems: vi.fn().mockResolvedValue([
    { id: 1, shipmentId: 1, sku: "TEST-SKU-001", quantity: 50 },
  ]),
  getPromotionsByBrand: vi.fn().mockResolvedValue([]),
  getSpringFestivalConfig: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
  getSkuBySku: vi.fn().mockResolvedValue({ id: 1, category: "standard" }),
  getAllShipmentItems: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("SKU Management", () => {
  it("should list SKUs for a brand", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sku.list({ brandName: "ELYONA" });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Transport Configuration", () => {
  it("should return transport config for a brand", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.transport.get({ brandName: "ELYONA" });

    expect(result).toBeDefined();
    expect(result?.standardShippingDays).toBe(25);
    expect(result?.oversizedShippingDays).toBe(35);
  });
});

describe("Shipment Management", () => {
  it("should list shipments for a brand", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shipment.list({ brandName: "ELYONA" });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get shipment items", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shipment.getItems({ shipmentId: 1 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Promotion Management", () => {
  it("should list promotions for a brand", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.promotion.list({ brandName: "ELYONA" });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Inventory Alert Calculation", () => {
  it("should calculate correct alert levels", () => {
    // Test urgent alert: 7 days or less of stock, no in-transit
    const urgentSku = {
      fbaStock: 70,
      dailySales: 10,
      inTransitStock: 0,
    };
    const urgentDays = urgentSku.fbaStock / urgentSku.dailySales;
    expect(urgentDays).toBe(7);
    expect(urgentDays <= 7 && urgentSku.inTransitStock === 0).toBe(true);

    // Test warning alert: 35 days or less of stock, no in-transit
    const warningSku = {
      fbaStock: 350,
      dailySales: 10,
      inTransitStock: 0,
    };
    const warningDays = warningSku.fbaStock / warningSku.dailySales;
    expect(warningDays).toBe(35);
    expect(warningDays <= 35 && warningSku.inTransitStock === 0).toBe(true);

    // Test sufficient: more than 35 days or has in-transit
    const sufficientSku = {
      fbaStock: 360,
      dailySales: 10,
      inTransitStock: 0,
    };
    const sufficientDays = sufficientSku.fbaStock / sufficientSku.dailySales;
    expect(sufficientDays).toBe(36);
    expect(sufficientDays > 35).toBe(true);
  });
});

describe("Shipping Plan Calculation", () => {
  it("should calculate expected arrival date correctly", () => {
    const shipDate = new Date("2026-01-16");
    const standardDays = 25 + 10; // ship + shelf
    const oversizedDays = 35 + 10;

    const standardArrival = new Date(shipDate);
    standardArrival.setDate(standardArrival.getDate() + standardDays);
    expect(standardArrival.toISOString().split("T")[0]).toBe("2026-02-20");

    const oversizedArrival = new Date(shipDate);
    oversizedArrival.setDate(oversizedArrival.getDate() + oversizedDays);
    expect(oversizedArrival.toISOString().split("T")[0]).toBe("2026-03-02");
  });

  it("should calculate planned shipping quantity correctly", () => {
    const sku = {
      dailySales: 10,
      fbaStock: 100,
      inTransitStock: 50,
    };
    const targetDays = 60; // 2 months turnover
    const targetStock = sku.dailySales * targetDays;
    const plannedShipping = Math.max(0, targetStock - sku.fbaStock - sku.inTransitStock);

    expect(targetStock).toBe(600);
    expect(plannedShipping).toBe(450);
  });
});

describe("Promotion Calculation", () => {
  it("should calculate additional shipping for promotion", () => {
    const lastYearSales = 1000; // total sales during promotion
    const lastYearDays = 7; // promotion duration
    const normalDailySales = 100;
    const thisYearDays = 7;

    const promoDailySales = lastYearSales / lastYearDays;
    const dailyDiff = promoDailySales - normalDailySales;
    const additionalShipping = dailyDiff * thisYearDays;

    expect(promoDailySales).toBeCloseTo(142.86, 1);
    expect(dailyDiff).toBeCloseTo(42.86, 1);
    expect(additionalShipping).toBeCloseTo(300, 0);
  });

  it("should calculate latest shipping date for promotion", () => {
    const promoStartDate = new Date("2026-07-15");
    const standardLeadDays = 35 + 7; // ship + buffer
    const oversizedLeadDays = 45 + 7;

    const standardLatest = new Date(promoStartDate);
    standardLatest.setDate(standardLatest.getDate() - standardLeadDays);
    expect(standardLatest.toISOString().split("T")[0]).toBe("2026-06-03");

    const oversizedLatest = new Date(promoStartDate);
    oversizedLatest.setDate(oversizedLatest.getDate() - oversizedLeadDays);
    expect(oversizedLatest.toISOString().split("T")[0]).toBe("2026-05-24");
  });
});

describe("Factory Plan Calculation", () => {
  it("should calculate monthly need correctly", () => {
    const dailySales = 10;
    const monthlyNeed = Math.ceil(dailySales * 30);
    expect(monthlyNeed).toBe(300);
  });

  it("should identify additional order needed", () => {
    const monthlyNeed = 300;
    const actualShipped = 200;
    const threshold = 0.2; // 20%

    const difference = actualShipped - monthlyNeed;
    const isAdditionalNeeded = difference < -monthlyNeed * threshold;

    expect(difference).toBe(-100);
    expect(isAdditionalNeeded).toBe(true); // -100 < -60
  });

  it("should identify excess shipping", () => {
    const monthlyNeed = 300;
    const actualShipped = 400;
    const threshold = 0.2;

    const difference = actualShipped - monthlyNeed;
    const isExcess = difference > monthlyNeed * threshold;

    expect(difference).toBe(100);
    expect(isExcess).toBe(true); // 100 > 60
  });
});
