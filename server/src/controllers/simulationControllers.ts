import { NextFunction, Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import * as path from "path";
import { generateSlug } from "random-word-slugs";
import * as XLSX from "xlsx";
import * as StyledXLSX from "xlsx-js-style";
import { z } from "zod";

import BaseData, { BaseDataInterface } from "../models/baseData";
import Decision, { DecisionInterface } from "../models/decisions";
import Event from "../models/events";
import GlobalInput, { IGlobalInput } from "../models/globalInputs";
import PnLConfig from "../models/pnlConfig";
import Product, { ProductInterface } from "../models/products";
import Projection from "../models/projections";
import Result, {
  PNLUnderTeamInterface,
  ResultInterface,
  TeamInvolvedInterface,
  WinningMetricsUnderTeamInterface,
} from "../models/results";
import Round, { RoundInterface } from "../models/rounds";
import Segment, { SegmentInterface } from "../models/segments";
import Simulation from "../models/simulations";
import SimulationType, { WinningMetricConfig } from "../models/simulationTypes";
import Team from "../models/teams";
import User from "../models/users";
import { calcCSATV2 } from "../sim/calcCSATV2";
import { calcESAT } from "../sim/calcESAT";
import { calcStdDev, MarketModelBatchInput, mean, simMm } from "../sim/calcMm";
import calcProjections, {
  BankingExtra,
  ProjectionResult,
} from "../sim/calcProjections";
import { calcCSAT as fmcgCalcCSAT } from "../sim/fmcg/calcCSAT";
import { calcESAT as fmcgCalcESAT } from "../sim/fmcg/calcESAT";
import fmcgCalcProjections from "../sim/fmcg/calcProjections";
import mallManagementCalcProjections from "../sim/mallManagement/calcProjections";
import { getTotalMarketSize } from "../sim/mallManagement/utils/marketUtils";
import { FeedbackReportOptions } from "../types/feedbackReportOptions";
import { checkProductPrerequisites } from "../utils/checkProductPrerequisites";
import { getPaginationQuery } from "../utils/paginationHelper";
import { calculateReadonlyFields } from "../utils/readonlyFieldsHelper";
import { getSocket } from "../utils/socket";
import { createFmcgAnalysisReport } from "./fmcg/createFmcgAnalysisReport";
import { createFmcgFeedbackReport } from "./fmcg/createFmcgFeedbackReport";
import { createMallManagementFeedbackReport } from "./mallManagement/createMallManagementFeedbackReport";

type ObjectId = Types.ObjectId;

const PNL_ROWS: (keyof PNLUnderTeamInterface)[] = [
  "Interest Income",
  "Interest Expense",
  "Net Interest Income",
  "Fees Income",
  "Other Non-Interest Income Total",
  "Non-Interest Income",
  "Total Revenue",
  "Sales & Marketing",
  "Back Office Expense",
  "Staff Costs",
  "Channel and Service",
  "Strategic Initiatives & Other Costs",
  "Other Operating Expenses",
  "Total Expenses",
  "Provisions",
  "Profit Before Tax",
  "Income Tax Expense",
  "Profit After Tax",
  "Capital Charge",
  "Risk Adjusted Profit",
  "Dividends",
  "Retained Earnings",
];

const CUSTOM_PNL_STYLE: Record<
  keyof Pick<
    Partial<PNLUnderTeamInterface>,
    | "Interest Expense"
    | "Other Non-Interest Income Total"
    | "Total Revenue"
    | "Other Operating Expenses"
    | "Total Expenses"
    | "Profit After Tax"
    | "Risk Adjusted Profit"
  >,
  {
    fill?: { fgColor?: { rgb: string }; bgColor?: { rgb: string } };
    font?: { color: { rgb: string }; bold?: boolean };
    border?: { bottom?: { style: "thick"; color?: { rgb: string } } };
  }
> = {
  "Interest Expense": {
    border: { bottom: { style: "thick" } },
  },
  "Other Non-Interest Income Total": {
    border: { bottom: { style: "thick" } },
  },
  "Total Revenue": {
    fill: { fgColor: { rgb: "d9f2d0" } },
  },
  "Other Operating Expenses": {
    border: { bottom: { style: "thick" } },
  },
  "Total Expenses": {
    fill: { fgColor: { rgb: "fbe3d6" } },
  },
  "Profit After Tax": {
    fill: { fgColor: { rgb: "d9f2d0" } },
    border: { bottom: { style: "thick" } },
  },
  "Risk Adjusted Profit": {
    fill: { fgColor: { rgb: "275417" } },
    font: { color: { rgb: "ffffff" }, bold: true },
  },
};

const NON_INTEREST_EXPENSE_ROWS: (keyof PNLUnderTeamInterface)[] = [
  "Sales & Marketing",
  "Back Office Expense",
  "Staff Costs",
  "Channel and Service",
  "Strategic Initiatives & Other Costs",
];

function combineTeamValues(
  teamValues: {
    teamId: mongoose.Types.ObjectId;
    score: number;
    originalDecisionValue: number;
  }[]
) {
  const map = new Map();
  for (const tv of teamValues) {
    const id = tv.teamId.toString();
    if (!map.has(id)) {
      map.set(id, {
        teamId: id,
        score: tv.score,
        originalDecisionValue: tv.originalDecisionValue,
      });
    } else {
      map.get(id).score += tv.score;
      map.get(id).originalDecisionValue += tv.originalDecisionValue;
    }
  }
  return Array.from(map.values());
}

// TODO set this in database later
const weights: {
  round: number;
  weights: { rap: number; csat: number; esat: number; revenue: number };
}[] = [
  {
    round: 0,
    weights: {
      rap: 0,
      csat: 0,
      esat: 0,
      revenue: 0,
    },
  },
  {
    round: 1,
    weights: {
      rap: 15,
      csat: 10,
      esat: 10,
      revenue: 15,
    },
  },
  {
    round: 2,
    weights: {
      rap: 15,
      csat: 10,
      esat: 10,
      revenue: 15,
    },
  },
  {
    round: 3,
    weights: {
      rap: 15,
      csat: 10,
      esat: 10,
      revenue: 15,
    },
  },
];

function getWeightByRound(metricKey: string, year: number): number {
  const round = Math.max(0, Math.min(3, year));

  return (
    weights.find((w) => w.round === round)?.weights[
      metricKey as "rap" | "csat" | "esat" | "revenue"
    ] || 0
  );
}

function calculateRanks(values: number[], descending = true): number[] {
  const entries = values.map((val, idx) => ({ val, idx }));

  entries.sort((a, b) => (descending ? b.val - a.val : a.val - b.val));

  const ranks = Array(values.length);
  let currentRank = 1;

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].val === entries[i - 1].val) {
      // Same as previous, same rank
      ranks[entries[i].idx] = ranks[entries[i - 1].idx];
    } else {
      ranks[entries[i].idx] = currentRank;
    }
    currentRank++;
  }

  return ranks;
}

function calculateMetricScore({
  teams,
  metricKey,
  round,
  descending = true,
  weight,
}: {
  teams: Array<{ teamId: string; teamName: string; value: number }>;
  metricKey: string;
  round: number;
  descending: boolean;
  weight?: number;
}) {
  const values = teams.map((t) => t.value);
  const ranks = calculateRanks(values, descending);

  const calculatedWeight = weight ? weight : getWeightByRound(metricKey, round);

  return teams.map((team, i) => {
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      value: team.value,
      rank: ranks[i],
      points: (teams.length - ranks[i] + 1) * calculatedWeight, // Fix: rank 1 gets highest points
    };
  });
}

