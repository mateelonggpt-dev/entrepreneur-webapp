import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image as ImageIcon, X, Paperclip, Plus, ReceiptText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/document-utils";
import { uploadAttachments } from "@/lib/api";
import { completeEvidenceTasks } from "@/lib/remaining-tasks";
import type { Attachment } from "@/lib/types";
import { ProcessingDialog } from "./ProcessingDialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType?: string;
  entityId?: string;
  receive?: { number: string; date: string; from: string; amount: string };
  onSaved?: (attachments: Attachment[]) => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export const AttachEvidenceModal = ({
  open,
  onOpenChange,
  entityType = "receive",
  entityId,
  receive = {
    number: "REC-2026-0142",
    date: "Apr 18, 2026",
    from: "Acme Co., Ltd.",
    amount: "THB 125,000.00",
  },
  onSaved,
}: Props) => {
  const linkedEntityId = entityId ?? receive.number;
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [drag, setDrag] = useState(false);
  const [category, setCategory] = useState("bank-slip");
  const [tags, setTags] = useState(["original", "verified-2026"]);
  const [tagInput, setTagInput] = useState("");
  const [note, setNote] = useState("");
  const [attachedBy, setAttachedBy] = useState("Sarah Chen");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFiles([]);
    setSelectedIndex(0);
    setDrag(false);
    setCategory("bank-slip");
    setTags(["original", "verified-2026"]);
    setTagInput("");
    setNote("");
    setAttachedBy("Sarah Chen");
    setSubmitting(false);
    setError(null);
  }, [open]);

  const selected = files[selectedIndex] ?? null;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) {
      return;
    }

    setFiles((current) => {
      const next = [...current, ...Array.from(incoming)];
      if (current.length === 0) {
        setSelectedIndex(0);
      }
      return next;
    });
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setSelectedIndex((current) => Math.max(0, current === index ? current - 1 : current));
  };

  const addTag = () => {
    const normalized = tagInput.trim();
    if (!normalized || tags.includes(normalized)) {
      setTagInput("");
      return;
    }

    setTags((current) => [...current, normalized]);
    setTagInput("");
  };

  const submit = async () => {
    if (files.length === 0) {
      setError("Please choose at least one file to attach.");
      toast.error("Select a file before saving attachments.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const created = await uploadAttachments({
        entityType,
        entityId: linkedEntityId,
        files,
        category,
        note,
        attachedBy,
        tags,
      });

      onSaved?.(created);
      if (category.includes("bank") || category.includes("payment") || category.includes("slip") || category.includes("receipt")) {
        completeEvidenceTasks(linkedEntityId, "payment");
      }
      if (category.includes("tax")) {
        completeEvidenceTasks(linkedEntityId, "tax_invoice");
      }
      if (category.includes("receive") || category.includes("delivery") || category.includes("inventory")) {
        completeEvidenceTasks(linkedEntityId, "inventory");
      }
      onOpenChange(false);
      toast.success("Evidence attached", {
        description: `${created.length} file(s) uploaded to backend storage.`,
      });
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload attachments.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[84vh] w-[78vw] max-w-none gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-premium">
          <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-info to-primary text-primary-foreground shadow-md">
                <Paperclip className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold leading-tight">Attach Evidence</h2>
                <p className="text-xs text-muted-foreground">
                  These files support record <span className="font-medium text-foreground">{linkedEntityId}</span>.
                </p>
              </div>
            </div>
          </header>

          <div className="grid flex-1 grid-cols-[3fr_2fr] overflow-hidden">
            <div className="flex flex-col gap-4 overflow-y-auto border-r border-border bg-secondary/30 p-5">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-md">
                {selected ? (
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-brand-soft">
                      {selected.type.startsWith("image/") ? (
                        <ImageIcon className="h-10 w-10 text-primary" />
                      ) : (
                        <FileText className="h-10 w-10 text-primary" />
                      )}
                    </div>
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selected.size)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No file selected</p>
                )}
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDrag(false);
                  addFiles(event.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-5 py-4 transition",
                  drag ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  multiple
                  onChange={(event) => addFiles(event.target.files)}
                />
                <Upload className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Drop files or click to browse</p>
                  <p className="text-[11px] text-muted-foreground">PDF, PNG, JPG up to 10 MB each</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
              {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

              <div className="space-y-1.5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Attachments ({files.length})
                </p>
                {files.map((file, index) => (
                  <button
                    type="button"
                    key={`${file.name}-${index}`}
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition",
                      index === selectedIndex
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 bg-card hover:border-primary/30"
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFile(index);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          removeFile(index);
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto bg-background p-6">
              <section className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary">
                  <ReceiptText className="h-3.5 w-3.5" />
                  LINKED RECORD
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Number</p>
                    <p className="font-mono font-semibold">{linkedEntityId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</p>
                    <p className="font-medium">{receive.date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">From</p>
                    <p className="truncate font-medium">{receive.from}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
                    <p className="font-mono font-semibold text-success">{receive.amount}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  File metadata
                </h3>

                <Field label="File type / category">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank-slip">Bank slip</SelectItem>
                      <SelectItem value="customer-po">Customer PO / Purchase Order</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="invoice">Invoice copy</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="other">Other supporting document</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Note / description">
                  <Textarea
                    rows={3}
                    placeholder="Add context for your team or auditors..."
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Upload date">
                    <Input type="date" defaultValue="2026-04-18" readOnly />
                  </Field>
                  <Field label="Attached by">
                    <Input value={attachedBy} onChange={(event) => setAttachedBy(event.target.value)} />
                  </Field>
                </div>

                <Field label="Verification tags">
                  <div className="min-h-[40px] rounded-md border border-input bg-background p-2">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => setTags((current) => current.filter((value) => value !== tag))}
                          />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-[80px] flex-1 bg-transparent text-xs outline-none"
                        placeholder="Add tag..."
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addTag();
                          }
                        }}
                      />
                      <Button type="button" size="sm" variant="outline" onClick={addTag}>
                        Add
                      </Button>
                    </div>
                  </div>
                </Field>
              </section>
            </div>
          </div>

          <footer className="flex items-center justify-between border-t border-border bg-card px-6 py-3.5">
            <p className="text-[11px] text-muted-foreground">{files.length} file(s) ready to attach</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={submitting}>
                Upload Another
              </Button>
              <Button
                type="button"
                className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                onClick={() => void submit()}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save Attachment
              </Button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title="Uploading evidence..."
        message="Files and metadata are being stored in backend storage."
      />
    </>
  );
};
