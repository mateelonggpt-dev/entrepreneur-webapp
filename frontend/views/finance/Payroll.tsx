import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  createPayrollRun,
  downloadPayrollRun,
  fetchPayrollEmployees,
  fetchPayrollRuns,
  fetchPayrollSettings,
  savePayrollEmployee,
  savePayrollSettings,
} from "@/lib/api";
import type { PayrollEmployee, PayrollRun, PayrollSettingsShell } from "@/lib/types";
import { fmtTHB } from "@/lib/demo-data";
import { Download, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

const emptyEmployee: Omit<PayrollEmployee, "id"> = {
  name: "",
  email: "",
  department: "",
  position: "",
  baseSalary: 0,
  paymentMethod: "bank_transfer",
  bankAccountHint: "",
  status: "active",
};

const emptySettings: PayrollSettingsShell = {
  defaultPayDate: "",
  salaryExpenseAccount: "",
  salaryPayableAccount: "",
  withholdingEnabled: true,
  socialSecurityEnabled: true,
  socialSecurityRate: 5,
  notes: "",
};

const Payroll = () => {
  const [settings, setSettings] = useState<PayrollSettingsShell>(emptySettings);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [employeeDraft, setEmployeeDraft] = useState<{ id?: string } & Omit<PayrollEmployee, "id">>(emptyEmployee);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runPeriod, setRunPeriod] = useState("2026-04");
  const [runPayDate, setRunPayDate] = useState("2026-04-30");
  const [runNotes, setRunNotes] = useState("");

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "active"),
    [employees]
  );

  const monthlySalary = useMemo(
    () => activeEmployees.reduce((total, employee) => total + employee.baseSalary, 0),
    [activeEmployees]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [nextSettings, nextEmployees, nextRuns] = await Promise.all([
        fetchPayrollSettings(),
        fetchPayrollEmployees(),
        fetchPayrollRuns(),
      ]);
      setSettings(nextSettings);
      setEmployees(nextEmployees);
      setRuns(nextRuns);
      setRunPayDate(nextSettings.defaultPayDate || "2026-04-30");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load payroll shell.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const saved = await savePayrollSettings(settings);
      setSettings(saved);
      toast.success("Payroll settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save payroll settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const openNewEmployee = (employee?: PayrollEmployee) => {
    setEmployeeDraft(
      employee
        ? { ...employee }
        : {
            ...emptyEmployee,
          }
    );
    setEmployeeOpen(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeDraft.name || !employeeDraft.email) {
      toast.error("Employee name and email are required.");
      return;
    }
    setSavingEmployee(true);
    try {
      await savePayrollEmployee(employeeDraft);
      await loadData();
      setEmployeeOpen(false);
      toast.success(employeeDraft.id ? "Employee updated" : "Employee added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save employee.");
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleCreateRun = async () => {
    setRunSubmitting(true);
    try {
      await createPayrollRun({
        period: runPeriod,
        payDate: runPayDate,
        notes: runNotes,
        employeeIds: activeEmployees.map((employee) => employee.id),
      });
      await loadData();
      setRunOpen(false);
      setRunNotes("");
      toast.success("Payroll run created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create payroll run.");
    } finally {
      setRunSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Payroll Foundations"
        description="Salary setup, employee shells, payment-run preparation, and export boundaries for future payroll expansion."
        breadcrumbs={[{ label: "Finance & Reports" }, { label: "Payroll Foundations" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setRunOpen(true)}>
              Run salary payment
            </Button>
            <Button
              size="sm"
              className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => openNewEmployee()}
            >
              <Plus className="h-4 w-4" /> New employee
            </Button>
          </>
        }
      />

      {loading ? (
        <Card className="card-premium p-8 text-sm text-muted-foreground">Loading payroll shell...</Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card className="card-premium p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active employees</p>
              <p className="mt-2 font-display text-2xl font-bold">{activeEmployees.length}</p>
            </Card>
            <Card className="card-premium p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly salary base</p>
              <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(monthlySalary)}</p>
            </Card>
            <Card className="card-premium p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payroll runs</p>
              <p className="mt-2 font-display text-2xl font-bold">{runs.length}</p>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="card-premium p-6">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold">Salary setup shell</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Store default payroll posting accounts, pay date, and deduction behavior for future payroll automation.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Default pay date</Label>
                  <Input
                    type="date"
                    className="mt-1.5"
                    value={settings.defaultPayDate}
                    onChange={(event) => setSettings((previous) => ({ ...previous, defaultPayDate: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>Social security rate (%)</Label>
                  <Input
                    type="number"
                    className="mt-1.5"
                    value={settings.socialSecurityRate}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        socialSecurityRate: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Salary expense account</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.salaryExpenseAccount}
                    onChange={(event) =>
                      setSettings((previous) => ({ ...previous, salaryExpenseAccount: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Salary payable account</Label>
                  <Input
                    className="mt-1.5"
                    value={settings.salaryPayableAccount}
                    onChange={(event) =>
                      setSettings((previous) => ({ ...previous, salaryPayableAccount: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                  <div>
                    <p className="text-sm font-semibold">Withholding tax shell</p>
                    <p className="text-xs text-muted-foreground">Prepare employee salary runs for future tax deduction handling.</p>
                  </div>
                  <Switch
                    checked={settings.withholdingEnabled}
                    onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, withholdingEnabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                  <div>
                    <p className="text-sm font-semibold">Social security shell</p>
                    <p className="text-xs text-muted-foreground">Apply a shared contribution shell to payroll runs.</p>
                  </div>
                  <Switch
                    checked={settings.socialSecurityEnabled}
                    onCheckedChange={(checked) => setSettings((previous) => ({ ...previous, socialSecurityEnabled: checked }))}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label>Notes</Label>
                <Textarea
                  className="mt-1.5 min-h-[96px]"
                  value={settings.notes}
                  onChange={(event) => setSettings((previous) => ({ ...previous, notes: event.target.value }))}
                />
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                  onClick={() => void handleSaveSettings()}
                  disabled={savingSettings}
                >
                  {savingSettings ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Save setup
                </Button>
              </div>
            </Card>

            <Card className="card-premium p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">Employee list shell</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add employees for salary runs, payslip export placeholders, and future payroll posting.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openNewEmployee()}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add employee
                </Button>
              </div>

              <div className="space-y-3">
                {employees.map((employee) => (
                  <div key={employee.id} className="rounded-xl border border-border/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold">{employee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {employee.position || "Team member"} - {employee.department || "Unassigned"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{fmtTHB(employee.baseSalary)}</p>
                        <p className="text-xs text-muted-foreground">
                          {employee.paymentMethod.replace("_", " ")} - {employee.bankAccountHint || "No payout note"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openNewEmployee(employee)}>
                        Edit employee
                      </Button>
                    </div>
                  </div>
                ))}

                {employees.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                    No employees yet.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <Card className="card-premium mt-6 p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Salary payment runs</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prepare salary runs, keep run-level summaries, and export payslip-ready data shells.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setRunOpen(true)}>
                Create salary run
              </Button>
            </div>

            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold">{run.id}</p>
                      <p className="text-xs text-muted-foreground">
                        Period {run.period} - Pay date {run.payDate} - {run.employeeCount} employee(s)
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{run.notes || "Payroll shell run"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{fmtTHB(run.netPay)}</p>
                      <p className="text-xs text-muted-foreground">
                        Gross {fmtTHB(run.grossPay)} - Deductions {fmtTHB(run.deductions)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void downloadPayrollRun(run.id)}>
                      <Download className="mr-1.5 h-4 w-4" /> Export payslip shell
                    </Button>
                  </div>
                </div>
              ))}

              {runs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  No payroll runs created yet.
                </div>
              ) : null}
            </div>
          </Card>
        </>
      )}

      <Dialog open={employeeOpen} onOpenChange={setEmployeeOpen}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">
                  {employeeDraft.id ? "Edit employee" : "New employee"}
                </h2>
                <p className="text-xs text-muted-foreground">Store a payroll-ready employee profile.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  className="mt-1.5"
                  value={employeeDraft.name}
                  onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, name: event.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  className="mt-1.5"
                  value={employeeDraft.email}
                  onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, email: event.target.value }))}
                />
              </div>
              <div>
                <Label>Department</Label>
                <Input
                  className="mt-1.5"
                  value={employeeDraft.department || ""}
                  onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, department: event.target.value }))}
                />
              </div>
              <div>
                <Label>Position</Label>
                <Input
                  className="mt-1.5"
                  value={employeeDraft.position || ""}
                  onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, position: event.target.value }))}
                />
              </div>
              <div>
                <Label>Base salary</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={employeeDraft.baseSalary}
                  onChange={(event) =>
                    setEmployeeDraft((previous) => ({
                      ...previous,
                      baseSalary: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
              <div>
                <Label>Payout note</Label>
                <Input
                  className="mt-1.5"
                  value={employeeDraft.bankAccountHint || ""}
                  onChange={(event) =>
                    setEmployeeDraft((previous) => ({ ...previous, bankAccountHint: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEmployeeOpen(false)} disabled={savingEmployee}>
                Cancel
              </Button>
              <Button
                className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                onClick={() => void handleSaveEmployee()}
                disabled={savingEmployee}
              >
                {savingEmployee ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save employee
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-xl">
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold">Create salary run</h2>
              <p className="text-xs text-muted-foreground">
                Generate a payroll run shell from the current active employee list.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Payroll period</Label>
                <Input className="mt-1.5" value={runPeriod} onChange={(event) => setRunPeriod(event.target.value)} />
              </div>
              <div>
                <Label>Pay date</Label>
                <Input type="date" className="mt-1.5" value={runPayDate} onChange={(event) => setRunPayDate(event.target.value)} />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1.5 min-h-[96px]" value={runNotes} onChange={(event) => setRunNotes(event.target.value)} />
            </div>

            <div className="rounded-xl border border-border/60 p-4 text-sm">
              <p className="font-semibold">Run summary</p>
              <p className="mt-1 text-muted-foreground">
                {activeEmployees.length} active employee(s) will be included with a gross salary base of {fmtTHB(monthlySalary)}.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRunOpen(false)} disabled={runSubmitting}>
                Cancel
              </Button>
              <Button
                className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                onClick={() => void handleCreateRun()}
                disabled={runSubmitting}
              >
                {runSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Create run
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Payroll;
