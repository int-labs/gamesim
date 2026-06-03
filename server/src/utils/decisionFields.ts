const requiredFieldDefaults = {
  projected_market_share: 0,
  interest_rate: 0,
  fees: 0,
  marketing_spent: 0,
  product_level: 0,
};

export function mapFields(
  fields: { key: string; value: number }[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const field of fields) {
    result[field.key] = field.value;
  }
  return result;
}

export function extractFields(
  productInput: Record<string, number>,
  defaults: typeof requiredFieldDefaults
): Record<string, number> {
  const extracted: Record<string, number> = {};
  for (const key in defaults) {
    const typedKey = key as keyof typeof requiredFieldDefaults;
    extracted[key] = productInput[typedKey] ?? defaults[typedKey];
  }
  return extracted;
}
