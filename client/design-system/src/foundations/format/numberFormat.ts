/**
 * Number formatting with one policy per app (decision D23): the locale for grouping and decimals
 * (en-US by default, as every client formats today) and the simulation's currency.
 */
export interface NumberFormatPolicy {
  /** BCP 47 locale for grouping and decimal marks. Default "en-US". */
  locale?: string;
  /** ISO 4217 currency code of the simulation (SimulationType.currency). Default "USD". */
  currency?: string;
}

interface CommonOptions {
  /** Exact number of decimals (minimum and maximum). */
  decimals?: number;
  /** Short scale: 1.2K, 3.4M, 5B. */
  compact?: boolean;
  /** Always show the sign, except for zero: +12, -3, 0. */
  signed?: boolean;
}

export interface MoneyOptions extends CommonOptions {
  /** Negative amounts in parentheses, as in financial statements: ($1,234). */
  accounting?: boolean;
}

export interface NumberFormatter {
  readonly locale: string;
  readonly currency: string;
  /** 1234.5 → "1,235"; with decimals 2 → "1,234.50". */
  number(value: number, options?: CommonOptions): string;
  /** An amount in the app's currency: 1234.5 → "$1,235"; compact → "$1K"; accounting → "($1,235)" when negative. */
  money(value: number, options?: MoneyOptions): string;
  /** A ratio as a percentage: 0.1234 → "12%"; with decimals 2 → "12.34%"; signed → "+12%". */
  percent(ratio: number, options?: Omit<CommonOptions, "compact">): string;
}

const cache = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
}

function common({ decimals = 0, compact = false, signed = false }: CommonOptions): Intl.NumberFormatOptions {
  return {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...(compact ? { notation: "compact", compactDisplay: "short" } : {}),
    ...(signed ? { signDisplay: "exceptZero" } : {}),
  };
}

export function createNumberFormatter({ locale = "en-US", currency = "USD" }: NumberFormatPolicy = {}): NumberFormatter {
  return {
    locale,
    currency,
    number: (value, options = {}) => formatterFor(locale, common(options)).format(value),
    money: (value, { accounting = false, ...options } = {}) =>
      formatterFor(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        ...(accounting ? { currencySign: "accounting" } : {}),
        ...common(options),
      }).format(value),
    percent: (ratio, options = {}) => formatterFor(locale, { style: "percent", ...common(options) }).format(ratio),
  };
}
