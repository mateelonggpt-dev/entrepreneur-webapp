export type RemainingTaskStatus = "pending" | "completed";

export type RemainingTask = {
  id: string;
  title: string;
  relatedDocumentNumber: string;
  documentType: string;
  missingEvidenceType:
    | "payment"
    | "tax_invoice"
    | "inventory"
    | "invoiceReceipt"
    | "paymentEvidence"
    | "deliveryEvidence"
    | "withholdingTaxEvidence";
  createdDate: string;
  status: RemainingTaskStatus;
  documentPath: string;
};

const STORAGE_KEY = "matter.remainingTasks";

export const readRemainingTasks = (): RemainingTask[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as RemainingTask[];
  } catch {
    return [];
  }
};

export const saveRemainingTasks = (tasks: RemainingTask[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event("matter.remainingTasksChanged"));
};

export const upsertRemainingTasks = (tasks: RemainingTask[]) => {
  const current = readRemainingTasks();
  const keyed = new Map(current.map((task) => [task.id, task]));
  tasks.forEach((task) => keyed.set(task.id, { ...keyed.get(task.id), ...task }));
  saveRemainingTasks(Array.from(keyed.values()).sort((a, b) => b.createdDate.localeCompare(a.createdDate)));
};

export const completeEvidenceTasks = (documentNumber: string, evidenceType: RemainingTask["missingEvidenceType"]) => {
  const aliases: Record<string, RemainingTask["missingEvidenceType"][]> = {
    payment: ["payment", "paymentEvidence"],
    tax_invoice: ["tax_invoice", "invoiceReceipt"],
    inventory: ["inventory", "deliveryEvidence"],
    withholding_tax: ["withholdingTaxEvidence"],
  };
  const matchingTypes = aliases[evidenceType] ?? [evidenceType];
  saveRemainingTasks(
    readRemainingTasks().map((task) =>
      task.relatedDocumentNumber === documentNumber && matchingTypes.includes(task.missingEvidenceType)
        ? { ...task, status: "completed" }
        : task
    )
  );
};
