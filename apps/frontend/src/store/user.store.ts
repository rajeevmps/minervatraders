import { create } from 'zustand';

interface UserState {
    profile: unknown | null;
    setProfile: (profile: unknown) => void;
}

export const useUserStore = create<UserState>((set) => ({
    profile: null,
    setProfile: (profile) => set({ profile }),
}));