function createFeedbackReport(
  result: ResultInterface,
  {
    availableGlobalInputs,
    availableEvents,
    segments,
    products,
    prevRoundDecisions,
    baseData,
    prevRoundResult,
    round,
    download = true,
  }: FeedbackReportOptions
) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  const initiativeGlobInput = availableGlobalInputs.find(
    (input) => input.key === "initiatives"
  );

  const companyLevelPNLTable = [
    ["P&L"],

    ...PNL_ROWS.map((rowLabel) => [
      "",
      "",
      rowLabel,
      ...result.teams.map((team) => {
        const teamPnl = (team.pnl || []).reduce(
          (acc, curr) => {
            if (curr[rowLabel] && typeof curr[rowLabel] === "number") {
              acc[rowLabel] = (acc[rowLabel] || 0) + (curr[rowLabel] || 0);
            }
            return acc;
          },
          {} as Record<keyof PNLUnderTeamInterface, number>
        );

        return teamPnl[rowLabel] || "";
      }),
    ]),
  ];

  const ldrTable = [
    ["Loan to Deposit Ratio"],
    ["", "", "Total Loans", ...result.teams.map((t) => t.ldr.totalLoan)],
    ["", "", "Total Deposits", ...result.teams.map((t) => t.ldr.totalDeposit)],
    [
      "",
      "",
      "Loan to Deposit Ratio",
      ...result.teams.map((t) => t.ldr.loanToDepositRatio),
    ],
  ];

  const productsSortedBySegmentOrderThenProductOrder = products.sort((a, b) => {
    const segmentA = segments.find(
      (s) => s._id.toString() === a.segmentId.toString()
    );
    const segmentB = segments.find(
      (s) => s._id.toString() === b.segmentId.toString()
    );
    return (
      (segmentA?.order || 0) - (segmentB?.order || 0) ||
      (a.order || 0) - (b.order || 0)
    );
  });

  const vocTable = [
    ...productsSortedBySegmentOrderThenProductOrder.flatMap((p) => {
      const marketShare = result.marketShares?.find(
        (ms) => ms.productId.toString() === p._id.toString()
      );

      const sortedDrivers =
        marketShare?.weightedScores.sort(
          (a, b) => b.coefficient - a.coefficient
        ) || [];

      return [
        ["", `${p.productName} ${p.segmentReference.name} - VOC`],
        ...sortedDrivers
          .filter((driver) => driver.coefficient > 0)
          .map((driver) => [
            "",
            driver.coefficient,
            driver.fieldLabel,
            ...result.teams.map((t) => {
              return (
                (driver.teamValues.find(
                  (tv) => tv.teamId.toString() === t.teamId.toString()
                )?.score || 0) / 10
              );
            }),
          ]),
        [""],
      ];
    }),
  ];

  const provisionTable = [
    ["Provisions"],
    [
      "",
      "",
      "Provision ($Mn)",
      ...result.teams.map(
        (t) =>
          (t.pnl || [])
            .filter((pnl) => {
              const hasRiskLevel = !!products
                .find((p) => p._id.toString() === pnl.productId?.toString())
                ?.fields.find((f) => f.key === "risk_level");

              return pnl.segmentId && pnl.productId && hasRiskLevel;
            })
            .reduce((acc, curr) => acc + (curr.Provisions || 0), 0) /
          (1000 * 1000)
      ),
    ],
    [
      "",
      "",
      "Minimum Credit Score",
      ...result.teams.map((t) => {
        const applicableProvisions = (t.pnl || []).filter((pnl) => {
          const hasRiskLevel = !!products
            .find((p) => p._id.toString() === pnl.productId?.toString())
            ?.fields.find((f) => f.key === "risk_level");

          return pnl.segmentId && pnl.productId && hasRiskLevel;
        });

        const totalMinimumCreditScore = applicableProvisions.reduce(
          (acc, curr) =>
            acc +
            (t.decision?.decisionDetails
              .find(
                (d) => d.productId.toString() === curr.productId?.toString()
              )
              ?.fields.find((f) => f.key === "risk_level")?.value ?? 0),
          0
        );

        return Math.round(
          totalMinimumCreditScore / (applicableProvisions.length || 1)
        );
      }),
    ],
    [],

    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return segmentProducts
        .filter((p) => !!p.fields.find((f) => f.key === "risk_level"))
        .flatMap((product) => {
          return [
            ["", `${product.productName} - ${segment.name} - Provision`],
            [
              "",
              "",
              "Provision ($Mn)",
              ...result.teams.map((t) => {
                return (
                  (t.pnl.find(
                    (pnl) =>
                      pnl.productId?.toString() === product._id.toString()
                  )?.Provisions || 0) /
                  (1000 * 1000)
                );
              }),
            ],
            [
              "",
              "",
              "Minimum Credit Score",
              ...result.teams.map((t) => {
                return (
                  t.decision?.decisionDetails
                    .find(
                      (d) => d.productId.toString() === product._id.toString()
                    )
                    ?.fields.find((f) => f.key === "risk_level")?.value ?? 0
                );
              }),
            ],
            [],
          ];
        });
    }),
  ];

  const corporateSegmentId = segments.find((s) =>
    s.name.includes("Corporate")
  )?._id;

  const changeInConsumerBankingDepositTable = [
    ["Change in Consumer Banking Deposits"],
    ...segments.map((s) => [
      "",
      "",
      s.name,
      ...result.teams.map(
        (t) =>
          t.pnl.find(
            (p) => p.segmentId?.toString() === s._id.toString() && !p.productId
          )?.["Total Deposits"] || 0
      ),
    ]),
    [
      "",
      "",
      "Total Consumer Banking Group",
      ...result.teams.map((t) =>
        t.pnl
          .filter((p) => !p.productId)
          .reduce((acc, curr) => acc + (curr["Total Deposits"] || 0), 0)
      ),
    ],
  ];

  const institutionalLendingProductId = products.find(
    (p) => p.productName === "Institutional Lending"
  )?._id;

  const institutionalLendingTable = [
    ["Institutional Lending"],
    [
      "",
      "",
      "Total Loan",
      ...result.teams.map(
        (t) =>
          t.pnl.find(
            (pnl) =>
              pnl.productId?.toString() ===
              institutionalLendingProductId?.toString()
          )?.["Total Loans"] || 0
      ),
    ],
    [
      "",
      "",
      "Interest Rate Charged",
      ...result.teams.map(
        (t) =>
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                institutionalLendingProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value ?? 0
      ),
    ],
    [
      "",
      "",
      "Total Loan Last Year",
      ...(prevRoundResult?.teams || []).map(
        (t) =>
          t.pnl.find(
            (pnl) =>
              pnl.productId?.toString() ===
              institutionalLendingProductId?.toString()
          )?.["Total Loans"] || 0
      ),
    ],
    [
      "",
      "",
      "Min Credit Rating",
      ...result.teams.map(
        (t) =>
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                institutionalLendingProductId?.toString()
            )
            ?.fields.find((f) => f.key === "risk_level")?.value ?? 0
      ),
    ],
  ];

  const netInterestIncomeTable = [
    ["Net Interest Income"],
    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return segmentProducts.map((product) => [
        "",
        segment.name,
        product.productName,
        ...result.teams.map((t) => {
          return (
            t.pnl.find(
              (pnl) => pnl.productId?.toString() === product._id.toString()
            )?.["Net Interest Income"] || 0
          );
        }),
      ]);
    }),
    [
      "",
      "",
      "Total Interest Income",
      ...result.teams.map((t) => {
        return (
          t.pnl
            .filter((p) => p.segmentId && !!p.productId)
            .reduce(
              (acc, curr) => acc + (curr["Net Interest Income"] || 0),
              0
            ) || 0
        );
      }),
    ],
  ];

  const nonInterestIncomeTable = [
    ["Non-Interest Income"],
    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return segmentProducts.map((product) => [
        "",
        segment.name,
        product.productName,
        ...result.teams.map((t) => {
          return (
            t.pnl.find(
              (pnl) => pnl.productId?.toString() === product._id.toString()
            )?.["Non-Interest Income"] || 0
          );
        }),
      ]);
    }),
    [
      "",
      "",
      "Total Non-Interest Income",
      ...result.teams.map((t) => {
        return (
          t.pnl
            .filter((p) => p.segmentId && !!p.productId)
            .reduce(
              (acc, curr) => acc + (curr["Non-Interest Income"] || 0),
              0
            ) || 0
        );
      }),
    ],
  ];

  const marketShareByProductTable = [
    ["Market Share by products"],
    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return segmentProducts.map((product) => [
        "",
        segment.name,
        product.productName,
        ...result.teams.map((t) => {
          return (
            t.bizperf.find(
              (bp) => bp.productId?.toString() === product._id.toString()
            )?.["Market Share"] || 0
          );
        }),
      ]);
    }),
  ];

  const riskAppetiteByProductTable = [
    ["Risk Appetite by Product"],

    ...segments.flatMap((s) => {
      const segmentProducts = products.filter(
        (p) =>
          p.segmentId.toString() === s._id.toString() &&
          !!p.fields.find((f) => f.key === "risk_level")
      );

      return segmentProducts.map((product) => [
        "",
        s.name,
        product.productName,
        ...result.teams.map((t) => {
          return (
            t.decision?.decisionDetails
              .find((dd) => dd.productId.toString() === product._id.toString())
              ?.fields.find((f) => f.key === "risk_level")?.value ?? 0
          );
        }),
      ]);
    }),
  ];

  const regionalMTUExpansionTable = [
    ["Regional MTU Expansion"],
    [
      "",
      "",
      "Wholesale Banking",
      ...result.teams.map((t) => "NOT IMPLEMENTED"),
    ],
    [
      "",
      "",
      "Wealth Management",
      ...result.teams.map((t) => "NOT IMPLEMENTED"),
    ],
  ];

  const affluentSegmentId = segments.find((s) =>
    s.name.includes("Affluent")
  )?._id;

  const affluentPrivateBankingProductId = products.find(
    (p) =>
      p.segmentId.toString() === affluentSegmentId?.toString() &&
      p.productName.includes("Private Banking")
  )?._id;

  const marketShareRetailAffluentPrivateBankingServiceTable = [
    ["Market Share - Retail Affluent Private Banking Service"],
    [
      "",
      "",
      "Growth",
      ...result.teams.map(
        (t) =>
          (t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              affluentPrivateBankingProductId?.toString()
          )?.["Total Deposits"] || 0) -
          (prevRoundResult?.teams
            ?.find((t) => t.teamId.toString() === t.teamId.toString())
            ?.pnl.find(
              (p) =>
                p.productId?.toString() ===
                affluentPrivateBankingProductId?.toString()
            )?.["Total Deposits"] || 0)
      ),
    ],
    [
      "",
      "",
      "Total",
      ...result.teams.map(
        (t) =>
          t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              affluentPrivateBankingProductId?.toString()
          )?.["Total Deposits"] || 0
      ),
    ],
    [
      "",
      "",
      "% Growth Label",
      ...result.teams.map((t) => {
        const currentTotalDeposits =
          t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              affluentPrivateBankingProductId?.toString()
          )?.["Total Deposits"] || 0;

        const lastYearTotalDeposits =
          (prevRoundResult?.teams || [])
            .find((t) => t.teamId.toString() === t.teamId.toString())
            ?.pnl.find(
              (p) =>
                p.productId?.toString() ===
                affluentPrivateBankingProductId?.toString()
            )?.["Total Deposits"] || 0;

        const growth =
          (currentTotalDeposits - lastYearTotalDeposits) /
          (lastYearTotalDeposits || 1);

        return growth;
      }),
    ],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams
        ? prevRoundResult.teams.map((t) => {
            return (
              t.pnl.find(
                (p) =>
                  p.productId?.toString() ===
                  affluentPrivateBankingProductId?.toString()
              )?.["Total Deposits"] || 0
            );
          })
        : result.teams.map((t) => 0)),
    ],
  ];

  const smeSegmentId = segments.find((s) => s.name.includes("SME"))?._id;

  const smeCapitalLoanProductId = products.find(
    (p) =>
      p.segmentId.toString() === smeSegmentId?.toString() &&
      p.productName === "Capital Loan"
  )?._id;

  const smeCapitalLoanTable = [
    ["SME Capital Loan"],
    [
      "",
      "",
      "Growth",
      ...result.teams.map((t) => {
        return (
          (t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0) -
          (prevRoundResult?.teams
            .find((t) => t.teamId.toString() === t.teamId.toString())
            ?.bizperf.find(
              (p) =>
                p.productId?.toString() === smeCapitalLoanProductId?.toString()
            )?.["Total Number of Accounts"] || 0)
        );
      }),
    ],
    [
      "",
      "",
      "% Growth Label",
      ...result.teams.map((t) => {
        const currentRoundTotalLoans =
          t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0;

        const prevRoundTotalLoans =
          prevRoundResult?.teams
            .find((t) => t.teamId.toString() === t.teamId.toString())
            ?.bizperf.find(
              (p) =>
                p.productId?.toString() === smeCapitalLoanProductId?.toString()
            )?.["Total Number of Accounts"] || 0;

        const growth =
          (currentRoundTotalLoans - prevRoundTotalLoans) /
          (prevRoundTotalLoans || 1);

        return growth;
      }),
    ],
    [
      "",
      "",
      "Shares of Customers",
      ...result.teams.map((t) => {
        return (
          result.marketShares
            ?.find(
              (ms) =>
                ms.productId.toString() === smeCapitalLoanProductId?.toString()
            )
            ?.marketShares.find(
              (ms) => ms.teamId.toString() === t.teamId.toString()
            )?.value || 0
        );
      }),
    ],
    [
      "",
      "",
      "This Year",
      ...result.teams.map((t) => {
        return (
          t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams || []).map((t) => {
        return (
          t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0
        );
      }),
    ],
  ];

  const institutionalLendingSecondTable = [
    ["Institutional Lending"],
    [
      "",
      "",
      "Institutional Lending Revenue",
      ...result.teams.map(
        (t) =>
          t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              institutionalLendingProductId?.toString()
          )?.["Total Revenue"] || 0
      ),
    ],
    [
      "",
      "",
      "Interest Rate Charged",
      ...result.teams.map(
        (t) =>
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                institutionalLendingProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value || 0
      ),
    ],
    [
      "",
      "",
      "Interest Rate Paid",
      ...result.teams.map((t) => {
        return (
          t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              institutionalLendingProductId?.toString()
          )?.["Interest Rate Paid"] || 0
        );
      }),
    ],
  ];

  const techOpsId = availableGlobalInputs.find(
    (agi) => agi.key === "tech_ops"
  )?._id;

  const tnoLevelAndDiffTable = [
    ["Tech & Ops"],

    ...(
      availableGlobalInputs.find((agi) => agi._id === techOpsId)?.inputs || []
    ).map((input) => [
      "",
      "",
      input.name,
      ...(prevRoundResult?.teams
        ? prevRoundResult.teams.map((t) => {
            return (
              t.decision?.globalDecisionDetails.find(
                (gdd) =>
                  gdd.globalInputId.toString() === techOpsId?.toString() &&
                  gdd.key === input.key
              )?.value || 0
            );
          })
        : result.teams.map((t) => 0)),
    ]),
    [],
    ...(
      availableGlobalInputs.find((agi) => agi._id === techOpsId)?.inputs || []
    ).map((input) => [
      "",
      "",
      input.name,
      ...result.teams.map((t) => {
        const diff =
          (t.decision?.globalDecisionDetails.find(
            (gdd) =>
              gdd.globalInputId.toString() === techOpsId?.toString() &&
              gdd.key === input.key
          )?.value || 0) -
          (prevRoundResult?.teams
            ?.find((t) => t.teamId.toString() === t.teamId.toString())
            ?.decision?.globalDecisionDetails.find(
              (gdd) =>
                gdd.globalInputId.toString() === techOpsId?.toString() &&
                gdd.key === input.key
            )?.value || 0);

        return diff;
      }),
    ]),
  ];

  const cfsDepositsBySegmentTable = [
    ["CFS Deposits by Segment"],
    ...segments
      .filter((s) => s._id.toString() !== corporateSegmentId?.toString())
      .map((s) => [
        "",
        "",
        s.name,
        ...result.teams.map((t) => {
          return (
            t.pnl.find(
              (p) =>
                p.segmentId?.toString() === s._id.toString() && !p.productId
            )?.["Total Deposits"] || 0
          );
        }),
      ]),
    [
      "",
      "",
      "Consumer Banking Group",
      ...result.teams.map((t) => {
        return t.pnl
          .filter(
            (p) =>
              p.segmentId?.toString() !== corporateSegmentId?.toString() &&
              !p.productId
          )
          .reduce((acc, curr) => acc + (curr["Total Deposits"] || 0), 0);
      }),
    ],
    ...segments
      .filter((s) => s._id.toString() !== corporateSegmentId?.toString())
      .map((s) => [
        "",
        "",
        `Interest Rate - ${s.name}`,
        ...result.teams.map((t) => {
          const productIdWithTotalDeposit = t.pnl.find(
            (p) =>
              p.segmentId?.toString() === s._id.toString() &&
              !!p["Total Deposits"]
          )?.productId;

          const interestRateOfTheProduct = t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                productIdWithTotalDeposit?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value;

          return interestRateOfTheProduct || 0;
        }),
      ]),
  ];

  const interestExpenseOverallDepositTable = [
    ["Interest Expense - Overall Deposits"],
    [
      "",
      "",
      "Deposit Balance",
      ...result.teams.map((t) => {
        return t.pnl
          .filter((p) => p.segmentId && !p.productId)
          .reduce((acc, curr) => acc + (curr["Total Deposits"] || 0), 0);
      }),
    ],
    [
      "",
      "",
      "Deposit Interest Rate",
      ...result.teams.map((t) => {
        return (
          (t.pnl
            .filter((p) => p.segmentId && !p.productId)
            .reduce((acc, curr) => acc + (curr["Interest Expense"] || 0), 0) ||
            0) /
          (t.pnl
            .filter((p) => p.segmentId && !p.productId)
            .reduce((acc, curr) => acc + (curr["Total Deposits"] || 0), 0) || 1)
        );
      }),
    ],
    [
      "",
      "",
      "Interest Expense",
      ...result.teams.map((t) => {
        return t.pnl
          .filter((p) => p.segmentId && !p.productId)
          .reduce((acc, curr) => acc + (curr["Interest Expense"] || 0), 0);
      }),
    ],
  ];

  const retailMassSegmentId = segments.find((s) =>
    s.name.includes("Retail Mass")
  )?._id;

  const retailMassCreditProductId = products.find(
    (p) =>
      p.segmentId.toString() === retailMassSegmentId?.toString() &&
      p.productName === "Credit Card"
  )?._id;

  const creditCardRetailMassChargeOffRiskTable = [
    ["Credit Card Retail Mass Charge Off vs Risk"],
    [
      "",
      "",
      "Assets",
      ...result.teams.map((t) => {
        return (
          t.pnl.find(
            (p) =>
              p.productId?.toString() === retailMassCreditProductId?.toString()
          )?.["Total Loans"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Last year",
      ...(prevRoundResult?.teams || []).map((t) => {
        return (
          t.pnl.find(
            (p) =>
              p.productId?.toString() === retailMassCreditProductId?.toString()
          )?.["Total Loans"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Interest rate",
      ...result.teams.map((t) => {
        return (
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                retailMassCreditProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value ?? 0
        );
      }),
    ],
    [
      "",
      "",
      "Risk",
      ...result.teams.map((t) => {
        return (
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                retailMassCreditProductId?.toString()
            )
            ?.fields.find((f) => f.key === "risk_level")?.value ?? 0
        );
      }),
    ],
  ];

  const companyLevelRAPTable = [
    ["Risk Adjusted Profit"],

    [
      "",
      "",
      "Total Revenue",
      ...result.teams.map(
        (t) =>
          t.pnl
            .filter((p) => p.segmentId && !p.productId)
            ?.reduce((acc, curr) => acc + (curr["Total Revenue"] || 0), 0) || 0
      ),
    ],
    [
      "",
      "",
      "Non-Interest Expense",
      ...result.teams.map(
        (t) =>
          t.pnl
            .filter((p) => p.segmentId && !p.productId)
            ?.reduce(
              (acc, curr) => acc + (curr["Non-Interest Expense"] || 0),
              0
            ) || 0
      ),
    ],
    [
      "",
      "",
      "Provisions",
      ...result.teams.map(
        (t) =>
          t.pnl
            .filter((p) => p.segmentId && !p.productId)
            ?.reduce((acc, curr) => acc + (curr["Provisions"] || 0), 0) || 0
      ),
    ],
    [
      "",
      "",
      "Capital Charges",
      ...result.teams.map(
        (t) =>
          t.pnl
            .filter((p) => p.segmentId && !p.productId)
            ?.reduce((acc, curr) => acc + (curr["Capital Charge"] || 0), 0) || 0
      ),
    ],
    [
      "",
      "",
      "Risk Adjusted Profits",
      ...result.teams.map(
        (t) =>
          t.pnl
            .filter((p) => p.segmentId && !p.productId)
            ?.reduce(
              (acc, curr) => acc + (curr["Risk Adjusted Profit"] || 0),
              0
            ) || 0
      ),
    ],
  ];

  const retailMassLoanProductId = products.find(
    (p) =>
      p.segmentId.toString() === retailMassSegmentId?.toString() &&
      p.productName === "Loan"
  )?._id;

  const retailMassLoanTable = [
    ["Retail Mass Loan"],
    [
      "",
      "",
      "Retail Mass Loan",
      ...result.teams.map((t) => {
        return (
          t.pnl.find(
            (p) =>
              p.productId?.toString() === retailMassLoanProductId?.toString()
          )?.["Total Loans"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Interest Rate Charged",
      ...result.teams.map((t) => {
        return (
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() === retailMassLoanProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value || 0
        );
      }),
    ],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams || []).map((t) => {
        return (
          t.pnl.find(
            (p) =>
              p.productId?.toString() === retailMassLoanProductId?.toString()
          )?.["Total Loans"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Min Credit Rating",
      ...result.teams.map((t) => {
        return (
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() === retailMassLoanProductId?.toString()
            )
            ?.fields.find((f) => f.key === "risk_level")?.value || 0
        );
      }),
    ],
    [
      "",
      "",
      "Label",
      ...result.teams.map((t) => {
        return Math.round(
          (t.pnl.find(
            (p) =>
              p.productId?.toString() === retailMassLoanProductId?.toString()
          )?.["Total Loans"] || 0) /
            (1000 * 1000 * 1000)
        );
      }),
    ],
  ];

  const smeCapitalLoanLongerTable = [
    ["SME Capital Loan"],
    [
      "",
      "",
      "Growth",
      ...result.teams.map((t) => {
        return (
          (t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0) -
          (prevRoundResult?.teams
            .find((t) => t.teamId.toString() === t.teamId.toString())
            ?.bizperf.find(
              (p) =>
                p.productId?.toString() === smeCapitalLoanProductId?.toString()
            )?.["Total Number of Accounts"] || 0)
        );
      }),
    ],
    [
      "",
      "",
      "% Growth Label",
      ...result.teams.map((t) => {
        const currentRoundTotalLoans =
          t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0;

        const prevRoundTotalLoans =
          prevRoundResult?.teams
            .find((t) => t.teamId.toString() === t.teamId.toString())
            ?.bizperf.find(
              (p) =>
                p.productId?.toString() === smeCapitalLoanProductId?.toString()
            )?.["Total Number of Accounts"] || 0;

        const growth =
          (currentRoundTotalLoans - prevRoundTotalLoans) /
          (prevRoundTotalLoans || 1);

        return growth;
      }),
    ],
    [
      "",
      "",
      "Shares of Customers",
      ...result.teams.map((t) => {
        return (
          result.marketShares
            ?.find(
              (ms) =>
                ms.productId.toString() === smeCapitalLoanProductId?.toString()
            )
            ?.marketShares.find(
              (ms) => ms.teamId.toString() === t.teamId.toString()
            )?.value || 0
        );
      }),
    ],
    [
      "",
      "",
      "This Year",
      ...result.teams.map((t) => {
        return (
          t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams || []).map((t) => {
        return (
          t.bizperf.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Number of Accounts"] || 0
        );
      }),
    ],
    [],
    [
      "",
      "",
      "SME Capital Loan",
      ...(result.teams || []).map((t) => {
        return (
          t.pnl.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Loans"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Interest Rate Charged",
      ...(result.teams || []).map((t) => {
        return (
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() === smeCapitalLoanProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value || 0
        );
      }),
    ],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams
        ? prevRoundResult.teams.map((t) => {
            return (
              t.pnl.find(
                (p) =>
                  p.productId?.toString() ===
                  smeCapitalLoanProductId?.toString()
              )?.["Total Loans"] || 0
            );
          })
        : result.teams.map((t) => 0)),
    ],
    [
      "",
      "",
      "Min Credit Rating",
      ...(result.teams || []).map((t) => {
        return (
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() === smeCapitalLoanProductId?.toString()
            )
            ?.fields.find((f) => f.key === "risk_level")?.value || 0
        );
      }),
    ],
    [
      "",
      "",
      "Label",
      ...(result.teams || []).map((t) => {
        return Math.round(
          (t.pnl.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Total Loans"] || 0) /
            (1000 * 1000 * 1000)
        );
      }),
    ],
  ];

  const smeCapitalLoanProvisionsTable = [
    ["SME Capital Loan - Provisions"],
    [
      "",
      "",
      "Provisions ($Mn)",
      ...result.teams.map((t) => {
        return (
          (t.pnl.find(
            (p) =>
              p.productId?.toString() === smeCapitalLoanProductId?.toString()
          )?.["Provisions"] || 0) /
          (1000 * 1000)
        );
      }),
    ],
    [
      "",
      "",
      "Credit Score Tolerance",
      ...(result.teams || []).map((t) => {
        return (
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() === smeCapitalLoanProductId?.toString()
            )
            ?.fields.find((f) => f.key === "risk_level")?.value || 0
        );
      }),
    ],
  ];

  const netInterestIncomeDifferenceTable = [
    ["Net Interest Income"],
    ...segments.map((s, index) => [
      index === 0 ? "CBAL" : "",
      "",
      s.name,
      ...(prevRoundResult?.teams || []).map((t) => {
        return (
          t.pnl.find((p) => p.segmentId?.toString() === s._id.toString())?.[
            "Net Interest Income"
          ] || 0
        );
      }),
    ]),
    [
      "",
      "",
      "Total Interest Income",
      ...(prevRoundResult?.teams || []).map((t) => {
        return t.pnl
          .filter((p) => p.segmentId && !p.productId)
          .reduce((acc, p) => acc + (p["Net Interest Income"] || 0), 0);
      }),
    ],
    ...segments.map((s, index) => [
      index === 0 ? "OBAL" : "",
      "",
      s.name,
      ...(result.teams || []).map((t) => {
        return (
          t.pnl.find((p) => p.segmentId?.toString() === s._id.toString())?.[
            "Net Interest Income"
          ] || 0
        );
      }),
    ]),
    ...segments.map((s, index) => [
      index === 0 ? "LABELS (DELTA)" : "",
      "",
      s.name,
      ...(result.teams || []).map((t) => {
        const currentRoundSegmentTotalInterestIncome = t.pnl
          .filter((p) => p.segmentId && !p.productId)
          .reduce((acc, p) => acc + (p["Net Interest Income"] || 0), 0);
        const prevRoundSegmentTotalInterestIncome =
          prevRoundResult?.teams
            .find((t) => t.teamId.toString() === t.teamId.toString())
            ?.pnl.filter((p) => p.segmentId && !p.productId)
            .reduce((acc, p) => acc + (p["Net Interest Income"] || 0), 0) || 0;

        return (
          (currentRoundSegmentTotalInterestIncome -
            prevRoundSegmentTotalInterestIncome) /
          (prevRoundSegmentTotalInterestIncome || 1)
        );
      }),
    ]),
  ];

  const nonInterestIncomeDifferenceTable = [
    ["Non-Interest Income"],
    ...segments.map((s, index) => [
      index === 0 ? "CBAL" : "",
      "",
      s.name,
      ...(prevRoundResult?.teams || []).map((t) => {
        return (
          t.pnl.find((p) => p.segmentId?.toString() === s._id.toString())?.[
            "Non-Interest Income"
          ] || 0
        );
      }),
    ]),
    [
      "",
      "",
      "Total Non-Interest Income",
      ...(prevRoundResult?.teams || []).map((t) => {
        return t.pnl
          .filter((p) => p.segmentId && !p.productId)
          .reduce((acc, p) => acc + (p["Non-Interest Income"] || 0), 0);
      }),
    ],
    ...segments.map((s, index) => [
      index === 0 ? "OBAL" : "",
      "",
      s.name,
      ...(result.teams || []).map((t) => {
        return (
          t.pnl.find((p) => p.segmentId?.toString() === s._id.toString())?.[
            "Non-Interest Income"
          ] || 0
        );
      }),
    ]),
    ...segments.map((s, index) => [
      index === 0 ? "LABELS (DELTA)" : "",
      "",
      s.name,
      ...(result.teams || []).map((t) => {
        const currentRoundSegmentTotalInterestIncome = t.pnl
          .filter((p) => p.segmentId && !p.productId)
          .reduce((acc, p) => acc + (p["Non-Interest Income"] || 0), 0);
        const prevRoundSegmentTotalInterestIncome =
          prevRoundResult?.teams
            .find((t) => t.teamId.toString() === t.teamId.toString())
            ?.pnl.filter((p) => p.segmentId && !p.productId)
            .reduce((acc, p) => acc + (p["Non-Interest Income"] || 0), 0) || 0;

        return (
          (currentRoundSegmentTotalInterestIncome -
            prevRoundSegmentTotalInterestIncome) /
          (prevRoundSegmentTotalInterestIncome || 1)
        );
      }),
    ]),
  ];

  const nonInterestExpenseTable = [
    ["Non-Interest Expense"],
    // Non-interest expense rows (using existing NON_INTEREST_EXPENSE_ROWS)
    ...NON_INTEREST_EXPENSE_ROWS.map((rowLabel) => [
      "",
      "",
      rowLabel,
      ...result.teams.map((team) => {
        // Sum this expense category across all products
        const sum =
          (team.pnl || [])
            .filter((pnl) => !!pnl.segmentId && !!pnl.productId)
            .reduce((total, pnlItem) => {
              const value = pnlItem[rowLabel];
              return total + (typeof value === "number" ? value : 0);
            }, 0) || 0;
        return sum;
      }),
    ]),
  ];

  const tnoTable = [
    ["Tech & Ops"],
    ...(availableGlobalInputs
      .find((agi) => agi.key === "tech_ops")
      ?.inputs.map((input) => [
        "",
        "",
        input.name,
        ...result.teams.map((t) => {
          return t.decision?.globalDecisionDetails.find(
            (d) =>
              d.globalInputId.toString() ===
                availableGlobalInputs
                  .find((agi) => agi.key === "tech_ops")
                  ?._id.toString() && d.key === input.key
          )?.value;
        }),
      ]) || []),
  ];

  const fixedInitiativeSets = 3;

  const initiativeTable = [
    [
      `Strategic Initiatives`,
      // "",
      // "",
      // ...result.teams.map((team) => team.team?.teamName),
    ],

    ...Array.from({ length: fixedInitiativeSets }, (_, index) => {
      return [
        "",
        "",
        `Selected Initiatives ${index + 1}`,
        ...result.teams.map((team) => {
          const chosen = team.decision?.globalDecisionDetails
            .filter((detail) =>
              detail.key &&
              detail.globalInputId.toString() ===
                initiativeGlobInput?._id.toString()
                ? detail
                : null
            )
            .filter((c) => c?.selected)[index];
          return chosen?.key
            ? initiativeGlobInput?.inputs.find((i) => i.key === chosen.key)
                ?.name
            : "-";
        }),
      ];
    }),
  ];

  const combinedESATDrivers = result.esatDrivers.reduce(
    (acc, curr) => {
      const existingDriver = acc.find((d) => d.fieldKey === curr.fieldKey);

      // Combine team values for the current driver
      const combinedTeamValues = combineTeamValues(curr.teamValues);

      if (existingDriver) {
        combinedTeamValues.forEach((tv) => {
          const existingTeamInDriverIndex = existingDriver.teamValues.findIndex(
            (tv2) => tv2.teamId.toString() === tv.teamId.toString()
          );

          if (existingTeamInDriverIndex !== -1) {
            existingDriver.teamValues[existingTeamInDriverIndex].score +=
              tv.score;
          } else {
            existingDriver.teamValues.push({
              teamId: tv.teamId.toString(),
              score: tv.score,
            });
          }
        });
      } else {
        acc.push({
          fieldKey: curr.fieldKey,
          fieldLabel: curr.fieldLabel,
          decisionType: curr.decisionType,
          teamValues: combinedTeamValues,
        });
      }

      return acc;
    },
    [] as {
      fieldKey: string;
      fieldLabel: string;
      decisionType: string;
      teamValues: { teamId: string; score: number }[];
    }[]
  );

  const sumOfCombinedESATDrivers = combinedESATDrivers.reduce(
    (acc, curr) => {
      curr.teamValues.forEach((tv) => {
        const existingTeam = acc.find(
          (t) => t.teamId.toString() === tv.teamId.toString()
        );

        if (existingTeam) {
          existingTeam.sum += tv.score;
        } else {
          acc.push({ teamId: tv.teamId.toString(), sum: tv.score });
        }
      });

      return acc;
    },
    [] as Array<{ teamId: string; sum: number }>
  );

  const totalLoansPerSegmentTable = [
    ["Total Loans"],
    ...segments.map((s) => [
      "",
      "",
      s.name,
      ...result.teams.map((t) => {
        return (
          t.pnl.find(
            (p) => p.segmentId?.toString() === s._id.toString() && !p.productId
          )?.["Total Loans"] || 0
        );
      }),
    ]),
  ];

  const affluentPremierLoanProductId = products.find(
    (p) =>
      p.segmentId.equals(affluentSegmentId) && p.productName.includes("Loan")
  )?._id;

  const retailAffluentPremierLoanTable = [
    ["Retail Affluent Premier Loan"],
    [
      "",
      "",
      "Retail Affluent Premier Loan",
      ...result.teams.map((t) => {
        return (
          t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              affluentPremierLoanProductId?.toString()
          )?.["Total Loans"] || 0
        );
      }),
    ],
    [
      "",
      "",
      "Interest Rate Charged",
      ...result.teams.map(
        (t) =>
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                affluentPremierLoanProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value || 0
      ),
    ],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams || []).map(
        (t) =>
          t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              affluentPremierLoanProductId?.toString()
          )?.["Total Loans"] || 0
      ),
    ],
    [
      "",
      "",
      "Min Credit Rating",
      ...result.teams.map(
        (t) =>
          t.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId.toString() ===
                affluentPremierLoanProductId?.toString()
            )
            ?.fields.find((f) => f.key === "risk_level")?.value || 0
      ),
    ],
    [
      "",
      "",
      "Label",
      ...result.teams.map((t) => {
        const loan =
          t.pnl.find(
            (p) =>
              p.productId?.toString() ===
              affluentPremierLoanProductId?.toString()
          )?.["Total Loans"] || 0;

        return loan / (1000 * 1000 * 1000);
      }),
    ],
  ];

  const eventsTable = [
    ["Events"],
    ...(round.eventsTriggered || []).flatMap((eventTriggered) => {
      const event = (eventTriggered as { event?: any }).event;
      if (!event) return [];

      return [
        ["", "", event.eventName, ""],
        ...(event.choices || []).map((choice: any) => {
          const choiceLabel = choice.title;
          const choiceKey = typeof choice === "string" ? choice : choice.key;

          return [
            "",
            "",
            choiceLabel,
            ...result.teams.map((team) => {
              const teamEventDecision = team.decision?.eventDecisions?.find(
                (decision) =>
                  decision.eventId?.toString() ===
                    eventTriggered.eventId?.toString() &&
                  decision.chosenKey === choiceKey
              );

              return teamEventDecision ? "Selected" : "Not Selected";
            }),
          ];
        }),
        ["", "", "", ""],
      ];
    }),
  ];

  const esatTable = [
    ["ESAT"],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams || []).map((t) => {
        return (
          t.winningMetric.find((wm) => !wm.segmentId && wm.esat)?.esat || 0.6
        );
      }),
    ],

    [
      "",
      "",
      "Events",
      ...result.teams.map((t) => {
        const eventTypeDrivers = combinedESATDrivers.filter(
          (cesatDriver) => cesatDriver.decisionType === "event"
        );

        const currentTeamEventScores = eventTypeDrivers.map((driver) => {
          return (
            driver.teamValues.find(
              (tv) => tv.teamId.toString() === t.teamId.toString()
            )?.score || 0
          );
        });

        const currentTeamEventTotalScore = currentTeamEventScores.reduce(
          (acc, curr) => {
            return acc + curr;
          },
          0
        );

        const totalEsatEachSegment =
          result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.esat)
            .length || 1;

        return currentTeamEventTotalScore / totalEsatEachSegment;
      }),
    ],
    [
      "",
      "",
      "Initiatives",
      ...result.teams.map((t) => {
        const initiativeTypeDrivers = combinedESATDrivers.filter(
          (cesatDriver) => cesatDriver.decisionType === "initiatives"
        );

        // console.log("initiativeTypeDrivers", initiativeTypeDrivers;

        const currentTeamInitiativeScores = initiativeTypeDrivers.map(
          (driver) => {
            return (
              driver.teamValues.find(
                (tv) => tv.teamId.toString() === t.teamId.toString()
              )?.score || 0
            );
          }
        );

        const currentTeamInitiativeTotalScore =
          currentTeamInitiativeScores.reduce((acc, curr) => {
            return acc + curr;
          }, 0);

        const totalEsatEachSegment =
          result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.esat)
            .length || 1;

        return currentTeamInitiativeTotalScore / totalEsatEachSegment;
      }),
    ],
    [
      "",
      "",
      "Compensation & Hiring",
      ...result.teams.map((t) => {
        const productAndSegmentTypeDrivers = combinedESATDrivers.filter(
          (cesatDriver) =>
            cesatDriver.decisionType === "product" ||
            cesatDriver.decisionType === "segment"
        );

        const currentTeamProductAndSegmentScores =
          productAndSegmentTypeDrivers.map((driver) => {
            return (
              driver.teamValues.find(
                (tv) => tv.teamId.toString() === t.teamId.toString()
              )?.score || 0
            );
          });

        const currentTeamProductAndSegmentTotalScore =
          currentTeamProductAndSegmentScores.reduce((acc, curr) => {
            return acc + curr;
          }, 0);

        const totalEsatEachSegment =
          result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.esat)
            .length || 1;

        return currentTeamProductAndSegmentTotalScore / totalEsatEachSegment;
      }),
    ],

    [
      "",
      "",
      "Others",
      ...result.teams.map((t) => {
        const techOpsTypeDrivers = combinedESATDrivers.filter(
          (cesatDriver) => cesatDriver.decisionType === "tech_ops"
        );

        const currentTeamTechOpsScores = techOpsTypeDrivers.map((driver) => {
          return (
            driver.teamValues.find(
              (tv) => tv.teamId.toString() === t.teamId.toString()
            )?.score || 0
          );
        });

        const currentTeamTechOpsTotalScore = currentTeamTechOpsScores.reduce(
          (acc, curr) => {
            return acc + curr;
          },
          0
        );

        const totalEsatEachSegment =
          result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.esat)
            .length || 1;

        return currentTeamTechOpsTotalScore / totalEsatEachSegment;
      }),
    ],
    [
      "",
      "",
      "Closing ESAT",
      ...result.teams.map((t) => {
        return (
          t.winningMetric.find((wm) => !wm.segmentId && wm.esat)?.esat || 0
        );
      }),
    ],
  ];

  const combinedCSATDrivers = result.csatDrivers.reduce(
    (acc, curr) => {
      const existingDriver = acc.find((d) => d.fieldKey === curr.fieldKey);

      // Combine team values for the current driver
      const combinedTeamValues = combineTeamValues(curr.teamValues);

      if (existingDriver) {
        combinedTeamValues.forEach((tv) => {
          const existingTeamInDriverIndex = existingDriver.teamValues.findIndex(
            (tv2) => tv2.teamId.toString() === tv.teamId.toString()
          );

          if (existingTeamInDriverIndex !== -1) {
            existingDriver.teamValues[existingTeamInDriverIndex].score +=
              tv.score;
          } else {
            existingDriver.teamValues.push({
              teamId: tv.teamId.toString(),
              score: tv.score,
            });
          }
        });
      } else {
        acc.push({
          fieldKey: curr.fieldKey,
          fieldLabel: curr.fieldLabel,
          decisionType: curr.decisionType,
          teamValues: combinedTeamValues,
        });
      }

      return acc;
    },
    [] as {
      fieldKey: string;
      fieldLabel: string;
      decisionType: string;
      teamValues: { teamId: string; score: number }[];
    }[]
  );

  const csatTable = [
    ["CSAT"],
    [
      "",
      "",
      "Last Year",
      ...(prevRoundResult?.teams
        ? prevRoundResult.teams.map((t) => {
            return (
              t.winningMetric.find((wm) => !wm.segmentId && wm.csat)?.csat ||
              0.6
            );
          })
        : result.teams.map((t) => 0)),
    ],

    [
      "",
      "",
      "Events",
      ...result.teams.map((t) => {
        const eventTypeDrivers = combinedCSATDrivers.filter(
          (csatDriver) => csatDriver.decisionType === "event"
        );

        const currentTeamEventScores = eventTypeDrivers.map((driver) => {
          return (
            driver.teamValues.find(
              (tv) => tv.teamId.toString() === t.teamId.toString()
            )?.score || 0
          );
        });

        const currentTeamEventTotalScore = currentTeamEventScores.reduce(
          (acc, curr) => {
            return acc + curr;
          },
          0
        );

        const totalCsatEachSegment =
          result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.csat)
            .length || 1;

        return currentTeamEventTotalScore / totalCsatEachSegment;
      }),
    ],
    [
      "",
      "",
      "Initiatives",
      ...result.teams.map((t) => {
        const initiativeTypeDrivers = combinedCSATDrivers.filter(
          (csatDriver) => csatDriver.decisionType === "initiatives"
        );

        const currentTeamInitiativeScores = initiativeTypeDrivers.map(
          (driver) => {
            return (
              driver.teamValues.find(
                (tv) => tv.teamId.toString() === t.teamId.toString()
              )?.score || 0
            );
          }
        );

        const currentTeamInitiativeTotalScore =
          currentTeamInitiativeScores.reduce((acc, curr) => {
            return acc + curr;
          }, 0);

        const totalCsatEachSegment =
          result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.csat)
            .length || 1;

        return currentTeamInitiativeTotalScore / totalCsatEachSegment;
      }),
    ],
    [
      "",
      "",
      "Tech & Ops",
      ...result.teams.map((t) => {
        const techOpsTypeDrivers = combinedCSATDrivers.filter(
          (csatDriver) => csatDriver.decisionType === "tech_ops"
        );

        const currentTeamTechOpsScores = techOpsTypeDrivers.map((driver) => {
          return (
            driver.teamValues.find(
              (tv) => tv.teamId.toString() === t.teamId.toString()
            )?.score || 0
          );
        });

        const currentTeamTechOpsTotalScore = currentTeamTechOpsScores.reduce(
          (acc, curr) => {
            return acc + curr;
          },
          0
        );

        const totalCsatEachSegment =
          result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.csat)
            .length || 1;

        return currentTeamTechOpsTotalScore / totalCsatEachSegment;
      }),
    ],
    [
      "",
      "",
      "Closing CSAT",
      ...result.teams.map((t) => {
        return (
          t.winningMetric.find((wm) => !wm.segmentId && wm.csat)?.csat || 0
        );
      }),
    ],
  ];

  const leagueTable = [
    [
      "The League",
      "",
      "",
      // ...result.teams.map((team) => "ranking value (NOT IMPLEMENTED)"),
    ],
    ["", "weighting", "", ...result.teams.map((team) => team.team?.teamName)],
    [
      "",
      "",
      "Risk Adjusted Profit",
      ...result.teams.map(
        (team) => team.winningMetric.find((m) => !m.segmentId)?.profit || 0
      ),
    ],
    [
      "",
      weights.find((w) => w.round === result.roundNumber)?.weights.rap || 0,
      "Risk Adjusted Profit Points",
      ...result.teams.map((team) => team.score.rap),
    ],
    [
      "",
      "",
      "CSAT",
      ...result.teams.map(
        (team) => team.winningMetric.find((m) => !m.segmentId)?.csat || 0
      ),
    ],
    [
      "",
      weights.find((w) => w.round === result.roundNumber)?.weights.csat || 0,
      "CSAT Points",
      ...result.teams.map((team) => team.score.csat),
    ],
    [
      "",
      "",
      "ESAT",
      ...result.teams.map(
        (team) => team.winningMetric.find((m) => !m.segmentId)?.esat || 0
      ),
    ],
    [
      "",
      weights.find((w) => w.round === result.roundNumber)?.weights.esat || 0,
      "ESAT Points",
      ...result.teams.map((team) => team.score.esat),
    ],
    [
      "",
      "",
      "Revenue",
      ...result.teams.map((team) => {
        return team.winningMetric.find((p) => !p.segmentId)?.revenue || 0;
      }),
    ],
    [
      "",
      weights.find((w) => w.round === result.roundNumber)?.weights.revenue || 0,
      "Revenue Points",
      ...result.teams.map((team) => team.score.revenue),
    ],
    [],
    ["", "", "Tie Break", ...result.teams.map((team) => 0)],
    [
      "",
      "",
      "In-Round Points",
      ...result.teams.map((team) => {
        return (
          (team.score.rap || 0) +
          (team.score.csat || 0) +
          (team.score.esat || 0) +
          (team.score.revenue || 0)
          // +
          // (team.score.tiebreaker || 0)
        );
      }),
    ],
    [
      "",
      "",
      "Rank",
      ...result.teams.map((team) => {
        const overallPointsOfAllTeams = result.teams
          .map((innerTeam) => ({
            teamId: innerTeam.teamId,
            overallPoints:
              (innerTeam.score.cumulativeRAP || 0) +
              (innerTeam.score.cumulativeCSAT || 0) +
              (innerTeam.score.cumulativeESAT || 0) +
              (innerTeam.score.cumulativeRevenue || 0),
            //  +
            // (innerTeam.score.tiebreaker || 0),
          }))
          .sort((a, b) => b.overallPoints - a.overallPoints);

        const rank =
          overallPointsOfAllTeams.findIndex(
            (innerTeam) =>
              innerTeam.teamId.toString() === team.teamId.toString()
          ) + 1;

        return rank;
      }),
    ],
    [
      "",
      "",
      "Cumulative Points",
      ...result.teams.map(
        (team) =>
          (team.score.cumulativeRAP || 0) +
          (team.score.cumulativeCSAT || 0) +
          (team.score.cumulativeESAT || 0) +
          (team.score.cumulativeRevenue || 0)
      ),
    ],
  ];

  const revenueTable = [
    ["", "Total Revenues"],
    [
      "",
      "",
      "Total Interest Income",
      ...result.teams.map((t) =>
        t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Net Interest Income"] || 0), 0)
      ),
    ],
    [
      "",
      "",
      "Total Non-Interest Income",
      ...result.teams.map((t) =>
        t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Non-Interest Income"] || 0), 0)
      ),
    ],
    [
      "",
      "",
      "Total Revenues",
      ...result.teams.map((t) =>
        t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Total Revenue"] || 0), 0)
      ),
    ],
    [],

    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );
      return segmentProducts.flatMap((product) => [
        ["", `${product.productName} - ${segment.name} Revenue`],
        [
          "",
          "",
          "Total Interest Income",
          ...result.teams.map(
            (t) =>
              t.pnl.find(
                (pnlItem) =>
                  pnlItem.productId?.toString() === product._id.toString()
              )?.["Net Interest Income"] || 0
          ),
        ],
        [
          "",
          "",
          "Total Non-Interest Income",
          ...result.teams.map(
            (t) =>
              t.pnl.find(
                (pnlItem) =>
                  pnlItem.productId?.toString() === product._id.toString()
              )?.["Non-Interest Income"] || 0
          ),
        ],
        [
          "",
          "",
          "Total Revenues",
          ...result.teams.map(
            (t) =>
              t.pnl.find(
                (pnlItem) =>
                  pnlItem.productId?.toString() === product._id.toString()
              )?.["Total Revenue"] || 0
          ),
        ],
        [],
      ]);
    }),
  ];

  const rapTable = [
    ["", "Risk Adjusted Profit"],
    [
      "",
      "",
      "NIAT",
      ...result.teams.map((t) =>
        t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Profit After Tax"] || 0), 0)
      ),
    ],
    [
      "",
      "",
      "Business Risk Capital",
      ...result.teams.map((t) =>
        t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Business Risk Capital"] || 0), 0)
      ),
    ],
    [
      "",
      "",
      "Credit Risk Capital",
      ...result.teams.map((t) =>
        t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Credit Risk Capital"] || 0), 0)
      ),
    ],

    [
      "",
      "",
      "Risk Adjusted Profit",
      ...result.teams.map((t) =>
        t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Risk Adjusted Profit"] || 0), 0)
      ),
    ],
    [],

    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );
      return segmentProducts.flatMap((product) => [
        ["", `${product.productName} - ${segment.name}`],
        [
          "",
          "",
          "NIAT",
          ...result.teams.map(
            (t) =>
              t.pnl.find(
                (pnlItem) =>
                  pnlItem.productId?.toString() === product._id.toString()
              )?.["Profit After Tax"] || 0
          ),
        ],
        [
          "",
          "",
          "Business Risk Capital",
          ...result.teams.map(
            (t) =>
              t.pnl.find(
                (pnlItem) =>
                  pnlItem.productId?.toString() === product._id.toString()
              )?.["Business Risk Capital"] || 0
          ),
        ],
        [
          "",
          "",
          "Credit Risk Capital",
          ...result.teams.map(
            (t) =>
              t.pnl.find(
                (pnlItem) =>
                  pnlItem.productId?.toString() === product._id.toString()
              )?.["Credit Risk Capital"] || 0
          ),
        ],
        [
          "",
          "",
          "Risk Adjusted Profit",
          ...result.teams.map(
            (t) =>
              t.pnl.find(
                (pnlItem) =>
                  pnlItem.productId?.toString() === product._id.toString()
              )?.["Risk Adjusted Profit"] || 0
          ),
        ],
        [],
      ]);
    }),
  ];

  const totalDepositsTable = [
    ["Total Deposits Revenue"],

    ...segments.flatMap((segment) => {
      return [
        [
          "",
          "",
          `${segment.name}`,
          ...result.teams.map(
            (t) =>
              t.ldr.depositPerSegment.find(
                (dps) => dps.segmentId.toString() === segment._id.toString()
              )?.deposit || 0
          ),
        ],
      ];
    }),
  ];

  let totalEnergyEachTeam = result.teams.map((t) => {
    return {
      teamId: t.teamId,
      totalEnergy: 0,
      productEnergy: 0,
      tnoEnergy: 0,
      initiativeEnergy: 0,
      eventEnergy: 0,
    };
  });

  const energyConsumptionTable = [
    ["Energy Consumption"],
    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return [
        // Segment field row (if segment has fields)
        ...(segment.fields && segment.fields.length > 0
          ? segment.fields
              .filter((f) => f.isConsumingEnergy)
              .map((field) => [
                "",
                "",
                `${segment.name} - ${field.label}`,
                ...result.teams.map((t) => {
                  const currentRoundLevel =
                    t.decision?.segmentDecisionDetails
                      .find(
                        (sdd) =>
                          sdd.segmentId.toString() === segment._id.toString()
                      )
                      ?.fields.find(
                        (innerField) => innerField.key === field.key
                      )?.value || 0;
                  const prevRoundLevel =
                    prevRoundDecisions
                      .find(
                        (rd) => rd?.teamId.toString() === t.teamId.toString()
                      )
                      ?.segmentDecisionDetails.find(
                        (sdd) =>
                          sdd.segmentId.toString() === segment._id.toString()
                      )
                      ?.fields.find(
                        (innerField) => innerField.key === field.key
                      )?.value || 0;

                  const diff = currentRoundLevel - prevRoundLevel;

                  if (diff > 0) {
                    const energyConsumed =
                      field.energyCosts?.find((ec) => ec.changeValue === diff)
                        ?.cost || 0;

                    totalEnergyEachTeam = totalEnergyEachTeam.map((teet) => {
                      if (t.teamId.toString() === teet.teamId.toString()) {
                        return {
                          ...teet,
                          totalEnergy: teet.totalEnergy + energyConsumed,
                          productEnergy: teet.productEnergy + energyConsumed,
                        };
                      }

                      return teet;
                    });

                    return energyConsumed;
                  }

                  return 0;
                }),
              ])
          : []),
        // Product field rows
        ...segmentProducts.flatMap((product) =>
          product.fields && product.fields.length > 0
            ? product.fields
                .filter((f) => f.isConsumingEnergy)
                .map((field) => [
                  "",
                  "",
                  `${product.productName} - ${field.label}`,
                  ...result.teams.map((t) => {
                    const currentRoundLevel =
                      t.decision?.decisionDetails
                        .find(
                          (dd) =>
                            dd.productId.toString() === product._id.toString()
                        )
                        ?.fields.find(
                          (innerField) => innerField.key === field.key
                        )?.value || 0;
                    const prevRoundLevel =
                      prevRoundDecisions
                        .find(
                          (rd) => rd?.teamId.toString() === t.teamId.toString()
                        )
                        ?.decisionDetails.find(
                          (dd) =>
                            dd.productId.toString() === product._id.toString()
                        )
                        ?.fields.find(
                          (innerField) => innerField.key === field.key
                        )?.value || 0;

                    const diff = currentRoundLevel - prevRoundLevel;

                    if (diff > 0) {
                      const energyConsumed =
                        field.energyCosts?.find((ec) => ec.changeValue === diff)
                          ?.cost || 0;

                      totalEnergyEachTeam = totalEnergyEachTeam.map((teet) => {
                        if (t.teamId.toString() === teet.teamId.toString()) {
                          return {
                            ...teet,
                            totalEnergy: teet.totalEnergy + energyConsumed,
                            productEnergy: teet.productEnergy + energyConsumed,
                          };
                        }

                        return teet;
                      });

                      return energyConsumed;
                    }

                    return 0;
                  }),
                ])
            : []
        ),
        // Empty row for spacing
        [""],
      ];
    }),
    [
      "",
      "",
      "Total Product Energy",
      ...result.teams.map((t) => {
        return (
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.totalEnergy || 0
        );
      }),
    ],
    [],
    ...availableGlobalInputs
      .filter((agi) => agi.type === "full-set")
      .flatMap((agi) => {
        const agiRows = agi.inputs.map((input) => {
          return [
            "",
            "",
            `${agi.name} - ${input.name}`,
            ...result.teams.map((t) => {
              if (agi.type === "full-set") {
                const currentRoundLevel =
                  t.decision?.globalDecisionDetails.find(
                    (dd) =>
                      dd.globalInputId.toString() === agi._id.toString() &&
                      dd.key === input.key
                  )?.value || 0;

                const prevRoundLevel =
                  prevRoundDecisions
                    .find((rd) => rd?.teamId.toString() === t.teamId.toString())
                    ?.globalDecisionDetails.find(
                      (dd) =>
                        dd.globalInputId.toString() === agi._id.toString() &&
                        dd.key === input.key
                    )?.value || 0;

                const diff = currentRoundLevel - prevRoundLevel;

                // Determine energy cost mode: check if first entry has levelValue (cumulative) or changeValue (delta)
                const isCumulativeMode =
                  input.energyCosts &&
                  input.energyCosts.length > 0 &&
                  input.energyCosts[0].levelValue !== undefined;

                let energyConsumed = 0;

                // Only consume energy if level increased (diff > 0)
                if (diff > 0) {
                  if (isCumulativeMode) {
                    // Cumulative mode: use currentRoundLevel (final level)
                    energyConsumed =
                      input.energyCosts?.find(
                        (ec) => ec.levelValue === currentRoundLevel
                      )?.cost || 0;
                  } else {
                    // Delta mode: use diff (change value)
                    energyConsumed =
                      input.energyCosts?.find((ec) => ec.changeValue === diff)
                        ?.cost || 0;
                  }
                }

                if (energyConsumed > 0) {
                  totalEnergyEachTeam = totalEnergyEachTeam.map((teet) => {
                    if (t.teamId.toString() === teet.teamId.toString()) {
                      return {
                        ...teet,
                        totalEnergy: teet.totalEnergy + energyConsumed,
                        tnoEnergy: teet.tnoEnergy + energyConsumed,
                      };
                    }

                    return teet;
                  });
                }

                return energyConsumed;
              } else if (agi.type === "selectable-set") {
                const isCurrentRoundSelected =
                  !!t.decision?.globalDecisionDetails.find(
                    (dd) =>
                      dd.globalInputId.toString() === agi._id.toString() &&
                      dd.key === input.key
                  )?.selected;

                if (isCurrentRoundSelected) {
                  totalEnergyEachTeam = totalEnergyEachTeam.map((teet) => {
                    if (t.teamId.toString() === teet.teamId.toString()) {
                      return {
                        ...teet,
                        totalEnergy: teet.totalEnergy + (input.energy || 0),
                      };
                    }

                    return teet;
                  });

                  return input.energy;
                }

                return 0;
              }

              return 0;
            }),
          ];
        });

        return [...agiRows, [""]];
      }),

    [
      "",
      "",
      "Total T&O",
      ...result.teams.map((t) => {
        return (
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.tnoEnergy || 0
        );
      }),
    ],
    [],
    [
      "",
      "",
      "Enterprise Initiatives",
      ...result.teams.map((t) => {
        const initiativeId = availableGlobalInputs.find(
          (agi) => agi.key === "initiatives"
        )?._id;

        const totalInitiativesEnergy =
          result.teams
            .find((te) => te.teamId.toString() === t.teamId.toString())
            ?.decision?.globalDecisionDetails.filter(
              (gdd) => gdd.globalInputId.toString() === initiativeId?.toString()
            )
            .reduce((acc, curr) => {
              const isSelected = !!curr.selected;

              const energy = isSelected
                ? availableGlobalInputs
                    .find((agi) => agi.key === "initiatives")
                    ?.inputs.find((i) => i.key === curr.key)?.energy || 0
                : 0;

              return acc + energy;
            }, 0) || 0;

        totalEnergyEachTeam = totalEnergyEachTeam.map((teet) => {
          if (t.teamId.toString() === teet.teamId.toString()) {
            return {
              ...teet,
              initiativeEnergy: teet.initiativeEnergy + totalInitiativesEnergy,
              totalEnergy: teet.totalEnergy + totalInitiativesEnergy,
            };
          }

          return teet;
        });

        return totalInitiativesEnergy;
      }),
    ],
    [],
    [
      "",
      "",
      "Enterprise Events",
      ...result.teams.map((t) => {
        const totalEventsEnergy =
          (
            result.teams.find(
              (te) => te.teamId.toString() === t.teamId.toString()
            )?.decision?.eventDecisions || []
          ).reduce((acc, curr) => {
            const energy =
              availableEvents
                .find(
                  (event) => event._id.toString() === curr.eventId.toString()
                )
                ?.choices.find((choice: any) => choice.key === curr.chosenKey)
                ?.config[result.roundNumber]?.energyCost || 0;

            return acc + energy;
          }, 0) || 0;

        totalEnergyEachTeam = totalEnergyEachTeam.map((teet) => {
          if (t.teamId.toString() === teet.teamId.toString()) {
            return {
              ...teet,
              eventEnergy: teet.eventEnergy + totalEventsEnergy,
              totalEnergy: teet.totalEnergy + totalEventsEnergy,
            };
          }

          return teet;
        });

        return totalEventsEnergy;
      }),
    ],
    // ...(round.eventsTriggered || []).map((eventTriggered) => {
    //   return [
    //     "",
    //     "",
    //     `${eventTriggered.event?.eventName}`,
    //     ...result.teams.map((t) => {
    //       const energyConsumedForEvent =
    //         eventTriggered.event?.choices.find(
    //           (choice) =>
    //             choice.key ===
    //             t.decision?.eventDecisions?.find(
    //               (ed) =>
    //                 ed.eventId.toString() === eventTriggered.eventId.toString()
    //             )?.chosenKey
    //         )?.config[round.roundNumber]?.energyCost || 0;

    //       if (energyConsumedForEvent > 0) {
    //         totalEnergyEachTeam = totalEnergyEachTeam.map((teet) => {
    //           if (t.teamId.toString() === teet.teamId.toString()) {
    //             return {
    //               ...teet,
    //               totalEnergy: teet.totalEnergy + energyConsumedForEvent,
    //             };
    //           }
    //           return teet;
    //         });
    //       }

    //       return energyConsumedForEvent;
    //     }),
    //   ];
    // }),
    [],
    [
      "",
      "",
      "Total Energy",
      ...result.teams.map(
        (t) =>
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.totalEnergy || 0
      ),
    ],
  ];

  const energySpentTable = [
    ["Energy Spend"],
    [
      "",
      "",
      "Total Prod Energy Spend",
      ...result.teams.map(
        (t) =>
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.productEnergy || 0
      ),
    ],
    [
      "",
      "",
      "Tech & Ops",
      ...result.teams.map(
        (t) =>
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.tnoEnergy || 0
      ),
    ],
    [
      "",
      "",
      "Initiatives",
      ...result.teams.map(
        (t) =>
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.initiativeEnergy || 0
      ),
    ],
    [
      "",
      "",
      "Events",
      ...result.teams.map(
        (t) =>
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.eventEnergy || 0
      ),
    ],
    [
      "",
      "",
      "Total Energy Allocated",
      ...result.teams.map(
        (t) =>
          totalEnergyEachTeam.find(
            (te) => te.teamId.toString() === t.teamId.toString()
          )?.totalEnergy || 0
      ),
    ],
  ];

  const rawArrayData = [
    [
      "Table Name",
      "Required data (Lv. 1)",
      "Required data (Lv. 2)",
      ...result.teams.map((team) => team.team?.teamName),
    ],
    ...leagueTable,
    [],
    [],
    ...revenueTable,
    [],
    ...rapTable,
    [],
    ...totalDepositsTable,
    [],
    [],
    ...ldrTable,
    [],
    [],
    ...vocTable,
    [],
    ...provisionTable,
    [],
    [],
    ...nonInterestExpenseTable,
    [],
    [],
    ...tnoTable,
    [],
    [],
    ...esatTable,
    [],
    [],
    ...csatTable,
    [],
    [],
    ...companyLevelPNLTable,
    [],
    [],
    ...energyConsumptionTable,
    [],
    [],
    ...changeInConsumerBankingDepositTable,
    [],
    [],
    ...institutionalLendingTable,
    [],
    [],
    ...netInterestIncomeTable,
    [],
    [],
    ...nonInterestIncomeTable,
    [],
    [],
    ...marketShareByProductTable,
    [],
    [],
    ...riskAppetiteByProductTable,
    [],
    [],
    ...energySpentTable,
    [],
    [],
    ...marketShareRetailAffluentPrivateBankingServiceTable,
    [],
    [],
    ...smeCapitalLoanTable,
    [],
    [],
    ...institutionalLendingSecondTable,
    [],
    [],
    ...tnoLevelAndDiffTable,
    [],
    [],
    ...cfsDepositsBySegmentTable,
    [],
    [],
    ...interestExpenseOverallDepositTable,
    [],
    [],
    ...creditCardRetailMassChargeOffRiskTable,
    [],
    [],
    ...companyLevelRAPTable,
    [],
    [],
    ...retailMassLoanTable,
    [],
    [],
    ...smeCapitalLoanLongerTable,
    [],
    [],
    ...smeCapitalLoanProvisionsTable,
    [],
    [],
    ...netInterestIncomeDifferenceTable,
    [],
    [],
    ...nonInterestIncomeDifferenceTable,
    [],
    [],
    ...initiativeTable,
    [],
    [],
    ...totalLoansPerSegmentTable,
    [],
    [],
    ...retailAffluentPremierLoanTable,
    [],
    [],
    ...eventsTable,
    [],
    [],
  ];

  if (download) {
    const feedbackSheet = XLSX.utils.aoa_to_sheet(rawArrayData);

    // Set column width for the title
    feedbackSheet["!cols"] = [
      { wpx: 200 },
      { wpx: 200 },
      { wpx: 200 },
      ...result.teams.map((team) => ({ wpx: 200 })),
      // { wpx: 15 },
      // { wpx: 15 },
      // { wpx: 213 },
      // { wpx: 87 },
      // ...result.teams.map((team) => ({ wpx: 123 })),
    ]; // Adjust width as needed

    // Add the feedbackSheet to the workbook
    XLSX.utils.book_append_sheet(workbook, feedbackSheet, "Feedback");

    // Write to file
    const fileName = `analysis_report_round_${result.roundNumber}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    return fileName;
  }

  return {
    segments: segments.map((segment) => ({
      name: segment.name,
      key: segment.key,
      _id: segment._id,
    })),

    segmentProducts: segments.flatMap((segment) => {
      return productsSortedBySegmentOrderThenProductOrder
        .filter((product) => {
          return product.segmentId.toString() === segment._id.toString();
        })
        .map((product) => {
          return {
            segmentName: segment.name,
            segmentId: segment._id,
            // segmentKey: segment.key,
            productName: product.productName,
            productId: product._id,
            // productKey: product.key,
          };
        });
    }),

    energyConsumption: result.teams.map((team) => {
      return {
        name: team.team?.teamName,
        product:
          totalEnergyEachTeam.find(
            (teet) => teet.teamId.toString() === team.teamId.toString()
          )?.productEnergy || 0,
        tAndO:
          totalEnergyEachTeam.find(
            (teet) => teet.teamId.toString() === team.teamId.toString()
          )?.tnoEnergy || 0,
        initiatives:
          totalEnergyEachTeam.find(
            (teet) => teet.teamId.toString() === team.teamId.toString()
          )?.initiativeEnergy || 0,
      };
    }),
    depositsPerSegment: result.teams.map((team) => {
      const returned: Record<string, number | string | null | undefined> = {
        name: team.team?.teamName,
      };

      segments.forEach((segment) => {
        returned[segment.key] =
          team.pnl.find(
            (pnl) =>
              pnl.segmentId?.toString() === segment._id.toString() &&
              !pnl.productId
          )?.["Total Deposits"] || 0;
      });

      return returned;
    }),

    retailMassDeposit: result.teams.map((team) => {
      const retailMassDepositProductId = products.find(
        (p) =>
          p.productName.includes("Deposit") &&
          p.segmentId.toString() === retailMassSegmentId?.toString()
      )?._id;

      return {
        name: team.team?.teamName,
        retailMass:
          team.pnl.find(
            (pnl) =>
              pnl.productId?.toString() ===
              retailMassDepositProductId?.toString()
          )?.["Total Deposits"] || 0,
        interestRate:
          team.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId?.toString() ===
                retailMassDepositProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value || 0,
      };
    }),

    retailAffluentDeposit: result.teams.map((team) => {
      const retailAffluentSegmentId = segments.find((s) =>
        s.name.includes("Affluent")
      )?._id;

      const retailAffluentDepositProductId = products.find(
        (p) =>
          p.productName.includes("Private Banking Services") &&
          p.segmentId.toString() === retailAffluentSegmentId?.toString()
      )?._id;

      return {
        name: team.team?.teamName,
        retailAffluent:
          team.pnl.find(
            (pnl) =>
              pnl.productId?.toString() ===
              retailAffluentDepositProductId?.toString()
          )?.["Total Deposits"] || 0,
        interestRate:
          team.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId?.toString() ===
                retailAffluentDepositProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value || 0,
      };
    }),

    smeDeposit: result.teams.map((team) => {
      const smeSegmentId = segments.find((s) => s.name.includes("SME"))?._id;
      const smeDepositProductId = products.find(
        (p) =>
          p.productName.includes("Deposit") &&
          p.segmentId.toString() === smeSegmentId?.toString()
      )?._id;

      return {
        name: team.team?.teamName,
        sme:
          team.pnl.find(
            (pnl) =>
              pnl.productId?.toString() === smeDepositProductId?.toString()
          )?.["Total Deposits"] || 0,
        interestRate:
          team.decision?.decisionDetails
            .find(
              (dd) =>
                dd.productId?.toString() === smeDepositProductId?.toString()
            )
            ?.fields.find((f) => f.key === "interest_rate")?.value || 0,
      };
    }),

    revenueBreakDown: result.teams.map((team) => {
      return {
        name: team.team?.teamName,
        revenues: segments.flatMap((segment) => {
          return productsSortedBySegmentOrderThenProductOrder
            .filter((product) => {
              return product.segmentId.toString() === segment._id.toString();
            })
            .map((product) => {
              return {
                segment: segment.name,
                segmentId: segment._id,
                product: product.productName,
                productId: product._id,
                revenue:
                  team.pnl.find(
                    (pnl) =>
                      pnl.productId?.toString() === product._id.toString()
                  )?.["Total Revenue"] || 0,
              };
            });
        }),
      };
    }),

    league: result.teams.map((team) => {
      const currentRoundScore =
        (team.score.revenue || 0) +
          (team.score.rap || 0) +
          (team.score.csat || 0) +
          (team.score.esat || 0) || 0;
      const totalScore =
        (team.score.cumulativeRevenue || 0) +
          (team.score.cumulativeRAP || 0) +
          (team.score.cumulativeCSAT || 0) +
          (team.score.cumulativeESAT || 0) +
          currentRoundScore || 0;

      return {
        name: team.team?.teamName,
        revenue: team.winningMetric.find((wm) => !wm.segmentId)?.revenue || 0,
        profitability:
          team.winningMetric.find((wm) => !wm.segmentId)?.profit || 0,
        customer: team.winningMetric.find((wm) => !wm.segmentId)?.csat || 0,
        employee: team.winningMetric.find((wm) => !wm.segmentId)?.esat || 0,
        currentRound: currentRoundScore,
        totalScore: totalScore,
      };
    }),
  };
}

function createAnalysisReport(
  result: ResultInterface,
  {
    availableGlobalInputs,
    segments,
    products,
    prevRoundDecisions,
    baseData,
    prevRoundResult,
    round,
    download = true,
  }: {
    availableGlobalInputs: IGlobalInput[];
    segments: SegmentInterface[];
    products: ProductInterface[];
    prevRoundDecisions: (DecisionInterface | null)[];
    baseData: BaseDataInterface;
    prevRoundResult?: ResultInterface | null;
    round: RoundInterface;
    download?: boolean;
  }
) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  const initiativeGlobInput = availableGlobalInputs.find(
    (input) => input.key === "initiatives"
  );

  const initiativesChosenPerTeam = result.teams.map((team) => {
    return team.decision?.globalDecisionDetails.map((detail) => {
      return detail.key &&
        detail.globalInputId.toString() === initiativeGlobInput?._id.toString()
        ? detail
        : null;
    });
  });

  const detailedPNLTable = [
    [
      {
        v: "PNL",
        t: "s",
        s: {
          font: {
            sz: 24,
            bold: true,
          },
        },
      },
    ],
    [
      {
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thin", color: { rgb: "ee0000" } } } },
      },
      {
        v: "Company level",
        t: "s",
        s: {
          font: { bold: true },
          border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
        },
      },
      {
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thin", color: { rgb: "ee0000" } } } },
      },
      {
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thin", color: { rgb: "ee0000" } } } },
      },

      ...result.teams.map((team) => ({
        v: "",
        t: "s",
        s: {
          font: { bold: true },
          border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
        },
      })),
    ],

    ...PNL_ROWS.map((rowLabel) => [
      "",
      "",
      "",
      {
        v: rowLabel,
        t: "s",
        s: {
          ...(CUSTOM_PNL_STYLE[rowLabel as keyof typeof CUSTOM_PNL_STYLE] ||
            {}),
        },
      },
      ...result.teams.map((team) => {
        // sum all the PnL
        const teamPnl = (team.pnl || [])
          .filter((pnl) => !!pnl.segmentId && !!pnl.productId)
          .reduce(
            (acc, curr) => {
              if (curr[rowLabel] && typeof curr[rowLabel] === "number") {
                acc[rowLabel] = (acc[rowLabel] || 0) + (curr[rowLabel] || 0);
              }

              return acc;
            },
            {} as Record<keyof PNLUnderTeamInterface, number>
          );

        // Return the value for this rowLabel, or empty if not found
        return {
          v: teamPnl[rowLabel] || 0,
          t: "n",
          z: "#,##0",
          s: {
            ...(CUSTOM_PNL_STYLE[rowLabel as keyof typeof CUSTOM_PNL_STYLE] ||
              {}),
            // numFmt: ""
          },
        };
      }),
    ]),

    [""],

    ...segments.flatMap((segment) => {
      // Find products in this segment
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );
      // For each product in the segment
      return segmentProducts.flatMap((product) => [
        // Product header row
        [
          {
            v: "",
            t: "s",
            s: {
              border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
            },
          },
          {
            v: `${segment.name} - ${product.productName}`,
            t: "s",
            s: {
              font: { bold: true },
              border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
            },
          },
          ...Array.from({ length: result.teams.length + 2 }).fill({
            v: "",
            t: "s",
            s: {
              border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
            },
          }),
        ],
        // For each PNL row, create a row with values for each team
        ...PNL_ROWS.map((rowLabel) => [
          "",
          "",
          "",
          {
            v: rowLabel,
            t: "s",
            s: {
              ...(CUSTOM_PNL_STYLE[rowLabel as keyof typeof CUSTOM_PNL_STYLE] ||
                {}),
            },
          },
          ...result.teams.map((team) => {
            // Find the PNL object for this product and team
            const teamPnl = team.pnl?.find(
              (p) =>
                p.productId?.toString() === product._id.toString() &&
                p.segmentId?.toString() === segment._id.toString()
            );
            // Return the value for this rowLabel, or empty if not found
            return teamPnl
              ? {
                  v: teamPnl[rowLabel],
                  t: "n",
                  z: "#,##0",
                  s: {
                    ...(CUSTOM_PNL_STYLE[
                      rowLabel as keyof typeof CUSTOM_PNL_STYLE
                    ] || {}),
                  },
                }
              : { v: 0, t: "n", z: "#,##0" };
          }),
        ]),
        // Empty row for spacing
        ["", ...Array(result.teams.length + 1).fill("")],
      ]);
    }),
  ];

  const productsSortedBySegmentOrderThenProductOrder = products.sort((a, b) => {
    const segmentA = segments.find(
      (s) => s._id.toString() === a.segmentId.toString()
    );
    const segmentB = segments.find(
      (s) => s._id.toString() === b.segmentId.toString()
    );
    return (
      (segmentA?.order || 0) - (segmentB?.order || 0) ||
      (a.order || 0) - (b.order || 0)
    );
  });

  const productGroupedTable = [
    [{ v: "Product Analysis", t: "s", s: { font: { sz: 24, bold: true } } }],
    ...productsSortedBySegmentOrderThenProductOrder.flatMap((product) => {
      const segment = segments.find(
        (s) => s._id.toString() === product.segmentId.toString()
      );
      const marketShare = result.marketShares?.find(
        (ms) => ms.productId.toString() === product._id.toString()
      );
      const sortedDrivers =
        marketShare?.weightedScores.sort(
          (a, b) => b.coefficient - a.coefficient
        ) || [];

      return [
        // Product header
        [
          {
            v: "",
            t: "s",
            s: {
              border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
            },
          },
          {
            v: `${product.productName} - ${segment?.name}`,
            t: "s",
            s: {
              font: { bold: true },
              border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
            },
          },
          ...Array.from({ length: result.teams.length + 2 }).fill({
            v: "",
            t: "s",
            s: {
              border: { bottom: { style: "thin", color: { rgb: "ee0000" } } },
            },
          }),
        ],

        // DECISIONS section
        ["", { v: "Decisions", t: "s", s: { font: { bold: true } } }],
        // Product decision fields
        ...product.fields.map((field) => [
          "",
          "",
          "",
          field.label,
          ...result.teams.map((team) => {
            const currentFieldDecision = team.decision?.decisionDetails
              .find(
                (detail) =>
                  detail.productId.toString() === product._id.toString()
              )
              ?.fields.find((f) => f.key === field.key)?.value;

            return {
              v: currentFieldDecision || 0,
              t: "n",
              z: field.label.includes("%") ? "#,##0.00%" : "#,##0",
            };
          }),
        ]),
        // Segment decision fields for this product's segment
        ...(segment?.fields.map((field) => [
          "",
          "",
          "",
          `${segment.name} - ${field.label}`,
          ...result.teams.map((team) => {
            const currentFieldDecision = team.decision?.segmentDecisionDetails
              .find(
                (detail) =>
                  detail.segmentId.toString() === segment._id.toString()
              )
              ?.fields.find((f) => f.key === field.key)?.value;

            return {
              v: currentFieldDecision || 0,
              t: "n",
              z: field.label.includes("%") ? "#,##0.00%" : "#,##0",
            };
          }),
        ]) || []),

        // Empty row
        [""],

        // MARKET SHARE section
        ["", { v: "Market Share", t: "s", s: { font: { bold: true } } }],
        [
          "",
          "",
          "",
          "Market Share %",
          ...result.teams.map((team) => {
            const ms =
              team.bizperf.find(
                (bp) => bp.productId?.toString() === product._id.toString()
              )?.["Market Share"] || 0;

            return {
              v: ms,
              t: "n",
              z: "#,##0.00%",
            };
          }),
        ],

        // Empty row
        [""],

        // DRIVERS section
        ["", { v: "Decision Drivers", t: "s", s: { font: { bold: true } } }],
        [
          "",
          "",
          "Driver",
          "Coefficient",
          ...result.teams.map((t) => t.team?.teamName),
          "Average",
          "Standard Deviation",
          "Tightening",
        ],
        ...sortedDrivers
          .filter((driver) => driver.coefficient > 0)
          .map((driver) => {
            const currentProductDriversBaseData = baseData.marketModel.segments
              .find(
                (s) => s.segmentId.toString() === product.segmentId.toString()
              )
              ?.products.find(
                (pr) => pr.productId.toString() === product._id.toString()
              );

            const tightening =
              currentProductDriversBaseData?.fields.find(
                (f) => f.key === driver.fieldKey
              )?.tightening ||
              currentProductDriversBaseData?.segmentFields.find(
                (f) => f.key === driver.fieldKey
              )?.tightening ||
              currentProductDriversBaseData?.globalFields.find(
                (f) => f.key === driver.fieldKey
              )?.tightening ||
              3;

            return [
              "",
              "",
              driver.fieldLabel,
              driver.coefficient,
              ...result.teams.map((t) => {
                const originalDecisionValue =
                  driver.teamValues.find(
                    (tv) => tv.teamId.toString() === t.teamId.toString()
                  )?.originalDecisionValue || 0;

                return {
                  v: originalDecisionValue,
                  t: "n",
                  z: driver.fieldLabel.includes("%") ? "#,##0.00%" : "#,##0",
                };
              }),
              mean(driver.teamValues.map((tv) => tv.originalDecisionValue)),
              calcStdDev(
                driver.teamValues.map((tv) => tv.originalDecisionValue),
                tightening
              ),
              tightening,
            ];
          }),

        // Empty row
        [""],

        // WEIGHTED SCORES section
        ["", { v: "Weighted Scores", t: "s", s: { font: { bold: true } } }],
        [
          "",
          "",
          "Driver",
          "Coefficient",
          ...result.teams.map((t) => t.team?.teamName),
        ],
        ...sortedDrivers
          .filter((driver) => driver.coefficient > 0)
          .map((driver) => [
            "",
            "",
            driver.fieldLabel,
            driver.coefficient,
            ...result.teams.map((t) => {
              return (
                driver.teamValues.find(
                  (tv) => tv.teamId.toString() === t.teamId.toString()
                )?.score || 0
              );
            }),
          ]),

        // Empty row
        [""],

        // VOC section
        [
          "",
          { v: "VOC (Voice of Customer)", t: "s", s: { font: { bold: true } } },
        ],
        [
          "",
          "",
          "Driver",
          "Coefficient",
          ...result.teams.map((t) => t.team?.teamName),
        ],
        ...sortedDrivers
          .filter((driver) => driver.coefficient > 0)
          .map((driver) => [
            "",
            "",
            driver.fieldLabel,
            driver.coefficient,
            ...result.teams.map((t) => {
              return (
                (driver.teamValues.find(
                  (tv) => tv.teamId.toString() === t.teamId.toString()
                )?.score || 0) / 10
              );
            }),
          ]),

        // Empty rows for spacing between products
        [""],
        [""],
        [""],
      ];
    }),
  ];

  const revenuePerProductTable = [
    [
      {
        v: "Revenues (Bn)",
        t: "s",
        s: {
          font: { sz: 24, bold: true },
          border: { bottom: { style: "thick" } },
        },
      },
      {
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thick" } } },
      },
      ...Array.from({ length: result.teams.length + 2 }).fill({
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thick" } } },
      }),
    ],
    [
      "",
      "",
      "",
      {
        v: "Total Revenues",
        t: "s",
        s: { font: { bold: true }, border: { bottom: { style: "thin" } } },
      },
      ...result.teams.map((t) => ({
        v:
          t.pnl
            .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
            .reduce((acc, curr) => acc + (curr["Total Revenue"] || 0), 0) /
          (1000 * 1000 * 1000),
        t: "n",
        z: "#,##0.00",
        s: {
          border: { bottom: { style: "thin" } },
          fill: { fgColor: { rgb: "d9f2d0" } },
        },
      })),
    ],
    [],

    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return [
        // Segment total row

        // Product rows within segment
        ...segmentProducts.flatMap((product) => [
          [
            "",
            "",
            "",
            `${product.productName}`,
            ...result.teams.map((t) => ({
              v:
                (t.pnl?.find(
                  (pnlItem) =>
                    pnlItem.productId?.toString() === product._id.toString() &&
                    pnlItem.segmentId?.toString() === segment._id.toString()
                )?.["Total Revenue"] || 0) /
                (1000 * 1000 * 1000),
              t: "n",
              z: "#,##0.00",
            })),
          ],
        ]),
        [
          "",
          "",
          "",
          {
            v: `${segment.name} Total`,
            t: "s",
            s: { border: { top: { style: "thick" } } },
          },
          ...result.teams.map((t) => ({
            v:
              t.pnl
                .filter(
                  (pnlItem) =>
                    pnlItem.segmentId?.toString() === segment._id.toString() &&
                    !pnlItem.productId
                )
                .reduce((acc, curr) => acc + (curr["Total Revenue"] || 0), 0) /
              (1000 * 1000 * 1000),
            t: "n",
            z: "#,##0.00",
            s: {
              border: { top: { style: "thick" } },
            },
          })),
        ],
        [],
      ];
    }),
  ];

  const rapPerProductTable = [
    [
      {
        v: "Risk Adjusted Profit (Bn)",
        t: "s",
        s: {
          font: { sz: 24, bold: true },
          border: { bottom: { style: "thick" } },
        },
      },
      { v: "", t: "s", s: { border: { bottom: { style: "thick" } } } },
      ...Array.from({ length: result.teams.length + 2 }).fill({
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thick" } } },
      }),
    ],
    [
      "",
      "",
      "",
      {
        v: "Total Risk Adjusted Profit",
        t: "s",
        s: { font: { bold: true }, border: { bottom: { style: "thin" } } },
      },
      ...result.teams.map((t) => ({
        v:
          t.pnl
            .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
            .reduce(
              (acc, curr) => acc + (curr["Risk Adjusted Profit"] || 0),
              0
            ) /
          (1000 * 1000 * 1000),
        t: "n",
        z: "#,##0.00",
        s: {
          border: { bottom: { style: "thin" } },
          fill: { fgColor: { rgb: "d9f2d0" } },
        },
      })),
    ],
    [
      "",
      "",
      "",
      { v: "Margin", t: "s", s: { font: { italic: true } } },
      ...result.teams.map((t) => {
        const totalRAP = t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Risk Adjusted Profit"] || 0), 0);
        const totalRevenue = t.pnl
          .filter((pnlItem) => !pnlItem.productId && !!pnlItem.segmentId)
          .reduce((acc, curr) => acc + (curr["Total Revenue"] || 0), 0);

        return {
          v: totalRAP / (totalRevenue || 1),
          t: "n",
          z: "#,##0.00%",
          s: { font: { italic: true } },
        };
      }),
    ],
    [],

    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return [
        // Segment total row

        // Product rows within segment
        ...segmentProducts.flatMap((product) => [
          [
            "",
            "",
            "",
            `${product.productName}`,
            ...result.teams.map((t) => ({
              v:
                (t.pnl?.find(
                  (pnlItem) =>
                    pnlItem.productId?.toString() === product._id.toString() &&
                    pnlItem.segmentId?.toString() === segment._id.toString()
                )?.["Risk Adjusted Profit"] || 0) /
                (1000 * 1000 * 1000),
              t: "n",
              z: "#,##0.00",
            })),
          ],
        ]),
        [
          "",
          "",
          "",
          {
            v: `${segment.name} Total`,
            t: "s",
            s: { border: { top: { style: "thick" } } },
          },
          ...result.teams.map((t) => ({
            v:
              t.pnl
                .filter(
                  (pnlItem) =>
                    pnlItem.segmentId?.toString() === segment._id.toString() &&
                    !pnlItem.productId
                )
                .reduce(
                  (acc, curr) => acc + (curr["Risk Adjusted Profit"] || 0),
                  0
                ) /
              (1000 * 1000 * 1000),
            t: "n",
            z: "#,##0.00",
            s: {
              border: { top: { style: "thick" } },
            },
          })),
        ],
        [
          "",
          "",
          "",
          { v: "Margin", t: "s", s: { font: { italic: true } } },
          ...result.teams.map((t) => {
            const totalRAP = t.pnl
              .filter(
                (pnlItem) =>
                  !pnlItem.productId &&
                  pnlItem.segmentId?.toString() === segment._id.toString()
              )
              .reduce(
                (acc, curr) => acc + (curr["Risk Adjusted Profit"] || 0),
                0
              );
            const totalRevenue = t.pnl
              .filter(
                (pnlItem) =>
                  !pnlItem.productId &&
                  pnlItem.segmentId?.toString() === segment._id.toString()
              )
              .reduce((acc, curr) => acc + (curr["Total Revenue"] || 0), 0);

            return {
              v: totalRAP / (totalRevenue || 1),
              t: "n",
              z: "#,##0.00%",
              s: { font: { italic: true } },
            };
          }),
        ],
        [],
      ];
    }),
  ];

  const loanProductAnalysisTable = [
    [
      {
        v: "Loan Product Analysis",
        t: "s",
        s: {
          font: { sz: 24, bold: true },
          border: { bottom: { style: "thick" } },
        },
      },
      ...Array.from({ length: result.teams.length + 3 }).fill({
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thick" } } },
      }),
    ],
    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) =>
          p.segmentId.equals(segment._id) &&
          !!p.fields.find((f) => f.key === "risk_level")
      );

      return segmentProducts.flatMap((product) => {
        const prevRoundRiskLevel = (prevRoundResult?.teams || []).map(
          (team) =>
            team.decision?.decisionDetails
              .find((d) => d.productId.equals(product._id))
              ?.fields.find((f) => f.key === "risk_level")?.value || 0
        );

        const prevRoundInterestRate = (prevRoundResult?.teams || []).map(
          (team) =>
            team.decision?.decisionDetails
              .find((d) => d.productId.equals(product._id))
              ?.fields.find((f) => f.key === "interest_rate")?.value || 0
        );

        return [
          // Product header row
          [
            "",
            "",
            {
              v: segment.name + " - " + product.productName,
              t: "s",
              s: { font: { bold: true } },
            },
            "",
            ...result.teams.map((team) => team.team?.teamName),
          ],
          [
            "",
            "",
            "",
            "Interest Rate This Year",
            ...result.teams.map((team) => ({
              v:
                team.decision?.decisionDetails
                  .find((d) => d.productId.equals(product._id))
                  ?.fields.find((f) => f.key === "interest_rate")?.value || 0,
              t: "n",
              z: "#,##0.00%",
            })),
          ],
          [
            "",
            "",
            "",
            "Interest Rate Last Year",
            ...(prevRoundResult?.teams || []).map((team) => ({
              v:
                team.decision?.decisionDetails
                  .find((d) => d.productId.equals(product._id))
                  ?.fields.find((f) => f.key === "interest_rate")?.value || 0,
              t: "n",
              z: "#,##0.00%",
            })),
          ],
          [
            "",
            "",
            "",
            "Min Credit Rating This Year",
            ...result.teams.map(
              (team) =>
                team.decision?.decisionDetails
                  .find((d) => d.productId.equals(product._id))
                  ?.fields.find((f) => f.key === "risk_level")?.value || 0
            ),
          ],
          [
            "",
            "",
            "",
            "Min Credit Rating Last Year",
            ...(prevRoundResult?.teams || []).map(
              (team) =>
                team.decision?.decisionDetails
                  .find((d) => d.productId.equals(product._id))
                  ?.fields.find((f) => f.key === "risk_level")?.value || 0
            ),
          ],
          // ['Check this team', ...result.teams.map(team => team.decision?.decisionDetails.find(d => d.productId.equals(product._id))?.fields.find(f => f.key === 'check_this_team')?.value || 0)],
          [
            "",
            "",
            {
              v: "",
              t: "s",
            },
            {
              v: "Starting Customers",
              t: "s",
              s: {
                border: { top: { style: "thin", color: { rgb: "ee0000" } } },
              },
            },
            ...result.teams.map((team) => ({
              v:
                team.miscellaneous.find(
                  (m) =>
                    m.segmentId.equals(segment._id) &&
                    m.productId?.equals(product._id)
                )?.startingCustomers || 0,
              t: "n",
              z: "#,##0",
              s: {
                border: { top: { style: "thin", color: { rgb: "ee0000" } } },
              },
            })),
          ],
          [
            "",
            "",
            "",
            "Churn %",
            ...result.teams.map((team) => ({
              v:
                team.miscellaneous.find(
                  (m) =>
                    m.segmentId.equals(segment._id) &&
                    m.productId?.equals(product._id)
                )?.customerChurnRate || 0,
              t: "n",
              z: "#,##0.00%",
            })),
          ],
          // ['Manual Adjustment (Relative)', ...result.teams.map(team => team.miscellaneous.find(m => m.segmentId.equals(segment._id) && m.productId?.equals(product._id))?.manualAdjustmentRelative || 0)],
          [
            "",
            "",
            "",
            "Churned Customers",
            ...result.teams.map((team) => ({
              v:
                team.miscellaneous.find(
                  (m) =>
                    m.segmentId.equals(segment._id) &&
                    m.productId?.equals(product._id)
                )?.churnedCustomers || 0,
              t: "n",
              z: "#,##0",
            })),
          ],
          [
            "",
            "",
            "",
            "Gross Adds",
            ...result.teams.map((team) => ({
              v:
                team.miscellaneous.find(
                  (m) =>
                    m.segmentId.equals(segment._id) &&
                    m.productId?.equals(product._id)
                )?.grossAdds || 0,
              t: "n",
              z: "#,##0",
            })),
          ],
          [
            "",
            "",
            "",
            {
              v: "Ending Customers",
              t: "s",
              s: { border: { top: { style: "thin" } } },
            },
            ...result.teams.map((team) => ({
              v:
                team.miscellaneous.find(
                  (m) =>
                    m.segmentId.equals(segment._id) &&
                    m.productId?.equals(product._id)
                )?.endingCustomers || 0,
              t: "n",
              z: "#,##0",
              s: { border: { top: { style: "thin" } } },
            })),
          ],
          [
            "",
            "",
            "",
            "Market Share",
            ...result.teams.map((team) => ({
              v:
                team.bizperf.find(
                  (bp) => bp.productId?.toString() === product._id.toString()
                )?.["Market Share"] || 0,
              t: "n",
              z: "#,##0.00%",
            })),
          ],
          [],
        ];
      });
    }),
  ];

  const combinedESATDrivers = result.esatDrivers.reduce(
    (acc, curr) => {
      const existingDriver = acc.find((d) => d.fieldKey === curr.fieldKey);

      // Combine team values for the current driver
      const combinedTeamValues = combineTeamValues(curr.teamValues);

      if (existingDriver) {
        combinedTeamValues.forEach((tv) => {
          const existingTeamInDriverIndex = existingDriver.teamValues.findIndex(
            (tv2) => tv2.teamId.toString() === tv.teamId.toString()
          );

          if (existingTeamInDriverIndex !== -1) {
            existingDriver.teamValues[existingTeamInDriverIndex].score +=
              tv.score;
            existingDriver.teamValues[
              existingTeamInDriverIndex
            ].originalDecisionValue += tv.originalDecisionValue;
          } else {
            existingDriver.teamValues.push({
              teamId: tv.teamId.toString(),
              score: tv.score,
              originalDecisionValue: tv.originalDecisionValue,
            });
          }
        });
      } else {
        acc.push({
          fieldKey: curr.fieldKey,
          fieldLabel: curr.fieldLabel,
          decisionType: curr.decisionType,
          teamValues: combinedTeamValues,
        });
      }

      return acc;
    },
    [] as {
      fieldKey: string;
      fieldLabel: string;
      teamValues: {
        teamId: string;
        score: number;
        originalDecisionValue: number;
      }[];
      decisionType: string;
    }[]
  );

  const esatDetailedAnalysisTable = [
    [
      {
        v: "ESAT",
        t: "s",
        s: {
          font: { sz: 24, bold: true },
          border: { bottom: { style: "thick" } },
        },
      },
      ...Array.from({ length: result.teams.length + 3 }).fill({
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thick" } } },
      }),
    ],
    [
      "",
      "",
      "Opening",
      "",
      ...(prevRoundResult?.teams || []).map((t) => ({
        v: t.winningMetric.find((wm) => !wm.segmentId && wm.esat)?.esat || 0,
        t: "n",
        z: "#,##0.00%",
      })),
    ],
    ...combinedESATDrivers.map((cESATDriver) => [
      "",
      "",
      cESATDriver.fieldLabel,
      "",
      ...result.teams.map((t) => ({
        v:
          (cESATDriver.teamValues.find(
            (tv) => tv.teamId.toString() === t.teamId.toString()
          )?.score || 0) /
          (result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.esat)
            .length || 1),
        t: "n",
        z: "#,##0.00%",
      })),
    ]),
    [
      "",
      "",
      "ESAT closing",
      "",
      ...result.teams.map((t) => {
        return {
          v: t.winningMetric.find((wm) => !wm.segmentId && wm.esat)?.esat || 0,
          t: "n",
          z: "#,##0.00%",
        };
      }),
    ],
  ];

  const combinedCSATDrivers = result.csatDrivers.reduce(
    (acc, curr) => {
      const existingDriver = acc.find((d) => d.fieldKey === curr.fieldKey);

      // Combine team values for the current driver
      const combinedTeamValues = combineTeamValues(curr.teamValues);

      if (existingDriver) {
        combinedTeamValues.forEach((tv) => {
          const existingTeamInDriverIndex = existingDriver.teamValues.findIndex(
            (tv2) => tv2.teamId.toString() === tv.teamId.toString()
          );

          if (existingTeamInDriverIndex !== -1) {
            existingDriver.teamValues[existingTeamInDriverIndex].score +=
              tv.score;
            existingDriver.teamValues[
              existingTeamInDriverIndex
            ].originalDecisionValue += tv.originalDecisionValue;
          } else {
            existingDriver.teamValues.push({
              teamId: tv.teamId.toString(),
              score: tv.score,
              originalDecisionValue: tv.originalDecisionValue,
            });
          }
        });
      } else {
        acc.push({
          fieldKey: curr.fieldKey,
          fieldLabel: curr.fieldLabel,
          decisionType: curr.decisionType,
          teamValues: combinedTeamValues,
        });
      }

      return acc;
    },
    [] as {
      fieldKey: string;
      fieldLabel: string;
      teamValues: {
        teamId: string;
        score: number;
        originalDecisionValue: number;
      }[];
      decisionType: string;
    }[]
  );

  const csatDetailedAnalysisTable = [
    [
      {
        v: "CSAT",
        t: "s",
        s: {
          font: { sz: 24, bold: true },
          border: { bottom: { style: "thick" } },
        },
      },
      ...Array.from({ length: result.teams.length + 3 }).fill({
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thick" } } },
      }),
    ],
    [
      "",
      "",
      "Opening",
      "",
      ...(prevRoundResult?.teams || []).map((t) => ({
        v: t.winningMetric.find((wm) => !wm.segmentId && wm.csat)?.csat || 0,
        t: "n",
        z: "#,##0.00%",
      })),
    ],
    ...combinedCSATDrivers.map((cCSATDriver) => [
      "",
      "",
      cCSATDriver.fieldLabel,
      "",
      ...result.teams.map((t) => ({
        v:
          (cCSATDriver.teamValues.find(
            (tv) => tv.teamId.toString() === t.teamId.toString()
          )?.score || 0) /
          (result.teams
            .find((t2) => t2.teamId.toString() === t.teamId.toString())
            ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.csat)
            .length || 1),
        t: "n",
        z: "#,##0.00%",
      })),
    ]),
    [
      "",
      "",
      "CSAT closing",
      "",
      ...result.teams.map((t) => {
        return {
          v: t.winningMetric.find((wm) => !wm.segmentId && wm.csat)?.csat || 0,
          t: "n",
          z: "#,##0.00%",
        };
      }),
    ],
  ];

  const detailedSheet = StyledXLSX.utils.aoa_to_sheet([
    [
      {
        v: "Table Name",
        t: "s",
        s: {
          font: { bold: true },
          border: { bottom: { style: "thick", color: { rgb: "ee0000" } } },
        },
      },
      {
        v: "Required data (Lv. 1)",
        t: "s",
        s: {
          font: { bold: true },
          border: { bottom: { style: "thick", color: { rgb: "ee0000" } } },
        },
      },
      {
        v: "Required data (Lv. 2)",
        t: "s",
        s: {
          font: { bold: true },
          border: { bottom: { style: "thick", color: { rgb: "ee0000" } } },
        },
      },
      {
        v: "",
        t: "s",
        s: { border: { bottom: { style: "thick", color: { rgb: "ee0000" } } } },
      },
      ...result.teams.map((team) => ({
        v: team.team?.teamName,
        t: "s",
        s: {
          font: { bold: true },
          border: { bottom: { style: "thick", color: { rgb: "ee0000" } } },
        },
      })),
    ],
    ...detailedPNLTable,
    [],
    ...productGroupedTable,
    [],
    ...revenuePerProductTable,
    [],
    ...rapPerProductTable,
    [],
    ...loanProductAnalysisTable,
    [],
    ...esatDetailedAnalysisTable,
    [],
    ...csatDetailedAnalysisTable,
  ]);

  detailedSheet["!cols"] = [
    { wpx: 200 },
    { wpx: 200 },
    { wpx: 200 },
    { wpx: 200 },
    ...result.teams.map((team) => ({ wpx: 200 })),
  ]; // Adjust width as needed

  StyledXLSX.utils.book_append_sheet(workbook, detailedSheet, "Detailed");

  if (download) {
    // Write to file
    const fileName = `analysis_report_round_${result.roundNumber}.xlsx`;
    StyledXLSX.writeFile(workbook, fileName);

    return fileName;
  } else {
    const retailMassSegmentId = segments.find((s) =>
      s.name.includes("Retail Mass")
    )?._id;
    const retailAffluentSegmentId = segments.find((s) =>
      s.name.includes("Affluent")
    )?._id;
    const smeSegmentId = segments.find((s) => s.name.includes("SME"))?._id;

    const depositRetailMassProductId = products.find(
      (p) =>
        p.segmentId?.toString() === retailMassSegmentId?.toString() &&
        p.productName.includes("Deposit")
    )?._id;
    const depositRetailAffluentProductId = products.find(
      (p) =>
        p.segmentId?.toString() === retailAffluentSegmentId?.toString() &&
        p.productName.includes("Private Banking")
    )?._id;
    const depositSmeProductId = products.find(
      (p) =>
        p.segmentId?.toString() === smeSegmentId?.toString() &&
        p.productName.includes("Deposit")
    )?._id;

    const depositProductIds = [
      depositRetailMassProductId,
      depositRetailAffluentProductId,
      depositSmeProductId,
    ];

    const plainEvents = round.eventsTriggered.filter(
      (event) => event.delayed === false
    );
    const wobblers = round.eventsTriggered.filter(
      (event) => event.delayed === true
    );

    return {
      teams: result.teams.map((t) => ({
        _id: t.teamId,
        teamName: t.team?.teamName || "",
      })),
      winningMetrics: {
        Revenue: result.teams.map(
          (t) => t.winningMetric.find((wm) => !wm.segmentId)?.revenue || 0
        ),
        RAP: result.teams.map(
          (t) => t.winningMetric.find((wm) => !wm.segmentId)?.profit || 0
        ),
        CSAT: result.teams.map(
          (t) => t.winningMetric.find((wm) => !wm.segmentId)?.csat || 0
        ),
        ESAT: result.teams.map(
          (t) => t.winningMetric.find((wm) => !wm.segmentId)?.esat || 0
        ),
      },
      currentRoundScore: {
        Revenue: result.teams.map((t) => t.score.revenue),
        RAP: result.teams.map((t) => t.score.rap),
        CSAT: result.teams.map((t) => t.score.csat),
        ESAT: result.teams.map((t) => t.score.esat),
      },
      revenues: {
        labels: [
          { label: "Total Revenues", section: "header" },
          ...segments.flatMap((segment) => [
            ...products
              .filter(
                (product) =>
                  product.segmentId?.toString() === segment._id.toString()
              )
              .map((product) => ({
                label: `${product.productName}`,
              })),
            { label: segment.name, section: "group" },
          ]),
        ],
        data: Object.fromEntries([
          [
            "Total Revenues",
            result.teams.map(
              (t) => t.winningMetric.find((wm) => !wm.segmentId)?.revenue || 0
            ),
          ],
          ...segments.flatMap((segment) => [
            ...products
              .filter(
                (product) =>
                  product.segmentId?.toString() === segment._id.toString()
              )
              .map((product) => [
                product.productName,
                result.teams.map(
                  (t) =>
                    t.pnl.find(
                      (pnl) =>
                        pnl.productId?.toString() === product._id.toString() &&
                        pnl.segmentId?.toString() === segment._id.toString()
                    )?.["Total Revenue"] || 0
                ),
              ]),
            [
              segment.name,
              result.teams.map(
                (t) =>
                  t.pnl.find(
                    (pnl) =>
                      pnl.segmentId?.toString() === segment._id.toString() &&
                      !pnl.productId
                  )?.["Total Revenue"] || 0
              ),
            ],
          ]),
        ]),
      },
      raps: {
        labels: [
          { label: "Total RAP", section: "header" },
          {
            label: "Margin Company level",
            section: "group",
            format: "percent",
          },
          ...segments.flatMap((segment) => [
            ...products
              .filter(
                (product) =>
                  product.segmentId?.toString() === segment._id.toString()
              )
              .map((product) => ({
                label: `${product.productName}`,
              })),
            { label: segment.name, section: "group" },
            {
              label: `Margin ${segment.name}`,
              section: "group",
              format: "percent",
            },
          ]),
        ],
        data: Object.fromEntries([
          [
            "Total RAP",
            result.teams.map(
              (t) => t.winningMetric.find((wm) => !wm.segmentId)?.profit || 0
            ),
          ],
          [
            "Margin Company level",
            result.teams.map(
              (t) =>
                (t.winningMetric.find((wm) => !wm.segmentId)?.profit || 0) /
                (t.winningMetric.find((wm) => !wm.segmentId)?.revenue || 1)
            ),
          ],
          ...segments.flatMap((segment) => [
            ...products
              .filter(
                (product) =>
                  product.segmentId?.toString() === segment._id.toString()
              )
              .map((product) => [
                product.productName,
                result.teams.map(
                  (t) =>
                    t.pnl.find(
                      (pnl) =>
                        pnl.productId?.toString() === product._id.toString() &&
                        pnl.segmentId?.toString() === segment._id.toString()
                    )?.["Risk Adjusted Profit"] || 0
                ),
              ]),
            [
              segment.name,
              result.teams.map(
                (t) =>
                  t.pnl.find(
                    (pnl) =>
                      pnl.segmentId?.toString() === segment._id.toString() &&
                      !pnl.productId
                  )?.["Risk Adjusted Profit"] || 0
              ),
            ],
            [
              `Margin ${segment.name}`,
              result.teams.map(
                (t) =>
                  (t.pnl.find(
                    (pnl) =>
                      pnl.segmentId?.toString() === segment._id.toString() &&
                      !pnl.productId
                  )?.["Risk Adjusted Profit"] || 0) /
                  (t.pnl.find(
                    (pnl) =>
                      pnl.segmentId?.toString() === segment._id.toString() &&
                      !pnl.productId
                  )?.["Total Revenue"] || 1)
              ),
            ],
          ]),
        ]),
      },
      enterprise: {
        initiatives: result.teams.map((t) => ({
          teamId: t.teamId,
          chosenInitiatives: t.decision?.globalDecisionDetails
            .filter(
              (d) =>
                d.globalInputId.toString() ===
                  initiativeGlobInput?._id.toString() && d.selected
            )
            .map((d) => ({
              initiativeName: initiativeGlobInput?.inputs.find(
                (i) => i.key === d.key
              )?.name,
            })),
        })),
        events: plainEvents.map((event) => ({
          eventId: event.eventId,
          eventName: event.event?.eventName,
          teamValues: result.teams.map((t) => {
            const teamChosenKey = (t.decision?.eventDecisions || []).find(
              (ed) => ed.eventId.toString() === event.eventId.toString()
            )?.chosenKey;

            const label = event.event?.choices.find(
              (c) => c.key === teamChosenKey
            )?.title;

            return {
              teamId: t.teamId,
              teamName: t.team?.teamName,
              teamValues: label,
            };
          }),
        })),
        wobblers: wobblers.map((event) => ({
          eventId: event.eventId,
          eventName: event.event?.eventName,
          teamValues: result.teams.map((t) => {
            const teamChosenKey = (t.decision?.eventDecisions || []).find(
              (ed) => ed.eventId.toString() === event.eventId.toString()
            )?.chosenKey;

            const label = event.event?.choices.find(
              (c) => c.key === teamChosenKey
            )?.title;

            return {
              teamId: t.teamId,
              teamName: t.team?.teamName,
              teamValues: label,
            };
          }),
        })),
      },
      esat: {
        rows: [
          ...combinedESATDrivers.map((cESATD) => ({
            label: cESATD.fieldLabel,
            data: cESATD.teamValues.map(
              (tv) =>
                tv.originalDecisionValue /
                (result.teams
                  .find((t2) => t2.teamId.toString() === tv.teamId.toString())
                  ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.esat)
                  .length || 1)
            ),
            format: "number",
            decisionType: cESATD.decisionType,
          })),
          {
            label: "Opening ESAT",
            data: (prevRoundResult?.teams || []).map(
              (t) =>
                t.winningMetric.find((wm) => !wm.segmentId && wm.esat)?.esat ||
                0
            ),
          },
          ...[
            ...combinedESATDrivers.map((cESATD) => ({
              label: cESATD.fieldLabel,
              data: cESATD.teamValues.map(
                (tv) =>
                  tv.score /
                  (result.teams
                    .find((t2) => t2.teamId.toString() === tv.teamId.toString())
                    ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.esat)
                    .length || 1)
              ),
              decisionType: cESATD.decisionType,
            })),
            {
              label: "Closing ESAT",
              data: result.teams.map(
                (t) => t.winningMetric.find((wm) => !wm.segmentId)?.esat || 0
              ),
            },
          ],
        ],
      },
      csat: {
        rows: [
          ...combinedCSATDrivers.map((cCSATD) => ({
            label: cCSATD.fieldLabel,
            data: cCSATD.teamValues.map(
              (tv) =>
                tv.originalDecisionValue /
                (result.teams
                  .find((t2) => t2.teamId.toString() === tv.teamId.toString())
                  ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.csat)
                  .length || 1)
            ),
            format: "number",
            decisionType: cCSATD.decisionType,
          })),
          {
            label: "Opening CSAT",
            data: (prevRoundResult?.teams || []).map(
              (t) =>
                t.winningMetric.find((wm) => !wm.segmentId && wm.csat)?.csat ||
                0
            ),
          },
          ...combinedCSATDrivers.map((cCSATD) => ({
            label: cCSATD.fieldLabel,
            data: cCSATD.teamValues.map(
              (tv) =>
                tv.score /
                (result.teams
                  .find((t2) => t2.teamId.toString() === tv.teamId.toString())
                  ?.winningMetric.filter((wm) => !!wm.segmentId && !!wm.csat)
                  .length || 1)
            ),
            decisionType: cCSATD.decisionType,
          })),
          {
            label: "Closing CSAT",
            data: result.teams.map(
              (t) => t.winningMetric.find((wm) => !wm.segmentId)?.csat || 0
            ),
          },
        ],
      },
      allProducts: productsSortedBySegmentOrderThenProductOrder.map((p) => {
        const uncappedMarketShare = result.marketShares?.find(
          (ms) => ms.productId.toString() === p._id.toString()
        );

        const marketShare = result.teams.map(
          (t) =>
            t.bizperf.find(
              (m) => m.productId?.toString() === p._id.toString()
            )?.["Market Share"] || 0
        );

        const sortedDrivers =
          uncappedMarketShare?.weightedScores
            .filter((ws) => ws.coefficient > 0)
            .sort((a, b) => b.coefficient - a.coefficient) || [];

        return {
          productId: p._id,
          productName: p.productName,
          segmentName: p.segmentReference?.name,
          tables: [
            {
              key: "decisions",
              label: "Decisions",
              rows: sortedDrivers.map((d) => ({
                label: d.fieldLabel,
                data: d.teamValues.map((tv) => tv.originalDecisionValue),
              })),
            },
            {
              key: "marketShares",
              label: "Market Shares",
              rows: [
                {
                  label: "Market Share %",
                  data: result.teams.map(
                    (t) =>
                      t.bizperf.find(
                        (m) => m.productId?.toString() === p._id.toString()
                      )?.["Market Share"] || 0
                  ),
                },
              ],
            },
            {
              key: "drivers",
              label: "Decision Drivers",
              rows: sortedDrivers.map((d) => {
                const allTeamDecisionValues = d.teamValues.map(
                  (tv) => tv.originalDecisionValue
                );

                const currentProductDriversBaseData =
                  baseData.marketModel.segments
                    .find(
                      (s) => s.segmentId.toString() === p.segmentId.toString()
                    )
                    ?.products.find(
                      (pr) => pr.productId.toString() === p._id.toString()
                    );

                const tightening =
                  currentProductDriversBaseData?.fields.find(
                    (f) => f.key === d.fieldKey
                  )?.tightening ||
                  currentProductDriversBaseData?.segmentFields.find(
                    (f) => f.key === d.fieldKey
                  )?.tightening ||
                  currentProductDriversBaseData?.globalFields.find(
                    (f) => f.key === d.fieldKey
                  )?.tightening ||
                  3;

                const average = mean(allTeamDecisionValues);

                const stdDev = calcStdDev(allTeamDecisionValues, tightening);

                return {
                  label: d.fieldLabel,
                  data: d.teamValues.map((tv) => tv.originalDecisionValue),
                  average,
                  stdDev,
                  tightening,
                };
              }),
            },
            {
              key: "weightedScores",
              label: "Weighted Scores",
              rows: sortedDrivers.map((d) => ({
                label: d.fieldLabel,
                data: d.teamValues.map((tv) => tv.score),
              })),
            },
            {
              key: "voc",
              label: "VOC (Voice of Customer)",
              rows: sortedDrivers.map((d) => ({
                label: d.fieldLabel,
                data: d.teamValues.map((tv) => tv.score / 10),
                dataWithTeamId: d.teamValues.map((tv) => ({
                  teamId: tv.teamId,
                  score: tv.score / 10,
                })),
              })),
            },
          ],
        };
      }),
      loanProducts: productsSortedBySegmentOrderThenProductOrder
        .filter((p) => !!p.fields.find((f) => f.key === "risk_level"))
        .map((p) => ({
          productId: p._id,
          productName: `${p.productName} \u2013 ${p.segmentReference?.name}`,
          rows: [
            {
              label: "Interest Rate This Year",
              format: "percent",
              data: result.teams.map(
                (t) =>
                  t.decision?.decisionDetails
                    ?.find((d) => d.productId?.toString() === p._id.toString())
                    ?.fields?.find((f) => f.key === "interest_rate")?.value || 0
              ),
            },
            {
              label: "Interest Rate Last Year",
              format: "percent",
              data: prevRoundResult
                ? prevRoundResult.teams.map(
                    (t) =>
                      t.decision?.decisionDetails
                        ?.find(
                          (d) => d.productId?.toString() === p._id.toString()
                        )
                        ?.fields?.find((f) => f.key === "interest_rate")
                        ?.value || 0
                  )
                : result.teams.map((t) => 0),
            },
            {
              label: "Min Credit Rating This Year",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.decision?.decisionDetails
                    ?.find((d) => d.productId?.toString() === p._id.toString())
                    ?.fields?.find((f) => f.key === "risk_level")?.value || 0
              ),
            },
            {
              label: "Min Credit Rating Last Year",
              format: "number",
              data: prevRoundResult
                ? prevRoundResult.teams.map(
                    (t) =>
                      t.decision?.decisionDetails
                        ?.find(
                          (d) => d.productId?.toString() === p._id.toString()
                        )
                        ?.fields?.find((f) => f.key === "risk_level")?.value ||
                      0
                  )
                : result.teams.map((t) => 0),
            },
            {
              label: "Starting Customers",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.startingCustomers || 0
              ),
            },
            {
              label: "Churn %",
              format: "percent",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.customerChurnRate || 0
              ),
            },
            {
              label: "Churned Customers",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.churnedCustomers || 0
              ),
            },
            {
              label: "Gross Adds",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.grossAdds || 0
              ),
            },
            {
              label: "Ending Customers",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.endingCustomers || 0
              ),
            },
            {
              label: "Market Share",
              format: "percent",
              data: result.teams.map(
                (t) =>
                  t.bizperf.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.["Market Share"] || 0
              ),
            },
          ],
        })),
      depositProducts: productsSortedBySegmentOrderThenProductOrder
        .filter((p) =>
          depositProductIds.some((id) => id?.toString() === p._id.toString())
        )
        .map((p) => ({
          productId: p._id,
          productName: `${p.productName} \u2013 ${p.segmentReference?.name}`,
          rows: [
            {
              label: "Interest Rate This Year",
              format: "percent",
              data: result.teams.map(
                (t) =>
                  t.decision?.decisionDetails
                    ?.find((d) => d.productId?.toString() === p._id.toString())
                    ?.fields?.find((f) => f.key === "interest_rate")?.value || 0
              ),
            },
            {
              label: "Interest Rate Last Year",
              format: "percent",
              data: prevRoundResult
                ? prevRoundResult.teams.map(
                    (t) =>
                      t.decision?.decisionDetails
                        ?.find(
                          (d) => d.productId?.toString() === p._id.toString()
                        )
                        ?.fields?.find((f) => f.key === "interest_rate")
                        ?.value || 0
                  )
                : result.teams.map((t) => 0),
            },
            {
              label: "Starting Customers",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.startingCustomers || 0
              ),
            },
            {
              label: "Churn %",
              format: "percent",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.customerChurnRate || 0
              ),
            },
            {
              label: "Churned Customers",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.churnedCustomers || 0
              ),
            },
            {
              label: "Gross Adds",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.grossAdds || 0
              ),
            },
            {
              label: "Ending Customers",
              format: "number",
              data: result.teams.map(
                (t) =>
                  t.miscellaneous.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.endingCustomers || 0
              ),
            },
            {
              label: "Market Share",
              format: "percent",
              data: result.teams.map(
                (t) =>
                  t.bizperf.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.["Market Share"] || 0
              ),
            },
          ],
        })),
      ldr: result.teams.map((t) => ({
        teamId: t.teamId,
        loan: t.ldr.totalLoan || 0,
        deposit: t.ldr.totalDeposit || 0,
        ldr: t.ldr.loanToDepositRatio || 0,
      })),
      provisions: productsSortedBySegmentOrderThenProductOrder
        .filter((p) => !!p.fields.find((f) => f.key === "risk_level"))
        .map((p) => ({
          productId: p._id,
          productName: `${p.productName} \u2013 ${p.segmentReference?.name}`,
          rows: [
            {
              key: "risk_level",
              label:
                p.fields.find((f) => f.key === "risk_level")?.label ||
                "Risk Level",
              data: result.teams.map((t) => {
                const riskLevel =
                  t.decision?.decisionDetails
                    .find((d) => d.productId?.toString() === p._id.toString())
                    ?.fields.find((f) => f.key === "risk_level")?.value || 0;
                return riskLevel;
              }),
            },
            {
              key: "provisions",
              label: "Provisions",
              data: result.teams.map((t) => {
                const provisions =
                  t.pnl.find(
                    (m) => m.productId?.toString() === p._id.toString()
                  )?.["Provisions"] || 0;
                return provisions;
              }),
            },
          ],
        })),
    };
  }
}

function createCompetitorReport(
  result: ResultInterface,
  {
    availableGlobalInputs,
    segments,
    products,
    prevRoundDecisions,
    baseData,
    prevRoundResult,
    round,
    winningMetricsConfig,
  }: {
    availableGlobalInputs: IGlobalInput[];
    segments: SegmentInterface[];
    products: ProductInterface[];
    prevRoundDecisions: (DecisionInterface | null)[];
    baseData: BaseDataInterface;
    prevRoundResult?: ResultInterface | null;
    round: RoundInterface;
    winningMetricsConfig?: WinningMetricConfig[];
    activeProductIds?: ObjectId[] | null;
  }
) {
  const workbook = XLSX.utils.book_new();

  const balancedScorecardSection = [
    [
      "",
      "Balanced Scorecard (Points)",
      "",
      "",
      ...result.teams.map((team) => team.team?.teamName),
    ],
    [],
    [
      "",
      "",
      "Risk Adjusted Profit",
      "",
      ...result.teams.map((t) => t.score.rap),
    ],
    ["", "", "Total Revenues", "", ...result.teams.map((t) => t.score.revenue)],
    ["", "", "CSAT", "", ...result.teams.map((t) => t.score.csat)],
    ["", "", "ESAT", "", ...result.teams.map((t) => t.score.esat)],
    [
      "",
      "",
      "Total",
      "",
      ...result.teams.map(
        (t) =>
          (t.score.rap || 0) +
          (t.score.revenue || 0) +
          (t.score.csat || 0) +
          (t.score.esat || 0)
      ),
    ],
    [],
    [
      "",
      "",
      "Cumulative Points",
      "",
      ...result.teams.map(
        (t) =>
          (t.score.cumulativeRAP || 0) +
          (t.score.cumulativeRevenue || 0) +
          (t.score.cumulativeCSAT || 0) +
          (t.score.cumulativeESAT || 0)
      ),
    ],
    [
      "",
      "",
      "Rank",
      "",
      ...result.teams.map((t) => {
        const totalScore =
          (t.score.cumulativeRAP || 0) +
          (t.score.cumulativeRevenue || 0) +
          (t.score.cumulativeCSAT || 0) +
          (t.score.cumulativeESAT || 0);

        const rank =
          result.teams.filter(
            (t2) =>
              (t2.score.cumulativeRAP || 0) +
                (t2.score.cumulativeRevenue || 0) +
                (t2.score.cumulativeCSAT || 0) +
                (t2.score.cumulativeESAT || 0) >
              totalScore
          ).length + 1;

        return rank;
      }),
    ],
    [],
    [
      "",
      "",
      "Risk Adjusted Profit ($Bn)",
      "",
      ...result.teams.map(
        (t) =>
          (t.winningMetric?.find((wm) => !wm.segmentId)?.profit || 0) /
          (1000 * 1000 * 1000)
      ), // Replace with actual values
    ],
    [
      "",
      "",
      "Total Revenues",
      "",
      ...result.teams.map(
        (t) => t.winningMetric?.find((wm) => !wm.segmentId)?.revenue || 0
      ),
    ],
    [
      "",
      "",
      "CSAT",
      "",
      ...result.teams.map(
        (t) => t.winningMetric?.find((wm) => !wm.segmentId)?.csat || 0
      ),
    ],
    [
      "",
      "",
      "ESAT",
      "",
      ...result.teams.map(
        (t) => t.winningMetric?.find((wm) => !wm.segmentId)?.esat || 0
      ),
    ],
  ];

  const revenuesSection = [
    ["", "", "Revenues", "", ...result.teams.map((t) => t.team?.teamName)],
    [],
    [
      "",
      "",
      "Total Revenues",
      "",
      ...result.teams.map(
        (t) =>
          (t.winningMetric?.find((wm) => !wm.segmentId)?.revenue || 0) /
          (1000 * 1000 * 1000)
      ),
    ],
    [],
    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return [
        ...segmentProducts.map((product) => {
          return [
            "",
            "",
            `${segment.name} - ${product.productName}`,
            "",
            ...result.teams.map(
              (t) =>
                (t.pnl?.find(
                  (wm) =>
                    wm.segmentId?.toString() === segment._id.toString() &&
                    wm.productId?.toString() === product._id.toString()
                )?.["Total Revenue"] || 0) /
                (1000 * 1000 * 1000)
            ),
          ];
        }),
        [
          "",
          "",
          `Total ${segment.name}`,
          "",
          ...result.teams.map((t) => {
            return (
              (t.pnl?.find(
                (pnl) =>
                  pnl.segmentId?.toString() === segment._id.toString() &&
                  !pnl.productId
              )?.["Total Revenue"] || 0) /
              (1000 * 1000 * 1000)
            );
          }),
        ],
        [],
      ];
    }),
  ];

  const rapSection = [
    [
      "",
      "Risk Adjusted Profit ($Bn)",
      "",
      "",
      ...result.teams.map((t) => t.team?.teamName),
    ],
    [],
    [
      "",
      "",
      "Total Risk Adjusted Profit",
      "",
      ...result.teams.map(
        (t) =>
          (t.winningMetric?.find((wm) => !wm.segmentId)?.profit || 0) /
          (1000 * 1000 * 1000)
      ),
    ],
    [
      "",
      "",
      "Margin",
      "",
      ...result.teams.map((t) => {
        const rap = t.winningMetric.find((wm) => !wm.segmentId)?.profit || 0;
        const revenue =
          t.winningMetric.find((wm) => !wm.segmentId)?.revenue || 0;

        return rap / revenue;
      }),
    ],
    [],
    ...segments.flatMap((segment) => {
      const segmentProducts = products.filter(
        (p) => p.segmentId.toString() === segment._id.toString()
      );

      return [
        ...segmentProducts.map((product) => {
          return [
            "",
            "",
            `${segment.name} - ${product.productName}`,
            "",
            ...result.teams.map(
              (t) =>
                (t.pnl?.find(
                  (wm) =>
                    wm.segmentId?.toString() === segment._id.toString() &&
                    wm.productId?.toString() === product._id.toString()
                )?.["Risk Adjusted Profit"] || 0) /
                (1000 * 1000 * 1000)
            ),
          ];
        }),
        [
          "",
          "",
          `Total ${segment.name}`,
          "",
          ...result.teams.map((t) => {
            return (
              (t.pnl?.find(
                (pnl) =>
                  pnl.segmentId?.toString() === segment._id.toString() &&
                  !pnl.productId
              )?.["Risk Adjusted Profit"] || 0) /
              (1000 * 1000 * 1000)
            );
          }),
        ],
        [
          "",
          "",
          "Margin",
          "",
          ...result.teams.map((t) => {
            const segmentRAP =
              t.winningMetric.find(
                (wm) => wm.segmentId?.toString() === segment._id.toString()
              )?.profit || 0;
            const segmentRevenue =
              t.winningMetric.find(
                (wm) => wm.segmentId?.toString() === segment._id.toString()
              )?.revenue || 0;

            return segmentRAP / segmentRevenue;
          }),
        ],
        [],
      ];
    }),
  ];

  const decisionsAndMarketShareAndCustomerPerProductSection = [
    ...segments.flatMap((segment) => {
      // Get products for this segment
      const segmentProducts = products.filter(
        (product) => product.segmentId?.toString() === segment._id?.toString()
      );

      // For each product, get decisions
      const productRows = segmentProducts.flatMap((product) => {
        // Get decisions for this product

        const decisionFieldsWithoutMarketing = product.fields.filter(
          (field) =>
            field.key !== "marketing_spent" &&
            field.key !== "projected_market_share"
        );

        return [
          ["", `${product.productName}`], // Product row (indented)
          [
            "",
            "",
            "Marketing ($Mn)",
            "",
            ...result.teams.map(
              (t) =>
                (t.decision?.decisionDetails
                  .find(
                    (d) =>
                      d.segmentId.equals(segment._id) &&
                      d.productId.equals(product._id)
                  )
                  ?.fields.find((f) => f.key === "marketing_spent")?.value ??
                  0) /
                (1000 * 1000)
            ),
          ],
          [
            "",
            "",
            "New Customers (000)",
            "",
            ...result.teams.map(
              (t) =>
                (t.miscellaneous?.find(
                  (m) =>
                    m.segmentId.equals(segment._id) &&
                    m.productId?.equals(product._id)
                )?.grossAdds || 0) / 1000
            ),
          ],
          [
            "",
            "",
            "Total Customers (000)",
            "",
            ...result.teams.map(
              (t) =>
                (t.miscellaneous?.find(
                  (m) =>
                    m.segmentId.equals(segment._id) &&
                    m.productId?.equals(product._id)
                )?.endingCustomers || 0) / 1000
            ),
          ],
          [
            "",
            "",
            "Market Share",
            "",
            ...result.teams.map(
              (t) =>
                t.bizperf.find(
                  (bp) => bp.productId?.toString() === product._id.toString()
                )?.["Market Share"] || 0
            ),
          ],
          [],
          ...decisionFieldsWithoutMarketing.map((f) => [
            "",
            "",
            f.label,
            "",
            ...result.teams.map((t) => {
              const currentFieldDecision = t.decision?.decisionDetails
                .find(
                  (d) =>
                    d.segmentId.equals(segment._id) &&
                    d.productId.equals(product._id)
                )
                ?.fields.find((innerF) => innerF.key === f.key);

              const hasTextValue = !!currentFieldDecision?.textValue;

              if (hasTextValue) {
                const realTextValue = segment.fields
                  .find((innerF) => innerF.key === f.key)
                  ?.options?.find(
                    (o) =>
                      (o.numericValue || 0) ===
                      (currentFieldDecision?.value || 0)
                  )?.label;

                return realTextValue || 0;
              }

              return currentFieldDecision?.value || 0;
            }),
          ]),
          [],
        ];
      });

      return [
        ["", segment.name], // Segment row
        ["", "", "", "", ...result.teams.map((t) => t.team?.teamName)],
        [],
        ...(segment.fields?.length > 0
          ? [
              ["", "Segment Level Decisions"],
              ...segment.fields.map((f) => [
                "",
                "",
                f.label,
                "",
                ...result.teams.map((t) => {
                  const currentFieldDecision =
                    t.decision?.segmentDecisionDetails
                      .find((d) => d.segmentId.equals(segment._id))
                      ?.fields.find((innerF) => innerF.key === f.key);

                  const hasTextValue = !!currentFieldDecision?.textValue;

                  if (hasTextValue) {
                    if (hasTextValue) {
                      const realTextValue = segment.fields
                        .find((innerF) => innerF.key === f.key)
                        ?.options?.find(
                          (o) =>
                            (o.numericValue || 0) ===
                            (currentFieldDecision?.value || 0)
                        )?.label;

                      return realTextValue || 0;
                    }
                  }

                  return currentFieldDecision?.value || 0;
                }),
              ]),
              [],
            ]
          : []),
        ...productRows,
        [], // Optional: blank row between segments
      ];
    }),
  ];

  const PNL_ROWS_IN_COMPETITOR_REPORT: Array<{
    label?:
      | keyof Omit<PNLUnderTeamInterface, "segmentId" | "productId">
      | "% of Income"
      | "Cost/Income Ratio"
      | "Margin";
    isCalculated?: boolean;
    formula?: string;
    isInPNL?: boolean;
  }> = [
    {
      label: "Net Interest Income",
      isCalculated: false,
      isInPNL: true,
    },
    {
      label: "Non-Interest Income",
      isCalculated: false,
      isInPNL: true,
    },
    {
      label: "% of Income",
      isCalculated: true,
      formula: "Interest Income / Total Revenue",
    },
    {},
    {
      label: "Total Revenue",
      isCalculated: false,
      isInPNL: true,
    },
    {},
    {
      label: "Total Expenses",
      isCalculated: false,
      isInPNL: true,
    },
    {
      label: "Cost/Income Ratio",
      isCalculated: true,
      formula: "Total Expenses / Total Revenue",
    },
    {},
    {
      label: "Provisions",
      isCalculated: false,
      isInPNL: true,
    },
    {},
    {
      label: "Profit Before Tax",
      isCalculated: false,
      isInPNL: true,
    },
    {},
    {
      label: "Profit After Tax",
      isCalculated: false,
      isInPNL: true,
    },
    {},
    {
      label: "Capital Charge",
      isCalculated: false,
      isInPNL: true,
    },
    {},
    {
      label: "Risk Adjusted Profit",
      isCalculated: false,
      isInPNL: true,
    },
    {
      label: "Margin",
      isCalculated: true,
      formula: "Risk Adjusted Profit / Total Revenue",
    },
    // "",
    // "",
    // { label: "Total Deposits", isCalculated: false, isInPNL: true},
    // { label: "Total Balances", isCalculated: false, isInPNL: true},
    // { label: "Loan-Deposit Ratio", isCalculated: true, formula: "Total Loans / Total Deposits" },
  ];

  const pnlSection = [
    ["", "Profit and Loss"],
    [],
    ["", "Group ($Bn)", "", "", ...result.teams.map((t) => t.team?.teamName)],
    ...PNL_ROWS_IN_COMPETITOR_REPORT.map((row) => {
      if (!row) return [];
      return [
        "",
        "",
        row.label || "",
        "",
        ...result.teams.map((t) => {
          if (row.isInPNL && !row.isCalculated) {
            // Sum or get the value as needed
            const summedRow = t.pnl
              ?.filter((pnl) => pnl.segmentId?.toString() && !pnl.productId)
              .reduce((acc, curr) => {
                if (
                  row.label &&
                  row.label !== "% of Income" &&
                  row.label !== "Cost/Income Ratio" &&
                  row.label !== "Margin"
                ) {
                  if (
                    row.label !== "customFields" &&
                    row.label !== "subProductKey"
                  ) {
                    return acc + (curr[row.label] || 0);
                  }

                  return acc + (curr?.customFields?.[row.label] || 0);
                }
                return acc;
              }, 0);
            return summedRow / (1000 * 1000 * 1000);
          }
          if (row.isCalculated) {
            const nonInterestIncome = t.pnl
              ?.filter((pnl) => pnl.segmentId?.toString() && !pnl.productId)
              .reduce(
                (acc, curr) => acc + (curr["Non-Interest Income"] || 0),
                0
              );
            const totalRevenue = t.pnl
              ?.filter((pnl) => pnl.segmentId?.toString() && !pnl.productId)
              .reduce((acc, curr) => acc + (curr["Total Revenue"] || 0), 0);
            const totalExpenses = t.pnl
              ?.filter((pnl) => pnl.segmentId?.toString() && !pnl.productId)
              .reduce((acc, curr) => acc + (curr["Total Expenses"] || 0), 0);
            const totalRAP = t.pnl
              ?.filter((pnl) => pnl.segmentId?.toString() && !pnl.productId)
              .reduce(
                (acc, curr) => acc + (curr["Risk Adjusted Profit"] || 0),
                0
              );

            if (row.label === "% of Income")
              return nonInterestIncome / totalRevenue;
            if (row.label === "Cost/Income Ratio")
              return totalExpenses / totalRevenue;
            if (row.label === "Margin") return totalRAP / totalRevenue;
            return 0;
          }
          return "";
        }),
      ];
    }),
    [],
    [],
    [
      "",
      "",
      "Total Deposits",
      "",
      ...result.teams.map((t) => t.ldr.totalDeposit),
    ],
    ["", "", "Total Balances", "", ...result.teams.map((t) => t.ldr.totalLoan)],
    [
      "",
      "",
      "Loan-Deposit Ratio",
      "",
      ...result.teams.map((t) => t.ldr.loanToDepositRatio),
    ],
    [],
    ...segments.flatMap((segment) => [
      [
        "",
        "",
        `${segment.name} ($Bn)`,
        "",
        ...result.teams.map((t) => t.team?.teamName),
      ],
      [],
      ...PNL_ROWS_IN_COMPETITOR_REPORT.map((row) => {
        if (!row) return [];
        return [
          "",
          "",
          row.label || "",
          "",
          ...result.teams.map((t) => {
            if (
              row.isInPNL &&
              !row.isCalculated &&
              !!row.label &&
              row.label !== "Margin" &&
              row.label !== "Cost/Income Ratio" &&
              row.label !== "% of Income"
            ) {
              let rowValue;

              if (
                row.label !== "customFields" &&
                row.label !== "subProductKey"
              ) {
                rowValue =
                  t.pnl?.find(
                    (pnl) =>
                      pnl.segmentId?.toString() === segment._id.toString() &&
                      !pnl.productId
                  )?.[row.label] || 0;
              }

              if (row.label === "customFields") {
                rowValue =
                  t.pnl?.find(
                    (pnl) =>
                      pnl.segmentId?.toString() === segment._id.toString() &&
                      !pnl.productId
                  )?.customFields?.[row.label] || 0;
              }

              return (rowValue || 0) / (1000 * 1000 * 1000);
            }

            if (row.isCalculated) {
              const nonInterestIncome =
                t.pnl?.find(
                  (pnl) =>
                    pnl.segmentId?.toString() === segment._id.toString() &&
                    !pnl.productId
                )?.["Non-Interest Income"] || 0;
              const totalRevenue =
                t.pnl?.find(
                  (pnl) =>
                    pnl.segmentId?.toString() === segment._id.toString() &&
                    !pnl.productId
                )?.["Total Revenue"] || 0;
              const totalExpenses =
                t.pnl?.find(
                  (pnl) =>
                    pnl.segmentId?.toString() === segment._id.toString() &&
                    !pnl.productId
                )?.["Total Expenses"] || 0;
              const totalRAP =
                t.pnl?.find(
                  (pnl) =>
                    pnl.segmentId?.toString() === segment._id.toString() &&
                    !pnl.productId
                )?.["Risk Adjusted Profit"] || 0;

              if (row.label === "% of Income")
                return nonInterestIncome / totalRevenue;
              if (row.label === "Cost/Income Ratio")
                return totalExpenses / totalRevenue;
              if (row.label === "Margin") return totalRAP / totalRevenue;
              return 0;
            }
            return "";
          }),
        ];
      }),
    ]),
  ];

  const tnoSection = [
    ["", "Technology & Operations"],
    [],
    ["", "Levels", "", "", ...result.teams.map((t) => t.team?.teamName)],
    [],
    ...(
      availableGlobalInputs.find((agi) => agi.key === "tech_ops")?.inputs || []
    ).map((input) => {
      return [
        "",
        "",
        input.name,
        "",
        ...result.teams.map((t) => {
          return (
            t.decision?.globalDecisionDetails.find(
              (gdd) => gdd.key === input.key
            )?.value || 0
          );
        }),
      ];
    }),
  ];

  const competitorSheet = XLSX.utils.aoa_to_sheet([
    ["", `Competitor Report - Year ${result.roundNumber}`],
    [],
    ...balancedScorecardSection,
    [],
    [],
    ...revenuesSection,
    [],
    ...rapSection,
    ...decisionsAndMarketShareAndCustomerPerProductSection,
    [],
    ...pnlSection,
    [],
    ...tnoSection,
    [],
    // ...detailedPNLTable,
    // [],
    // ...productGroupedTable,
    // [],
    // ...revenuePerProductTable,
    // [],
    // ...rapPerProductTable,
    // [],
    // ...loanProductAnalysisTable,
    // [],
    // ...esatDetailedAnalysisTable,
    // [],
    // ...csatDetailedAnalysisTable,
  ]);

  competitorSheet["!cols"] = [
    { wpx: 20 },
    { wpx: 20 },
    { wpx: 200 },
    { wpx: 200 },
    ...result.teams.map((team) => ({ wpx: 200 })),
  ]; // Adjust width as needed

  XLSX.utils.book_append_sheet(workbook, competitorSheet, "Competitor");

  // Write to file
  const fileName = `competitor_report_round_${result.roundNumber}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return fileName;
}

