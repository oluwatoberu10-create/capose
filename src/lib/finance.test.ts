import { describe, expect, it } from "vitest";
import {
  acquisitionTotal, commissionFor, deriveAvailability, effectiveAvailability, expectedProfit, grossVehicleProfit, isOrderable,
  netVehicleProfit, outstanding, perUnitCost, publicPrice, saleAmount, salePaymentStatus,
} from "./finance";
import { csvEscape, naira, nairaCompact, parseNaira, phoneKey, slugify, whatsappLink } from "./format";

describe("spec example: commission is 10% of profit, not of price", () => {
  it("₦20,000,000 cost + ₦500,000 expenses, sold at ₦23,000,000 → ₦2,500,000 profit → ₦250,000", () => {
    const cost = acquisitionTotal({ purchasePrice: 20_000_000, additionalPurchaseExpenses: 500_000 });
    expect(cost).toBe(20_500_000);
    const profit = netVehicleProfit({ sellingPrice: 23_000_000, acquisitionCost: cost });
    expect(profit).toBe(2_500_000);
    expect(commissionFor(profit)).toBe(250_000);
  });
});

describe("acquisition cost", () => {
  it("adds every recorded expense once", () => {
    expect(acquisitionTotal({ purchasePrice: 10, additionalPurchaseExpenses: 1, transportCost: 2, customsCost: 3, repairsCost: 4, otherExpenses: 5 })).toBe(25);
  });
  it("ignores blanks and negatives", () => {
    expect(acquisitionTotal({ purchasePrice: 100, transportCost: null, customsCost: -50 })).toBe(100);
  });
  it("splits a multi-unit purchase per unit", () => {
    expect(perUnitCost(90_000_000, 3)).toBe(30_000_000);
    expect(perUnitCost(100, 0)).toBe(100);
  });
});

describe("vehicle profit", () => {
  const s = { sellingPrice: 50_000_000, discount: 1_000_000, additionalIncome: 200_000, acquisitionCost: 40_000_000, saleExpenses: 300_000 };
  it("sale amount = price − discount + additional income", () => expect(saleAmount(s)).toBe(49_200_000));
  it("gross = sale amount − acquisition", () => expect(grossVehicleProfit(s)).toBe(9_200_000));
  it("net = sale amount − acquisition − sale expenses", () => expect(netVehicleProfit(s)).toBe(8_900_000));
  it("can be negative (a loss)", () => expect(netVehicleProfit({ sellingPrice: 10, acquisitionCost: 15 })).toBe(-5));
});

describe("commission", () => {
  it("is zero for no or negative profit", () => {
    expect(commissionFor(0)).toBe(0);
    expect(commissionFor(-1_000_000)).toBe(0);
    expect(commissionFor(Number.NaN)).toBe(0);
  });
  it("rounds to the nearest naira", () => expect(commissionFor(1_234_567)).toBe(123_457));
});

describe("payment status", () => {
  it("tracks unpaid / partial / full", () => {
    expect(salePaymentStatus(100, 0)).toBe("unpaid");
    expect(salePaymentStatus(100, 40)).toBe("partially_paid");
    expect(salePaymentStatus(100, 100)).toBe("fully_paid");
    expect(outstanding(100, 40)).toBe(60);
    expect(outstanding(100, 140)).toBe(0);
  });
});

describe("availability", () => {
  it("follows stock", () => {
    expect(deriveAvailability(3, 0)).toBe("available");
    expect(deriveAvailability(0, 0)).toBe("out_of_stock");
    expect(deriveAvailability(0, 1)).toBe("reserved");
  });
  it("respects a manual override", () => {
    expect(effectiveAvailability({ availability: "sold", availabilityOverride: true, stockQuantity: 2, reservedQuantity: 0 })).toBe("sold");
    expect(effectiveAvailability({ availability: "sold", availabilityOverride: false, stockQuantity: 2, reservedQuantity: 0 })).toBe("available");
  });
  it("only available cars are orderable", () => {
    expect(isOrderable("available")).toBe(true);
    expect(isOrderable("out_of_stock")).toBe(false);
    expect(isOrderable("reserved")).toBe(false);
  });
});

describe("prices", () => {
  it("uses a lower discount price publicly", () => {
    expect(publicPrice({ price: 100, discountPrice: 90 })).toEqual({ price: 90, was: 100 });
    expect(publicPrice({ price: 100, discountPrice: 120 })).toEqual({ price: 100, was: null });
    expect(publicPrice({ price: 100, discountPrice: null })).toEqual({ price: 100, was: null });
  });
  it("expected profit uses the public price", () => {
    expect(expectedProfit({ price: 100, discountPrice: 90, purchaseCost: 60, additionalExpenses: 5 })).toBe(25);
  });
});

describe("formatting", () => {
  it("formats Naira with grouping", () => {
    expect(naira(45_000_000)).toBe("₦45,000,000");
    expect(naira(-2500)).toBe("−₦2,500");
    expect(nairaCompact(45_000_000)).toBe("₦45M");
    expect(nairaCompact(850_000)).toBe("₦850K");
  });
  it("parses typed amounts", () => {
    expect(parseNaira("₦45,000,000")).toBe(45_000_000);
    expect(parseNaira("")).toBeNull();
    expect(parseNaira("abc")).toBeNaN();
  });
  it("normalises Nigerian phone numbers", () => {
    expect(phoneKey("0803 123 4567")).toBe("2348031234567");
    expect(phoneKey("+234 803 123 4567")).toBe("2348031234567");
    expect(whatsappLink("0803 123 4567", "Hi")).toBe("https://wa.me/2348031234567?text=Hi");
  });
  it("slugifies", () => expect(slugify("Toyota Camry 2023 — Black!")).toBe("toyota-camry-2023-black"));
  it("neutralises CSV formula injection", () => {
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvEscape('a,"b"')).toBe('"a,""b"""');
  });
});
