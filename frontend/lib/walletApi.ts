import { apiFetch } from "./api";

export type TopUpRail = "paystack" | "flutterwave" | "bank_transfer";

export interface TopUpRequest {
  amountNgn: number;
  rail: TopUpRail;
}

export interface BankTransferDetails {
  accountNumber: string;
  accountName: string;
  bankName: string;
  reference: string;
}

export interface TopUpResponse {
  id: string;
  amountNgn: number;
  rail: TopUpRail;
  status: "pending" | "confirmed" | "failed";
  reference: string;
  redirectUrl?: string | null;
  bankTransfer?: BankTransferDetails | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface NgnBalanceResponse {
  availableNgn: number;
  heldNgn: number;
  totalNgn: number;
}

export type WalletLedgerStatus = "pending" | "confirmed" | "failed";

export interface WalletLedgerEntry {
  id: string;
  type: string;
  amountNgn: number;
  status: WalletLedgerStatus;
  timestamp: string;
  reference?: string | null;
}

export interface WalletLedgerResponse {
  entries: WalletLedgerEntry[];
  nextCursor?: string | null;
}

export function getNgnBalance(): Promise<NgnBalanceResponse> {
  return apiFetch<NgnBalanceResponse>("/api/wallet/ngn/balance");
}

export function getNgnLedger(params?: {
  cursor?: string;
  limit?: number;
}): Promise<WalletLedgerResponse> {
  const cursor = params?.cursor ?? "";
  const limit = params?.limit ?? 20;

  const qs = new URLSearchParams();
  if (cursor) qs.set("cursor", cursor);
  qs.set("limit", String(limit));

  return apiFetch<WalletLedgerResponse>(`/api/wallet/ngn/ledger?${qs.toString()}`);
}

export function initiateTopUp(payload: TopUpRequest): Promise<TopUpResponse> {
  return apiFetch<TopUpResponse>("/api/wallet/ngn/topup/initiate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
