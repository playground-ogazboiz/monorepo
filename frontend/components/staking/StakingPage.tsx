"use client";

import { 
  claimRewards, 
  getStakingPosition, 
  stakeTokens, 
  StakingPositionReponse, 
  unstakeTokens, 
  TxResponse,
  getStakingQuote,
  stakeNgn,
  StakingQuote
} from "@/lib/config";
import { getNgnBalance, type NgnBalanceResponse } from "@/lib/walletApi";
import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { 
  Loader2, 
  Wallet, 
  Coins, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  RefreshCw,
  Shield
} from "lucide-react";
import { handleError, showSuccessToast } from "@/lib/toast";
import { TransactionStatusPanel, TransactionStatus } from "@/components/transaction/TransactionStatusPanel";

type StakingMode = "ngn_balance" | "usdc";
type NgnStakeStep = "input" | "preview" | "processing" | "completed";

interface TransactionState {
  status: TransactionStatus;
  txId?: string | null;
  outboxId?: string | null;
  message?: string | null;
  action?: string;
}

interface StakingTimeline {
  ngnReserved: boolean;
  conversionProcessing: boolean;
  usdcStaked: boolean;
  receiptRecorded: boolean;
}

export default function StakingPage() {
  const [stakingPosition, setStakingPosition] = useState<StakingPositionReponse | null>(null);
  const [ngnBalance, setNgnBalance] = useState<NgnBalanceResponse | null>(null);
  const [stakingMode, setStakingMode] = useState<StakingMode>("ngn_balance");
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [transaction, setTransaction] = useState<TransactionState | null>(null);
  
  // NGN staking flow state
  const [ngnStakeStep, setNgnStakeStep] = useState<NgnStakeStep>("input");
  const [quote, setQuote] = useState<StakingQuote | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<StakingTimeline>({
    ngnReserved: false,
    conversionProcessing: false,
    usdcStaked: false,
    receiptRecorded: false,
  });
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
      return;
    }

    getStakingPosition()
      .then((data) => setStakingPosition(data))
      .catch((err: Error) => {
        handleError(err, "Failed to fetch staking position");
      });
  }, []);

  useEffect(() => {
    if (stakingMode === "ngn_balance") {
      setIsLoadingBalance(true);
      getNgnBalance()
        .then((balance) => setNgnBalance(balance))
        .catch((err: Error) => {
          handleError(err, "Failed to fetch NGN balance");
        })
        .finally(() => setIsLoadingBalance(false));
    }
  }, [stakingMode]);





  // Function to map TxResponse status to TransactionStatus
  const mapTxStatus = (status: string): TransactionStatus => {
    switch (status) {
      case "CONFIRMED":
        return "confirmed";
      case "QUEUED":
        return "queued";
      case "FAILED":
        return "failed";
      case "PENDING":
      default:
        return "pending";
    }
  };

  // Function to update transaction state
  const updateTransaction = (res: TxResponse, action: string) => {
    setTransaction({
      status: mapTxStatus(res.status),
      txId: res.txId,
      outboxId: res.outboxId,
      message: res.message,
      action,
    });
  };

  // Function to clear transaction state
  const clearTransaction = () => {
    setTransaction(null);
  };

  const resetNgnFlow = () => {
    setNgnStakeStep("input");
    setQuote(null);
    setQuoteError(null);
    setStakeAmount("");
    setTimeline({
      ngnReserved: false,
      conversionProcessing: false,
      usdcStaked: false,
      receiptRecorded: false,
    });
    clearTransaction();
  };

  //  This function handles balance state in the staking page
  const updatePosition = (updates: {
    stakedDelta?: number
    claimableDelta?: number
  }) => {
    setStakingPosition((prev) => {
      if (!prev) return prev

      const currentStaked = Number(prev.position.staked)
      const currentClaimable = Number(prev.position.claimable)

      return {
        ...prev,
        position: {
          staked: (
            currentStaked + (updates.stakedDelta ?? 0)
          ).toFixed(6),
          claimable: (
            currentClaimable + (updates.claimableDelta ?? 0)
          ).toFixed(6),
        },
      }
    })
  }




  // Function to format countdown timer
  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Quote expiry countdown
  useEffect(() => {
    if (!quote || ngnStakeStep !== "preview") return;

    const expiryTime = new Date(quote.expiresAt).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        setQuoteError("Quote has expired. Please refresh to get a new quote.");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [quote, ngnStakeStep]);

  // Step 1: Get quote for NGN staking
  const handleGetQuote = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) {
      setQuoteError("Enter a valid amount to stake");
      return;
    }

    const amount = Number(stakeAmount);

    if (!ngnBalance || amount > ngnBalance.availableNgn) {
      setQuoteError(`Insufficient NGN balance. Available: ₦${ngnBalance?.availableNgn.toLocaleString() || 0}`);
      return;
    }

    setIsFetchingQuote(true);
    setQuoteError(null);

    try {
      const quoteData = await getStakingQuote(amount);
      setQuote(quoteData);
      setNgnStakeStep("preview");
    } catch (err: any) {
      setQuoteError(err.message || "Failed to get quote");
    } finally {
      setIsFetchingQuote(false);
    }
  };

  // Step 2: Refresh expired quote
  const handleRefreshQuote = async () => {
    if (!stakeAmount) return;
    
    setQuoteError(null);
    await handleGetQuote();
  };

  // Step 3: Confirm stake with NGN
  const handleConfirmNgnStake = async () => {
    if (!quote || !stakeAmount) return;

    // Check if quote expired
    if (timeLeft === 0) {
      setQuoteError("Quote has expired. Please refresh to get a new quote.");
      return;
    }

    setIsStaking(true);
    setNgnStakeStep("processing");
    setTimeline({
      ngnReserved: true,
      conversionProcessing: false,
      usdcStaked: false,
      receiptRecorded: false,
    });

    try {
      const amount = Number(stakeAmount);
      const res = await stakeNgn(amount);

      // Update timeline based on response
      setTimeline({
        ngnReserved: true,
        conversionProcessing: true,
        usdcStaked: res.status === "CONFIRMED" || !!res.outboxId,
        receiptRecorded: res.status === "CONFIRMED" && !!res.txId,
      });

      setTransaction({
        status: mapTxStatus(res.status || "QUEUED"),
        txId: res.txId || null,
        outboxId: res.outboxId || null,
        message: res.message,
        action: "Stake NGN",
      });

      if (res.success) {
        setNgnStakeStep("completed");
        showSuccessToast(res.message);
        
        // Refresh balances
        const updatedBalance = await getNgnBalance();
        setNgnBalance(updatedBalance);
        const updatedPosition = await getStakingPosition();
        setStakingPosition(updatedPosition);
      } else {
        setNgnStakeStep("preview");
      }
    } catch (err: any) {
      handleError(err, "Failed to stake");
      setTransaction({
        status: "failed",
        message: err.message || "Stake failed",
        action: "Stake NGN",
      });
      setNgnStakeStep("preview");
    } finally {
      setIsStaking(false);
    }
  };

  // USDC staking (advanced mode)
  const handleStakeUsdc = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) {
      setTransaction({
        status: "failed",
        message: "Enter a valid amount to stake",
        action: "Stake",
      });
      return;
    }

    const amount = Number(stakeAmount);

    setIsStaking(true);
    setTransaction({
      status: "pending",
      message: "Submitting stake transaction...",
      action: "Stake",
    });

    try {
      const res = await stakeTokens(stakeAmount);

      updateTransaction(res, "Stake USDC");

      if (res.status === "CONFIRMED") {
        showSuccessToast("Stake confirmed on-chain");
      }

      updatePosition({ stakedDelta: amount });
      setStakeAmount("");
    } catch (err: any) {
      handleError(err, "Failed to stake");
      setTransaction({
        status: "failed",
        message: err.message || "Stake failed",
        action: "Stake",
      });
    } finally {
      setIsStaking(false);
    }
  };



  //  Function to unstake token
  const handleUnstake = async () => {
    if (!unstakeAmount || Number(unstakeAmount) <= 0) {
      setTransaction({
        status: "failed",
        message: "Enter a valid amount to unstake",
        action: "Unstake",
      });
      return
    }

    const amount = Number(unstakeAmount)

    setTransaction({
      status: "pending",
      message: "Submitting unstake transaction...",
      action: "Unstake",
    });

    try {
      const res = await unstakeTokens(unstakeAmount)

      updateTransaction(res, "Unstake");

      if (res.status === "CONFIRMED") {
        showSuccessToast("Unstake confirmed on-chain")
      }

      // Subtract from staked
      updatePosition({ stakedDelta: -amount })

      setUnstakeAmount("")

    } catch (err: any) {
      handleError(err, "Failed to unstake")
      setTransaction({
        status: "failed",
        message: err.message || "Unstake failed",
        action: "Unstake",
      });
    }
  }



  //  Function to claim token
  const handleClaim = async () => {
    setTransaction({
      status: "pending",
      message: "Claiming rewards...",
      action: "Claim Rewards",
    });

    try {
      const claimable = Number(stakingPosition?.position.claimable ?? 0)

      const res = await claimRewards()

      updateTransaction(res, "Claim Rewards");

      if (res.status === "CONFIRMED") {
        showSuccessToast("Rewards claimed successfully")
      }

      // Remove claimable rewards
      updatePosition({ claimableDelta: -claimable })

    } catch (err: any) {
      handleError(err, "Failed to claim rewards")
      setTransaction({
        status: "failed",
        message: err.message || "Claim failed",
        action: "Claim Rewards",
      });
    }
  }


  const handleStakeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    // Allow empty string to let user clear input
    if (value === '' || !isNaN(Number(value))) {
      setStakeAmount(value);
    }
  }


  const handleUnstakeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    // Allow empty string to let user clear input
    if (value === '' || !isNaN(Number(value))) {
      setUnstakeAmount(value);
    }
  }




  const TimelineItem = ({ 
    icon: Icon, 
    label, 
    completed, 
    active 
  }: { 
    icon: React.ElementType; 
    label: string; 
    completed: boolean; 
    active: boolean;
  }) => (
    <div className="flex items-center gap-3">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        completed 
          ? "bg-green-500 text-white" 
          : active 
            ? "bg-primary text-primary-foreground animate-pulse"
            : "bg-muted text-muted-foreground"
      }`}>
        {completed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </div>
      <span className={`text-sm ${
        completed ? "text-green-600 font-medium" : active ? "text-foreground font-medium" : "text-muted-foreground"
      }`}>
        {label}
      </span>
    </div>
  );

  const formatNgn = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Staking Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Stake your tokens to earn rewards
        </p>
      </div>

      {/* Staking Position Cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card className="border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
          <CardHeader className="pb-2">
            <CardDescription>Staked Balance</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {stakingPosition ? (
                `${Number(stakingPosition.position.staked).toFixed(2)} USDC`
              ) : (
                "—"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Currently staked</p>
          </CardContent>
        </Card>

        <Card className="border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
          <CardHeader className="pb-2">
            <CardDescription>Claimable Rewards</CardDescription>
            <CardTitle className="font-mono text-2xl text-primary">
              {stakingPosition ? (
                `${Number(stakingPosition.position.claimable).toFixed(2)} USDC`
              ) : (
                "—"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Available to claim</p>
          </CardContent>
        </Card>
      </div>

      {/* Staking Mode Toggle */}
      <Tabs value={stakingMode} onValueChange={(v) => {
        setStakingMode(v as StakingMode);
        resetNgnFlow();
        setStakeAmount("");
        clearTransaction();
      }} className="mb-6">
        <TabsList className="grid w-full grid-cols-2 border-3 border-foreground">
          <TabsTrigger value="ngn_balance" className="data-[state=active]:bg-primary">
            <Wallet className="h-4 w-4 mr-2" />
            Stake with NGN
          </TabsTrigger>
          <TabsTrigger value="usdc" className="data-[state=active]:bg-primary">
            <Coins className="h-4 w-4 mr-2" />
            Stake USDC (Advanced)
          </TabsTrigger>
        </TabsList>

        {/* NGN Balance Staking */}
        <TabsContent value="ngn_balance" className="mt-4">
          <Card className="border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
            <CardHeader>
              <CardTitle>Stake from NGN Balance</CardTitle>
              <CardDescription>
                Convert your NGN wallet balance to USDC and stake it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingBalance ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : ngnBalance ? (
                <>
                  {/* NGN Balance Display */}
                  <div className="rounded-md border-2 border-foreground/20 bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Available NGN Balance</span>
                      <span className="font-mono font-bold">{formatNgn(ngnBalance.availableNgn)}</span>
                    </div>
                    {ngnBalance.heldNgn > 0 && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">Held (Pending)</span>
                        <span className="font-mono text-sm">{formatNgn(ngnBalance.heldNgn)}</span>
                      </div>
                    )}
                  </div>

                  {/* Step 1: Input Amount */}
                  {ngnStakeStep === "input" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="stake-ngn-amount">Amount (NGN)</Label>
                        <Input
                          id="stake-ngn-amount"
                          type="number"
                          placeholder="Enter amount in NGN"
                          value={stakeAmount}
                          onChange={handleStakeInput}
                          min={100}
                          max={ngnBalance.availableNgn}
                          className="border-2 border-foreground"
                        />
                        <p className="text-xs text-muted-foreground">
                          Min: ₦100 · Max: {formatNgn(ngnBalance.availableNgn)}
                        </p>
                      </div>

                      {quoteError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{quoteError}</span>
                        </div>
                      )}

                      <Button
                        onClick={handleGetQuote}
                        disabled={isFetchingQuote || !stakeAmount || Number(stakeAmount) <= 0}
                        className="w-full border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-50"
                      >
                        {isFetchingQuote ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Getting Quote...
                          </>
                        ) : (
                          <>
                            Preview Stake
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </>
                  )}

                  {/* Step 2: Preview Quote */}
                  {ngnStakeStep === "preview" && quote && (
                    <>
                      <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">You Pay</span>
                          <span className="font-mono font-bold">{formatNgn(quote.amountNgn)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">You Receive (Est.)</span>
                          <span className="font-mono font-bold text-primary">{quote.estimatedAmountUsdc} USDC</span>
                        </div>
                        <div className="border-t border-foreground/10 pt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">FX Rate</span>
                            <span className="font-mono">₦{quote.fxRateNgnPerUsdc.toLocaleString()} / USDC</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Fees</span>
                            <span className="font-mono">{formatNgn(quote.feesNgn)}</span>
                          </div>
                        </div>
                        <div className="border-t border-foreground/10 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Quote Expires In</span>
                            <span className={`font-mono font-bold ${timeLeft < 30 ? "text-destructive" : "text-primary"}`}>
                              {formatTimeLeft(timeLeft)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {quote.disclaimer && (
                        <p className="text-xs text-muted-foreground">{quote.disclaimer}</p>
                      )}

                      {quoteError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span>{quoteError}</span>
                            {timeLeft === 0 && (
                              <Button
                                onClick={handleRefreshQuote}
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                              >
                                <RefreshCw className="mr-2 h-3 w-3" />
                                Refresh Quote
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setNgnStakeStep("input")}
                          className="flex-1 border-2 border-foreground"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleConfirmNgnStake}
                          disabled={isStaking || timeLeft === 0}
                          className="flex-1 border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-50"
                        >
                          {isStaking ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Confirm Stake"
                          )}
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Step 3: Processing with Timeline */}
                  {ngnStakeStep === "processing" && (
                    <div className="space-y-6 py-4">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                      
                      <div className="space-y-4">
                        <TimelineItem
                          icon={Shield}
                          label="NGN Reserved"
                          completed={timeline.ngnReserved}
                          active={!timeline.ngnReserved}
                        />
                        <div className="ml-4 pl-4 border-l-2 border-muted">
                          <TimelineItem
                            icon={RefreshCw}
                            label="Conversion Processing"
                            completed={timeline.conversionProcessing}
                            active={timeline.ngnReserved && !timeline.conversionProcessing}
                          />
                        </div>
                        <div className="ml-4 pl-4 border-l-2 border-muted">
                          <TimelineItem
                            icon={Coins}
                            label="USDC Staked On-Chain"
                            completed={timeline.usdcStaked}
                            active={timeline.conversionProcessing && !timeline.usdcStaked}
                          />
                        </div>
                        <div className="ml-4 pl-4 border-l-2 border-muted">
                          <TimelineItem
                            icon={CheckCircle2}
                            label="Receipt Recorded"
                            completed={timeline.receiptRecorded}
                            active={timeline.usdcStaked && !timeline.receiptRecorded}
                          />
                        </div>
                      </div>

                      {transaction && (
                        <TransactionStatusPanel
                          status={transaction.status}
                          txId={transaction.txId}
                          outboxId={transaction.outboxId}
                          message={transaction.message}
                          allowRetry={transaction.status === "failed"}
                        />
                      )}
                    </div>
                  )}

                  {/* Step 4: Completed */}
                  {ngnStakeStep === "completed" && (
                    <div className="text-center space-y-4 py-6">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-600">Stake Successful!</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your NGN has been converted and staked successfully
                        </p>
                      </div>
                      {transaction?.txId && (
                        <div className="text-xs text-muted-foreground font-mono break-all">
                          Transaction: {transaction.txId}
                        </div>
                      )}
                      <Button
                        onClick={resetNgnFlow}
                        className="w-full border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                      >
                        Stake More
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load NGN balance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usdc" className="mt-4">
          <Card className="border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
            <CardHeader>
              <CardTitle>Stake USDC Directly</CardTitle>
              <CardDescription>
                Stake USDC tokens directly (requires USDC in your wallet)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stake-usdc-amount">Amount (USDC)</Label>
                <Input
                  id="stake-usdc-amount"
                  type="text"
                  placeholder="Enter amount in USDC"
                  value={stakeAmount}
                  onChange={handleStakeInput}
                  className="border-2 border-foreground"
                  disabled={isStaking}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the amount in USDC (e.g., 100.50)
                </p>
              </div>

              {/* Transaction Status Panel */}
              {transaction && (
                <TransactionStatusPanel
                  status={transaction.status}
                  txId={transaction.txId}
                  outboxId={transaction.outboxId}
                  message={transaction.message}
                  allowRetry={transaction.status === "failed"}
                />
              )}

              <Button
                onClick={handleStakeUsdc}
                disabled={isStaking || !stakeAmount || Number(stakeAmount) <= 0}
                className="w-full border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-50"
              >
                {isStaking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Stake USDC"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unstake Form */}
      <Card className="mb-6 border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
        <CardHeader>
          <CardTitle>Unstake Tokens</CardTitle>
          <CardDescription>Unstake your USDC tokens from the staking pool</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unstake-amount">Amount (USDC)</Label>
            <Input
              id="unstake-amount"
              type="text"
              placeholder="Enter amount to unstake"
              value={unstakeAmount}
              onChange={handleUnstakeInput}
              className="border-2 border-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Maximum: {stakingPosition ? Number(stakingPosition.position.staked).toFixed(2) : "0"} USDC
            </p>
          </div>

          <Button
            onClick={handleUnstake}
            disabled={!unstakeAmount || Number(unstakeAmount) <= 0}
            className="w-full border-3 border-foreground bg-destructive font-bold text-destructive-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-50"
          >
            Unstake Tokens
          </Button>
        </CardContent>
      </Card>

      {/* Claim Rewards */}
      <Card className="mb-6 border-3 border-foreground shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
        <CardHeader>
          <CardTitle>Claim Rewards</CardTitle>
          <CardDescription>
            Claim your staking rewards ({stakingPosition ? Number(stakingPosition.position.claimable).toFixed(2) : "0"} USDC available)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleClaim}
            disabled={!stakingPosition || Number(stakingPosition.position.claimable) <= 0}
            className="w-full border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-50"
          >
            Claim Rewards
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
