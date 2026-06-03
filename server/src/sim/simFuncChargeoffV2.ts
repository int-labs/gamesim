export interface ChargeOffRow {
  minCredit: number | string;
  frequency: string;
  normDist: string;
  customerCount: number;
  expectedChargeOffs: string;
  consumerAllocation: string;
  expectedDefaultCount: number;
}

export interface ChargeOffInput {
  deltaCustomers: number;
  segment?: "Seg1Prod2" | "Seg1Prod3" | "Seg2Prod2" | "Seg3Prod2" | "Seg4Prod3";
  mmShare: number;
  chargeoffCoefficient?: {
    mean: number;
    stdDev: number;
    start: number;
    step: number;
    end: number;
  };
}

function normalPdf(x: number, mean: number, stdDev: number): number {
  return (
    (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
    Math.exp(-((x - mean) ** 2) / (2 * stdDev ** 2))
  );
}

function getSegmentParams(segment?: string) {
 return { mean: 0.45, stdDev: 0.17, start: 0.02, step: 0.00135, end: 0.02 };
}

export function calculateDecayChargeOffTable(
  input: ChargeOffInput
): ChargeOffRow[] {
  const { deltaCustomers, mmShare, chargeoffCoefficient } = input;
  const { mean, stdDev, start, step, end } = chargeoffCoefficient
    ? chargeoffCoefficient
    : getSegmentParams();

  // console.log("inside calculateDecayChargeOffTable");
  // console.log("inside calculateDecayChargeOffTable mean", mean);
  // console.log("inside calculateDecayChargeOffTable stdDev", stdDev);
  // console.log("inside calculateDecayChargeOffTable start", start);
  // console.log("inside calculateDecayChargeOffTable step", step);
  // console.log("inside calculateDecayChargeOffTable end", end);

  const chargeOffs: number[] = [start];
  for (let i = 1; i <= 20; i++) {
    chargeOffs[i] = chargeOffs[i - 1] + i * step;
  }
  const reversedChargeOffs = [...chargeOffs].reverse().map((v) => v * 100);

  const normDists: number[] = [];
  let totalNormDist = 0;
  for (let i = 0; i <= 20; i++) {
    const pdf = normalPdf(i * 0.05, mean, stdDev);
    normDists[i] = pdf;
    totalNormDist += pdf;
  }

  const rows: ChargeOffRow[] = [];
  let totalCustomerCount = 0;
  let totalChargeOffWeighted = 0;
  let totalExpectedDefaults = 0;
  let totalConsumerAllocation = 0;

  for (let i = 0; i <= 20; i++) {
    const normPdf = normDists[i];
    const normPct = normPdf / totalNormDist;
    const customerCount = Math.round(deltaCustomers * normPct);
    const chargeOffPct = reversedChargeOffs[i];
    const consumerAllocation = customerCount * mmShare;
    const expectedDefaults = consumerAllocation * (chargeOffPct / 100);

    totalCustomerCount += customerCount;
    totalChargeOffWeighted += chargeOffPct * customerCount;
    totalExpectedDefaults += expectedDefaults;
    totalConsumerAllocation += consumerAllocation;

    rows.push({
      minCredit: i,
      frequency: `${i * 5}%`,
      normDist: `${(normPdf * 100).toFixed(1)}%`,
      customerCount,
      expectedChargeOffs: `${chargeOffPct.toFixed(2)}%`,
      consumerAllocation: consumerAllocation.toFixed(2),
      expectedDefaultCount: expectedDefaults,
    });
  }

  const avgChargeOff = totalChargeOffWeighted / deltaCustomers;

  rows.push({
    minCredit: "Total",
    frequency: "-",
    normDist: "100.0%",
    customerCount: totalCustomerCount,
    expectedChargeOffs: `${avgChargeOff.toFixed(2)}%`,
    consumerAllocation: totalConsumerAllocation.toFixed(2),
    expectedDefaultCount: totalExpectedDefaults,
  });

  return rows;
}

export function sumCustCount(
  tableRows: ChargeOffRow[],
  riskLevel: number
): number {
  return tableRows
    .slice(Math.max(0, Math.min(riskLevel, 20)), 21)
    .reduce((sum, row) => sum + row.customerCount, 0);
}

export function sumConsumerAllocation(
  tableRows: ChargeOffRow[],
  riskLevel: number
): number {
  return tableRows
    .slice(Math.max(0, Math.min(riskLevel, 20)), 21)
    .reduce((sum, row) => sum + parseFloat(row.consumerAllocation), 0);
}

export function sumExpectedDefaults(
  tableRows: ChargeOffRow[],
  riskLevel: number
): number {
  return tableRows
    .slice(Math.max(0, Math.min(riskLevel, 20)), 21)
    .reduce((sum, row) => sum + row.expectedDefaultCount, 0);
}

export function provisionsPct(
  tableRows: ChargeOffRow[],
  riskLevel: number
): number {
  return (
    sumExpectedDefaults(tableRows, riskLevel) /
    sumConsumerAllocation(tableRows, riskLevel)
  );
}

export function printChargeOffTable(rows: ChargeOffRow[]): void {
  const headers = [
    "Minimum Credit",
    "Frequency",
    "NORMDIST",
    "Customer Count",
    "Expected Charge-offs",
    "Consumer Allocation",
    "Expected Defaults",
  ];

  const tableRows = rows.map((row) => [
    row.minCredit.toString(),
    row.frequency,
    row.normDist,
    row.customerCount.toLocaleString(),
    row.expectedChargeOffs,
    row.consumerAllocation,
    row.expectedDefaultCount.toFixed(2),
  ]);

  const colWidths = headers.map((h, idx) =>
    Math.max(h.length, ...tableRows.map((r) => r[idx].length))
  );

  const pad = (str: string, length: number) =>
    str + " ".repeat(length - str.length);

  console.log(headers.map((h, i) => pad(h, colWidths[i])).join("  "));
  console.log(colWidths.map((w) => "-".repeat(w)).join("  "));
  tableRows.forEach((r) =>
    console.log(r.map((cell, i) => pad(cell, colWidths[i])).join("  "))
  );
}

// if (require.main === module) {
//   const input: ChargeOffInput = {
//     deltaCustomers: 1762484,
//     mmShare: 0.2
//   };

//   const tableRows = calculateDecayChargeOffTable(input);
//   printChargeOffTable(tableRows);

//   const riskLevel = 5;
//   const partialCustSum = sumCustCount(tableRows, riskLevel);
//   const partialConsumerAllocSum = sumConsumerAllocation(tableRows, riskLevel);
//   const partialDefaultSum = sumExpectedDefaults(tableRows, riskLevel);
//   const provisions = provisionsPct(tableRows, riskLevel);

//   console.log(`\nCumulative Customer Count (${riskLevel}–20): ${partialCustSum.toLocaleString()}`);
//   console.log(`Consumer Allocation (${riskLevel}–20): ${partialConsumerAllocSum.toFixed(2)}`);
//   console.log(`Expected Defaults (${riskLevel}–20): ${partialDefaultSum.toFixed(2)}`);

//   console.log(`Provisions Pct (${riskLevel}–20): ${provisions.toFixed(2)}`);
// }
