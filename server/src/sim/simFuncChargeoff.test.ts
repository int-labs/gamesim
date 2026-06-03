import { calculateCompoundingChargeOffs, getCustomerCountSumForRiskLevel } from './simFuncChargeoff';

describe('Chargeoff Calculation', () => {
  it('should match Python output for risk_level 9', () => {
    const deltaCustomers = 801129;
    const riskLevel = 9;
    const start = 0.0267;
    const minLevelForCumulative = 0;

    const { table } = calculateCompoundingChargeOffs({ deltaCustomers, riskLevel, start, minLevelForCumulative });

    // Get customer count for level 19 and 20
    const lv19 = parseInt(table[19].customerCount.replace(/,/g, ''));
    const lv20 = parseInt(table[20].customerCount.replace(/,/g, ''));
    const sum = lv19 + lv20;

    expect(sum).toBe(1750); // Should match the Python output
  });

  it('should match all Customer Count values from Python output', () => {
    const deltaCustomers = 801129;
    const riskLevel = 9;
    const start = 0.0267;
    const minLevelForCumulative = 0;
    const expectedCustomerCounts = [
      2837, 5918, 11323, 19867, 31972, 47188, 63873, 79294, 90281, 94271,
      90281, 79294, 63873, 47188, 31972, 19867, 11323, 5918, 2837, 1247, 503
    ];
    const { table } = calculateCompoundingChargeOffs({ deltaCustomers, riskLevel, start, minLevelForCumulative });
    for (let i = 0; i <= 20; i++) {
      const actual = parseInt(table[i].customerCount.replace(/,/g, ''));
      expect(actual).toBe(expectedCustomerCounts[i]);
    }
    // Optionally check the total
    const total = parseInt(table[21].customerCount.replace(/,/g, ''));
    expect(total).toBe(801129);
  });

  it('should return 1750 for capNewMarket when riskLevel = 19 (sum of customerCount for 19 and 20 from riskLevel 9 table)', () => {
    const deltaCustomers = 801129;
    const riskLevel = 9;
    const start = 0.0267;
    const minLevelForCumulative = 0;
    const { table } = calculateCompoundingChargeOffs({ deltaCustomers, riskLevel, start, minLevelForCumulative });
    const sum = parseInt(table[19].customerCount.replace(/,/g, '')) + parseInt(table[20].customerCount.replace(/,/g, ''));
    expect(sum).toBe(1247 + 503); // Should be 1750
  });

  it('should sum to delta_customers for any input', () => {
    const testValues = [100, 1000, 123456, 999999];
    const riskLevel = 9;
    const start = 0.0267;
    const minLevelForCumulative = 0;
    for (const deltaCustomers of testValues) {
      const { table } = calculateCompoundingChargeOffs({ deltaCustomers, riskLevel, start, minLevelForCumulative });
      const total = parseInt(table[21].customerCount.replace(/,/g, ''));
      expect(total).toBe(Math.round(deltaCustomers));
    }
  });
}); 