"use client";

import { useCallback, useEffect, useState } from "react";
import { getRiskState } from "@/lib/risk";

interface UseRiskStateResult {
  isFrozen: boolean;
  freezeReason: string | null;
  deficitNgn: number;
  updatedAt: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useRiskState(): UseRiskStateResult {
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeReason, setFreezeReason] = useState<string | null>(null);
  const [deficitNgn, setDeficitNgn] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const risk = await getRiskState();
    setIsFrozen(risk.isFrozen);
    setFreezeReason(risk.freezeReason ?? null);
    setDeficitNgn(risk.deficitNgn);
    setUpdatedAt(risk.updatedAt);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchRiskState() {
      try {
        const risk = await getRiskState();
        if (!cancelled) {
          setIsFrozen(risk.isFrozen);
          setFreezeReason(risk.freezeReason ?? null);
          setDeficitNgn(risk.deficitNgn);
          setUpdatedAt(risk.updatedAt);
        }
      } catch (error) {
        console.error("Failed to fetch risk state", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchRiskState();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isFrozen, freezeReason, deficitNgn, updatedAt, isLoading, refresh };
}
