import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Building,
  Image as ImageIcon,
  ReceiptText,
  Users,
  Package,
  Landmark,
  FileText,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Mascot } from "@/components/brand/Mascot";
import { LangSwitch } from "@/components/brand/LangSwitch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  completeOnboarding,
  fetchOnboardingState,
  saveOnboardingDraft,
} from "@/lib/api";
import type { OnboardingDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const steps = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "company", label: "Company", icon: Building },
  { id: "logo", label: "Logo", icon: ImageIcon },
  { id: "tax", label: "Taxes", icon: ReceiptText },
  { id: "customer", label: "First customer", icon: Users },
  { id: "product", label: "First product", icon: Package },
  { id: "bank", label: "Bank account", icon: Landmark },
  { id: "invoice", label: "First invoice", icon: FileText },
  { id: "team", label: "Invite team", icon: UserPlus },
] as const;

const defaultDraft: OnboardingDraft = {
  step: 0,
  companyName: "",
  companyTaxId: "",
  companyBranch: "",
  companyAddress: "",
  logoName: "",
  vatRegistration: "Registered (7%)",
  vatRate: "7",
  taxFrequency: "Monthly (P.P.30)",
  issueWht: true,
  customerName: "",
  customerTaxId: "",
  customerEmail: "",
  productType: "Service",
  productSku: "",
  productName: "",
  productPrice: "",
  bankName: "Bangkok Bank",
  bankAccountName: "",
  bankAccountNumber: "",
  invites: [
    { email: "", role: "Accountant" },
    { email: "", role: "Manager" },
  ],
};

