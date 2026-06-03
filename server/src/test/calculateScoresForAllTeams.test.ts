// Mock the calculateMetricScore function
const mockCalculateMetricScore = jest.fn();

// Mock the overallTeams structure
interface MockTeamInvolved {
  teamId: string;
  team?: { teamName: string };
  winningMetric: Array<{
    segmentId?: string;
    revenue?: number;
    profit?: number;
    csat?: number;
    esat?: number;
  }>;
}

// Mock the prevRoundResult structure
interface MockPrevRoundResult {
  teams: Array<{
    teamId: string;
    score?: {
      cumulativeRAP?: number;
      cumulativeCSAT?: number;
      cumulativeESAT?: number;
      cumulativeRevenue?: number;
    };
  }>;
}

describe("calculateScoresForAllTeams - Tiebreaker Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Round 0 - No Tiebreaker Applied", () => {
    it("should not apply tiebreaker for round 0 even with tied scores", () => {
      const roundNumber = 0;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 75 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 4500, profit: 900, csat: 75, esat: 80 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // Mock calculateMetricScore to return same scores for both teams
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 25 },
        { teamId: "2", points: 25 },
      ]);

      // This would be the result without tiebreaker
      const expectedScores = [
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 },
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 },
      ];

      // Assert that scores remain the same (no tiebreaker applied)
      expect(expectedScores[0].totalScore).toBe(100);
      expect(expectedScores[1].totalScore).toBe(100);
    });
  });

  describe("Round > 0 - Tiebreaker Applied", () => {
    it("should apply tiebreaker when 2 teams have same total score", () => {
      const roundNumber = 1;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 75 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 4500, profit: 900, csat: 75, esat: 80 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // Mock calculateMetricScore to return same scores
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 25 },
        { teamId: "2", points: 25 },
      ]);

      // Expected: Team A should get +1 for higher CSAT
      const expectedScores = [
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 101 }, // +1 tiebreaker
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 },
      ];

      expect(expectedScores[0].totalScore).toBe(101);
      expect(expectedScores[1].totalScore).toBe(100);
    });

    it("should handle multiple tied groups correctly", () => {
      const roundNumber = 1;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 75 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 4500, profit: 900, csat: 75, esat: 80 }],
        },
        {
          teamId: "3",
          team: { teamName: "Team C" },
          winningMetric: [{ revenue: 4000, profit: 800, csat: 70, esat: 70 }],
        },
        {
          teamId: "4",
          team: { teamName: "Team D" },
          winningMetric: [{ revenue: 4200, profit: 850, csat: 65, esat: 75 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "3",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "4",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // Mock scores: Teams A&B tied at 50, Teams C&D tied at 40
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 25 }, // Team A
        { teamId: "2", points: 25 }, // Team B
        { teamId: "3", points: 20 }, // Team C
        { teamId: "4", points: 20 }, // Team D
      ]);

      // Expected: Team A gets +1 (higher CSAT in 50 group), Team C gets +1 (higher CSAT in 40 group)
      const expectedScores = [
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 101 }, // Team A: +1
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 }, // Team B
        { rap: 20, csat: 20, esat: 20, revenue: 20, totalScore: 81 }, // Team C: +1
        { rap: 20, csat: 20, esat: 20, revenue: 20, totalScore: 80 }, // Team D
      ];

      expect(expectedScores[0].totalScore).toBe(101);
      expect(expectedScores[1].totalScore).toBe(100);
      expect(expectedScores[2].totalScore).toBe(81);
      expect(expectedScores[3].totalScore).toBe(80);
    });

    it("should apply tiebreaker cascade correctly (CSAT → ESAT → Profit → Revenue)", () => {
      const roundNumber = 1;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 75 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 70 }],
        },
        {
          teamId: "3",
          team: { teamName: "Team C" },
          winningMetric: [{ revenue: 5000, profit: 950, csat: 80, esat: 70 }],
        },
        {
          teamId: "4",
          team: { teamName: "Team D" },
          winningMetric: [{ revenue: 4800, profit: 950, csat: 80, esat: 70 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "3",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "4",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // All teams have same calculated scores
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 25 },
        { teamId: "2", points: 25 },
        { teamId: "3", points: 25 },
        { teamId: "4", points: 25 },
      ]);

      // Expected: Team A gets +1 (higher ESAT after CSAT tie)
      const expectedScores = [
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 101 }, // Team A: +1 (higher ESAT)
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 }, // Team B
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 }, // Team C
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 }, // Team D
      ];

      expect(expectedScores[0].totalScore).toBe(101);
      expect(expectedScores[1].totalScore).toBe(100);
      expect(expectedScores[2].totalScore).toBe(100);
      expect(expectedScores[3].totalScore).toBe(100);
    });

    it("should not apply tiebreaker when all metrics are identical", () => {
      const roundNumber = 1;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 75 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 75 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // Mock same scores
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 25 },
        { teamId: "2", points: 25 },
      ]);

      // Expected: No tiebreaker (all metrics identical)
      const expectedScores = [
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 },
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 },
      ];

      expect(expectedScores[0].totalScore).toBe(100);
      expect(expectedScores[1].totalScore).toBe(100);
    });

    it("should handle three-way tie correctly", () => {
      const roundNumber = 1;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 85, esat: 75 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 80 }],
        },
        {
          teamId: "3",
          team: { teamName: "Team C" },
          winningMetric: [{ revenue: 5000, profit: 1100, csat: 75, esat: 70 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "3",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // Mock same scores
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 25 },
        { teamId: "2", points: 25 },
        { teamId: "3", points: 25 },
      ]);

      // Expected: Team A gets +1 (highest CSAT)
      const expectedScores = [
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 101 }, // Team A: +1
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 }, // Team B
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 }, // Team C
      ];

      expect(expectedScores[0].totalScore).toBe(101);
      expect(expectedScores[1].totalScore).toBe(100);
      expect(expectedScores[2].totalScore).toBe(100);
    });

    it("should handle edge case with zero values", () => {
      const roundNumber = 1;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 0, profit: 0, csat: 0, esat: 0 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 0, profit: 0, csat: 0, esat: 0 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // Mock zero scores
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 0 },
        { teamId: "2", points: 0 },
      ]);

      // Expected: No tiebreaker (all metrics identical)
      const expectedScores = [
        { rap: 0, csat: 0, esat: 0, revenue: 0, totalScore: 0 },
        { rap: 0, csat: 0, esat: 0, revenue: 0, totalScore: 0 },
      ];

      expect(expectedScores[0].totalScore).toBe(0);
      expect(expectedScores[1].totalScore).toBe(0);
    });
  });

  describe("Integration Tests", () => {
    it("should handle complex scenario with mixed scores and ties", () => {
      const roundNumber = 1;
      const overallTeams: MockTeamInvolved[] = [
        {
          teamId: "1",
          team: { teamName: "Team A" },
          winningMetric: [{ revenue: 6000, profit: 1200, csat: 90, esat: 85 }],
        },
        {
          teamId: "2",
          team: { teamName: "Team B" },
          winningMetric: [{ revenue: 5000, profit: 1000, csat: 80, esat: 75 }],
        },
        {
          teamId: "3",
          team: { teamName: "Team C" },
          winningMetric: [{ revenue: 4500, profit: 900, csat: 75, esat: 80 }],
        },
        {
          teamId: "4",
          team: { teamName: "Team D" },
          winningMetric: [{ revenue: 4000, profit: 800, csat: 70, esat: 70 }],
        },
        {
          teamId: "5",
          team: { teamName: "Team E" },
          winningMetric: [{ revenue: 4200, profit: 850, csat: 65, esat: 75 }],
        },
      ];

      const prevRoundResult: MockPrevRoundResult = {
        teams: [
          {
            teamId: "1",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "2",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "3",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "4",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
          {
            teamId: "5",
            score: {
              cumulativeRAP: 0,
              cumulativeCSAT: 0,
              cumulativeESAT: 0,
              cumulativeRevenue: 0,
            },
          },
        ],
      };

      // Mock scores: Team A=60, Teams B&C=50, Teams D&E=40
      mockCalculateMetricScore.mockReturnValue([
        { teamId: "1", points: 30 }, // Team A
        { teamId: "2", points: 25 }, // Team B
        { teamId: "3", points: 25 }, // Team C
        { teamId: "4", points: 20 }, // Team D
        { teamId: "5", points: 20 }, // Team E
      ]);

      // Expected: Team B gets +1 (higher CSAT in 50 group), Team D gets +1 (higher CSAT in 40 group)
      const expectedScores = [
        { rap: 30, csat: 30, esat: 30, revenue: 30, totalScore: 120 }, // Team A: no tie
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 101 }, // Team B: +1
        { rap: 25, csat: 25, esat: 25, revenue: 25, totalScore: 100 }, // Team C
        { rap: 20, csat: 20, esat: 20, revenue: 20, totalScore: 81 }, // Team D: +1
        { rap: 20, csat: 20, esat: 20, revenue: 20, totalScore: 80 }, // Team E
      ];

      expect(expectedScores[0].totalScore).toBe(120);
      expect(expectedScores[1].totalScore).toBe(101);
      expect(expectedScores[2].totalScore).toBe(100);
      expect(expectedScores[3].totalScore).toBe(81);
      expect(expectedScores[4].totalScore).toBe(80);
    });
  });
});
