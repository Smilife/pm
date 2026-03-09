import { create } from 'zustand';

interface UiState {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  collapsed: false,
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
}));
