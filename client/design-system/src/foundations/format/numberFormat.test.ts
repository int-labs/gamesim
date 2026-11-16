import { createNumberFormatter } from "./numberFormat";

// Parity with the helpers the clients use today (utils/formatCost.ts, utils/hooks/useCurrency.ts,
// utils/formatOutputFieldValue.ts, utils/formattingUtils.tsx), re-implemented here as the oracle.
const legacy = {
  formatCost: (value: number, fractionDigits: number, withCurrency: boolean, currency = "USD") =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      ...(withCurrency ? { style: "currency", currency, currencyDisplay: "narrowSymbol" } : {}),
    }).format(value),
  formatMoney: (value: number, currency: string, fractionDigits = 2) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value),
  outputMoney: (value: number, currency: string, decimals = 0) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value),
  outputNumber: (value: number, decimals = 0) =>
    value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  outputPercent: (value: number, digits: number) =>
    `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`,
  formatChangePercent: (change: number) =>
    change.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0, style: "percent", signDisplay: "exceptZero" }),
};

const VALUES = [0, 1, -1, 0.5, 12.345, 999, 1000, 1234.5, -1234.5, 56789.123, 1_000_000, 3_000_000_000, -42_000];

describe("createNumberFormatter (en-US, the policy every client uses today)", () => {
  const usd = createNumberFormatter();
  const idr = createNumberFormatter({ currency: "IDR" });

  it("formats plain numbers like the output fields", () => {
    for (const value of VALUES) {
      expect(usd.number(value)).toBe(legacy.outputNumber(value));
      expect(usd.number(value, { decimals: 2 })).toBe(legacy.outputNumber(value, 2));
    }
  });

  it("formats money like the output fields, in the simulation's currency", () => {
    for (const value of VALUES) {
      expect(usd.money(value)).toBe(legacy.outputMoney(value, "USD"));
      expect(usd.money(value, { decimals: 2 })).toBe(legacy.outputMoney(value, "USD", 2));
      expect(idr.money(value)).toBe(legacy.outputMoney(value, "IDR"));
    }
  });

  it("formats compact costs like formatCost", () => {
    for (const value of VALUES) {
      expect(usd.money(value, { compact: true })).toBe(legacy.formatCost(value, 0, true));
      expect(usd.money(value, { compact: true, decimals: 1 })).toBe(legacy.formatCost(value, 1, true));
      expect(usd.number(value, { compact: true })).toBe(legacy.formatCost(value, 0, false));
    }
    expect(usd.money(5000, { compact: true })).toBe("$5K");
  });

  it("differs from useCurrency's formatMoney only in using the narrow symbol", () => {
    // useCurrency omits currencyDisplay: same as narrowSymbol for USD, "IDR 1.23M" instead of "Rp 1.23M" for IDR.
    expect(usd.money(1_234_567, { compact: true, decimals: 2 })).toBe(legacy.formatMoney(1_234_567, "USD"));
  });

  it("formats ratios as percentages like the output fields", () => {
    for (const value of [0, 0.1234, 0.5, 1, -0.0321, 0.00049]) {
      expect(usd.percent(value)).toBe(legacy.outputPercent(value, 0));
      expect(usd.percent(value, { decimals: 2 })).toBe(legacy.outputPercent(value, 2));
    }
  });

  it("signs changes like formatChangePercent", () => {
    for (const value of [0, 0.99, -0.99, 0.004, 1.5]) {
      expect(usd.percent(value, { signed: true })).toBe(legacy.formatChangePercent(value));
    }
    expect(usd.percent(0.99, { signed: true })).toBe("+99%");
    expect(usd.percent(-0.99, { signed: true })).toBe("-99%");
    expect(usd.percent(0, { signed: true })).toBe("0%");
  });

  it("writes negative amounts in parentheses for statements", () => {
    expect(usd.money(-1234.5, { accounting: true, decimals: 2 })).toBe("($1,234.50)");
    expect(usd.money(1234.5, { accounting: true, decimals: 2 })).toBe("$1,234.50");
  });

  it("exposes its policy", () => {
    expect(usd.locale).toBe("en-US");
    expect(usd.currency).toBe("USD");
    expect(idr.currency).toBe("IDR");
  });
});
