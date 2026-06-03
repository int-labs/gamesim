export type HardcodedPastInitiative = {
  round: number;
  segment: string;
  initiatives: Array<{
    _id: string;
    name: string | null;
    selectedId: string | null;
  }>;
};

const pastInitiatives: Array<HardcodedPastInitiative> = [
  {
    round: 0,
    segment: "Mass Consumer",
    initiatives: [
      { _id: "9", name: null, selectedId: null },
      { _id: "1", name: "Initiative A", selectedId: "1" },
      { _id: "2", name: "Initiative B", selectedId: "2" },
    ],
  },
  {
    round: 0,
    segment: "Affluent Consumer",
    initiatives: [
      { _id: "3", name: "Initiative C", selectedId: "3" },
      { _id: "10", name: null, selectedId: null },
      { _id: "4", name: "Initiative D", selectedId: "4" },
    ],
  },
  {
    round: 0,
    segment: "SME",
    initiatives: [
      { _id: "5", name: "Initiative E", selectedId: "5" },
      { _id: "6", name: "Initiative F", selectedId: "6" },
      { _id: "11", name: null, selectedId: null },
    ],
  },
  {
    round: 0,
    segment: "Corporate",
    initiatives: [
      { _id: "12", name: null, selectedId: null },
      { _id: "7", name: "Initiative G", selectedId: "7" },
      { _id: "8", name: "Initiative H", selectedId: "8" },
    ],
  },
];

export default pastInitiatives;
