export type Position = {
  id: string;
  ticker: string;
  shares: number;
  cost_basis: number;
  opened_at: string;
  created_at: string;
  updated_at: string;
};

export type Stance = "bull" | "bear";

export type Thesis = {
  id: string;
  ticker: string;
  run_id: string;
  stance: Stance;
  thesis: string;
  key_points: string[] | null;
  sources: string[] | null;
  created_at: string;
};

export type Verdict = "bullish" | "bearish" | "neutral";

export type Memo = {
  id: string;
  ticker: string;
  run_id: string;
  verdict: Verdict;
  confidence: number | null;
  summary: string;
  bull_thesis_id: string | null;
  bear_thesis_id: string | null;
  created_at: string;
};

export type DailyPrice = {
  id: string;
  ticker: string;
  date: string;
  close: number;
  created_at: string;
};
