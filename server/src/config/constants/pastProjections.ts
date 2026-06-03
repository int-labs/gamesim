export type HardcodedPastProjection = {
  round: number;
  productBu: string;
  kpi: Record<string, number>;
  pnl: Array<{ productType: string; values: Record<string, number> }>;
};

const pastProjections: Array<HardcodedPastProjection> = [
  {
    round: 0,
    productBu: "Mass Consumer",
    kpi: {
      revenue: 1000000000,
      csat: 90,
      esat: 85,
      // newCustomers: 600, // Commented out as in the original
      // brandEquity: 90,
      cir: 0.5,
      profit: 500000,
    },
    pnl: [
      {
        productType: "Deposit",
        values: {
          "Total No of Accounts": 12302804,
          "Avg Deposits per Customer": 5500,
          "Total Deposits": 61514020000,
          "Interest Income": 1845420600,
          "Interest Expense": 676654220,
          "Net Interest Income": 1168766380,
          "Fees Income": 159936452,
          "Other Non-Interest Income Total": 256206080,
          "Non-Interest Income": 416142532,
          "% Non-Interest Income": 0.2626,
          "Total Revenue": 1584908912,
        },
      },
      {
        productType: "Loan",
        values: {
          "Total Loans": 201,
          "Total No of Accounts": 16,
          "Avg Loans per Customer": 16,
          "Total Revenue": 12,
          "Interest Income": 12,
          "Non-Interest Income": 12,
          "Interest Expense": 12,
          "Net Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Credit",
        values: {
          "Total Balance": 201,
          "Total No of Cards": 7875001,
          "Avg Balance per Customer": 16,
          "Total Revenue": 12,
          "% Interest Income": 12,
          "Fees Income": 12,
          "Other Non-Interest Income Total": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Investment",
        values: {
          "Total Revenue": 12,
          "Interest Income": 16,
          "Interest Expense": 16,
          "Net Interest Income": 201,
          "Non-Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
    ],
  },
  {
    round: 0,
    productBu: "Affluent Consumer",
    kpi: {
      revenue: 1000000000,
      csat: 90,
      esat: 85,
      // newCustomers: 600, // Commented out as in the original
      // brandEquity: 90,
      cir: 0.5,
      profit: 500000,
    },
    pnl: [
      {
        productType: "Deposit",
        values: {
          "Total No of Accounts": 12302804,
          "Avg Deposits per Customer": 5500,
          "Total Deposits": 61514020000,
          "Interest Income": 1845420600,
          "Interest Expense": 676654220,
          "Net Interest Income": 1168766380,
          "Fees Income": 159936452,
          "Other Non-Interest Income Total": 256206080,
          "Non-Interest Income": 416142532,
          "% Non-Interest Income": 0.2626,
          "Total Revenue": 1584908912,
        },
      },
      {
        productType: "Loan",
        values: {
          "Total Loans": 201,
          "Total No of Accounts": 16,
          "Avg Loans per Customer": 16,
          "Total Revenue": 12,
          "Interest Income": 12,
          "Non-Interest Income": 12,
          "Interest Expense": 12,
          "Net Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Credit",
        values: {
          "Total Balance": 201,
          "Total No of Cards": 7875001,
          "Avg Balance per Customer": 16,
          "Total Revenue": 12,
          "% Interest Income": 12,
          "Fees Income": 12,
          "Other Non-Interest Income Total": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Investment",
        values: {
          "Total Revenue": 12,
          "Interest Income": 16,
          "Interest Expense": 16,
          "Net Interest Income": 201,
          "Non-Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
    ],
  },
  {
    round: 0,
    productBu: "SME",
    kpi: {
      revenue: 1000000000,
      csat: 90,
      esat: 85,
      // newCustomers: 600, // Commented out as in the original
      // brandEquity: 90,
      cir: 0.5,
      profit: 500000,
    },
    pnl: [
      {
        productType: "Deposit",
        values: {
          "Total No of Accounts": 12302804,
          "Avg Deposits per Customer": 5500,
          "Total Deposits": 61514020000,
          "Interest Income": 1845420600,
          "Interest Expense": 676654220,
          "Net Interest Income": 1168766380,
          "Fees Income": 159936452,
          "Other Non-Interest Income Total": 256206080,
          "Non-Interest Income": 416142532,
          "% Non-Interest Income": 0.2626,
          "Total Revenue": 1584908912,
        },
      },
      {
        productType: "Loan",
        values: {
          "Total Loans": 201,
          "Total No of Accounts": 16,
          "Avg Loans per Customer": 16,
          "Total Revenue": 12,
          "Interest Income": 12,
          "Non-Interest Income": 12,
          "Interest Expense": 12,
          "Net Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Credit",
        values: {
          "Total Balance": 201,
          "Total No of Cards": 7875001,
          "Avg Balance per Customer": 16,
          "Total Revenue": 12,
          "% Interest Income": 12,
          "Fees Income": 12,
          "Other Non-Interest Income Total": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Investment",
        values: {
          "Total Revenue": 12,
          "Interest Income": 16,
          "Interest Expense": 16,
          "Net Interest Income": 201,
          "Non-Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
    ],
  },
  {
    round: 0,
    productBu: "Corporate",
    kpi: {
      revenue: 1000000000,
      csat: 90,
      esat: 85,
      // newCustomers: 600, // Commented out as in the original
      // brandEquity: 90,
      cir: 0.5,
      profit: 500000,
    },
    pnl: [
      {
        productType: "Deposit",
        values: {
          "Total No of Accounts": 12302804,
          "Avg Deposits per Customer": 5500,
          "Total Deposits": 61514020000,
          "Interest Income": 1845420600,
          "Interest Expense": 676654220,
          "Net Interest Income": 1168766380,
          "Fees Income": 159936452,
          "Other Non-Interest Income Total": 256206080,
          "Non-Interest Income": 416142532,
          "% Non-Interest Income": 0.2626,
          "Total Revenue": 1584908912,
        },
      },
      {
        productType: "Loan",
        values: {
          "Total Loans": 201,
          "Total No of Accounts": 16,
          "Avg Loans per Customer": 16,
          "Total Revenue": 12,
          "Interest Income": 12,
          "Non-Interest Income": 12,
          "Interest Expense": 12,
          "Net Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Credit",
        values: {
          "Total Balance": 201,
          "Total No of Cards": 7875001,
          "Avg Balance per Customer": 16,
          "Total Revenue": 12,
          "% Interest Income": 12,
          "Fees Income": 12,
          "Other Non-Interest Income Total": 12,
          "Revenue per Customer": 12,
        },
      },
      {
        productType: "Investment",
        values: {
          "Total Revenue": 12,
          "Interest Income": 16,
          "Interest Expense": 16,
          "Net Interest Income": 201,
          "Non-Interest Income": 12,
          "Revenue per Customer": 12,
        },
      },
    ],
  },
];

export default pastProjections;
