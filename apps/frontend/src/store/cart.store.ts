import { create } from 'zustand';

interface CartItem {
    id: string;
    [key: string]: unknown;
}

interface CartState {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (itemId: string) => void;
    clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
    items: [],
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
    removeItem: (itemId) => set((state) => ({ items: state.items.filter((i) => i.id !== itemId) })),
    clearCart: () => set({ items: [] }),
}));
