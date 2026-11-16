import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createNumberFormatter, type NumberFormatPolicy, type NumberFormatter } from "./numberFormat";

const NumberFormatContext = createContext<NumberFormatter>(createNumberFormatter());

/** Sets the app's number policy (locale and currency) for every design-system component inside it. */
export function NumberFormatProvider({ locale, currency, children }: NumberFormatPolicy & { children: ReactNode }) {
  const formatter = useMemo(() => createNumberFormatter({ locale, currency }), [locale, currency]);
  return <NumberFormatContext.Provider value={formatter}>{children}</NumberFormatContext.Provider>;
}

/** The app's number formatter (en-US and USD outside a NumberFormatProvider). */
export function useNumberFormat(): NumberFormatter {
  return useContext(NumberFormatContext);
}