// Mall Management versions of XLSX report functions
// TODO: Update Competitor functions with mall management specific logic later

function createMallManagementAnalysisReport(
  result: ResultInterface,
  {
    availableGlobalInputs,
    segments,
    products,
    prevRoundDecisions,
    baseData,
    prevRoundResult,
    round,
    download = true,
  }: {
    availableGlobalInputs: IGlobalInput[];
    segments: SegmentInterface[];
    products: ProductInterface[];
    prevRoundDecisions: (DecisionInterface | null)[];
    baseData: BaseDataInterface;
    prevRoundResult?: ResultInterface | null;
    round: RoundInterface;
    download?: boolean;
  }
) {
  return createAnalysisReportMall(result, {
    segments,
    round,
  });
}

// Ensure the rename on import above doesn't clash. Actually, the best way is to import it at the top as the exact name, and replace the function body here. Or just remove the wrapper entirely if it matches the signature where it's called.
// Since the callers expect the full signature, I will keep the wrapper and call our new function.

import { createMallManagementAnalysisReport as createAnalysisReportMall } from "./mallManagement/createMallManagementAnalysisReport";

import { createFmcgCompetitorReport } from "./fmcg/createFmcgCompetitorReport";
import { createMallManagementCompetitorReport as createCompetitorReportMall } from "./mallManagement/createMallManagementCompetitorReport";

