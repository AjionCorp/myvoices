import { create } from "zustand";
import { ContestStatus } from "@/lib/constants";

export interface Contest {
  id: string;
  startAt: number;
  endAt: number;
  prizePool: number;
  status: ContestStatus;
}

export interface Winner {
  blockId: number;
  videoId: string;
  platform: string;
  ownerName: string;
  ownerIdentity: string;
  likes: number;
  rank: number;
  prizeAmount: number;
}

interface ContestState {
  activeContest: Contest | null;
  winners: Winner[];
  leaderboard: Array<{ blockId: number; ownerName: string; likes: number }>;
  timeRemaining: number | null;

  setActiveContest: (contest: Contest | null) => void;
  setWinners: (winners: Winner[]) => void;
  setLeaderboard: (
    leaderboard: Array<{ blockId: number; ownerName: string; likes: number }>
  ) => void;
  setTimeRemaining: (ms: number | null) => void;
}

export const useContestStore = create<ContestState>((set) => ({
  activeContest: null,
  winners: [],
  leaderboard: [],
  timeRemaining: null,

  setActiveContest: (contest) => set({ activeContest: contest }),
  setWinners: (winners) => set({ winners }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setTimeRemaining: (ms) => set({ timeRemaining: ms }),
}));
