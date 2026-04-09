import { create } from 'zustand';

interface CommandState {
  pending: number;
  startedAt: number | null;
  start: () => void;
  finish: () => void;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  pending: 0,
  startedAt: null,
  start: () => {
    const { pending } = get();
    set({
      pending: pending + 1,
      startedAt: pending === 0 ? Date.now() : get().startedAt,
    });
  },
  finish: () => {
    const { pending } = get();
    const next = Math.max(0, pending - 1);
    set({
      pending: next,
      startedAt: next === 0 ? null : get().startedAt,
    });
  },
}));