function createMallManagementCompetitorReport(
  result: ResultInterface,
  {
    availableGlobalInputs,
    segments,
    products,
    prevRoundDecisions,
    baseData,
    prevRoundResult,
    round,
    winningMetricsConfig,
    currency,
  }: {
    availableGlobalInputs: IGlobalInput[];
    segments: SegmentInterface[];
    products: ProductInterface[];
    prevRoundDecisions: (DecisionInterface | null)[];
    baseData: BaseDataInterface;
    prevRoundResult?: ResultInterface | null;
    round: RoundInterface;
    winningMetricsConfig?: WinningMetricConfig[];
    currency?: string;
    pnl?: undefined;
    activeProductIds?: ObjectId[] | null;
  }
) {
  return createCompetitorReportMall(result, {
    segments,
    products,
    round,
    winningMetricsConfig,
    currency,
    prevRoundResult,
  });
}

const calculateScoresForAllTeams = ({
  overallTeams,
  roundNumber,
  prevRoundResult,
  winningMetricsConfig,
}: {
  roundNumber: number;
  prevRoundResult: ResultInterface | null;
  overallTeams: TeamInvolvedInterface[];
  winningMetricsConfig?: Array<{
    key: string;
    label: string;
    format: "money" | "percentage" | "number";
    source: "pnl" | "bizperf" | "csat" | "esat" | "custom";
    sourceField?: string;
    aggregationType: "sum" | "average";
    order: number;
  }> | null;
}) => {
  // Use default metrics if no config is provided (backward compatibility)
  const useDefaultMetrics =
    !winningMetricsConfig || winningMetricsConfig.length === 0;
  const metricsToCalculate: WinningMetricConfig[] = useDefaultMetrics
    ? [
        {
          key: "profit",
          label: "Profit",
          order: 1,
          format: "money",
          source: "pnl",
          aggregationType: "sum",
        },
        {
          key: "csat",
          label: "CSAT",
          order: 2,
          format: "number",
          source: "csat",
          aggregationType: "average",
        },
        {
          key: "esat",
          label: "ESAT",
          order: 3,
          format: "number",
          source: "esat",
          aggregationType: "average",
        },
        {
          key: "revenue",
          label: "Revenue",
          order: 4,
          format: "money",
          source: "pnl",
          aggregationType: "sum",
        },
      ]
    : winningMetricsConfig.sort((a, b) => a.order - b.order);

  // do not delete this, maybe this will be needed for certain simulation type
  // but for now every simulation type do not need this
  // if (roundNumber <= 0) {
  //   const emptyMetrics: Record<string, number> = {};
  //   metricsToCalculate.forEach((m) => {
  //     emptyMetrics[m.key] = 0;
  //   });

  //   return overallTeams.map((team) => ({
  //     teamId: team.teamId.toString(),
  //     teamName: team.team?.teamName || "",
  //     metrics: emptyMetrics,
  //     cumulativeMetrics: emptyMetrics,
  //     rap: 0,
  //     csat: 0,
  //     esat: 0,
  //     revenue: 0,
  //     cumulativeRAP: 0,
  //     cumulativeCSAT: 0,
  //     cumulativeESAT: 0,
  //     cumulativeRevenue: 0,
  //     totalScore: 0,
  //     tiebreaker: 0,
  //   }));
  // }

  const baseScores = overallTeams.map((team) => {
    const teamId = team.teamId.toString();
    const overallWinningMetric = team.winningMetric.find((wm) => !wm.segmentId);
    const prev = prevRoundResult?.teams.find(
      (t) => t.teamId.toString() === teamId
    );

    // Calculate scores for each metric dynamically
    const metricScores: Record<string, number> = {};
    const cumulativeMetricScores: Record<string, number> = {};
    const legacyScores: {
      rap?: number;
      csat?: number;
      esat?: number;
      revenue?: number;
      cumulativeRAP?: number;
      cumulativeCSAT?: number;
      cumulativeESAT?: number;
      cumulativeRevenue?: number;
    } = {};

    metricsToCalculate.forEach((metric) => {
      const metricValue =
        overallWinningMetric?.metrics?.[metric.key] ||
        (overallWinningMetric?.[
          metric.key as keyof typeof overallWinningMetric
        ] as number) ||
        0;

      const scores = calculateMetricScore({
        teams: overallTeams.map((ot) => {
          const otOverallMetric = ot.winningMetric.find((wm) => !wm.segmentId);
          return {
            teamId: ot.teamId.toString(),
            teamName: ot.team?.teamName || "",
            value:
              otOverallMetric?.metrics?.[metric.key] ||
              (otOverallMetric?.[
                metric.key as keyof typeof otOverallMetric
              ] as number) ||
              0,
          };
        }),
        metricKey: metric.key,
        round: roundNumber,
        descending: true,
        weight: metric.weight,
      });

      const points = scores.find((s) => s.teamId === teamId)?.points || 0;
      metricScores[metric.key] = points;

      // Calculate cumulative scores
      const prevCumulative =
        prev?.score?.cumulativeMetrics?.[metric.key] ||
        (prev?.score?.[
          `cumulative${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}` as keyof typeof prev.score
        ] as number) ||
        0;
      cumulativeMetricScores[metric.key] = prevCumulative + points;

      // Also populate legacy fields for backward compatibility
      if (useDefaultMetrics) {
        if (metric.key === "profit" || metric.key === "rap") {
          legacyScores.rap = points;
          legacyScores.cumulativeRAP = prevCumulative + points;
        } else if (metric.key === "csat") {
          legacyScores.csat = points;
          legacyScores.cumulativeCSAT = prevCumulative + points;
        } else if (metric.key === "esat") {
          legacyScores.esat = points;
          legacyScores.cumulativeESAT = prevCumulative + points;
        } else if (metric.key === "revenue") {
          legacyScores.revenue = points;
          legacyScores.cumulativeRevenue = prevCumulative + points;
        }
      }
    });

    const totalScore = Object.values(metricScores).reduce(
      (acc, val) => acc + val,
      0
    );

    return {
      teamId,
      teamName: team.team?.teamName || "",
      metrics: metricScores,
      cumulativeMetrics: cumulativeMetricScores,
      ...legacyScores,
      totalScore,
      tiebreaker: 0, // to be filled later
    };
  });

  if (roundNumber > 0) {
    // Apply tiebreaker logic
    // baseScores.sort((a, b) => {
    //   if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    //   if (b.csat !== a.csat) return b.csat - a.csat;
    //   if (b.esat !== a.esat) return b.esat - a.esat;
    //   if (b.rap !== a.rap) return b.rap - a.rap;
    //   if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    //   return 0;
    // });
    // Recalculate tiebreaker field (non-zero if this team broke a tie)
    // for (let i = 1; i < baseScores.length; i++) {
    //   const prev = baseScores[i - 1];
    //   const curr = baseScores[i];
    //   if (curr.totalScore === prev.totalScore) {
    //     const diffCSAT = curr.csat !== prev.csat;
    //     const diffESAT = curr.csat === prev.csat && curr.esat !== prev.esat;
    //     const diffRAP =
    //       curr.csat === prev.csat &&
    //       curr.esat === prev.esat &&
    //       curr.rap !== prev.rap;
    //     const diffRevenue =
    //       curr.csat === prev.csat &&
    //       curr.esat === prev.esat &&
    //       curr.rap === prev.rap &&
    //       curr.revenue !== prev.revenue;
    //     if (diffCSAT || diffESAT || diffRAP || diffRevenue) {
    //       if (
    //         curr.csat > prev.csat ||
    //         (curr.csat === prev.csat && curr.esat > prev.esat) ||
    //         (curr.csat === prev.csat &&
    //           curr.esat === prev.esat &&
    //           curr.rap > prev.rap) ||
    //         (curr.csat === prev.csat &&
    //           curr.esat === prev.esat &&
    //           curr.rap === prev.rap &&
    //           curr.revenue > prev.revenue)
    //       ) {
    //         curr.tiebreaker = 1;
    //       } else {
    //         prev.tiebreaker = 1;
    //       }
    //     }
    //   }
    // }
  }

  return baseScores;
};

