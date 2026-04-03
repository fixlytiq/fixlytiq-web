import { create } from "zustand";

type TransactionUiState = {
  detailSaleId: string | null;
  openTransactionDetail: (saleId: string) => void;
  closeTransactionDetail: () => void;
};

export const useTransactionUiStore = create<TransactionUiState>((set) => ({
  detailSaleId: null,
  openTransactionDetail: (saleId) => set({ detailSaleId: saleId }),
  closeTransactionDetail: () => set({ detailSaleId: null }),
}));
