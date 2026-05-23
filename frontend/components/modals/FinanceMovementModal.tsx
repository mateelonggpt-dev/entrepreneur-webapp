import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createFinanceMovement } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  defaultMode?: "top_up" | "transfer";
  presetSourceAccountNumber?: string;
  presetDestinationAccountNumber?: string;
  onSaved?: () => void;
}

const today = "2026-04-19";

export const FinanceMovementModal = ({
  open,
  onOpenChange,
  defaultMode = "transfer",
  presetSourceAccountNumber,
  presetDestinationAccountNumber,
  onSaved,
}: Props) => {
  const { data, refresh } = useAppData();
  const [movementType, setMovementType] = useState<"top_up" | "transfer">(defaultMode);
  const [sourceAccountNumber, setSourceAccountNumber] = useState("");
  const [destinationAccountNumber, setDestinationAccountNumber] = useState("");
  const [amount, setAmount] = useState("0");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pettyCashAccounts = useMemo(
    () => data.financeAccounts.filter((account) => account.accountType === "petty_cash"),
    [data.financeAccounts]
  );

  const sourceAccounts = useMemo(
    () =>
      data.financeAccounts.filter((account) =>
        movementType === "top_up" ? account.accountType !== "petty_cash" : true
      ),
    [data.financeAccounts, movementType]
  );

  const destinationAccounts = useMemo(
    () =>
      data.financeAccounts.filter((account) =>
        movementType === "top_up" ? account.accountType === "petty_cash" : true
      ),
    [data.financeAccounts, movementType]
  );

  const sourceAccount = data.financeAccounts.find((account) => account.number === sourceAccountNumber) ?? null;
  const destinationAccount =
    data.financeAccounts.find((account) => account.number === destinationAccountNumber) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextMode = defaultMode;
    const firstOperational =
      data.financeAccounts.find((account) => account.accountType !== "petty_cash") ?? data.financeAccounts[0];
    const firstPetty = pettyCashAccounts[0] ?? data.financeAccounts[0];

    setMovementType(nextMode);
    setSourceAccountNumber(
      presetSourceAccountNumber ??
        (nextMode === "top_up" ? firstOperational?.number ?? "" : firstOperational?.number ?? "")
    );
    setDestinationAccountNumber(
      presetDestinationAccountNumber ??
        (nextMode === "top_up" ? firstPetty?.number ?? "" : firstPetty?.number ?? "")
    );
    setAmount("0");
    setDate(today);
    setNote(nextMode === "top_up" ? "Weekly petty cash top up" : "");
    setError(null);
    setSubmitting(false);
  }, [
    data.financeAccounts,
    defaultMode,
    open,
    pettyCashAccounts,
    presetDestinationAccountNumber,
    presetSourceAccountNumber,
  ]);

  useEffect(() => {
    if (movementType !== "top_up") {
      return;
    }

    if (destinationAccount && destinationAccount.accountType !== "petty_cash") {
      setDestinationAccountNumber(pettyCashAccounts[0]?.number ?? "");
    }
  }, [destinationAccount, movementType, pettyCashAccounts]);

  const handleSubmit = async () => {
    const numericAmount = Number(amount);

    if (!sourceAccountNumber || !destinationAccountNumber) {
      setError("Choose both source and destination accounts.");
      return;
    }
    if (sourceAccountNumber === destinationAccountNumber) {
      setError("Choose two different accounts.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await createFinanceMovement({
        movementType,
        sourceAccountNumber,
        destinationAccountNumber,
        amount: numericAmount,
        date,
        note,
      });
      await refresh();
      onSaved?.();
      onOpenChange(false);
      toast.success(movementType === "top_up" ? "Petty cash topped up" : "Transfer recorded");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to record movement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                {movementType === "top_up" ? "Top Up Petty Cash" : "Transfer Between Accounts"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Record an internal finance movement and refresh the account activity view.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Movement type</Label>
                <Select value={movementType} onValueChange={(value) => setMovementType(value as "top_up" | "transfer")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top_up">Top up petty cash</SelectItem>
                    <SelectItem value="transfer">Transfer between accounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Source account</Label>
                <Select value={sourceAccountNumber} onValueChange={setSourceAccountNumber}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((account) => (
                      <SelectItem key={account.number} value={account.number}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Destination account</Label>
                <Select value={destinationAccountNumber} onValueChange={setDestinationAccountNumber}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationAccounts.map((account) => (
                      <SelectItem key={account.number} value={account.number}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount</Label>
                <Input className="mt-1.5" type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>

              <div>
                <Label>Effective date</Label>
                <Input className="mt-1.5" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>

              <div className="col-span-2">
                <Label>Note</Label>
                <Textarea className="mt-1.5 min-h-[96px]" value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium">{sourceAccount?.name ?? "-"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Destination</span>
                <span className="font-medium">{destinationAccount?.name ?? "-"}</span>
              </div>
            </div>

            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {movementType === "top_up" ? "Top Up" : "Record Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={movementType === "top_up" ? "Recording top up..." : "Recording transfer..."}
        message="Saving the finance movement to the backend."
      />
    </>
  );
};