export async function processCalculations({
  simulationId,
  simulationTypeId,
  simulationTypeName,
  roundNumber,
  session,
  activeSegments,
  activeProducts,
}: {
  simulationTypeId: string;
  simulationTypeName: string;
  simulationId: string;
  roundNumber: number;
  session: mongoose.ClientSession;
  activeSegments: SegmentInterface[];
  activeProducts: ProductInterface[];
}) {
  try {
    const simulationType =
      await SimulationType.findById(simulationTypeId).lean();
    const winningMetricsConfig = simulationType?.winningMetrics || null; // null means use default metrics

    const teams = await Team.find({ simulationId }).session(session);
    const products = await Product.find({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).session(session);
    const segments = await Segment.find({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    }).session(session);

    const availableGlobalInputs = await GlobalInput.find({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    });

    const baseData = await BaseData.findOne({
      simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
    });

    if (!baseData) {
      throw new Error("Base data not found");
    }

    const prevRoundResult = await Result.findOne({
      simulationId: new mongoose.Types.ObjectId(simulationId),
      roundNumber: roundNumber - 1,
    })
      .session(session)
      .sort({ createdAt: -1 })
      .lean();

    const currentRound = await Round.findOne({
      simulationId: new mongoose.Types.ObjectId(simulationId),
      roundNumber,
    })
      .populate("eventsTriggered.event")
      .session(session)
      .sort({ createdAt: -1 })
      .lean();

    const eventsTriggered = currentRound?.eventsTriggered || [];

    // 2. Get latest decision for each team
    const decisions = await Promise.all(
      teams.map(async (team) => {
        const decision = await Decision.findOne({
          simulationId,
          roundNumber,
          teamId: team._id,
        })
          .populate(
            "decisionDetails.product eventDecisions.event segmentDecisionDetails.segment decisionDetails.segment globalDecisionDetails.globalInput"
          )
          .sort({ createdAt: -1 }) // Get the latest one
          .session(session)
          .lean();

        if (!decision) {
          throw new Error(
            `No decision found for team ${team._id} in round ${roundNumber}`
          );
        }
        return decision;
      })
    );

    if (!decisions.length) {
      throw new Error("No decisions found for this round");
    }

    let endResult: ResultInterface = {
      simulationId: new mongoose.Types.ObjectId(simulationId),
      teams: decisions.map((decision) => ({
        teamId: decision.teamId,
        decisionId: decision._id as mongoose.Types.ObjectId,
        winningMetric: [],
        esat: [],
        csat: [],
        bizperf: [],
        pnl: [],
        cashflow: [],
        balanceSheet: [],
        adjustedParams: [],
        miscellaneous: [],
        ldr: {
          loanToDepositRatio: 0,
          totalLoan: 0,
          totalDeposit: 0,
          depositPerSegment: [],
        },
        score: {
          rap: 0,
          csat: 0,
          esat: 0,
          revenue: 0,
          cumulativeRAP: 0,
          cumulativeCSAT: 0,
          cumulativeESAT: 0,
          cumulativeRevenue: 0,
        },
      })),
      roundNumber,
      marketShares: [],
      csat: [],
      esat: [],
      esatDrivers: [],
      csatDrivers: [],
    };

    // const productDecisions = decisions.map((decision) => {
    //   return {
    //     teamId: decision.teamId,
    //     decisionDetail: decision.decisionDetails,
    //   };
    // });

    // const segmentDecisions = decisions.map((decision) => {
    //   return {
    //     teamId: decision.teamId,
    //     decisionDetail: decision.segmentDecisionDetails,
    //   };
    // });

    const globalDecisions = decisions.map((decision) => {
      return {
        teamId: decision.teamId,
        decisionDetail: decision.globalDecisionDetails,
      };
    });

    const globalMMInput: MarketModelBatchInput = {};

    globalDecisions.forEach((decision) => {
      decision.decisionDetail.forEach((field) => {
        if (globalMMInput[field.key] === undefined) {
          globalMMInput[field.key] = [
            {
              teamId: decision.teamId,
              value: field.value ?? 0,
              selected: field.selected || false,
              globalInputType: field.globalInput?.type,
            },
          ];
        } else {
          globalMMInput[field.key].push({
            teamId: decision.teamId,
            value: field.value ?? 0,
            selected: field.selected || false,
            globalInputType: field.globalInput?.type,
          });
        }
      });
    });

    const eventDecisions = decisions.map((decision) => {
      return {
        teamId: decision.teamId,
        decisionDetail: decision.eventDecisions || [],
      };
    });

    const eventMMInput: MarketModelBatchInput = {};

    eventDecisions.forEach((decision) => {
      decision.decisionDetail.forEach((field) => {
        const combinedKey = `${field.eventId}_${field.chosenKey}`;

        if (eventMMInput[combinedKey] === undefined) {
          eventMMInput[combinedKey] = [
            { teamId: decision.teamId, chosenKey: field.chosenKey, value: 0 },
          ];
        } else {
          eventMMInput[combinedKey].push({
            teamId: decision.teamId,
            chosenKey: field.chosenKey,
            value: 0,
          });
        }
      });
    });

    const teamProductAggregates = new Map<
      string,
      {
        [productId: string]: {
          totalWeightedShare: number;
          totalMarketSize: number;
          weightedFieldScores: { [fieldKey: string]: number };
        };
      }
    >();

    // >>> ADDED: Imports for Market Models
    const { calcMmFmcg } = await import("../sim/fmcg/calcMmFmcg");
    const { calcMmMall } = await import("../sim/mallManagement/calcMmMall");
    // <<< END ADDED

    for (const product of products) {
      // Filter decisions for this product
      const productDecisions = decisions
        .map((decision) => {
          const decisionDetail = decision.decisionDetails.find(
            (detail) =>
              detail.product?._id.toString() === product._id.toString()
          );

          return {
            teamId: decision.teamId,
            decisionDetail,
          };
        })
        .filter((d) => d.decisionDetail); // Filter out teams without decisions for this product

      if (productDecisions.length === 0) continue;

      if (simulationType?.name === "FMCG") {
        // Find subproducts (channels) for this product
        const subProducts = product.subProducts || [];

        // Pre-collect Global and Segment inputs (consistent across channels)
        const globalMMInput: MarketModelBatchInput = {};
        const segmentMMInput: MarketModelBatchInput = {};

        decisions.forEach((teamDec) => {
          // Global
          teamDec.globalDecisionDetails.forEach((gd) => {
            if (!globalMMInput[gd.key]) globalMMInput[gd.key] = [];

            const agi = availableGlobalInputs.find(
              (a) => a._id.toString() === gd.globalInputId.toString()
            );
            let value = gd.value ?? 0;
            if (agi?.type === "selectable-set") {
              value = gd.selected ? 1 : 0;
            }

            globalMMInput[gd.key].push({
              teamId: teamDec.teamId,
              value: value,
              originalValue: gd.selected !== undefined ? gd.selected : gd.value,
              globalInputType: agi?.type as any,
            });
          });

          // Segment
          const segDec = teamDec.segmentDecisionDetails.find((sd) =>
            sd.segmentId.equals(product.segmentId)
          );
          segDec?.fields.forEach((f) => {
            if (!segmentMMInput[f.key]) segmentMMInput[f.key] = [];
            segmentMMInput[f.key].push({
              teamId: teamDec.teamId,
              value: f.value ?? 0,
            });
          });
        });

        // Iterate through each subproduct (channel)
        for (const subProd of subProducts) {
          const subProductKey = subProd.key;
          const mmInput: MarketModelBatchInput = {};

          const segmentModel = baseData.marketModel.segments.find((s) =>
            s.segmentId.equals(product.segmentId)
          );
          const productModel = segmentModel?.products.find((p) =>
            p.productId.equals(product._id)
          );
          const subProductModel = productModel?.subProducts?.find(
            (sp) => sp.key === subProductKey
          );

          // Collect Product/Subproduct inputs for this team
          productDecisions.forEach((teamProdDec) => {
            const teamExtensionFields =
              teamProdDec.decisionDetail?.fields || [];

            // We need a unique set of keys to avoid pushing duplicate entries for the same team
            const uniqueKeys = new Set(
              teamExtensionFields.map((f: any) => f.key)
            );

            // Inject derived fields that market model may need
            uniqueKeys.forEach((key) => {
              // Prefer fields explicitly tied to this subproduct, fallback to generic product fields
              const selectedField =
                teamExtensionFields.find(
                  (f: any) => f.key === key && f.subProductKey === subProductKey
                ) ||
                teamExtensionFields.find(
                  (f: any) => f.key === key && !f.subProductKey
                );

              if (selectedField) {
                let value = selectedField.value ?? 0;

                // Special handling for costs mapped from product.fields
                if (
                  key === "promotion" ||
                  key === "formulation" ||
                  key === "packaging"
                ) {
                  value =
                    product.fields
                      .find((pf: any) => pf.key === key)
                      ?.costs?.find(
                        (c) =>
                          c.selectedValue === selectedField.value &&
                          (c.subProductKey === subProductKey ||
                            !c.subProductKey)
                      )?.cost ?? 0;
                }

                if (!mmInput[key]) mmInput[key] = [];
                (mmInput[key] as any).push({
                  teamId: teamProdDec.teamId,
                  value: value,
                  originalValue: selectedField.value,
                });
              }
            });
          });

          // Run FMCG Market Model
          try {
            const { sharesNormalCDF: marketShares, weightedScores } =
              await calcMmFmcg({
                inputs: mmInput,
                segmentInputs: segmentMMInput,
                globalInputs: globalMMInput,
                segmentId: product.segmentId,
                productId: product._id,
                subProductKey,
                year: roundNumber,
                simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
              });

            // Aggregate for Product-level weighted average
            // @ts-ignore
            const chMarketInfo = baseData.getYearlyDataForProduct(
              product.segmentId,
              product._id,
              roundNumber,
              subProductKey
            );
            const channelMarketSize = chMarketInfo?.marketSize || 0;

            marketShares.forEach((teamShare) => {
              const teamIdStr = teamShare.teamId.toString();
              const productIdStr = product._id.toString();

              if (!teamProductAggregates.has(teamIdStr)) {
                teamProductAggregates.set(teamIdStr, {});
              }
              const teamAggr = teamProductAggregates.get(teamIdStr)!;

              if (!teamAggr[productIdStr]) {
                teamAggr[productIdStr] = {
                  totalWeightedShare: 0,
                  totalMarketSize: 0,
                  weightedFieldScores: {},
                };
              }

              const prodAggr = teamAggr[productIdStr];
              prodAggr.totalWeightedShare +=
                teamShare.value * channelMarketSize;
              prodAggr.totalMarketSize += channelMarketSize;

              weightedScores.forEach((ws) => {
                const teamValue = ws.teamValues.find(
                  (tv) => tv.teamId.toString() === teamIdStr
                );
                if (teamValue) {
                  prodAggr.weightedFieldScores[ws.fieldKey] =
                    (prodAggr.weightedFieldScores[ws.fieldKey] || 0) +
                    teamValue.score * channelMarketSize;
                }
              });
            });

            // We MUST update the decision's projected_market_share used by calcProjections
            // and also persist the detailed market shares in the endResult

            endResult.marketShares.push({
              productId: product._id,
              segmentId: product.segmentId,
              subProductKey,
              marketShares,
              weightedScores,
            });

            // Update each team's decision with the calculated market share
            productDecisions.forEach((decision) => {
              const teamShare = marketShares.find(
                (ms) => ms.teamId.toString() === decision.teamId.toString()
              );

              if (teamShare && decision.decisionDetail) {
                const projectedShareField = decision.decisionDetail.fields.find(
                  (f: any) =>
                    f.key === "projected_market_share" &&
                    f.subProductKey === subProductKey
                );

                if (projectedShareField) {
                  projectedShareField.value = teamShare.value;
                }
              }
            });
          } catch (error) {
            console.error(
              `FMCG Market Model Error for ${product.productName} - ${subProductKey}:`,
              error
            );
          }
        }
      } else if (simulationType?.name === "Mall Management") {
        try {
          const { sharesNormalCDF: marketShares, weightedScores } =
            await calcMmMall({
              productDecisions: decisions as any, // Cast to any to avoid strict mongoose document vs interface issues
            });

          // Update each team's decision with the calculated market share
          productDecisions.forEach((decision) => {
            const teamShare = marketShares.find(
              (ms) => ms.teamId.toString() === decision.teamId.toString()
            );

            const totalMarketSize = getTotalMarketSize(roundNumber);

            if (teamShare && decision.decisionDetail) {
              const projectedShareField = decision.decisionDetail.fields.find(
                (f: any) => f.key === "projected_market_share"
              );

              if (projectedShareField) {
                projectedShareField.value = teamShare.value * totalMarketSize;
              }
            } else {
              decision.decisionDetail?.fields.push({
                key: "projected_market_share",
                value: (teamShare?.value || 0) * totalMarketSize,
              });
            }
          });

          endResult.marketShares.push({
            productId: product._id,
            segmentId: product.segmentId,
            weightedScores,
            marketShares,
          });
        } catch (error) {
          console.error(
            `Mall Management Market Model Error for ${product.productName}:`,
            error
          );
        }
      } else {
        const mmInput: MarketModelBatchInput = {};

        // For each field in the product's market model, get the corresponding values from decisions
        product.fields.forEach((field) => {
          mmInput[field.key] = productDecisions.map((decision) => {
            const fieldValue = decision?.decisionDetail?.fields.find(
              (f) => f.key === field.key
            )?.value;

            return fieldValue !== undefined
              ? { teamId: decision.teamId, value: fieldValue }
              : { teamId: decision.teamId, value: 0 };
          });
        });

        const segmentDecisions = decisions.map((decision) => {
          return {
            teamId: decision.teamId,
            decisionDetail: decision.segmentDecisionDetails,
          };
        });

        const segmentMMInput: MarketModelBatchInput = {};

        segmentDecisions.forEach((decision) => {
          decision.decisionDetail
            .find((d) => d.segmentId.equals(product.segmentId))
            ?.fields.forEach((f) => {
              if (segmentMMInput[f.key] === undefined) {
                segmentMMInput[f.key] = [
                  { teamId: decision.teamId, value: f.value ?? 0 },
                ];
              } else {
                segmentMMInput[f.key].push({
                  teamId: decision.teamId,
                  value: f.value ?? 0,
                });
              }
            });
        });

        // Calculate market shares for this product
        const { sharesNormalCDF: marketShares, weightedScores } = await simMm({
          inputs: mmInput,
          segmentInputs: segmentMMInput,
          globalInputs: globalMMInput,
          year: roundNumber,
          segmentId: product.segmentId,
          productId: product._id,
          simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
        });

        endResult.marketShares.push({
          productId: product._id,
          segmentId: product.segmentId,
          weightedScores,
          marketShares,
        });

        // Update market shares in decisions
        productDecisions.forEach((decision) => {
          const marketShare = marketShares.find(
            (m) => m.teamId.toString() === decision.teamId.toString()
          )!.value;

          if (decision.decisionDetail) {
            const projectedMarketShare = decision.decisionDetail.fields.find(
              (f) => f.key === "projected_market_share"
            );

            if (projectedMarketShare) {
              projectedMarketShare.value = marketShare;
            } else {
              decision.decisionDetail.fields.push({
                key: "projected_market_share",
                value: marketShare,
              });
            }
          }
        });
      }
    }

    for (const segment of segments) {
      const productMMInputInCurrentSegment: MarketModelBatchInput = {};
      const segmentMMInput: MarketModelBatchInput = {};

      decisions.forEach((decision) => {
        decision.decisionDetails.forEach((details) => {
          if (details.segmentId.equals(segment._id)) {
            details.fields.forEach((field) => {
              if (productMMInputInCurrentSegment[field.key] === undefined) {
                productMMInputInCurrentSegment[field.key] = [
                  { teamId: decision.teamId, value: field.value ?? 0 },
                ];
              } else {
                productMMInputInCurrentSegment[field.key].push({
                  teamId: decision.teamId,
                  value: field.value ?? 0,
                });
              }
            });
          }
        });
      });

      decisions.forEach((decision) => {
        decision.segmentDecisionDetails.forEach((details) => {
          if (details.segmentId.equals(segment._id)) {
            details.fields.forEach((field) => {
              if (segmentMMInput[field.key] === undefined) {
                segmentMMInput[field.key] = [
                  { teamId: decision.teamId, value: field.value ?? 0 },
                ];
              } else {
                segmentMMInput[field.key].push({
                  teamId: decision.teamId,
                  value: field.value ?? 0,
                });
              }
            });
          }
        });
      });

      const openingCSAT =
        prevRoundResult?.teams.map((t) => ({
          teamId: t.teamId,
          score:
            t.csat.find(
              (c) => c.segmentId.toString() === segment._id.toString()
            )?.closing || 0.6,
        })) || [];

      const calcCSATUsed =
        simulationTypeName === "FMCG" ? fmcgCalcCSAT : calcCSATV2;

      const csat = await calcCSATUsed({
        simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
        inputs: productMMInputInCurrentSegment,
        segmentInputs: segmentMMInput,
        globalInputs: globalMMInput,
        eventInputs: eventMMInput,
        eventsTriggered: eventsTriggered.map((event) =>
          event.eventId.toString()
        ),
        segmentId: segment._id,
        year: roundNumber,
        numberOfTeams: decisions.length,
        teamIds: teams.map((team) => team._id),
        openingCSAT,
      });

      endResult.csat.push({
        segmentId: segment._id,
        scores: csat.csatScores,
      });

      endResult.teams.forEach((team) => {
        const csatUnderTeam = csat.csatUnderTeams.find(
          (e) => e.teamId.toString() === team.teamId.toString()
        );

        if (csatUnderTeam) {
          team.csat.push(csatUnderTeam);
        }
      });

      endResult.csatDrivers.push(...csat.csatDrivers);

      const openingESAT =
        prevRoundResult?.teams.map((t) => ({
          teamId: t.teamId,
          score:
            t.esat.find(
              (e) => e.segmentId.toString() === segment._id.toString()
            )?.closing || 0.6,
        })) || [];

      const calcESATUsed =
        simulationTypeName === "FMCG" ? fmcgCalcESAT : calcESAT;

      const esat = await calcESATUsed({
        simulationTypeId: new mongoose.Types.ObjectId(simulationTypeId),
        segmentId: segment._id,
        year: roundNumber,
        numberOfTeams: decisions.length,
        inputs: productMMInputInCurrentSegment,
        segmentInputs: segmentMMInput,
        globalInputs: globalMMInput,
        eventInputs: eventMMInput,
        teamIds: teams.map((team) => team._id),
        openingESAT,
        eventsTriggered: eventsTriggered.map((event) =>
          event.eventId.toString()
        ),
      });

      endResult.esat.push({
        segmentId: segment._id,
        scores: esat.esatScores,
      });

      endResult.teams.forEach((team) => {
        const esatUnderTeam = esat.esatUnderTeams.find(
          (e) => e.teamId.toString() === team.teamId.toString()
        );
        if (esatUnderTeam) {
          team.esat.push(esatUnderTeam);
        }
      });

      endResult.esatDrivers.push(...esat.esatDrivers);
    }

    // Pre-calculate average retail prices per product and channel for FMCG CSAT
    const avgRetailPrices: Record<string, Record<string, number>> = {};
    if (simulationTypeName === "FMCG") {
      const productChannelPriceSums: Record<
        string,
        Record<string, number>
      > = {};
      const productChannelPriceCounts: Record<
        string,
        Record<string, number>
      > = {};

      decisions.forEach((d) => {
        d.decisionDetails.forEach((dd) => {
          const prodId = dd.productId.toString();
          if (!productChannelPriceSums[prodId])
            productChannelPriceSums[prodId] = {};
          if (!productChannelPriceCounts[prodId])
            productChannelPriceCounts[prodId] = {};

          dd.fields.forEach((f) => {
            if (
              f.key === "retail_price" &&
              f.subProductKey &&
              f.value !== undefined
            ) {
              productChannelPriceSums[prodId][f.subProductKey] =
                (productChannelPriceSums[prodId][f.subProductKey] || 0) +
                f.value;
              productChannelPriceCounts[prodId][f.subProductKey] =
                (productChannelPriceCounts[prodId][f.subProductKey] || 0) + 1;
            }
          });
        });
      });

      Object.keys(productChannelPriceSums).forEach((prodId) => {
        avgRetailPrices[prodId] = {};
        Object.keys(productChannelPriceSums[prodId]).forEach(
          (subProductKey) => {
            avgRetailPrices[prodId][subProductKey] =
              productChannelPriceSums[prodId][subProductKey] /
              (productChannelPriceCounts[prodId][subProductKey] || 1);
          }
        );
      });
    }

    // 5. Calculate projections for each team and update
    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];

      let prevRoundDecision: DecisionInterface | null = await Decision.findOne({
        simulationId: simulationId,
        roundNumber: roundNumber - 1,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!prevRoundDecision) {
        const simulationType = await SimulationType.findById(simulationTypeId);

        if (!simulationType) {
          throw new Error("Simulation type not found.");
        }

        const pastData = simulationType.pastData.find((pd) => pd.year === 0);

        if (!pastData) {
          throw new Error("Past data not found.");
        }

        prevRoundDecision = {
          simulationId: new mongoose.Types.ObjectId(simulationId),
          decisionDetails: pastData.productData.map((pd) => ({
            productId: pd.productId,
            segmentId: pd.segmentId,
            fields: pd.fields.map((field) => ({
              key: field.key,
              value: field.value,
            })),
          })),
          segmentDecisionDetails: pastData.segmentData.map((sd) => ({
            segmentId: sd.segmentId,
            fields: sd.fields.map((field) => ({
              key: field.key,
              value: field.value,
            })),
          })),
          globalDecisionDetails: pastData.globalData.map((gd) => ({
            globalInputId: gd.globalInputId,
            key: gd.key,
            value: gd.value,
          })),
          teamId: decision.teamId,
          roundNumber: roundNumber - 1,
          // initiatives: [],
          createdAt: new Date(),
          // updatedAt: new Date(),
        };
      }

      const latestDecisionsInPreviousRounds = await Decision.aggregate([
        {
          $match: {
            simulationId: new mongoose.Types.ObjectId(simulationId),
            roundNumber: { $lt: roundNumber },
            teamId: decision.teamId,
          },
        },
        {
          $sort: { roundNumber: 1, createdAt: -1 },
        },
        {
          $group: {
            _id: "$roundNumber",
            latestDecision: { $first: "$$ROOT" },
          },
        },
        {
          $replaceRoot: { newRoot: "$latestDecision" },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      const simulationType = await SimulationType.findById(simulationTypeId);

      // TODO: use key instead of name
      const calcProjectionsUsed =
        simulationType?.name === "FMCG"
          ? fmcgCalcProjections
          : simulationType?.name === "Mall Management"
            ? mallManagementCalcProjections
            : calcProjections;

      let projections = await calcProjectionsUsed({
        decision: {
          ...decision,
          decisionDetails: decision.decisionDetails.map((dd) => ({
            ...dd,
            fields: dd.fields.find((f) => f.key === "projected_market_share")
              ? dd.fields.map((f) => ({
                  ...f,
                  value:
                    f.key === "projected_market_share"
                      ? (endResult.marketShares
                          .find(
                            (ms) =>
                              ms.productId.toString() ===
                                dd.productId.toString() &&
                              ms.segmentId.toString() ===
                                dd.segmentId.toString() &&
                              (ms.subProductKey || "") ===
                                (f.subProductKey || "")
                          )
                          ?.marketShares.find(
                            (m) =>
                              m.teamId.toString() === decision.teamId.toString()
                          )?.value ?? 0) *
                        (simulationType?.name === "Mall Management"
                          ? getTotalMarketSize(roundNumber)
                          : 1)
                      : (f.value ?? 0),
                }))
              : [
                  ...dd.fields,
                  {
                    key: "projected_market_share",
                    value:
                      (endResult.marketShares
                        .find(
                          (ms) =>
                            ms.productId.toString() ===
                              dd.productId.toString() &&
                            ms.segmentId.toString() ===
                              dd.segmentId.toString() &&
                            !ms.subProductKey
                        )
                        ?.marketShares.find(
                          (m) =>
                            m.teamId.toString() === decision.teamId.toString()
                        )?.value ?? 0) *
                      (simulationType?.name === "Mall Management"
                        ? getTotalMarketSize(roundNumber)
                        : 1),
                  },
                ],
          })),
        },
        prevRoundDecision: prevRoundDecision as DecisionInterface,
        latestDecisionsInPreviousRounds,
        totalTeams: decisions.length,
        baseData,
        triggeredBy: "roundEnding",
        availableGlobalInputs,
        prevRoundParams:
          prevRoundResult?.teams.find((t) => t.teamId.equals(decision.teamId))
            ?.adjustedParams || [],
        currentRoundDecision: decision,
        prevRoundResult: prevRoundResult?.teams.find((t) =>
          t.teamId.equals(decision.teamId)
        ),
        products,
        segments,
        penultimateProjection: null,
        penultimateDecision: null,
        eventsTriggered: currentRound?.eventsTriggered || [],
        avgRetailPrices,
      });

      if (
        (projections as ProjectionResult<BankingExtra>).ldr &&
        (projections as ProjectionResult<BankingExtra>).ldr.totalLoan >
          (projections as ProjectionResult<BankingExtra>).ldr.totalDeposit
      ) {
        const specificBankingProjections =
          projections as ProjectionResult<BankingExtra>;

        projections = await calcProjectionsUsed({
          decision: {
            ...decision,
            decisionDetails: decision.decisionDetails.map((dd) => ({
              ...dd,
              fields: dd.fields.find((f) => f.key === "projected_market_share")
                ? dd.fields.map((f) => ({
                    ...f,
                    value:
                      f.key === "projected_market_share"
                        ? (endResult.marketShares
                            .find(
                              (ms) =>
                                ms.productId.equals(dd.productId) &&
                                ms.segmentId.equals(dd.segmentId)
                            )
                            ?.marketShares.find((m) =>
                              m.teamId.equals(decision.teamId)
                            )?.value ?? 0) *
                          (simulationType?.name === "Mall Management"
                            ? getTotalMarketSize(roundNumber)
                            : 1)
                        : (f.value ?? 0),
                  }))
                : [
                    ...dd.fields,
                    {
                      key: "projected_market_share",
                      value:
                        (endResult.marketShares
                          .find(
                            (ms) =>
                              ms.productId.equals(dd.productId) &&
                              ms.segmentId.equals(dd.segmentId)
                          )
                          ?.marketShares.find((m) =>
                            m.teamId.equals(decision.teamId)
                          )?.value ?? 0) *
                        (simulationType?.name === "Mall Management"
                          ? getTotalMarketSize(roundNumber)
                          : 1),
                    },
                  ],
            })),
          },
          prevRoundDecision: prevRoundDecision as DecisionInterface,
          latestDecisionsInPreviousRounds,
          totalTeams: decisions.length,
          baseData,
          triggeredBy: "roundEnding",
          availableGlobalInputs,
          prevRoundParams:
            prevRoundResult?.teams.find((t) => t.teamId.equals(decision.teamId))
              ?.adjustedParams || [],
          currentRoundDecision: decision,
          prevRoundResult: prevRoundResult?.teams.find((t) =>
            t.teamId.equals(decision.teamId)
          ),
          products,
          segments,
          penultimateProjection: null,
          penultimateDecision: null,
          exceededLoan:
            specificBankingProjections.ldr.totalLoan -
            specificBankingProjections.ldr.totalDeposit,
          totalCompanyLoan: specificBankingProjections.ldr.totalLoan,
          eventsTriggered: currentRound?.eventsTriggered || [],
        });
      }

      // const fixedBizperf = projections.bizperf.map((bizperf) => ({
      //   ...bizperf,
      //   "Market Share":
      //     bizperf.segmentId && bizperf.productId
      //       ? endResult.marketShares
      //           .find(
      //             (ms) =>
      //               ms.productId.equals(bizperf.productId) &&
      //               ms.segmentId.equals(bizperf.segmentId)
      //           )
      //           ?.marketShares.find((m) => m.teamId.equals(decision.teamId))
      //           ?.value || 0
      //       : bizperf.segmentId && !bizperf.productId
      //         ? endResult.marketShares
      //             .filter((ms) => ms.segmentId.equals(bizperf.segmentId))
      //             .reduce(
      //               (acc, ms) =>
      //                 acc +
      //                 (ms.marketShares.find((m) =>
      //                   m.teamId.equals(decision.teamId)
      //                 )?.value || 0),
      //               0
      //             ) /
      //           (endResult.marketShares.filter((ms) =>
      //             ms.segmentId.equals(bizperf.segmentId)
      //           ).length || 1)
      //         : 0,
      // }));

      // Inject Demand-based Market Share and MM Scores
      const teamAggr = teamProductAggregates.get(decision.teamId.toString());
      if (teamAggr) {
        projections.bizperf = projections.bizperf.map((bp) => {
          const prodAggr = teamAggr[bp.productId?.toString() || ""];
          if (prodAggr && !bp.subProductKey && prodAggr.totalMarketSize > 0) {
            const finalDemandShare =
              prodAggr.totalWeightedShare / prodAggr.totalMarketSize;

            const customFields = { ...(bp.customFields || {}) };
            customFields["market_share"] = finalDemandShare;
            Object.entries(prodAggr.weightedFieldScores).forEach(
              ([key, score]) => {
                customFields[`mm_score_${key}`] =
                  score / prodAggr.totalMarketSize;
              }
            );

            return {
              ...bp,
              customFields,
            };
          }
          return bp;
        });
      }

      endResult.teams[i].bizperf = projections.bizperf;
      endResult.teams[i].pnl = projections.pnl;
      endResult.teams[i].cashflow = projections.cashflow;
      endResult.teams[i].balanceSheet = projections.balanceSheet;

      if (calcProjectionsUsed === calcProjections) {
        const specificBankingProjections =
          projections as ProjectionResult<BankingExtra>;

        endResult.teams[i].adjustedParams =
          specificBankingProjections.adjustedParams;
        endResult.teams[i].miscellaneous =
          specificBankingProjections.miscellaneous;
        endResult.teams[i].ldr = {
          loanToDepositRatio: specificBankingProjections.ldr.loanToDepositRatio,
          totalLoan: specificBankingProjections.ldr.totalLoan,
          totalDeposit: specificBankingProjections.ldr.totalDeposit,
          depositPerSegment: specificBankingProjections.ldr.depositPerSegment,
        };
      }
    }

    endResult.teams.forEach((team) => {
      let winningMetrics: Array<WinningMetricsUnderTeamInterface> = [];

      // Use default metrics if no config is provided (backward compatibility)
      const useDefaultMetrics =
        !winningMetricsConfig || winningMetricsConfig.length === 0;
      const metricsToCalculate = useDefaultMetrics
        ? [
            {
              key: "revenue",
              source: "pnl" as const,
              sourceField: "Total Revenue",
              aggregationType: "sum" as const,
            },
            {
              key: "profit",
              source: "pnl" as const,
              sourceField: "Risk Adjusted Profit",
              aggregationType: "sum" as const,
            },
            {
              key: "csat",
              source: "csat" as const,
              aggregationType: "average" as const,
            },
            {
              key: "esat",
              source: "esat" as const,
              aggregationType: "average" as const,
            },
          ]
        : winningMetricsConfig;

      // Calculate metrics per segment
      activeSegments.forEach((segment) => {
        const segmentIdStr = segment._id.toString();
        const segmentMetrics: Record<string, number> = {};
        const legacyMetrics: {
          revenue?: number;
          profit?: number;
          csat?: number;
          esat?: number;
        } = {};

        metricsToCalculate.forEach((metric) => {
          if (metric.source === "pnl" && metric.sourceField) {
            const pnlLocal = team.pnl.find(
              (p) => p.segmentId?.toString() === segmentIdStr && !p.productId
            );
            if (pnlLocal) {
              const value =
                pnlLocal.customFields?.[
                  metric.sourceField as keyof typeof pnlLocal.customFields
                ] ||
                (pnlLocal[
                  metric.sourceField as keyof typeof pnlLocal
                ] as number) ||
                0;
              segmentMetrics[metric.key] = value;
              // Also populate legacy fields for backward compatibility
              if (metric.key === "revenue") legacyMetrics.revenue = value;
              if (metric.key === "profit") legacyMetrics.profit = value;
            }
          } else if (metric.source === "bizperf" && metric.sourceField) {
            const bizperfItem = team.bizperf.find(
              (bp) => bp.segmentId?.toString() === segmentIdStr && !bp.productId
            );
            if (bizperfItem) {
              const value =
                bizperfItem?.customFields?.[
                  metric.sourceField as keyof typeof bizperfItem.customFields
                ] ||
                (bizperfItem?.[
                  metric.sourceField as keyof typeof bizperfItem
                ] as number) ||
                0;

              segmentMetrics[metric.key] = value;
            }
          }
        });

        winningMetrics.push({
          segmentId: segment._id as mongoose.Types.ObjectId,
          metrics: segmentMetrics,
          ...legacyMetrics,
          csat: 0,
          esat: 0,
        });
      });

      // Add CSAT values
      team.csat.forEach((csat) => {
        winningMetrics = [
          ...winningMetrics.map((wm) => {
            if (
              wm.segmentId &&
              csat.segmentId &&
              wm.segmentId.toString() === csat.segmentId.toString()
            ) {
              const updatedMetrics = { ...(wm.metrics || {}) };
              // Find if csat is in the metrics to calculate
              const csatMetric = metricsToCalculate.find(
                (m) => m.key === "csat" || m.source === "csat"
              );
              if (csatMetric) {
                updatedMetrics[csatMetric.key] = csat.closing;
              }
              return {
                ...wm,
                metrics: updatedMetrics,
                csat: csat.closing, // Legacy field
              };
            }
            return wm;
          }),
        ];
      });

      // Add ESAT values
      team.esat.forEach((esat) => {
        winningMetrics = [
          ...winningMetrics.map((wm) => {
            if (
              wm.segmentId &&
              esat.segmentId &&
              wm.segmentId.toString() === esat.segmentId.toString()
            ) {
              const updatedMetrics = { ...(wm.metrics || {}) };
              // Find if esat is in the metrics to calculate
              const esatMetric = metricsToCalculate.find(
                (m) => m.key === "esat" || m.source === "esat"
              );
              if (esatMetric) {
                updatedMetrics[esatMetric.key] = esat.closing;
              }
              return {
                ...wm,
                metrics: updatedMetrics,
                esat: esat.closing, // Legacy field
              };
            }
            return wm;
          }),
        ];
      });

      // Calculate overall metrics
      const overallMetrics: Record<string, number> = {};
      const overallLegacyMetrics: {
        revenue: number;
        profit: number;
        csat: number;
        esat: number;
      } = {
        revenue: 0,
        profit: 0,
        csat: 0,
        esat: 0,
      };

      metricsToCalculate.forEach((metric) => {
        let hasDirectOverallValue = false;
        let directValue = 0;

        // Try getting direct overall value first
        if (metric.source === "pnl" && metric.sourceField) {
          const overallPnl = team.pnl.find((p) => !p.segmentId && !p.productId);
          if (overallPnl) {
            const value =
              overallPnl.customFields?.[
                metric.sourceField as keyof typeof overallPnl.customFields
              ] ||
              (overallPnl[
                metric.sourceField as keyof typeof overallPnl
              ] as number);

            if (value !== undefined && !isNaN(value)) {
              hasDirectOverallValue = true;
              directValue = value;
            }
          }
        } else if (metric.source === "bizperf" && metric.sourceField) {
          const overallBizperf = team.bizperf.find(
            (bp) => !bp.segmentId && !bp.productId
          );
          if (overallBizperf) {
            const value =
              overallBizperf.customFields?.[
                metric.sourceField as keyof typeof overallBizperf.customFields
              ] ||
              (overallBizperf[
                metric.sourceField as keyof typeof overallBizperf
              ] as number);

            if (value !== undefined && !isNaN(value)) {
              hasDirectOverallValue = true;
              directValue = value;
            }
          }
        }

        if (hasDirectOverallValue) {
          overallMetrics[metric.key] = directValue;
          if (metric.key === "revenue")
            overallLegacyMetrics.revenue = directValue;
          if (metric.key === "profit")
            overallLegacyMetrics.profit = directValue;
          if (metric.key === "csat") overallLegacyMetrics.csat = directValue;
          if (metric.key === "esat") overallLegacyMetrics.esat = directValue;
        } else if (metric.aggregationType === "sum") {
          const sum = winningMetrics
            .filter((wm) => !!wm.segmentId)
            .reduce((acc, wm) => {
              const value =
                wm.metrics?.[metric.key] ||
                (wm[metric.key as keyof typeof wm] as number) ||
                0;
              return acc + value;
            }, 0);
          overallMetrics[metric.key] = sum;
          // Also populate legacy fields
          if (metric.key === "revenue") overallLegacyMetrics.revenue = sum;
          if (metric.key === "profit") overallLegacyMetrics.profit = sum;
        } else if (metric.aggregationType === "average") {
          const segmentValues = winningMetrics
            .filter((wm) => !!wm.segmentId)
            .map((wm) =>
              wm.metrics?.[metric.key] !== undefined
                ? wm.metrics?.[metric.key]
                : (wm[metric.key as keyof typeof wm] as number) !== undefined
                  ? (wm[metric.key as keyof typeof wm] as number)
                  : undefined
            )
            .filter((v) => v !== undefined) as number[];
          const avg =
            segmentValues.length > 0
              ? segmentValues.reduce((acc, val) => acc + val, 0) /
                segmentValues.length
              : 0;
          overallMetrics[metric.key] = avg;
          // Also populate legacy fields
          if (metric.key === "csat") overallLegacyMetrics.csat = avg;
          if (metric.key === "esat") overallLegacyMetrics.esat = avg;
        }
      });

      const overallWinningMetrics: WinningMetricsUnderTeamInterface = {
        segmentId: undefined,
        metrics: overallMetrics,
        ...overallLegacyMetrics,
      };

      winningMetrics.push(overallWinningMetrics);

      team.winningMetric = [...winningMetrics];
    });

    const scoresForAllTeams = calculateScoresForAllTeams({
      overallTeams: endResult.teams,
      roundNumber,
      prevRoundResult,
      winningMetricsConfig,
    });

    endResult.teams.forEach((team, index) => {
      const scoreData = scoresForAllTeams[index];

      team.score = {
        metrics: scoreData.metrics,
        cumulativeMetrics: scoreData.cumulativeMetrics,
        tiebreaker: scoreData.tiebreaker,
        // Legacy fields for backward compatibility
        rap: scoreData.rap,
        csat: scoreData.csat,
        esat: scoreData.esat,
        revenue: scoreData.revenue,
        cumulativeRAP: scoreData.cumulativeRAP,
        cumulativeCSAT: scoreData.cumulativeCSAT,
        cumulativeESAT: scoreData.cumulativeESAT,
        cumulativeRevenue: scoreData.cumulativeRevenue,
      };
    });

    const result = new Result(endResult);

    await result.save({ session });
  } catch (error) {
    console.log("error", error);

    throw error;
  }
}

// Get all simulations with pagination and filtering
export const getAllSimulations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const role = user.role;

    const fieldsAvailableForSearch = ["simulationName"];

    const overriddenReq = req as any;

    if (role === "client") {
      overriddenReq.query.ownerId = user.userId;
    }

    const { page, skip, limit, sortField, sortOrder, filters } =
      getPaginationQuery(overriddenReq, {
        fieldsAvailableForSearch,
      });

    // Process custom filters
    const processedFilters: any = { ...filters };

    // Handle currentRound filter (config.currRounds)
    if (processedFilters.currentRound !== undefined) {
      const currentRound = parseInt(
        processedFilters.currentRound as string,
        10
      );
      if (!isNaN(currentRound)) {
        processedFilters["config.currRounds"] = currentRound;
      }
      delete processedFilters.currentRound;
    }

    // Handle totalRounds filter (config.totalRounds)
    if (processedFilters.totalRounds !== undefined) {
      const totalRounds = parseInt(processedFilters.totalRounds as string, 10);
      if (!isNaN(totalRounds)) {
        processedFilters["config.totalRounds"] = totalRounds;
      }
      delete processedFilters.totalRounds;
    }

    // Handle dateCreated filter (createdAt date ranges)
    if (processedFilters.dateCreated !== undefined) {
      const dateCreated = processedFilters.dateCreated as string;
      const now = new Date();
      let startDate: Date;

      switch (dateCreated) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;
        case "last7days":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last30days":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "last3months":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 3,
            now.getDate()
          );
          break;
        case "last6months":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 6,
            now.getDate()
          );
          break;
        case "last9months":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 9,
            now.getDate()
          );
          break;
        case "last1year":
          startDate = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate()
          );
          break;
        default:
          startDate = new Date(0); // Default to beginning of time
      }

      processedFilters.createdAt = { $gte: startDate };
      delete processedFilters.dateCreated;
    }

    // Build sort object - handle nested fields with dot notation
    let sortObject: any = {};
    if (sortField && sortOrder) {
      // Convert sortOrder to MongoDB format (1 for asc, -1 for desc)
      const mongoSortOrder =
        sortOrder === "asc" || sortOrder === "ascending" ? 1 : -1;
      sortObject[sortField] = mongoSortOrder;
    }

    const simulations = await Simulation.find(processedFilters)
      .skip(skip)
      .limit(limit)
      .sort(sortObject)
      .lean();
    const totalCount = await Simulation.countDocuments(processedFilters);

    // Get last round end date for each simulation
    const simulationsWithLastRoundEnd = await Promise.all(
      simulations.map(async (sim) => {
        let lastRoundEndAt: Date | null = null;

        // Only set lastRoundEndAt if simulation is completed
        // and currRounds equals totalRounds (meaning we're at the last round)
        if (
          sim.status === "Completed" &&
          sim.config?.currRounds === sim.config?.totalRounds
        ) {
          // Find the last round (roundNumber equals totalRounds)
          const lastRound = await Round.findOne({
            simulationId: sim._id,
            roundNumber: sim.config.totalRounds,
            status: "Completed",
          })
            .select("completedAt")
            .lean();

          // Use the round's completedAt, or fall back to simulation's endDate
          lastRoundEndAt =
            lastRound?.completedAt ||
            (sim.endDate ? new Date(sim.endDate) : null);
        }

        const teamCount = await Team.countDocuments({ simulationId: sim._id });

        return {
          ...sim,
          lastRoundEndAt,
          teamCount,
        };
      })
    );

    res.status(200).json({
      simulations: simulationsWithLastRoundEnd,
      data: simulationsWithLastRoundEnd,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    next(err); // Pass the error to Express error handler
  }
};

