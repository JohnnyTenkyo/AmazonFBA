import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getSkusByBrand: vi.fn(),
  getSkuById: vi.fn(),
  getSkuBySku: vi.fn(),
  createSku: vi.fn(),
  updateSku: vi.fn(),
  deleteSku: vi.fn(),
  batchUpsertSkus: vi.fn(),
  clearAllSkus: vi.fn(),
  getUserByUsername: vi.fn(),
  hashPassword: vi.fn((p: string) => `hashed_${p}`),
  initDefaultUser: vi.fn().mockResolvedValue(undefined),
}));

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("sku router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list SKUs for a brand", async () => {
    const db = await import("./db");
    const mockSkus = [
      { id: 1, brandName: "ELYONA", sku: "SKU001", category: "standard", dailySales: "10.5" },
      { id: 2, brandName: "ELYONA", sku: "SKU002", category: "oversized", dailySales: "5.0" },
    ];
    vi.mocked(db.getSkusByBrand).mockResolvedValue(mockSkus as any);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sku.list({ brandName: "ELYONA" });

    expect(db.getSkusByBrand).toHaveBeenCalledWith("ELYONA");
    expect(result).toEqual(mockSkus);
  });

  it("should create a new SKU", async () => {
    const db = await import("./db");
    vi.mocked(db.getSkuBySku).mockResolvedValue(null);
    vi.mocked(db.createSku).mockResolvedValue(undefined);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sku.create({
      brandName: "ELYONA",
      sku: "NEW-SKU",
      category: "standard",
      dailySales: "15.5",
    });

    expect(db.createSku).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("should reject duplicate SKU", async () => {
    const db = await import("./db");
    vi.mocked(db.getSkuBySku).mockResolvedValue({ id: 1, sku: "EXISTING" } as any);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sku.create({
        brandName: "ELYONA",
        sku: "EXISTING",
        category: "standard",
      })
    ).rejects.toThrow("SKU已存在");
  });

  it("should update an existing SKU", async () => {
    const db = await import("./db");
    vi.mocked(db.updateSku).mockResolvedValue(undefined);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sku.update({
      id: 1,
      dailySales: "20.0",
      notes: "Updated notes",
    });

    expect(db.updateSku).toHaveBeenCalledWith(1, {
      dailySales: "20.0",
      notes: "Updated notes",
    });
    expect(result).toEqual({ success: true });
  });

  it("should delete a SKU", async () => {
    const db = await import("./db");
    vi.mocked(db.deleteSku).mockResolvedValue(undefined);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sku.delete({ id: 1 });

    expect(db.deleteSku).toHaveBeenCalledWith(1);
    expect(result).toEqual({ success: true });
  });

  it("should batch import SKUs", async () => {
    const db = await import("./db");
    vi.mocked(db.batchUpsertSkus).mockResolvedValue(undefined);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const items = [
      { sku: "BATCH-001", category: "standard" as const, dailySales: "10" },
      { sku: "BATCH-002", category: "oversized" as const, dailySales: "5" },
    ];

    const result = await caller.sku.batchImport({
      brandName: "ELYONA",
      items,
    });

    expect(db.batchUpsertSkus).toHaveBeenCalled();
    expect(result).toEqual({ success: true, count: 2 });
  });

  it("should clear all SKUs for a brand", async () => {
    const db = await import("./db");
    vi.mocked(db.clearAllSkus).mockResolvedValue(undefined);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sku.clearAll({ brandName: "ELYONA" });

    expect(db.clearAllSkus).toHaveBeenCalledWith("ELYONA");
    expect(result).toEqual({ success: true });
  });
});

describe("auth router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should login with valid credentials", async () => {
    const db = await import("./db");
    const mockUser = {
      id: 1,
      username: "ELYONA",
      password: "hashed_123456",
      brandName: "ELYONA",
      name: "Test User",
    };
    vi.mocked(db.getUserByUsername).mockResolvedValue(mockUser as any);
    vi.mocked(db.hashPassword).mockReturnValue("hashed_123456");

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "ELYONA",
      password: "123456",
    });

    expect(result.success).toBe(true);
    expect(result.user.username).toBe("ELYONA");
  });

  it("should reject invalid credentials", async () => {
    const db = await import("./db");
    vi.mocked(db.getUserByUsername).mockResolvedValue(null);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        username: "INVALID",
        password: "wrong",
      })
    ).rejects.toThrow("用户名或密码错误");
  });
});
