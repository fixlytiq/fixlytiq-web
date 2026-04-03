import { create } from "zustand";

type OrderUiState = {
  detailOrderId: string | null;
  openOrderDetail: (orderId: string) => void;
  closeOrderDetail: () => void;
};

export const useOrderUiStore = create<OrderUiState>((set) => ({
  detailOrderId: null,
  openOrderDetail: (orderId) => set({ detailOrderId: orderId }),
  closeOrderDetail: () => set({ detailOrderId: null }),
}));