// Create a new simulation
export const createSimulation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const simulationData = req.body;
    const user = (req as any).user;

    // Check for duplicate simulationName
    const existingSimulation = await Simulation.findOne({
      simulationName: simulationData.simulationName,
    });

    if (existingSimulation) {
      res.status(400).json({ error: "Simulation name already exists" });
      return;
    }

    // Start a session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // default to start first round immediately
      // const immediatelyStartFirstRound =
      //   typeof simulationData.immediatelyStartFirstRound === "boolean"
      //     ? simulationData.immediatelyStartFirstRound
      //     : true;

      const immediatelyStartFirstRound = false;

      // Create and save the new simulation
      const newSimulation = new Simulation({
        ...simulationData,
        simulationTypeId: new mongoose.Types.ObjectId(
          simulationData.simulationTypeId
        ),
        status: "Active",
        activeSegments: simulationData.selectedSegments.map(
          (segment: string) => new mongoose.Types.ObjectId(segment)
        ),
        activeProducts: simulationData.selectedProducts.map(
          (product: string) => new mongoose.Types.ObjectId(product)
        ),
        config: {
          totalRounds: simulationData.config.totalRounds,
          currRounds: immediatelyStartFirstRound ? 1 : 0,
        },
        ownerId: user.role === "client" ? user._id : null,
      });
      const savedSimulation = await newSimulation.save({ session });

      // Create rounds based on the totalRounds
      for (let i = 0; i <= simulationData.config.totalRounds; i++) {
        const roundData = {
          simulationId: savedSimulation._id,
          roundNumber: i,
          status: i === 0 ? "Active" : "Pending",
          startedAt: i === 0 ? new Date() : null,
        };
        const newRound = new Round(roundData);
        await newRound.save({ session });
      }

      // Create teams if payload field of team is provided
      if (
        simulationData.config?.teams &&
        Array.isArray(simulationData.config.teams)
      ) {
        for (let i = 0; i < simulationData.config.teams.length; i++) {
          const teamData = {
            simulationId: savedSimulation._id,
            teamName: simulationData.config.teams[i].teamName,
            marketShare: 0,
            score: 0,
            teamLeader: simulationData.config.teams[i].teamLeader,
          };
          const newTeam = new Team(teamData);
          await newTeam.save({ session });

          const randomPassKey = generateSlug(2, {
            format: "kebab",
            partsOfSpeech: ["adjective", "noun"],
          });

          // Create a user with team role without email and password, but with passkey
          const userData = {
            role: "team",
            passkey: randomPassKey, // Generate a unique static passkey for each team user, renamed as passkey
            teamId: newTeam._id,
          };
          const newUser = new User(userData);
          await newUser.save({ session });
        }
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // After all rounds are created, send the response
      res.status(201).json(savedSimulation);
    } catch (err) {
      // Abort the transaction on error
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  } catch (err) {
    next(err);
  }
};