const Onboarding = () => {
  const nav = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<OnboardingDraft>(defaultDraft);
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [saveMessage, setSaveMessage] = useState("Loading setup...");
  const hasLoadedDraftRef = useRef(false);
  const skipNextSaveRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadDraft = async () => {
      try {
        const response = await fetchOnboardingState();
        if (!active) {
          return;
        }
        setDraft(response.draft);
        setSaveMessage(response.completed ? "Setup already completed." : "Setup saved to your workspace.");
      } catch (error) {
        if (!active) {
          return;
        }
        setSaveMessage("Unable to load setup state.");
        toast.error(error instanceof Error ? error.message : "Unable to load onboarding state.");
      } finally {
        if (active) {
          hasLoadedDraftRef.current = true;
          setInitializing(false);
        }
      }
    };

    void loadDraft();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedDraftRef.current || initializing) {
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    let active = true;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaving(true);
    setSaveMessage("Saving setup...");
    saveTimerRef.current = window.setTimeout(() => {
      void saveOnboardingDraft(draft)
        .then(() => {
          if (!active) {
            return;
          }
          setSaveMessage("Setup saved to your workspace.");
        })
        .catch((error) => {
          if (!active) {
            return;
          }
          const message =
            error instanceof Error ? error.message : "Unable to save onboarding progress.";
          setSaveMessage(message);
          toast.error(message);
        })
        .finally(() => {
          if (active) {
            setSaving(false);
          }
        });
    }, 350);

    return () => {
      active = false;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [draft, initializing]);

  const step = draft.step;
  const Active = steps[step].icon;
  const isLast = step === steps.length - 1;
  const progress = ((step + 1) / steps.length) * 100;

  const next = async () => {
    if (isLast) {
      try {
        setFinishing(true);
        setSaveMessage("Finishing setup...");
        await completeOnboarding(draft);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to finish onboarding.");
        setSaveMessage("Unable to finish setup.");
        setFinishing(false);
        return;
      }
      nav("/app");
      return;
    }
    setDraft((previous) => ({ ...previous, step: previous.step + 1 }));
  };

  const back = () => {
    setDraft((previous) => ({ ...previous, step: Math.max(0, previous.step - 1) }));
  };

  const invoicePreviewTotal = useMemo(() => {
    const base = Number(draft.productPrice || 0);
    const vatRate = Number(draft.vatRate || 0) / 100;
    return base + base * vatRate;
  }, [draft.productPrice, draft.vatRate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link to="/">
            <BrandMark size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <LangSwitch />
            <button
              onClick={() => nav("/app")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
          </div>
        </div>
        <div className="h-1 bg-secondary">
          <div className="h-full bg-gradient-brand transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-border p-6 lg:block">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Setup · {step + 1}/{steps.length}
          </p>
          <ol className="space-y-1">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isDone = index < step;
              const isActive = index === step;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => index <= step && setDraft((previous) => ({ ...previous, step: index }))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                      isActive && "bg-primary/10 text-primary",
                      !isActive && isDone && "text-foreground hover:bg-secondary/60",
                      !isActive && !isDone && "text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition",
                        isActive && "bg-gradient-brand text-primary-foreground shadow-brand",
                        !isActive && isDone && "bg-success/15 text-success",
                        !isActive && !isDone && "bg-secondary"
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="flex-1">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="flex items-start justify-center p-6 lg:p-12">
          <div className="w-full max-w-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
                    <Active className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Step {step + 1} of {steps.length}
                  </span>
                </div>

                {step === 0 ? (
                  <Card className="card-premium p-8 text-center">
                    <Mascot size="lg" className="mx-auto mb-4" />
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">
                      Welcome to Matter Acc.
                    </h1>
                    <p className="mx-auto max-w-md text-muted-foreground">
                      Let&apos;s set up your workspace in about 2 minutes. Every step is saved to your
                      backend workspace, so you can refresh and continue later.
                    </p>
                  </Card>
                ) : null}

                {step === 1 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">
                      Tell us about your company
                    </h1>
                    <p className="mb-6 text-muted-foreground">
                      This goes on your invoices and tax documents.
                    </p>
                    <Card className="card-premium space-y-4 p-6">
                      <div>
                        <Label>Company name</Label>
                        <Input
                          className="mt-1.5 h-11"
                          placeholder="Siam Tech Co., Ltd."
                          value={draft.companyName}
                          onChange={(event) => setDraft((previous) => ({ ...previous, companyName: event.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Tax ID (VAT)</Label>
                          <Input
                            className="mt-1.5 h-11 font-mono"
                            placeholder="0105561234567"
                            value={draft.companyTaxId}
                            onChange={(event) => setDraft((previous) => ({ ...previous, companyTaxId: event.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Branch</Label>
                          <Input
                            className="mt-1.5 h-11"
                            placeholder="Head Office (00000)"
                            value={draft.companyBranch}
                            onChange={(event) => setDraft((previous) => ({ ...previous, companyBranch: event.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Address</Label>
                        <Input
                          className="mt-1.5 h-11"
                          placeholder="123 Sukhumvit Rd., Bangkok"
                          value={draft.companyAddress}
                          onChange={(event) => setDraft((previous) => ({ ...previous, companyAddress: event.target.value }))}
                        />
                      </div>
                    </Card>
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">Upload your logo</h1>
                    <p className="mb-6 text-muted-foreground">
                      It will appear on every invoice and customer-facing document.
                    </p>
                    <Card className="card-premium p-6">
                      <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center transition hover:border-primary/40 hover:bg-primary/5">
                        <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                        <p className="font-semibold">Drop your logo here</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          PNG or SVG up to 2MB. The selected filename is saved with the onboarding
                          draft in your workspace.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Browse files
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".png,.svg,.jpg,.jpeg"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            setDraft((previous) => ({ ...previous, logoName: file.name }));
                          }}
                        />
                        {draft.logoName ? (
                          <p className="mt-3 text-xs font-medium text-primary">Selected: {draft.logoName}</p>
                        ) : null}
                      </div>
                    </Card>
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">Tax preferences</h1>
                    <p className="mb-6 text-muted-foreground">
                      Set your default VAT rate and withholding behavior.
                    </p>
                    <Card className="card-premium space-y-4 p-6">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>VAT registration</Label>
                          <select
                            className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={draft.vatRegistration}
                            onChange={(event) => setDraft((previous) => ({ ...previous, vatRegistration: event.target.value }))}
                          >
                            <option>Registered (7%)</option>
                            <option>Not registered</option>
                          </select>
                        </div>
                        <div>
                          <Label>Default VAT rate</Label>
                          <Input
                            className="mt-1.5 h-11"
                            value={draft.vatRate}
                            onChange={(event) => setDraft((previous) => ({ ...previous, vatRate: event.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Tax filing frequency</Label>
                        <select
                          className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={draft.taxFrequency}
                          onChange={(event) => setDraft((previous) => ({ ...previous, taxFrequency: event.target.value }))}
                        >
                          <option>Monthly (P.P.30)</option>
                          <option>Quarterly</option>
                        </select>
                      </div>
                      <label className="flex cursor-pointer items-start gap-2.5 border-t border-border pt-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.issueWht}
                          onChange={(event) => setDraft((previous) => ({ ...previous, issueWht: event.target.checked }))}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-semibold">Issue Withholding Tax certificates (P.N.D.3/53)</span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Recommended for B2B businesses paying service vendors.
                          </span>
                        </span>
                      </label>
                    </Card>
                  </>
                ) : null}

                {step === 4 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">Add your first customer</h1>
                    <p className="mb-6 text-muted-foreground">
                      You can always add more later or import from CSV.
                    </p>
                    <Card className="card-premium space-y-4 p-6">
                      <div>
                        <Label>Customer name</Label>
                        <Input
                          className="mt-1.5 h-11"
                          placeholder="Bangkok Foods Co., Ltd."
                          value={draft.customerName}
                          onChange={(event) => setDraft((previous) => ({ ...previous, customerName: event.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Tax ID</Label>
                          <Input
                            className="mt-1.5 h-11 font-mono"
                            placeholder="0105..."
                            value={draft.customerTaxId}
                            onChange={(event) => setDraft((previous) => ({ ...previous, customerTaxId: event.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input
                            className="mt-1.5 h-11"
                            placeholder="ap@customer.co.th"
                            value={draft.customerEmail}
                            onChange={(event) => setDraft((previous) => ({ ...previous, customerEmail: event.target.value }))}
                          />
                        </div>
                      </div>
                    </Card>
                  </>
                ) : null}

                {step === 5 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">
                      Add your first product or service
                    </h1>
                    <p className="mb-6 text-muted-foreground">
                      This will be selectable when creating invoices.
                    </p>
                    <Card className="card-premium space-y-4 p-6">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Type</Label>
                          <select
                            className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={draft.productType}
                            onChange={(event) => setDraft((previous) => ({ ...previous, productType: event.target.value }))}
                          >
                            <option>Service</option>
                            <option>Goods</option>
                          </select>
                        </div>
                        <div>
                          <Label>SKU</Label>
                          <Input
                            className="mt-1.5 h-11 font-mono"
                            placeholder="SVC-CONS-01"
                            value={draft.productSku}
                            onChange={(event) => setDraft((previous) => ({ ...previous, productSku: event.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Name</Label>
                        <Input
                          className="mt-1.5 h-11"
                          placeholder="Accounting Consulting (1h)"
                          value={draft.productName}
                          onChange={(event) => setDraft((previous) => ({ ...previous, productName: event.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Default price (THB)</Label>
                        <Input
                          className="mt-1.5 h-11"
                          placeholder="2500"
                          value={draft.productPrice}
                          onChange={(event) => setDraft((previous) => ({ ...previous, productPrice: event.target.value }))}
                        />
                      </div>
                    </Card>
                  </>
                ) : null}

                {step === 6 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">Connect a bank account</h1>
                    <p className="mb-6 text-muted-foreground">
                      Use this for payment receipts and optional future auto-reconciliation.
                    </p>
                    <Card className="card-premium space-y-4 p-6">
                      <div>
                        <Label>Bank</Label>
                        <select
                          className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={draft.bankName}
                          onChange={(event) => setDraft((previous) => ({ ...previous, bankName: event.target.value }))}
                        >
                          <option>Bangkok Bank</option>
                          <option>Kasikorn Bank</option>
                          <option>SCB</option>
                          <option>Krungsri</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Account name</Label>
                          <Input
                            className="mt-1.5 h-11"
                            placeholder="Siam Tech Co., Ltd."
                            value={draft.bankAccountName}
                            onChange={(event) => setDraft((previous) => ({ ...previous, bankAccountName: event.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Account number</Label>
                          <Input
                            className="mt-1.5 h-11 font-mono"
                            placeholder="123-4-56789-0"
                            value={draft.bankAccountNumber}
                            onChange={(event) => setDraft((previous) => ({ ...previous, bankAccountNumber: event.target.value }))}
                          />
                        </div>
                      </div>
                    </Card>
                  </>
                ) : null}

                {step === 7 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">Create your first invoice</h1>
                    <p className="mb-6 text-muted-foreground">
                      We&apos;ll pre-fill it using the customer and product you just added.
                    </p>
                    <Card className="card-premium bg-gradient-card p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <BrandMark size="sm" />
                        <p className="font-mono text-sm font-bold">INV-2026-0001</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="text-muted-foreground">Bill to:</span>{" "}
                          {draft.customerName || "Bangkok Foods Co., Ltd."}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Item:</span>{" "}
                          {draft.productName || "Accounting Consulting (1h)"} × 1
                        </p>
                        <div className="flex justify-between border-t border-border pt-2 font-bold">
                          <span>Total</span>
                          <span className="gradient-brand-text tabular-nums">
                            THB {invoicePreviewTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </>
                ) : null}

                {step === 8 ? (
                  <>
                    <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">Invite your team</h1>
                    <p className="mb-6 text-muted-foreground">
                      Add accountants, managers, or staff. This invitation list is saved in your
                      onboarding draft in the backend.
                    </p>
                    <Card className="card-premium space-y-3 p-6">
                      {draft.invites.map((invite, index) => (
                        <div key={`${index}-${invite.role}`} className="grid grid-cols-[1fr_160px] gap-3">
                          <Input
                            className="h-11"
                            placeholder={`teammate${index + 1}@company.co.th`}
                            value={invite.email}
                            onChange={(event) =>
                              setDraft((previous) => ({
                                ...previous,
                                invites: previous.invites.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, email: event.target.value } : item
                                ),
                              }))
                            }
                          />
                          <select
                            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={invite.role}
                            onChange={(event) =>
                              setDraft((previous) => ({
                                ...previous,
                                invites: previous.invites.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, role: event.target.value } : item
                                ),
                              }))
                            }
                          >
                            <option>Accountant</option>
                            <option>Manager</option>
                            <option>Staff</option>
                            <option>Read-only</option>
                          </select>
                        </div>
                      ))}

                      <button
                        className="text-sm font-semibold text-primary hover:underline"
                        onClick={() =>
                          setDraft((previous) => ({
                            ...previous,
                            invites: [...previous.invites, { email: "", role: "Staff" }],
                          }))
                        }
                      >
                        + Add another invite
                      </button>
                    </Card>
                  </>
                ) : null}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-between gap-4">
              <div className="text-xs text-muted-foreground">
                {saving || finishing ? "Saving..." : saveMessage}
              </div>
              <Button
                variant="ghost"
                onClick={back}
                disabled={step === 0 || initializing || finishing}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex items-center gap-2">
                {!isLast && step > 0 ? (
                  <Button variant="outline" onClick={() => void next()} disabled={initializing || finishing}>
                    Skip
                  </Button>
                ) : null}
                <Button
                  onClick={() => void next()}
                  disabled={initializing || finishing}
                  className="min-w-[140px] gap-1.5 border-0 bg-gradient-brand font-semibold text-primary-foreground shadow-brand hover:opacity-95"
                >
                  {isLast ? "Enter dashboard" : step === 0 ? "Let's start" : "Continue"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Onboarding;
