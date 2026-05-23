import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createFinanceAccount, updateFinanceAccount } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { getEnabledCurrencies } from "@/lib/currency";
import { readFormNumber, readFormString } from "@/lib/document-utils";
import type { FinanceAccount } from "@/lib/types";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AccountStatus = "active" | "inactive";
type AccountType =
  | "bank"
  | "petty_cash"
  | "cheque_payable"
  | "credit_card_payable"
  | "payment_gateway";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  account?: FinanceAccount | null;
  defaultAccountType?: AccountType;
  onSaved?: (account: FinanceAccount) => void;
}

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "petty_cash", label: "Petty Cash" },
  { value: "cheque_payable", label: "Cheque Payable" },
  { value: "credit_card_payable", label: "Credit Card Payable" },
  { value: "payment_gateway", label: "EDC / POS / Gateway" },
];

export const AccountModal = ({ open, onOpenChange, account, defaultAccountType = "bank", onSaved }: Props) => {
  const { data, refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [primary, setPrimary] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [currency, setCurrency] = useState("THB");
  const [status, setStatus] = useState<AccountStatus>("active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(account);
  const title = useMemo(() => (isEditing ? "Edit Account" : "Add Account"), [isEditing]);
  const currencyOptions = useMemo(() => getEnabledCurrencies(data.currencySettings), [data.currencySettings]);

  useEffect(() => {
    if (!open) {
      return;
    }

    formRef.current?.reset();
    setPrimary(Boolean(account?.primary));
    setAccountType((account?.accountType as AccountType | undefined) ?? defaultAccountType);
    setCurrency(account?.currency ?? data.currencySettings.baseCurrency ?? "THB");
    setStatus((account?.status as AccountStatus | undefined) ?? "active");
    setSubmitting(false);
    setError(null);
  }, [account, data.currencySettings.baseCurrency, defaultAccountType, open]);

  const handleSubmit = async () => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const name = readFormString(formData, "name");
    if (!name) {
      setError("Account name is required.");
      toast.error("Please complete the account form.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name,
        number: readFormString(formData, "number") || undefined,
        balance: readFormNumber(formData, "balance"),
        primary,
        accountType,
        status,
        institution: readFormString(formData, "institution"),
        currency,
      };

      const saved = account
        ? await updateFinanceAccount(account.number, {
            name: payload.name,
            balance: payload.balance,
            primary: payload.primary,
            accountType: payload.accountType,
            status: payload.status,
            institution: payload.institution,
            currency: payload.currency,
          })
        : await createFinanceAccount(payload);

      await refresh();
      onSaved?.(saved);
      onOpenChange(false);
      toast.success(account ? `Account ${saved.name} updated` : `Account ${saved.name} added`, {
        description: "The finance module has been refreshed.",
      });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to save account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add or update a bank, petty cash, cheque, credit card, or payment gateway account.
              </p>
            </div>
          </div>

          <form ref={formRef} className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="account-name">Account name</Label>
                <Input id="account-name" name="name" defaultValue={account?.name ?? ""} className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="account-number">Account number / reference</Label>
                <Input
                  id="account-number"
                  name="number"
                  defaultValue={account?.number ?? ""}
                  className="mt-1.5 font-mono"
                  disabled={isEditing}
                />
              </div>

              <div>
                <Label htmlFor="account-balance">Opening balance</Label>
                <Input
                  id="account-balance"
                  name="balance"
                  type="number"
                  defaultValue={account?.balance ?? 0}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Account type</Label>
                <Select value={accountType} onValueChange={(value) => setAccountType(value as AccountType)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as AccountStatus)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="account-institution">Institution / channel</Label>
                <Input
                  id="account-institution"
                  name="institution"
                  defaultValue={account?.institution ?? ""}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="account-currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((currencyCode) => (
                      <SelectItem key={currencyCode} value={currencyCode}>
                        {currencyCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-border/60 p-3">
                <Checkbox id="account-primary" checked={primary} onCheckedChange={(value) => setPrimary(Boolean(value))} />
                <Label htmlFor="account-primary" className="!mt-0 cursor-pointer">
                  Make this the primary account
                </Label>
              </div>
            </div>

            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          </form>

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
              {isEditing ? "Save Account" : "Add Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={isEditing ? "Saving account..." : "Adding account..."}
        message="Saving the finance account to the backend."
      />
    </>
  );
};
