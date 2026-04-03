import { create } from "zustand";

type CustomerUiState = {
  detailCustomerId: string | null;
  openCustomerDetail: (id: string) => void;
  closeCustomerDetail: () => void;
};

export const useCustomerUiStore = create<CustomerUiState>()((set) => ({
  detailCustomerId: null,
  openCustomerDetail: (id) => set({ detailCustomerId: id }),
  closeCustomerDetail: () => set({ detailCustomerId: null }),
}));
