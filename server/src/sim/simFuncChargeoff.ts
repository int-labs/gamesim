export interface ChargeOffRow {
  minCredit: number | string;
  frequency: string;
  normDist: string;
  customerCount: string;
  expectedChargeOffs: string;
}

interface ChargeOffInput {
  deltaCustomers: number;
  riskLevel: number;
  start: number;
  minLevelForCumulative: number;
}

const STD_DEV = 0.17;
const STEP = 0.0025;

export function calculateCompoundingChargeOffs(input: ChargeOffInput): {
  table: ChargeOffRow[];
  cumulativeCustomerCount: number;
} {
  const { deltaCustomers, riskLevel, start, minLevelForCumulative } = input;
  const mean = riskLevel / 20;
  const results: ChargeOffRow[] = [];

  // Normal distribution PDF calculation (same as Python's scipy.stats.norm.pdf)
  const normPDF = (x: number, mean: number, stdDev: number): number => {
    const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  };

  // Step 1: calculate distribution
  const normDists: number[] = Array.from({ length: 21 }, (_, i) => {
    const freq = i * 0.05;
    return normPDF(freq, mean, STD_DEV);
  });

  const totalNormDist = normDists.reduce((sum, val) => sum + val, 0);

  let totalCustomerCount = 0;
  let totalChargeOffWeighted = 0;
  let chargeOffPct = 0;

  const rawCustomerCounts: number[] = [];

  for (let i = 0; i <= 20; i++) {
    const freq = i * 0.05;
    const norm = normDists[i];
    const normPercent = norm / totalNormDist;
    const customerCount = deltaCustomers * normPercent;
    rawCustomerCounts.push(customerCount);
    totalCustomerCount += customerCount;

    // Compound charge-off %
    if (i === 0) {
      chargeOffPct = start * 100;
    } else {
      chargeOffPct += STEP * i * 100;
    }

    totalChargeOffWeighted += chargeOffPct * customerCount;

    results.push({
      minCredit: i,
      frequency: `${Math.round(freq * 100)}%`,
      normDist: `${(norm * 100).toFixed(1)}%`,
      customerCount: customerCount.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      }),
      expectedChargeOffs: `${chargeOffPct.toFixed(2)}%`,
    });
  }

  // Step 2: compute cumulative customer count from minLevel to 20
  let cumulativeCustomerCount = 0;
  for (let i = minLevelForCumulative; i <= 20; i++) {
    cumulativeCustomerCount += rawCustomerCounts[i];
  }

  // Step 3: add total row to table
  const weightedAvgChargeOff = totalChargeOffWeighted / deltaCustomers;
  results.push({
    minCredit: "Total",
    frequency: "-",
    normDist: "100.0%",
    customerCount: Math.round(totalCustomerCount).toLocaleString(),
    expectedChargeOffs: `${weightedAvgChargeOff.toFixed(2)}%`,
  });

  return {
    table: results,
    cumulativeCustomerCount: Math.round(cumulativeCustomerCount),
  };
}

// Helper function to get just the customer count sum for a given risk level
export function getCustomerCountSumForRiskLevel(
  deltaCustomers: number,
  riskLevel: number
): number {
  const { cumulativeCustomerCount } = calculateCompoundingChargeOffs({
    deltaCustomers,
    riskLevel,
    start: 0.0267, // Using same default as Python example
    minLevelForCumulative: riskLevel,
  });

  return cumulativeCustomerCount;
}

export function sumCustomerCountFromLevel(
  table: ChargeOffRow[],
  fromLevel: number
): number {
  let sum = 0;
  for (let i = fromLevel; i <= 20; i++) {
    sum += parseInt(table[i].customerCount.replace(/,/g, ""));
  }
  return sum;
}
