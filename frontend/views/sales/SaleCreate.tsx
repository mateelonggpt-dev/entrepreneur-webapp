import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DocumentTypeSelector } from "@/components/documents/DocumentTypeSelector";
import { SalesDocumentForm } from "@/components/sales/SalesDocumentForm";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAppData } from "@/lib/app-data";
import {
  SALE_DOCUMENT_TYPE_OPTIONS,
  QUOTATION_INCOMPATIBILITY_HELPER,
  buildSalesDocumentTitle,
  getDisabledSalesDocumentTypes,
  getRealDocumentTypes,
  sanitizeSalesDocumentTypes,
} from "@/lib/document-sections";
import { buildSalesWorkflow, collectSalesWorkflowDocuments, type SalesWorkflowStepId } from "@/lib/sales-workflow";
import type { DocumentKind } from "@/lib/types";

type InvoicePaymentMode = "full_payment" | "partial_payment" | "deposit";
type DocumentLanguage = "th" | "en";

const getDocumentLanguage = (value: string | null): DocumentLanguage => (value === "en" ? "en" : "th");

const SaleCreate = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { data } = useAppData();
  const activeLanguage = i18n.language?.startsWith("th") ? "th" : "en";
  const queryDefaults = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const documentTypes = (params.get("documentTypes") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      selectedTypes: documentTypes.length ? sanitizeSalesDocumentTypes(documentTypes) : ["none"],
      initialTaxInvoice: documentTypes.includes("tax_invoice"),
      initialInvoicePaymentMode: ((
        params.get("documentVariant") === "deposit_invoice"
          ? "deposit"
          : params.get("flow") === "installment"
            ? "partial_payment"
            : undefined
      ) as InvoicePaymentMode | undefined),
      sourceDocumentId: params.get("sourceDocumentId") ?? "",
      sourceDocumentType: (params.get("sourceDocumentType") || undefined) as DocumentKind | undefined,
      workflowSourceId: params.get("workflowSourceId") ?? "",
      workflowStep: (params.get("workflowStep") || undefined) as SalesWorkflowStepId | undefined,
      duplicateDocumentId: params.get("duplicateDocumentId") ?? "",
      duplicateDocumentType: (params.get("duplicateDocumentType") || params.get("sourceDocumentType") || undefined) as DocumentKind | undefined,
      documentLanguage: getDocumentLanguage(params.get("documentLanguage")),
    };
  }, [location.search]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(queryDefaults.selectedTypes);
  const realTypes = useMemo(() => getRealDocumentTypes(selectedTypes), [selectedTypes]);
  const documentTitle = useMemo(() => buildSalesDocumentTitle(realTypes, activeLanguage), [activeLanguage, realTypes]);
  const disabledReasons = useMemo(() => getDisabledSalesDocumentTypes(selectedTypes), [selectedTypes]);
  const workflowDisabledReasons = useMemo(() => {
    const sourceId = queryDefaults.workflowSourceId || queryDefaults.sourceDocumentId;
    if (!sourceId) return {};
    const workflowDocuments = collectSalesWorkflowDocuments(data);
    const source = workflowDocuments.find((document) => document.id === sourceId);
    if (!source) return {};
    const workflow = buildSalesWorkflow(source, workflowDocuments, data.linkedDocumentGraph);
    const disabled: Record<string, string> = {};
    const text = t("incomeCreate.workflowStepComplete");
    workflow.steps.forEach((step) => {
      if (step.status !== "complete") return;
      const ids = step.id === "invoice" ? ["invoice"] : [step.id];
      ids.forEach((id) => {
        if (queryDefaults.workflowStep === step.id) return;
        disabled[id] = text;
      });
    });
    return disabled;
  }, [data, queryDefaults.sourceDocumentId, queryDefaults.workflowSourceId, queryDefaults.workflowStep, t]);
  const localizedDisabledReasons = useMemo(() => {
    const translateReason = (reason: string) => {
      if (reason === QUOTATION_INCOMPATIBILITY_HELPER) {
        return t("incomeCreate.quotationIncompatibility");
      }
      if (reason === "This document type cannot be combined with the current Income document selection.") {
        return t("incomeCreate.documentCombinationDisabled");
      }
      return reason;
    };

    return Object.fromEntries(
      Object.entries(disabledReasons).map(([kind, reason]) => [kind, translateReason(reason)])
    );
  }, [disabledReasons, t]);
  const mergedDisabledReasons = useMemo(
    () => ({ ...localizedDisabledReasons, ...workflowDisabledReasons }),
    [localizedDisabledReasons, workflowDisabledReasons]
  );
  const updateSelectedTypes = (values: string[]) => setSelectedTypes(sanitizeSalesDocumentTypes(values));

  return (
    <AppShell>
      <PageHeader
        title={t("incomeCreate.title")}
        description={t("incomeCreate.description")}
        breadcrumbs={[{ label: t("common.income") }, { label: t("common.create") }]}
      />

      <Card className="card-premium mb-6 p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("incomeCreate.documentTypesTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("incomeCreate.documentTypesDescription")}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {realTypes.length === 0
              ? t("incomeCreate.noDocumentSelected")
              : t("incomeCreate.selectedCount", { count: realTypes.length })}
          </Badge>
        </div>

        <DocumentTypeSelector
          options={SALE_DOCUMENT_TYPE_OPTIONS}
          selectedValues={selectedTypes}
          onSelectedValuesChange={updateSelectedTypes}
          language={activeLanguage}
          otherMenuLabel={t("incomeCreate.otherDocuments")}
          disabledReasons={mergedDisabledReasons}
        />

        {Object.keys(mergedDisabledReasons).length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {Object.keys(workflowDisabledReasons).length > 0
              ? t("incomeCreate.completedWorkflowDisabled")
              : t("incomeCreate.quotationIncompatibility")}
          </p>
        ) : null}

        {documentTitle ? (
          <div className="mt-4 rounded-xl border border-primary/20 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
            {documentTitle}
          </div>
        ) : null}
      </Card>

      {realTypes.length > 0 ? (
        <SalesDocumentForm
          selectedDocumentTypes={realTypes}
          language={queryDefaults.documentLanguage}
          mode="create"
          initialSourceDocumentId={queryDefaults.sourceDocumentId}
          initialSourceDocumentType={queryDefaults.sourceDocumentType}
          initialDuplicateDocumentId={queryDefaults.duplicateDocumentId}
          initialDuplicateDocumentType={queryDefaults.duplicateDocumentType}
          initialTaxInvoice={queryDefaults.initialTaxInvoice || realTypes.includes("tax_invoice")}
          initialInvoicePaymentMode={queryDefaults.initialInvoicePaymentMode}
        />
      ) : (
        <Card className="card-premium p-8 text-center text-sm text-muted-foreground">
          {t("incomeCreate.emptyState")}
        </Card>
      )}
    </AppShell>
  );
};

export default SaleCreate;
