import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { downloadImportTemplate, previewImportFile, confirmImportRows } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import {
  IMPORT_EXPECTED_COLUMNS,
  IMPORT_MODE_DESCRIPTIONS,
  IMPORT_MODE_LABELS,
} from "@/lib/imports";
import type { ImportMode, ImportPreview, ImportPreviewRow } from "@/lib/types";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

const renderRowSummary = (mode: ImportMode, row: ImportPreviewRow) => {
  const mapped = row.mapped;
  if (mode === "contacts") {
    return `${String(mapped.code ?? "-")} • ${String(mapped.name ?? "-")} • ${String(mapped.contactType ?? "-")}`;
  }
  if (mode === "products") {
    return `${String(mapped.sku ?? "-")} • ${String(mapped.name ?? "-")} • ${String(mapped.productType ?? "-")}`;
  }
  return `${String(mapped.documentNumber ?? "-")} • ${String(mapped.customerName ?? mapped.customerCode ?? "-")} • ${String(mapped.lineDescription ?? "-")}`;
};

const ImportData = () => {
  const { refresh } = useAppData();
  const [mode, setMode] = useState<ImportMode>("contacts");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{
    batchId: string;
    importedCount: number;
    secondaryCount: number;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const canConfirm = useMemo(
    () =>
      Boolean(preview) &&
      preview!.summary.validRows > 0 &&
      preview!.summary.invalidRows === 0 &&
      !confirming,
    [confirming, preview]
  );

  const handleDownloadTemplate = async () => {
    try {
      await downloadImportTemplate(mode);
      toast.success(`${IMPORT_MODE_LABELS[mode]} template downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download template.");
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error("Choose a csv, xls, or xlsx file first.");
      return;
    }

    setPreviewing(true);
    setResult(null);

    try {
      const nextPreview = await previewImportFile(mode, file);
      setPreview(nextPreview);
      toast.success("Import preview ready");
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Unable to preview import file.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) {
      return;
    }

    setConfirming(true);
    try {
      const importResult = await confirmImportRows(mode, preview.rows);
      await refresh();
      setResult({
        batchId: importResult.batchId,
        importedCount: importResult.importedCount,
        secondaryCount: importResult.secondaryCount,
      });
      toast.success(`${importResult.importedCount} record(s) imported`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to confirm import.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Import Data"
        description="Download a template, preview parsed rows, and confirm validated imports into the live backend."
        breadcrumbs={[{ label: "Contacts & Products" }, { label: "Import Data" }]}
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card className="card-premium p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Import Setup</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {IMPORT_MODE_DESCRIPTIONS[mode]}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <Label>Template type</Label>
                <Select
                  value={mode}
                  onValueChange={(value) => {
                    setMode(value as ImportMode);
                    setPreview(null);
                    setResult(null);
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(IMPORT_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expected columns</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {IMPORT_EXPECTED_COLUMNS[mode].map((column) => (
                    <span key={column} className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-mono">
                      {column}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="import-file">Upload file</Label>
                <Input
                  id="import-file"
                  className="mt-1.5"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                    setResult(null);
                  }}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Supported formats: csv, xls, xlsx
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void handleDownloadTemplate()}>
                  Download Template
                </Button>
                <Button
                  className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                  onClick={() => void handlePreview()}
                  disabled={!file || previewing}
                >
                  {previewing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Preview Import
                </Button>
              </div>
            </div>
          </Card>

          {result ? (
            <Card className="card-premium p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-success">Import Complete</p>
              <h3 className="mt-2 font-display text-lg font-bold">{result.batchId}</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Imported {result.importedCount} primary record(s)
                {result.secondaryCount > 0 ? ` and ${result.secondaryCount} linked record(s).` : "."}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {preview ? (
            <>
              <Card className="card-premium p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview Summary</p>
                    <h2 className="mt-2 font-display text-lg font-bold">{preview.fileName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {preview.summary.totalRows} row(s) • {preview.summary.validRows} valid • {preview.summary.invalidRows} invalid
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void handlePreview()} disabled={!file || previewing}>
                      Refresh Preview
                    </Button>
                    <Button
                      className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                      onClick={() => void handleConfirm()}
                      disabled={!canConfirm}
                    >
                      {confirming ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Confirm Import
                    </Button>
                  </div>
                </div>
                {!canConfirm ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {preview.summary.invalidRows > 0
                      ? "Resolve invalid rows first. Confirm stays disabled until all rows are valid."
                      : "Preview the file first to enable import confirmation."}
                  </p>
                ) : null}
              </Card>

              <Card className="card-premium overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 text-left font-semibold">Row</th>
                        <th className="px-3 py-3 text-left font-semibold">Mapped Summary</th>
                        <th className="px-3 py-3 text-left font-semibold">Detected Columns</th>
                        <th className="px-3 py-3 text-left font-semibold">Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={`${row.rowNumber}-${renderRowSummary(mode, row)}`} className="border-t border-border/50 align-top">
                          <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">{row.rowNumber}</td>
                          <td className="px-3 py-3.5">
                            <p className="font-medium">{renderRowSummary(mode, row)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {Object.entries(row.mapped)
                                .slice(0, 5)
                                .map(([key, value]) => `${key}: ${String(value ?? "-")}`)
                                .join(" • ")}
                            </p>
                          </td>
                          <td className="px-3 py-3.5 text-xs text-muted-foreground">
                            {preview.detectedColumns.join(", ")}
                          </td>
                          <td className="px-3 py-3.5">
                            {row.valid ? (
                              <span className="inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                                Valid
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {row.errors.map((error) => (
                                  <p key={error} className="text-xs text-destructive">
                                    {error}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <EmptyState
              title="No import preview yet"
              description="Choose a template type, download the matching file, upload your sheet, and preview row-level validation before anything is written."
              icon={<UploadCloud className="h-10 w-10 text-primary" />}
              action={{ label: "Download Template", onClick: () => void handleDownloadTemplate() }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default ImportData;
