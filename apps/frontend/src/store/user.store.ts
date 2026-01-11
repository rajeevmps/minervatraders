import { create } from 'zustand';

interface UserState {
    profile: any | null;
    setProfile: (profile: any) => void;
}

export const useUserStore = create<UserState>((set) => ({
    profile: null,
    setProfile: (profile) => set({ profile }),
}));
