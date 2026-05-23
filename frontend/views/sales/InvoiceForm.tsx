import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PoAttachmentBox } from "@/components/sales/PoAttachmentBox";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Send, ArrowLeft, FileText, Loader2 } from "lucide-react";
import { createDocument, sendInvoiceToCustomer, uploadAttachments } from "@/lib/api";
import { formatMoney, getEnabledCurrencies, resolveExchangeRate } from "@/lib/currency";
import { createClientId, readFormString } from "@/lib/document-utils";
import { buildDocumentNumberPreview } from "@/lib/domain/numbering";
import { calculateDocumentTotals } from "@/lib/domain/totals";
import { toast } from "sonner";
import { useAppData } from "@/lib/app-data";

type Line = { id: string; desc: string; qty: number; unit: number };

const initialLines: Line[] = [
  { id: "1", desc: "Accounting Consulting (April 2026)", qty: 24, unit: 2500 },
  { id: "2", desc: "Software License - Pro (Annual)", qty: 1, unit: 18000 },
];

const InvoiceForm = () => {
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [customer, setCustomer] = useState("Bangkok Foods Co., Ltd.");
  const [currency, setCurrency] = useState("THB");
  const [projectId, setProjectId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 14");
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [poAttachmentFiles, setPoAttachmentFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState<"draft" | "send" | null>(null);

  const currencyOptions = useMemo(() => getEnabledCurrencies(data.currencySettings), [data.currencySettings]);
  const selectedProject = data.projects.find((project) => project.id === projectId) ?? null;

  const totals = calculateDocumentTotals(
    lines.map((line) => ({ qty: line.qty, price: line.unit, tax: 7 })),
    { defaultTaxRate: 7 }
  );
  const subtotal = totals.subtotal;
  const vat = totals.taxAmount;
  const total = totals.total;
  const invoiceNumberPreview = buildDocumentNumberPreview({
    mode: "yearly_reset",
    prefix: "INV",
    startAt: 143,
    dateText: "2026-04-18",
  });

  const addLine = () =>
    setLines((current) => [...current, { id: createClientId(), desc: "", qty: 1, unit: 0 }]);

  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));

  const updateLine = (id: string, key: keyof Line, value: string | number) =>
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              [key]:
                key === "desc"
                  ? String(value)
                  : Number.isFinite(Number(value))
                    ? Number(value)
                    : 0,
            }
          : line
      )
    );

  const submit = async (mode: "draft" | "send") => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const sanitizedLines = lines
      .map((line) => ({
        id: line.id,
        desc: line.desc.trim(),
        qty: Number(line.qty) || 0,
        price: Number(line.unit) || 0,
        tax: 7,
      }))
      .filter((line) => line.desc && line.qty > 0);

    if (!readFormString(formData, "customer") || sanitizedLines.length === 0) {
      toast.error("Please add a customer and at least one line item.");
      return;
    }

    setSubmitting(mode);

    try {
      const created = await createDocument("invoice", {
        number: readFormString(formData, "number"),
        customer: readFormString(formData, "customer"),
        date: readFormString(formData, "date"),
        due: readFormString(formData, "due"),
        reference: readFormString(formData, "reference"),
        currency: readFormString(formData, "currency"),
        exchangeRate: resolveExchangeRate(data.currencySettings, readFormString(formData, "currency") || "THB"),
        projectId,
        projectName: selectedProject?.name,
        paymentTerms: readFormString(formData, "paymentTerms"),
        notes: readFormString(formData, "notes"),
        status: mode === "draft" ? "draft" : "pending",
        lines: sanitizedLines,
      });

      if (poAttachmentFiles.length > 0) {
        await uploadAttachments({
          entityType: "invoice",
          entityId: created.id,
          files: poAttachmentFiles,
          category: "customer-po",
          note: "Customer PO / purchase order evidence. Internal record only; not printed on document PDF.",
          attachedBy: "Matter Acc.",
          tags: ["customer-po", "internal-only"],
        });
      }

      if (mode === "send") {
        await sendInvoiceToCustomer(created.id);
      }

      await refresh();
      setPoAttachmentFiles([]);
      toast.success(mode === "draft" ? `Draft ${created.id} saved` : `Invoice ${created.id} saved and sent`, {
        description: poAttachmentFiles.length > 0 ? `${poAttachmentFiles.length} PO file(s) attached` : undefined,
      });
      nav(`/sales/invoices/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save invoice.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <AppShell>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1" onClick={() => nav(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <form ref={formRef}>
        <input type="hidden" name="customer" value={customer} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="paymentTerms" value={paymentTerms} />

        <PageHeader
          title="New Invoice"
          breadcrumbs={[{ label: "Sales" }, { label: "Invoices" }, { label: "New" }]}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void submit("draft")}
                disabled={Boolean(submitting)}
              >
                {submitting === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save draft
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                onClick={() => void submit("send")}
                disabled={Boolean(submitting)}
              >
                {submitting === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Save &amp; Send
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="card-premium p-6">
              <h3 className="mb-4 flex items-center gap-2 font-display font-semibold">
                <FileText className="h-4 w-4 text-primary" /> Document details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Customer</Label>
                  <Select value={customer} onValueChange={setCustomer}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bangkok Foods Co., Ltd.">Bangkok Foods Co., Ltd.</SelectItem>
                      <SelectItem value="Siam Digital Studio">Siam Digital Studio</SelectItem>
                      <SelectItem value="Chiang Mai Crafts Ltd.">Chiang Mai Crafts Ltd.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Invoice number</Label>
                  <Input name="number" defaultValue={invoiceNumberPreview} className="mt-1.5 font-mono" />
                </div>
                <div>
                  <Label>Reference</Label>
                  <Input name="reference" placeholder="PO-2026-... (optional)" className="mt-1.5" />
                </div>
                <div>
                  <Label>Issue date</Label>
                  <Input name="date" type="date" defaultValue="2026-04-18" className="mt-1.5" />
                </div>
                <div>
                  <Label>Due date</Label>
                  <Input name="due" type="date" defaultValue="2026-05-02" className="mt-1.5" />
                </div>
                <div>
                  <Label>Currency</Label>
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
                <div>
                  <Label>Project</Label>
                  <Select value={projectId || "__none__"} onValueChange={(value) => setProjectId(value === "__none__" ? "" : value)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Optional project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {data.projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.code ? `${project.code} - ${project.name}` : project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 14">Net 14</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="card-premium p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display font-semibold">Line items</h3>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addLine}>
                  <Plus className="h-4 w-4" /> Add line
                </Button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-border/60 bg-card p-2">
                    <Input
                      className="col-span-6 border-0 bg-transparent focus-visible:ring-1"
                      value={line.desc}
                      onChange={(event) => updateLine(line.id, "desc", event.target.value)}
                    />
                    <Input
                      type="number"
                      className="col-span-2 border-0 bg-transparent text-right tabular-nums focus-visible:ring-1"
                      value={line.qty}
                      onChange={(event) => updateLine(line.id, "qty", event.target.value)}
                    />
                    <Input
                      type="number"
                      className="col-span-2 border-0 bg-transparent text-right tabular-nums focus-visible:ring-1"
                      value={line.unit}
                      onChange={(event) => updateLine(line.id, "unit", event.target.value)}
                    />
                    <div className="col-span-1 text-right text-sm font-semibold tabular-nums">
                      {formatMoney(line.qty * line.unit, currency)}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeLine(line.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="card-premium p-6">
              <h3 className="mb-3 font-display font-semibold">Notes / Terms</h3>
              <Textarea
                name="notes"
                rows={3}
                defaultValue="Net 14 days. Bank transfer to Bangkok Bank 123-4-56789-0."
              />
            </Card>

            <PoAttachmentBox
              files={poAttachmentFiles}
              onFilesChange={setPoAttachmentFiles}
              disabled={Boolean(submitting)}
            />
          </div>

          <div className="space-y-4">
            <Card className="card-premium sticky top-20 p-6">
              <h3 className="mb-4 font-display font-semibold">Totals</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="tabular-nums">{formatMoney(0, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">VAT 7%</dt>
                  <dd className="tabular-nums">{formatMoney(vat, currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3 font-display text-lg font-bold">
                  <dt>Total</dt>
                  <dd className="gradient-brand-text tabular-nums">{formatMoney(total, currency)}</dd>
                </div>
              </dl>
              <div className="mt-5 space-y-2">
                <Button
                  type="button"
                  className="w-full border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                  onClick={() => void submit("send")}
                  disabled={Boolean(submitting)}
                >
                  {submitting === "send" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  Save &amp; Send
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void submit("draft")}
                  disabled={Boolean(submitting)}
                >
                  {submitting === "draft" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Save as draft
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </AppShell>
  );
};

export default InvoiceForm;