export const createSimulationWithDecisions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationData, decisionData, decisionsByRound } = req.body;
    const user = (req as any).user;

    // Check for duplicate simulationName
    const existingSimulation = await Simulation.findOne({
      simulationName: simulationData.simulationName,
    });

    if (existingSimulation) {
      res.status(400).json({ error: "Simulation name already exists" });
      return;
    }

    // Start a session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create and save the new simulation
      const newSimulation = new Simulation({
        ...simulationData,
        simulationTypeId: new mongoose.Types.ObjectId(
          simulationData.simulationTypeId
        ),
        status: "Active",
        activeSegments: simulationData.selectedSegments.map(
          (segment: string) => new mongoose.Types.ObjectId(segment)
        ),
        activeProducts: simulationData.selectedProducts.map(
          (product: string) => new mongoose.Types.ObjectId(product)
        ),
        config: {
          totalRounds: simulationData.config.totalRounds,
          currRounds: 1, // Start at round 1 (pending)
          hideUnselectedSegmentsProducts:
            !!simulationData.config?.hideUnselectedSegmentsProducts,
        },
        ownerId: user.role === "client" ? user._id : null,
      });
      const savedSimulation = await newSimulation.save({ session });

      // Get offset to determine the starting round
      const simTypeObj = await SimulationType.findById(
        simulationData.simulationTypeId
      ).lean();
      const offset = simTypeObj?.comparisonRoundOffset ?? 1;
      const startRoundForCreation = Math.min(0, 1 - offset);

      // Create rounds based on the totalRounds
      // Offset rounds (e.g., -1, 0): Completed (for predefined decisions)
      // Round 1: Pending (current round)
      // Rounds 2+: Pending
      for (
        let i = startRoundForCreation;
        i <= simulationData.config.totalRounds;
        i++
      ) {
        const roundData = {
          simulationId: savedSimulation._id,
          roundNumber: i,
          status: i <= 0 ? "Completed" : i === 1 ? "Pending" : "Pending",
          startedAt: i <= 0 ? new Date() : null,
          completedAt: i <= 0 ? new Date() : null,
        };
        const newRound = new Round(roundData);
        await newRound.save({ session });
      }

      // Create teams and team users
      const createdTeams: any[] = [];
      if (
        simulationData.config?.teams &&
        Array.isArray(simulationData.config.teams)
      ) {
        for (let i = 0; i < simulationData.config.teams.length; i++) {
          const teamData = {
            simulationId: savedSimulation._id,
            teamName: simulationData.config.teams[i].teamName,
            marketShare: 0,
            score: 0,
            teamLeader: simulationData.config.teams[i].teamLeader,
          };
          const newTeam = new Team(teamData);
          const savedTeam = await newTeam.save({ session });
          createdTeams.push(savedTeam);

          const randomPassKey = generateSlug(2, {
            format: "kebab",
            partsOfSpeech: ["adjective", "noun"],
          });

          // Create a user with team role without email and password, but with passkey
          const userData = {
            role: "team",
            passkey: randomPassKey,
            teamId: newTeam._id,
          };
          const newUser = new User(userData);
          await newUser.save({ session });
        }
      }

      // Create predefined decisions for past rounds and round 0 for all teams
      if (createdTeams.length > 0) {
        // Fetch required data for decision creation
        const simulation = await Simulation.findById(savedSimulation._id)
          .populate("simulationType")
          .populate("activeSegmentsDetailed")
          .populate("activeProductsDetailed")
          .session(session);

        if (!simulation) {
          throw new Error("Simulation not found after creation");
        }

        const productsInSimulation = await Product.find({
          simulationTypeId: simulation.simulationTypeId,
        }).session(session);

        const baseData = await BaseData.findOne({
          simulationTypeId: simulation.simulationTypeId,
        }).session(session);

        const defaultMarketShare = 1 / createdTeams.length;

        for (let r = startRoundForCreation; r <= 0; r++) {
          // Determine the decision data for this specific round
          // 1. Check decisionsByRound[r]
          // 2. If r == 0, check decisionData (legacy)
          // 3. Fallback to simulationType.pastData[year == r]
          let roundDecisionData =
            decisionsByRound && decisionsByRound[r]
              ? decisionsByRound[r]
              : r === 0 && decisionData
                ? decisionData
                : null;

          // If no specific override, try to pull from pastData
          if (!roundDecisionData && simulation.simulationType?.pastData) {
            const pastYearData = (
              simulation.simulationType.pastData as any[]
            ).find((p: any) => p.year === r);
            if (pastYearData) {
              roundDecisionData = {
                decisionDetails: pastYearData.productData,
                segmentDecisionDetails: pastYearData.segmentData,
                globalDecisionDetails: pastYearData.globalData.map(
                  (g: any) => ({
                    globalInputId: g.globalInputId,
                    key: g.key,
                    value: g.value,
                    selected: true,
                  })
                ),
              };
            }
          }

          if (!roundDecisionData) {
            if (r === 0) {
              console.warn(
                `No decision data found for round 0 of simulation ${savedSimulation._id}`
              );
            }
            continue;
          }

          // Create decisions for all teams for round r
          for (const team of createdTeams) {
            const transformedGlobalDecisionDetails = (
              roundDecisionData.globalDecisionDetails || []
            ).map((detail: any) => ({
              globalInputId: new mongoose.Types.ObjectId(detail.globalInputId),
              key: detail.key,
              value: detail.value,
              selected: detail.selected ?? true,
            }));

            const newDecision = new Decision({
              simulationId: savedSimulation._id,
              teamId: team._id,
              roundNumber: r,
              decisionDetails: (roundDecisionData.decisionDetails || [])
                .filter((decDet: any) =>
                  productsInSimulation.find((p) =>
                    p._id.equals(decDet.productId)
                  )
                )
                .map((d: any) => {
                  const productId = new mongoose.Types.ObjectId(d.productId);
                  const product = productsInSimulation.find((p) =>
                    p._id.equals(productId)
                  );

                  let isUnlocked = true;
                  const unlockRequested = d.unlockRequested || false;

                  if (product) {
                    const hasPrerequisites =
                      product.unlockPrerequisites &&
                      product.unlockPrerequisites.length > 0;

                    if (hasPrerequisites) {
                      isUnlocked = false;
                      if (d.isUnlocked !== undefined) {
                        isUnlocked = d.isUnlocked;
                      }
                    }
                  }

                  const mappedFields = (d.fields || []).map((f: any) => {
                    if (f.key === "campaign_type_complex" && f.complexValues) {
                      const uniqueOptionKeys = Array.from(
                        new Set(f.complexValues.map((cv: any) => cv.optionKey))
                      );

                      const newComplexValues = [...f.complexValues];
                      uniqueOptionKeys.forEach((optionKey) => {
                        const hasAnchor = f.complexValues.some(
                          (cv: any) =>
                            cv.optionKey === optionKey &&
                            cv.tab !== "incentive" &&
                            cv.tab !== "channel" &&
                            cv.tab !== "set_your_tenant_strategy"
                        );

                        if (!hasAnchor) {
                          newComplexValues.push({
                            optionKey,
                            tab: "campaign",
                            itemKey: optionKey,
                            value: 0,
                          });
                        }
                      });

                      return {
                        ...f,
                        complexValues: newComplexValues,
                        value:
                          f.key === "projected_market_share"
                            ? defaultMarketShare
                            : f.value,
                      };
                    }

                    return {
                      ...f,
                      value:
                        f.key === "projected_market_share"
                          ? defaultMarketShare
                          : f.value,
                    };
                  });

                  if (product && baseData) {
                    calculateReadonlyFields({
                      product,
                      mappedFields,
                      prevRoundDecision: null, // No prev round decision during initial creation
                      baseData,
                      simulationRound: r,
                    });
                  }

                  return {
                    ...d,
                    productId,
                    segmentId: new mongoose.Types.ObjectId(d.segmentId),
                    fields: mappedFields,
                    unlockRequested,
                    isUnlocked,
                  };
                }),
              segmentDecisionDetails: (
                roundDecisionData.segmentDecisionDetails || []
              ).map((d: any) => ({
                segmentId: new mongoose.Types.ObjectId(d.segmentId),
                fields: (d.fields || []).map((f: any) => ({
                  key: f.key,
                  value: f.value,
                  textValue: f.textValue,
                })),
              })),
              globalDecisionDetails: transformedGlobalDecisionDetails,
              eventDecisions: [],
            });

            await newDecision.save({ session });
          }

          // Generate result for round r using decisions
          await processCalculations({
            simulationId: savedSimulation._id.toString(),
            simulationTypeId: simulation.simulationTypeId.toString(),
            simulationTypeName: simulation.simulationType.name,
            roundNumber: r,
            session,
            activeSegments: simulation.activeSegmentsDetailed || [],
            activeProducts: simulation.activeProductsDetailed || [],
          });
        }

        // Seed round 1 baseline by duplicating round 0 decisions
        await duplicateDecisionForAllTeams({
          simulationId: savedSimulation._id.toString(),
          session,
          nextRoundNumber: 1,
        });
      }

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Fetch the complete simulation to return
      const completeSimulation = await Simulation.findById(savedSimulation._id)
        .populate("simulationType")
        .populate("activeSegmentsDetailed")
        .populate("activeProductsDetailed")
        .lean();

      res.status(201).json(completeSimulation);
    } catch (err) {
      // Abort the transaction on error
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  } catch (err) {
    next(err);
  }
};

// Get a simulation by simulationName
export const getSimulationByName = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationNameOrSimulationId } = req.params;
    const { withTeams } = req.query;

    const user = (req as any).user;

    let simulation: any;

    if (mongoose.Types.ObjectId.isValid(simulationNameOrSimulationId)) {
      simulation = await Simulation.findOne({
        _id: simulationNameOrSimulationId,
        ownerId:
          user.role === "client"
            ? new mongoose.Types.ObjectId(user._id)
            : undefined,
      })
        .populate({
          path: "simulationType",
          model: "SimulationType",
          populate: [
            {
              path: "segments",
              model: "Segment",
              options: {
                sort: { order: 1 },
              },
              // match: {}, // optional filtering
            },
            {
              path: "globalInputs",
              model: "GlobalInput",
              options: {
                sort: { order: 1 },
              },
            },
          ],
        })
        .populate({
          path: "activeSegmentsDetailed",
          model: "Segment",
        })
        .populate({
          path: "activeProductsDetailed",
          model: "Product",
        })
        .lean();

      if (simulation && simulation.simulationType) {
        const baseData = await BaseData.findOne({
          simulationTypeId: simulation.simulationTypeId,
        }).lean();
        if (baseData) {
          simulation.simulationType.baseData = baseData;
        }
      }
    } else {
      simulation = await Simulation.aggregate([
        {
          $match: {
            simulationName: simulationNameOrSimulationId,
            ownerId:
              user.role === "client"
                ? new mongoose.Types.ObjectId(user._id)
                : undefined,
          },
        },
        {
          $lookup: {
            from: "SimulationType",
            let: { simulationTypeId: "$simulationTypeId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$simulationTypeId"] } } },
              {
                $lookup: {
                  from: "segments",
                  let: { simulationTypeId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ["$simulationTypeId", "$$simulationTypeId"],
                        },
                      },
                    },
                    {
                      $sort: { order: 1 },
                    },
                  ],
                  as: "segments",
                },
              },
            ],
            as: "simulationType",
          },
        },
        { $unwind: "$simulationType" },
      ])
        .then((res) => res[0])
        .catch((err) => console.error(err));
    }

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    if (withTeams === "true") {
      const teams = await Team.find({ simulationId: simulation._id }).lean();

      const teamIds = teams.map((team) => team._id);

      const users = await User.find({ teamId: { $in: teamIds } });

      const usersWithTeams = users.map((user) => {
        const userTeam = teams.find(
          (team) => team._id.toString() === user.teamId.toString()
        );

        return {
          ...user.toObject(), // Convert Mongoose document to plain object
          team: userTeam || null, // Attach team or null if not found
        };
      });

      usersWithTeams.sort((a, b) => {
        const teamIdA = a.team?._id?.toString() || "";
        const teamIdB = b.team?._id?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });

      simulation.teams = usersWithTeams;
    }

    if (req.query.withCurrentRound === "true") {
      const currentRound = await Round.findOne({
        simulationId: simulation._id,
        roundNumber: simulation.config.currRounds,
      })
        .populate("event eventsTriggered.event")
        .lean();

      if (currentRound) {
        simulation.currentRound = currentRound;
      } else {
        simulation.currentRound = null;
      }
    }

    res.status(200).json(simulation);
  } catch (err) {
    next(err);
  }
};

// Delete a simulation by simulationName
export const deleteSimulation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { simulationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(simulationId)) {
      res.status(400).json({ error: "Invalid simulationId" });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const simulation = await Simulation.findById(simulationId).session(session);

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const teams = await Team.find({ simulationId }).session(session);
    const teamIds = teams.map((team) => team._id);

    // Hard delete everything related to the simulation
    await Decision.deleteMany({ simulationId }).session(session);
    await Projection.deleteMany({ simulationId }).session(session);
    await Result.deleteMany({ simulationId }).session(session);
    await Round.deleteMany({ simulationId }).session(session);

    // Delete users associated with the teams
    await User.deleteMany({ teamId: { $in: teamIds } }).session(session);

    // Delete teams
    await Team.deleteMany({ simulationId }).session(session);

    // Finally, delete the simulation record
    await Simulation.findByIdAndDelete(simulationId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Simulation and all related data deleted successfully",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

const duplicateDecisionForAllTeams = async ({
  simulationId,
  session,
  nextRoundNumber,
}: {
  simulationId: string;
  session: mongoose.ClientSession;
  nextRoundNumber: number;
}) => {
  const teams = await Team.find({
    simulationId: new mongoose.Types.ObjectId(simulationId),
  });

  const simulation = await Simulation.findById(simulationId).lean();

  const products = await Product.find({
    simulationTypeId: simulation?.simulationTypeId,
  });

  const segments = await Segment.find({
    simulationTypeId: simulation?.simulationTypeId,
  });

  const baseData = await BaseData.findOne({
    simulationTypeId: simulation?.simulationTypeId,
  });

  for (const team of teams) {
    const decision = await Decision.findOne({
      simulationId: new mongoose.Types.ObjectId(simulationId),
      teamId: team._id,
      roundNumber: nextRoundNumber - 1,
    })
      .sort({ createdAt: -1 }) // Get the latest decision for the previous round
      .lean();

    if (decision) {
      const decisionToPass = {
        ...decision,
        decisionDetails: decision.decisionDetails.map((pd) => {
          const mappedFields = pd.fields.map((f) => {
            const isComplexCheckbox =
              products
                .find((p) => p._id.toString() === pd.productId.toString())
                ?.fields.find((pf) => pf.key === f.key)?.type ===
              "complex-checkbox";

            // If it's a complex checkbox, or if it has complexValues, we should probably reset complexValues
            if (isComplexCheckbox) {
              return {
                ...f,
                complexValues: [],
                value: 0,
              };
            }

            return {
              ...f,
              value: (
                products
                  .find((p) => p._id.toString() === pd.productId.toString())
                  ?.fields.find((pf) => pf.key === f.key) as any
              )?.resetEachRound
                ? 0
                : f.value,
            };
          });

          const product = products.find(
            (p) => p._id.toString() === pd.productId.toString()
          );

          if (product && baseData) {
            calculateReadonlyFields({
              product,
              mappedFields,
              prevRoundDecision: decision,
              baseData,
              simulationRound: nextRoundNumber,
            });
          }

          return {
            ...pd,
            fields: mappedFields,
          };
        }),
        segmentDecisionDetails: decision.segmentDecisionDetails.map((sd) => ({
          ...sd,
          fields: sd.fields.map((f) => {
            const isComplexCheckbox =
              (
                segments
                  .find((s) => s._id.toString() === sd.segmentId.toString())
                  ?.fields.find((sf) => sf.key === f.key) as any
              )?.type === "complex-checkbox";

            if (isComplexCheckbox) {
              return {
                ...f,
                complexValues: [],
                value: 0,
              };
            }

            return {
              ...f,
              value: segments
                .find((s) => s._id.toString() === sd.segmentId.toString())
                ?.fields.find((sf) => sf.key === f.key)?.resetEachRound
                ? 0
                : f.value,
            };
          }),
        })),
        globalDecisionDetails: decision.globalDecisionDetails.map((gd) => ({
          ...gd,
          selected: false,
          selectedInPreviousRounds:
            gd.selectedInPreviousRounds || gd.selected || false,
        })),
        roundNumber: nextRoundNumber,
        createdAt: undefined,
        updatedAt: undefined,
        _id: undefined,
      };

      const newDecision = new Decision({
        ...decisionToPass,
        eventDecisions: [],
      });

      await newDecision.save({ session });
    }
  }
};

export const endCurrentRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;
    const { isImmediatelyStartingNextRound } = req.body;
    const user = (req as any).user;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      status: "Active",
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    })
      .populate({
        path: "activeSegmentsDetailed",
        model: "Segment",
      })
      .populate({
        path: "activeProductsDetailed",
        model: "Product",
      })
      .populate({
        path: "simulationType",
        model: "SimulationType",
      });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found or not active" });

      return;
    }

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: simulation.config.currRounds,
    });

    if (!currentRound || currentRound.status !== "Active") {
      res.status(400).json({ error: "Current round is not active" });

      return;
    }

    const session = await mongoose.startSession({
      defaultTransactionOptions: { maxTimeMS: 10 * 60 * 1000 },
    });
    session.startTransaction();

    try {
      await Round.findOneAndUpdate(
        { _id: currentRound._id },
        { status: "Completed", completedAt: new Date() },
        { session }
      );

      if (simulation.config.currRounds === simulation.config.totalRounds) {
        await Simulation.findOneAndUpdate(
          { _id: simulation._id },
          { status: "Completed" },
          { session }
        );
      } else if (!!isImmediatelyStartingNextRound) {
        await Simulation.findOneAndUpdate(
          { _id: simulation._id },
          { $set: { "config.currRounds": simulation.config.currRounds + 1 } },
          { session }
        );
      }

      await processCalculations({
        simulationId,
        simulationTypeName: simulation.simulationType.name,
        simulationTypeId: simulation.simulationTypeId.toString(),
        roundNumber: currentRound.roundNumber,
        session,
        activeSegments: simulation.activeSegmentsDetailed || [],
        activeProducts: simulation.activeProductsDetailed || [],
      });

      if (simulation.config.currRounds < simulation.config.totalRounds) {
      }

      await session.commitTransaction();
    } catch (error) {
      console.log("error", error);

      await session.abortTransaction();

      throw error;
    } finally {
      session.endSession();
    }

    const io = getSocket();

    io.emit("roundCompleted", {
      simulationId: simulationId,
      roundId: currentRound._id,
      isLastRound:
        simulation.config.currRounds === simulation.config.totalRounds,
    });

    res.status(200).json({ message: "Current round completed (ended)" });
  } catch (err) {
    next(err);
  }
};

export const goToNextRoundWithoutStarting = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;
    const user = (req as any).user;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      status: "Active",
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });

      return;
    }

    const currentRoundNumber = simulation.config.currRounds;

    const oldRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: currentRoundNumber,
    });

    if (!oldRound) {
      res.status(400).json({ error: "Current round is not active" });

      return;
    }

    const totalRounds = simulation.config.totalRounds;

    if (currentRoundNumber === totalRounds) {
      res.status(400).json({
        error: "Cannot go to next round, it's already the last round",
      });

      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updatedSimulation = await Simulation.findByIdAndUpdate(
        new mongoose.Types.ObjectId(simulationId),
        { $set: { "config.currRounds": currentRoundNumber + 1 } },
        { session, new: true }
      ).lean();

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();

      throw error;
    } finally {
      session.endSession();
    }

    const io = getSocket();

    io.emit("roundPending", {
      simulationId: simulationId,
      oldRoundId: oldRound._id,
      notes: "Simulation has moved to next round but still pending",
    });

    res.status(200).json({ message: "Arrived at next round" });
  } catch (err) {
    next(err);
  }
};

export const startCurrentRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;
    const user = (req as any).user;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      status: "Active",
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });

      return;
    }

    const currentRoundNumber = simulation.config.currRounds;
    const totalRounds = simulation.config.totalRounds;

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: currentRoundNumber,
    });

    if (!currentRound || currentRound.status !== "Pending") {
      res.status(400).json({ error: "Current round is not pending" });

      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Round.updateOne(
        { simulationId: simulation._id, roundNumber: currentRoundNumber },
        {
          $set: {
            status: "Active",
            startedAt: new Date(),
          },
        },
        { session }
      );

      await duplicateDecisionForAllTeams({
        simulationId,
        session,
        nextRoundNumber: currentRoundNumber,
      });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();

      throw error;
    } finally {
      session.endSession();
    }

    const io = getSocket();

    io.emit("roundStarted", {
      simulationId: simulationId,
      roundId: currentRound._id,
      stateMovement: "pendingToActive",
      notes: "Current round has started",
    });

    res.status(200).json({ message: "Next round started" });
  } catch (err) {
    next(err);
  }
};

export const startNextRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;
    const user = (req as any).user;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      status: "Active",
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });

      return;
    }

    const currentRoundNumber = simulation.config.currRounds;
    const totalRounds = simulation.config.totalRounds;

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: currentRoundNumber,
    });

    if (!currentRound) {
      res.status(400).json({ error: "Current round not found" });

      return;
    }

    if (
      currentRoundNumber !== 0 &&
      (!currentRound || currentRound.status !== "Completed")
    ) {
      res.status(400).json({ error: "Current round is not yet completed" });

      return;
    }

    if (currentRoundNumber === totalRounds) {
      res.status(400).json({
        error: "Cannot start next round, simulation is already completed",
      });

      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      simulation.config.currRounds = currentRoundNumber + 1;
      await simulation.save({ session });

      await Round.findOneAndUpdate(
        { simulationId: simulation._id, roundNumber: currentRoundNumber + 1 },
        { status: "Active", startedAt: new Date() },
        { session }
      );

      await duplicateDecisionForAllTeams({
        simulationId,
        session,
        nextRoundNumber: currentRoundNumber + 1,
      });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();

      throw error;
    } finally {
      session.endSession();
    }

    const io = getSocket();

    io.emit("roundStarted", {
      simulationId: simulationId,
      oldRoundId: currentRound._id,
      stateMovement: "completedToActive",
      notes: "Simulation has moved to next round and it is started",
    });

    res.status(200).json({ message: "Next round started" });
  } catch (err) {
    next(err);
  }
};

export const getSimulationProjections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    const { simulationId } = req.params;
    const { roundNumber } = req.query;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    // Query to find teams in the simulation
    const teams = await Team.find(
      ["admin", "operator", "client"].includes(user.role)
        ? { simulationId }
        : { simulationId, _id: user.teamId }
    );

    if (!teams || teams.length === 0) {
      res.status(404).json({
        error: "No teams found for the specified simulation.",
        name: "NotFoundError",
      });
      return;
    }

    // Query to find the latest projections for each team
    const projections = await Promise.all(
      teams.map(async (team) => {
        const teamProjections = await Projection.find({
          simulationId,
          teamId: team._id,
          ...(roundNumber && { roundNumber }),
        })
          .populate("decision")
          .sort({ createdAt: -1 })
          .limit(1)
          .lean(); // Get the latest projection
        return { ...(teamProjections[0] || {}), team }; // Return the latest projection
      })
    );

    res.status(200).json({ projections });
  } catch (err) {
    next(err);
  }
};

