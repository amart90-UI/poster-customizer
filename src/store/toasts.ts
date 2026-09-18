import { create } from "zustand";
import { nanoid } from "nanoid";

export interface Toast {
  id: string;
  message: string;
  variant: "info" | "warn" | "error";
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, variant?: Toast["variant"], ms?: number) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, variant = "info", ms = 3500) => {
    const id = nanoid(6);
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    if (ms > 0) {
      setTimeout(() => get().dismiss(id), ms);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