export const getSimulationWinningMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    const { simulationId } = req.params;
    const { roundNumber } = req.query;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    // Query to find teams in the simulation
    const teams = await Team.find(
      ["admin", "operator", "client"].includes(user.role)
        ? { simulationId }
        : { simulationId, _id: user.teamId }
    );

    if (!teams || teams.length === 0) {
      res.status(404).json({
        error: "No teams found for the specified simulation.",
        name: "NotFoundError",
      });
      return;
    }

    teams.sort((a, b) => {
      const teamIdA = a._id?.toString() || "";
      const teamIdB = b._id?.toString() || "";
      return teamIdA.localeCompare(teamIdB);
    });

    // Query to find the latest projections for each team
    const projections = await Promise.all(
      teams.map(async (team) => {
        const teamProjections = await Projection.find({
          simulationId,
          teamId: team._id,
          ...(roundNumber && { roundNumber }),
        })
          // .populate("decision")
          .sort({ createdAt: -1 })
          .limit(1)
          .lean(); // Get the latest projection
        return { ...(teamProjections[0] || {}), team }; // Return the latest projection
      })
    );

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    ).lean();
    const winningMetricsConfig = simulationType?.winningMetrics || null;

    const result = await Result.findOne({
      simulationId: simulationId,
      roundNumber: roundNumber ? parseInt(roundNumber.toString()) - 1 : 0,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Use default metrics if no config is provided (backward compatibility)
    const useDefaultMetrics =
      !winningMetricsConfig || winningMetricsConfig.length === 0;
    const metricsToCalculate = useDefaultMetrics
      ? [
          {
            key: "revenue",
            source: "pnl" as const,
            sourceField: "Total Revenue",
            aggregationType: "sum" as const,
          },
          {
            key: "profit",
            source: "pnl" as const,
            sourceField: "Risk Adjusted Profit",
            aggregationType: "sum" as const,
          },
          {
            key: "csat",
            source: "csat" as const,
            aggregationType: "average" as const,
          },
          {
            key: "esat",
            source: "esat" as const,
            aggregationType: "average" as const,
          },
        ]
      : winningMetricsConfig;

    const winningMetrics = teams.map((team) => {
      const teamId = team._id.toString();

      const teamProjection = projections.find(
        (p) => p.team._id.toString() === teamId
      );
      const pnl = teamProjection?.pnl || [];
      const resultTeam = result?.teams.find(
        (t) => t.teamId.toString() === teamId
      );

      const dynamicMetrics: Record<string, number> = {};
      const legacyMetrics: {
        revenue?: number;
        profit?: number;
        csat?: number;
        esat?: number;
      } = {};

      metricsToCalculate.forEach((metric) => {
        if (metric.source === "pnl" && metric.sourceField) {
          const getFromMapOrObj = (mapOrObj: any, key: string): number => {
            if (!mapOrObj) return 0;
            if (mapOrObj instanceof Map)
              return (mapOrObj.get(key) as number) || 0;
            return (mapOrObj[key] as number) || 0;
          };
          const value = pnl
            .filter((p) => p.segmentId && p.productId)
            .reduce((acc, curr) => {
              const fieldValue =
                getFromMapOrObj(
                  curr?.customFields,
                  metric.sourceField as string
                ) ||
                (curr[metric.sourceField as keyof typeof curr] as number) ||
                0;
              return acc + fieldValue;
            }, 0);
          dynamicMetrics[metric.key] = value;
          // Also populate legacy fields for backward compatibility
          if (metric.key === "revenue") legacyMetrics.revenue = value;
          if (metric.key === "profit") legacyMetrics.profit = value;
        } else if (metric.source === "bizperf" && metric.sourceField) {
          const getFromMapOrObj = (mapOrObj: any, key: string): number => {
            if (!mapOrObj) return 0;
            if (mapOrObj instanceof Map)
              return (mapOrObj.get(key) as number) || 0;
            return (mapOrObj[key] as number) || 0;
          };
          const bizperf = teamProjection?.bizperf || [];

          const value = bizperf
            .filter((b) => b.segmentId && b.productId)
            .reduce((acc, curr) => {
              const fieldValue =
                getFromMapOrObj(
                  curr?.customFields,
                  metric.sourceField as string
                ) ||
                (curr[metric.sourceField as keyof typeof curr] as number) ||
                0;
              return acc + fieldValue;
            }, 0);
          dynamicMetrics[metric.key] = value;
        } else if (metric.source === "csat") {
          const csat =
            resultTeam?.csat.reduce((acc, curr, index, arr) => {
              if (index === arr.length - 1) {
                return (
                  (acc + curr.closing) /
                  (arr.filter((a) => !!a.segmentId && !!a.closing).length || 1)
                );
              }
              return acc + curr.closing;
            }, 0) || 0;
          dynamicMetrics[metric.key] = csat;
          legacyMetrics.csat = csat;
        } else if (metric.source === "esat") {
          const esat =
            resultTeam?.esat.reduce((acc, curr, index, arr) => {
              if (index === arr.length - 1) {
                return (
                  (acc + curr.closing) /
                  (arr.filter((a) => !!a.segmentId && !!a.closing).length || 1)
                );
              }
              return acc + curr.closing;
            }, 0) || 0;
          dynamicMetrics[metric.key] = esat;
          legacyMetrics.esat = esat;
        }
      });

      return {
        teamId: team._id,
        teamName: team.teamName,
        winningMetrics: {
          ...dynamicMetrics,
          ...legacyMetrics, // Include legacy fields for backward compatibility
        },
      };
    });

    res.status(200).json({ projections, winningMetrics });
  } catch (err) {
    next(err);
  }
};

export const getSimulationWinningMetricsWithComparison = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;

    const user = (req as any).user;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      status: "Active",
    }).populate({
      path: "activeSegmentsDetailed",
      model: "Segment",
    });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: simulation.config.currRounds,
    });

    if (!currentRound) {
      res.status(404).json({ error: "Current round not found" });
      return;
    }

    const currentRoundProjections = await Projection.findOne({
      simulationId: simulation._id,
      teamId: new mongoose.Types.ObjectId(user.teamId),
      roundNumber: currentRound.roundNumber,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!currentRoundProjections) {
      res.status(404).json({ error: "Current round projections not found" });
      return;
    }

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    ).lean();
    const winningMetricsConfig = simulationType?.winningMetrics || null;

    const offset = simulationType?.comparisonRoundOffset || 1;

    const previousRoundResult = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: currentRound.roundNumber - offset,
    }).sort({ createdAt: -1 });

    const previousPreviousRoundResult = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: currentRound.roundNumber - offset - 1,
    }).sort({ createdAt: -1 });

    const availableSegments = await Segment.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    // Use default metrics if no config is provided (backward compatibility)
    const useDefaultMetrics =
      !winningMetricsConfig || winningMetricsConfig.length === 0;
    const metricsToCalculate = useDefaultMetrics
      ? [
          {
            key: "banking_revenue",
            source: "pnl" as const,
            sourceField: "Total Revenue",
            aggregationType: "sum" as const,
          },
          {
            key: "banking_profit",
            source: "pnl" as const,
            sourceField: "Risk Adjusted Profit",
            aggregationType: "sum" as const,
          },
          {
            key: "csat",
            source: "csat" as const,
            aggregationType: "average" as const,
          },
          {
            key: "esat",
            source: "esat" as const,
            aggregationType: "average" as const,
          },
        ]
      : winningMetricsConfig;

    const segmentMetrics: Array<{
      segmentId?: mongoose.Types.ObjectId;
      [key: string]:
        | {
            value: number;
            previousValue: number;
            changePercentage: number | null;
          }
        | mongoose.Types.ObjectId
        | undefined;
    }> = availableSegments.map((segment) => {
      const currentRoundSegmentPnl = currentRoundProjections.pnl.find(
        (pnl) =>
          pnl.segmentId?.toString() === segment._id.toString() && !pnl.productId
      );
      const currentRoundSegmentBizperf = currentRoundProjections.bizperf?.find(
        (bp: any) =>
          bp.segmentId?.toString() === segment._id.toString() && !bp.productId
      );

      const previousRoundWinningMetric = previousRoundResult?.teams
        .find((t) => t.teamId.toString() === user.teamId.toString())
        ?.winningMetric.find(
          (wm) => wm.segmentId?.toString() === segment._id.toString()
        );

      const previousPreviousRoundWinningMetric =
        previousPreviousRoundResult?.teams
          ?.find((t) => t.teamId.toString() === user.teamId.toString())
          ?.winningMetric.find(
            (wm) => wm.segmentId?.toString() === segment._id.toString()
          );

      const previousRoundMetricsObj =
        previousRoundWinningMetric?.metrics instanceof Map
          ? Object.fromEntries(previousRoundWinningMetric.metrics)
          : previousRoundWinningMetric?.metrics;

      const previousPreviousRoundMetricsObj =
        previousPreviousRoundWinningMetric?.metrics instanceof Map
          ? Object.fromEntries(previousPreviousRoundWinningMetric.metrics)
          : previousPreviousRoundWinningMetric?.metrics;

      const segmentMetricRow: {
        segmentId?: mongoose.Types.ObjectId;
        [key: string]:
          | {
              value: number;
              previousValue: number;
              changePercentage: number | null;
            }
          | mongoose.Types.ObjectId
          | undefined;
      } = {
        segmentId: segment._id,
      };

      // Helper to read from a value that may be a Mongoose Map or plain object after .lean()
      const getFromMapOrObj = (
        mapOrObj:
          | Map<string, number>
          | Record<string, number>
          | undefined
          | null,
        key: string
      ): number => {
        if (!mapOrObj) return 0;
        if (mapOrObj instanceof Map) return (mapOrObj.get(key) as number) || 0;
        return (mapOrObj[key] as number) || 0;
      };

      metricsToCalculate.forEach((metric) => {
        // current value
        let currentValue = 0;
        if (metric.source === "pnl" && metric.sourceField) {
          currentValue =
            getFromMapOrObj(
              currentRoundSegmentPnl?.customFields as any,
              metric.sourceField
            ) ||
            (currentRoundSegmentPnl?.[
              metric.sourceField as keyof typeof currentRoundSegmentPnl
            ] as number) ||
            0;
        } else if (metric.source === "bizperf" && metric.sourceField) {
          currentValue =
            getFromMapOrObj(
              currentRoundSegmentBizperf?.customFields as any,
              metric.sourceField
            ) ||
            (currentRoundSegmentBizperf?.[
              metric.sourceField as keyof typeof currentRoundSegmentBizperf
            ] as number) ||
            0;
        } else if (metric.source === "csat" || metric.source === "esat") {
          currentValue =
            (previousRoundMetricsObj?.[metric.key] as number) ||
            (previousRoundWinningMetric?.[
              metric.key as keyof typeof previousRoundWinningMetric
            ] as number) ||
            0;

          // Legacy behavior: convert csat/esat to percentage in default mode
          if (
            useDefaultMetrics &&
            (metric.key === "csat" || metric.key === "esat")
          ) {
            currentValue = currentValue * 100;
          }
        } else if (metric.source === "custom") {
          currentValue = (previousRoundMetricsObj?.[metric.key] as number) || 0;
        }

        // previous value
        // Use previous round as baseline; fall back to the round before if missing
        let previousValue =
          (previousRoundMetricsObj?.[metric.key] as number) ||
          (previousRoundWinningMetric?.[
            metric.key as keyof typeof previousRoundWinningMetric
          ] as number) ||
          0;

        if (previousValue === 0 && previousPreviousRoundWinningMetric) {
          previousValue =
            (previousPreviousRoundMetricsObj?.[metric.key] as number) ||
            (previousPreviousRoundWinningMetric?.[
              metric.key as keyof typeof previousPreviousRoundWinningMetric
            ] as number) ||
            0;
        }
        if (
          useDefaultMetrics &&
          (metric.key === "csat" || metric.key === "esat")
        ) {
          previousValue = previousValue * 100;
        }

        const changePercentage =
          previousValue === 0
            ? null
            : metric.aggregationType === "average" &&
                (metric.key === "csat" || metric.key === "esat")
              ? (currentValue - previousValue) / 100
              : (currentValue - previousValue) / Math.abs(previousValue);

        segmentMetricRow[metric.key] = {
          value: currentValue,
          previousValue,
          changePercentage,
        };
      });

      return segmentMetricRow;
    });

    // Aggregate overall metrics
    const overallMetricsRow: {
      segmentId: null;
      [key: string]: {
        value: number;
        previousValue: number;
        changePercentage: number | null;
      } | null;
    } = {
      segmentId: null,
    };

    metricsToCalculate.forEach((metric) => {
      const values = segmentMetrics
        .filter((sm) => sm.segmentId)
        .map((sm) => (sm[metric.key] as any)?.value ?? 0);
      const prevValues = segmentMetrics
        .filter((sm) => sm.segmentId)
        .map((sm) => (sm[metric.key] as any)?.previousValue || 0);

      const aggregate = (arr: number[]) =>
        arr.reduce((acc, val) => acc + val, 0);

      // @TODO
      // these currentAgg and prevAgg are not correct, because they are filtering for 0 values
      // this is only hotfix to not wrongly averaging metrics that are not included because product is locked
      const currentAgg =
        metric.aggregationType === "average"
          ? aggregate(values) /
              (values.filter(
                (v) => typeof v === "number" && !isNaN(v) && v !== 0
              ).length || 1) || 0
          : aggregate(values);
      const prevAgg =
        metric.aggregationType === "average"
          ? aggregate(prevValues) /
              (prevValues.filter(
                (v) => typeof v === "number" && !isNaN(v) && v !== 0
              ).length || 1) || 0
          : aggregate(prevValues);

      const changePercentage =
        prevAgg === 0
          ? null
          : metric.aggregationType === "average" &&
              (metric.key === "csat" || metric.key === "esat")
            ? (currentAgg - prevAgg) / 100
            : (currentAgg - prevAgg) / Math.abs(prevAgg);

      overallMetricsRow[metric.key] = {
        value: currentAgg,
        previousValue: prevAgg,
        changePercentage,
      };
    });

    const finalMetrics = [...segmentMetrics, overallMetricsRow];

    res.status(200).json({ data: finalMetrics });
  } catch (err) {
    next(err);
  }
};

export const getSimulationAnalysisByRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.params;
    const user = (req as any).user;
    const { download = "true" } = req.query;

    const validation = z.number().int().safeParse(parseInt(roundNumber));

    if (!validation.success) {
      res.status(400).json({ error: "Invalid round number" });
      return;
    }

    const simulation = await Simulation.findOne({
      _id: simulationId,
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    })
      .populate({
        path: "activeSegmentsDetailed",
        model: "Segment",
      })
      .populate({
        path: "activeProductsDetailed",
        model: "Product",
        populate: {
          path: "segmentReference",
          model: "Segment",
        },
      });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    const round = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: validation.data,
      // status: "Completed",
    });

    if (!round) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    const result = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber,
    })
      .populate("teams.team teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (!result) {
      res.status(404).json({ error: "Result not found" });
      return;
    }

    if (result.teams) {
      result.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const prevRoundResult = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber - 1,
    })
      .populate("teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (prevRoundResult && prevRoundResult.teams) {
      prevRoundResult.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const prevRoundDecisions = await Promise.all(
      result.teams.map((t) => {
        return Decision.findOne({
          simulationId: simulation._id,
          roundNumber: round.roundNumber - 1,
          teamId: t.teamId,
        })
          .sort({ createdAt: -1 })
          .lean();
      })
    );

    const baseData = await BaseData.findOne({
      simulationTypeId: simulation.simulationTypeId,
    }).lean();

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    // console.log(result);

    // res.status(200).json({ results });

    const availableGlobalInputs = await GlobalInput.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const segments = await Segment.find({
      simulationTypeId: simulation.simulationTypeId,
    }).sort({ order: 1 });

    const products = await Product.find({
      simulationTypeId: simulation.simulationTypeId,
    })
      .populate("segmentReference")
      .sort({ order: 1 });

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber,
    }).populate({
      path: "eventsTriggered.event",
    });

    if (!currentRound) {
      res.status(404).json({ error: "Current round not found" });
      return;
    }

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    );

    // TODO: use key instead of name
    const options = {
      availableGlobalInputs,
      segments,
      products,
      prevRoundDecisions,
      baseData: baseData,
      prevRoundResult: prevRoundResult,
      round: currentRound,
      download: download === "true",
    };

    let fileName: string | any;

    if (simulationType?.name === "Mall Management") {
      fileName = createMallManagementAnalysisReport(result, options);
    } else if (simulationType?.name === "FMCG") {
      fileName = createFmcgAnalysisReport(result, options);
    } else {
      fileName = createAnalysisReport(result, options);
    }

    if (download === "true" && typeof fileName === "string") {
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.sendFile(path.join(process.cwd(), fileName));
    } else {
      res.status(200).json({ data: fileName });
    }
  } catch (err) {
    next(err);
  }
};

export const getSimulationFeedbackByRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.params;
    const user = (req as any).user;
    const { download = "true" } = req.query;

    const validation = z.number().int().safeParse(parseInt(roundNumber));

    if (!validation.success) {
      res.status(400).json({ error: "Invalid round number" });
      return;
    }

    const simulation = await Simulation.findOne({
      _id: simulationId,
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    })
      .populate({
        path: "activeSegmentsDetailed",
        model: "Segment",
      })
      .populate({
        path: "activeProductsDetailed",
        model: "Product",
        populate: {
          path: "segmentReference",
          model: "Segment",
        },
      });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    const round = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: validation.data,
      // status: "Completed",
    });

    if (!round) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    const result = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber,
    })
      .populate("teams.team teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (!result) {
      res.status(404).json({ error: "Result not found" });
      return;
    }

    if (result.teams) {
      result.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    );
    const offset = simulationType?.comparisonRoundOffset || 1;

    const prevRoundResult = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber - offset,
    })
      .populate("teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (prevRoundResult && prevRoundResult.teams) {
      prevRoundResult.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const prevRoundDecisions = await Promise.all(
      result.teams.map((t) => {
        return Decision.findOne({
          simulationId: simulation._id,
          roundNumber: round.roundNumber - offset,
          teamId: t.teamId,
        })
          .sort({ createdAt: -1 })
          .lean();
      })
    );

    const baseData = await BaseData.findOne({
      simulationTypeId: simulation.simulationTypeId,
    }).lean();

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    // console.log(result);

    // res.status(200).json({ results });

    const availableGlobalInputs = await GlobalInput.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const availableEvents = await Event.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const segments = await Segment.find({
      simulationTypeId: simulation.simulationTypeId,
    }).sort({ order: 1 });

    const products = await Product.find({
      simulationTypeId: simulation.simulationTypeId,
    })
      .populate("segmentReference")
      .sort({ order: 1 });

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber,
    }).populate("eventsTriggered.event");

    if (!currentRound) {
      res.status(404).json({ error: "Current round not found" });
      return;
    }

    // Note: simulationType is fetched above

    // TODO: use key instead of name
    const createReportFunction =
      simulationType?.name === "Mall Management"
        ? createMallManagementFeedbackReport
        : simulationType?.name === "FMCG"
          ? createFmcgFeedbackReport
          : createFeedbackReport;

    const fileName = createReportFunction(
      // simulationId,
      result,
      {
        availableGlobalInputs,
        availableEvents,
        segments,
        products,
        prevRoundDecisions,
        baseData: baseData,
        prevRoundResult: prevRoundResult,
        round: currentRound,
        download: download === "true",
        winningMetricsConfig: simulationType?.winningMetrics || undefined,
        currency: simulationType?.currency,
        activeProductIds: simulation.activeProducts as ObjectId[],
      }
    );

    if (download === "true" && typeof fileName === "string") {
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.sendFile(path.join(process.cwd(), fileName));
    } else {
      res.status(200).json({ data: fileName });
    }
  } catch (err) {
    next(err);
  }
};

export const getSimulationCompetitorReportByRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.params;
    const user = (req as any).user;

    const validation = z.number().int().safeParse(parseInt(roundNumber));

    if (!validation.success) {
      res.status(400).json({ error: "Invalid round number" });
      return;
    }

    const simulation = await Simulation.findOne({
      _id: simulationId,
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    })
      .populate({
        path: "activeSegmentsDetailed",
        model: "Segment",
      })
      .populate({
        path: "activeProductsDetailed",
        model: "Product",
        populate: {
          path: "segmentReference",
          model: "Segment",
        },
      });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    const round = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: validation.data,
      // status: "Completed",
    });

    if (!round) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    const result = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber,
    })
      .populate("teams.team teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (!result) {
      res.status(404).json({ error: "Result not found" });
      return;
    }

    if (result.teams) {
      result.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const prevRoundResult = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber - 1,
    })
      .populate("teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (prevRoundResult && prevRoundResult.teams) {
      prevRoundResult.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const prevRoundDecisions = await Promise.all(
      result.teams.map((t) => {
        return Decision.findOne({
          simulationId: simulation._id,
          roundNumber: round.roundNumber - 1,
          teamId: t.teamId,
        })
          .sort({ createdAt: -1 })
          .lean();
      })
    );

    const baseData = await BaseData.findOne({
      simulationTypeId: simulation.simulationTypeId,
    }).lean();

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    const availableGlobalInputs = await GlobalInput.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const segments = await Segment.find({
      simulationTypeId: simulation.simulationTypeId,
    }).sort({ order: 1 });

    const products = await Product.find({
      simulationTypeId: simulation.simulationTypeId,
    })
      .populate("segmentReference")
      .sort({ order: 1 });

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: round.roundNumber,
    }).populate("eventsTriggered.event");

    if (!currentRound) {
      res.status(404).json({ error: "Current round not found" });
      return;
    }

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    );

    // TODO: use key instead of name
    const createReportFunction =
      simulationType?.name === "FMCG"
        ? createFmcgCompetitorReport
        : simulationType?.name === "Mall Management"
          ? createMallManagementCompetitorReport
          : createCompetitorReport;

    const pnlConfig = await PnLConfig.findOne({
      simulationTypeId: simulation.simulationTypeId,
    }).lean();

    const fileName = createReportFunction(
      // simulationId,
      result,
      {
        availableGlobalInputs,
        segments,
        products,
        prevRoundDecisions,
        baseData: baseData,
        prevRoundResult: prevRoundResult,
        round: currentRound,
        winningMetricsConfig: simulationType?.winningMetrics || [],
        currency: simulationType?.currency,
        pnlConfig: pnlConfig,
      }
    );

    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.sendFile(path.join(process.cwd(), fileName));

    // Send the file to the client
    // res.download(fileName, (err) => {
    //   if (err) {
    //     console.error("Error sending file:", err);
    //   }
    //   // Clean up the file after sending
    //   fs.unlink(fileName, (unlinkErr) => {
    //     if (unlinkErr) {
    //       console.error("Error deleting file:", unlinkErr);
    //     }
    //   });
    // });
  } catch (err) {
    next(err);
  }
};

export const getCurrentRoundAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId } = req.params;
    const { download = "true" } = req.query;
    const user = (req as any).user;

    const simulation = await Simulation.findOne({
      _id: simulationId,
      ownerId:
        user.role === "client"
          ? new mongoose.Types.ObjectId(user._id)
          : undefined,
    })
      .populate({
        path: "activeSegmentsDetailed",
        model: "Segment",
      })
      .populate({
        path: "activeProductsDetailed",
        model: "Product",
        populate: {
          path: "segmentReference",
          model: "Segment",
        },
      });

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    const currentRound = await Round.findOne({
      simulationId: simulation._id,
      roundNumber: simulation.config.currRounds,
      // status: "Completed",
    }).populate("eventsTriggered.event");

    if (!currentRound) {
      res.status(404).json({ error: "Current round not found" });
      return;
    }

    const result = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: currentRound.roundNumber,
    })
      .populate("teams.team teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (!result) {
      res.status(404).json({ error: "Result not found" });
      return;
    }

    if (result.teams) {
      result.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const prevRoundDecisions = await Promise.all(
      result.teams.map((t) => {
        return Decision.findOne({
          simulationId: simulation._id,
          roundNumber: currentRound.roundNumber - 1,
          teamId: t.teamId,
        })
          .sort({ createdAt: -1 })
          .lean();
      })
    );

    const baseData = await BaseData.findOne({
      simulationTypeId: simulation.simulationTypeId,
    }).lean();

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    // console.log(result);

    // res.status(200).json({ results });

    const availableGlobalInputs = await GlobalInput.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const availableEvents = await Event.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const segments = await Segment.find({
      simulationTypeId: simulation.simulationTypeId,
    }).sort({ order: 1 });

    const products = await Product.find({
      simulationTypeId: simulation.simulationTypeId,
    })
      .populate("segmentReference")
      .sort({ order: 1 });

    const prevRoundResult = await Result.findOne({
      simulationId: simulation._id,
      roundNumber:
        currentRound.roundNumber -
        (simulation.simulationType?.comparisonRoundOffset || 1),
    })
      .populate("teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (prevRoundResult && prevRoundResult.teams) {
      prevRoundResult.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    );

    // TODO: use key instead of name
    const createReportFunction =
      simulationType?.name === "Mall Management"
        ? createMallManagementFeedbackReport
        : simulationType?.name === "FMCG"
          ? createFmcgFeedbackReport
          : createFeedbackReport;

    const fileName = createReportFunction(
      // simulationId,
      result,
      {
        availableGlobalInputs,
        availableEvents,
        segments,
        products,
        prevRoundDecisions,
        baseData: baseData,
        prevRoundResult: prevRoundResult,
        round: currentRound,
        winningMetricsConfig: simulationType?.winningMetrics || undefined,
        currency: simulationType?.currency,
      }
    );

    if (download === "true" && typeof fileName === "string") {
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.sendFile(path.join(process.cwd(), fileName));
    } else {
      res.status(200).json({ data: fileName });
    }
  } catch (err) {
    next(err);
  }
};

export const getAnalysisReportPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { simulationId } = req.params;
  const { download = "true" } = req.query;
  const user = (req as any).user;

  const simulation = await Simulation.findOne({
    _id: simulationId,
    status: "Active",
    ownerId:
      user.role === "client"
        ? new mongoose.Types.ObjectId(user._id)
        : undefined,
  })
    .populate({
      path: "activeSegmentsDetailed",
      model: "Segment",
    })
    .populate({
      path: "activeProductsDetailed",
      model: "Product",
      populate: {
        path: "segmentReference",
        model: "Segment",
      },
    });

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found or not active" });

    return;
  }

  const currentRound = await Round.findOne({
    simulationId: simulation._id,
    roundNumber: simulation.config.currRounds,
  }).populate("eventsTriggered.event");

  if (!currentRound || currentRound.status !== "Active") {
    res.status(400).json({ error: "Current round is not active" });

    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await processCalculations({
      simulationId,
      simulationTypeId: simulation.simulationTypeId.toString(),
      simulationTypeName: simulation.simulationType.name,
      roundNumber: currentRound.roundNumber,
      session,
      activeSegments: simulation.activeSegmentsDetailed || [],
      activeProducts: simulation.activeProductsDetailed || [],
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    throw error;
  } finally {
    session.endSession();
  }

  try {
    const result = await Result.findOne({
      simulationId: simulation._id,
      roundNumber: currentRound.roundNumber,
    })
      .populate("teams.team teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (!result) {
      res.status(404).json({ error: "Result not found" });
      return;
    }

    if (result.teams) {
      result.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const baseData = await BaseData.findOne({
      simulationTypeId: simulation.simulationTypeId,
    }).lean();

    if (!baseData) {
      res.status(404).json({ error: "Base data not found" });
      return;
    }

    const availableGlobalInputs = await GlobalInput.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const availableEvents = await Event.find({
      simulationTypeId: simulation.simulationTypeId,
    });

    const segments = await Segment.find({
      simulationTypeId: simulation.simulationTypeId,
    }).sort({ order: 1 });

    const products = await Product.find({
      simulationTypeId: simulation.simulationTypeId,
    })
      .populate("segmentReference")
      .sort({ order: 1 });

    const prevRoundDecisions = await Promise.all(
      result.teams.map((t) => {
        return Decision.findOne({
          simulationId: simulation._id,
          roundNumber:
            currentRound.roundNumber -
            (simulation.simulationType?.comparisonRoundOffset || 1),
          teamId: t.teamId,
        })
          .sort({ createdAt: -1 })
          .lean();
      })
    );

    const prevRoundResult = await Result.findOne({
      simulationId: simulation._id,
      roundNumber:
        currentRound.roundNumber -
        (simulation.simulationType?.comparisonRoundOffset || 1),
    })
      .populate("teams.decision")
      .sort({ createdAt: -1 })
      .lean();

    if (prevRoundResult && prevRoundResult.teams) {
      prevRoundResult.teams.sort((a, b) => {
        const teamIdA = a.teamId?.toString() || "";
        const teamIdB = b.teamId?.toString() || "";
        return teamIdA.localeCompare(teamIdB);
      });
    }

    const simulationType = await SimulationType.findById(
      simulation.simulationTypeId
    );

    // TODO: use key instead of name
    const createReportFunction =
      simulationType?.name === "Mall Management"
        ? createMallManagementFeedbackReport
        : simulationType?.name === "FMCG"
          ? createFmcgFeedbackReport
          : createFeedbackReport;

    const fileName = createReportFunction(
      // simulationId,
      result,
      {
        availableGlobalInputs,
        availableEvents,
        segments,
        products,
        prevRoundDecisions,
        baseData: baseData,
        prevRoundResult: prevRoundResult,
        round: currentRound,
        winningMetricsConfig: simulationType?.winningMetrics || undefined,
        currency: simulationType?.currency,
      }
    );

    if (download === "true" && typeof fileName === "string") {
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.sendFile(path.join(process.cwd(), fileName));
    } else {
      res.status(200).json({ data: fileName });
    }
  } catch (err) {
    next(err);
  }
};

export const recalculateByRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { simulationId, roundNumber } = req.params;
  const user = (req as any).user;

  const simulation = await Simulation.findOne({
    _id: simulationId,
    ownerId:
      user.role === "client"
        ? new mongoose.Types.ObjectId(user._id)
        : undefined,
  })
    .populate({
      path: "activeSegmentsDetailed",
      model: "Segment",
    })
    .populate({
      path: "activeProductsDetailed",
      model: "Product",
    })
    .populate({
      path: "simulationType",
      model: "SimulationType",
    });

  if (!simulation) {
    res.status(404).json({ error: "Simulation not found or not active" });

    return;
  }

  const validation = z
    .number()
    .int()
    .min(-10)
    .max(1000)
    .safeParse(parseInt(roundNumber));

  if (!validation.success) {
    res.status(400).json({ error: "Invalid round number" });

    return;
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await processCalculations({
      simulationId,
      simulationTypeId: simulation.simulationTypeId.toString(),
      simulationTypeName: simulation.simulationType.name,
      roundNumber: validation.data,
      session,
      activeSegments: simulation.activeSegmentsDetailed || [],
      activeProducts: simulation.activeProductsDetailed || [],
    });

    await session.commitTransaction();

    await session.endSession();

    res.status(200).json({ message: "Round recalculated successfully" });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    next(error);
  }
};

/**
 * Get product unlock state for a team
 * Returns unlock status and prerequisite check results for all products
 */
export const getProductUnlockState = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, teamId } = req.params;

    // Get simulation with active products
    const simulation = await Simulation.findById(simulationId)
      .populate("activeProductsDetailed")
      .lean();

    if (!simulation) {
      res.status(404).json({ error: "Simulation not found" });
      return;
    }

    // Get current round
    const currentRound = await Round.findOne({
      simulationId,
      status: "Active",
    }).lean();

    if (!currentRound) {
      res.status(404).json({ error: "No active round found" });
      return;
    }

    // Get current decision for this team
    const currentDecision = await Decision.findOne({
      simulationId,
      teamId,
      roundNumber: currentRound.roundNumber,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Get previous round decision for prerequisite checking
    const prevRoundDecision = await Decision.findOne({
      simulationId,
      teamId,
      roundNumber: currentRound.roundNumber - 1,
    })
      .sort({ createdAt: -1 })
      .lean();

    const products = (simulation.activeProductsDetailed ||
      []) as unknown as ProductInterface[];
    const unlockStates = [];

    for (const product of products) {
      // Get current unlock state from decision
      const decisionDetail = currentDecision?.decisionDetails.find(
        (dd) => dd.productId.toString() === product._id.toString()
      );

      // Check if product has prerequisites
      const hasPrerequisites =
        product.unlockPrerequisites && product.unlockPrerequisites.length > 0;

      // Default unlock state: products with prerequisites default to locked, others default to unlocked
      const defaultUnlocked = !hasPrerequisites;
      const isUnlocked = decisionDetail?.isUnlocked ?? defaultUnlocked;

      // Check if prerequisites are met
      let prerequisitesMet = true;
      let unmetRequirements: any[] = [];

      if (hasPrerequisites) {
        const prereqCheck = checkProductPrerequisites(
          product,
          prevRoundDecision
        );
        prerequisitesMet = prereqCheck.isMet;
        unmetRequirements = prereqCheck.unmetRequirements;
      }

      unlockStates.push({
        productId: product._id,
        productName: product.productName,
        isUnlocked,
        prerequisitesMet,
        unlockCost: product.unlockCost || 0,
        unmetRequirements: unmetRequirements.map((req) => ({
          targetName: req.prerequisite.targetName,
          fieldKey: req.prerequisite.fieldKey,
          operator: req.prerequisite.operator,
          requiredValue: req.prerequisite.value,
          actualValue: req.actualValue,
          reason: req.reason,
        })),
      });
    }

    res.status(200).json(unlockStates);
  } catch (error) {
    console.error("Error fetching product unlock state:", error);
    next(error);
  }
};

export const getSimulationAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationName } = req.query;

    const existingSimulation = await Simulation.findOne({
      simulationName: simulationName,
    });

    if (existingSimulation) {
      res.status(400).json({ error: "Simulation already exists" });
      return;
    }

    res.status(200).json({ message: "Simulation is available" });
  } catch (error) {
    next(error);
  }
};
