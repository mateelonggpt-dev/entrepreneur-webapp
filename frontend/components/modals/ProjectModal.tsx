import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createProject, updateProject } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import type { Project } from "@/lib/types";
import { BriefcaseBusiness, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  project?: Project | null;
  onSaved?: (project: Project) => void;
}

export const ProjectModal = ({ open, onOpenChange, project, onSaved }: Props) => {
  const { data, refresh } = useAppData();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(project?.id);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(project?.name ?? "");
    setCode(project?.code ?? "");
    setStatus((project?.status as "active" | "inactive") ?? "active");
    setCustomer(project?.customer ?? "");
    setDescription(project?.description ?? "");
    setError(null);
    setSubmitting(false);
  }, [open, project]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        status,
        customer: customer.trim(),
        description: description.trim(),
      };

      const saved = project
        ? await updateProject(project.id, payload)
        : await createProject(payload);

      await refresh();
      onSaved?.(saved);
      onOpenChange(false);
      toast.success(project ? `Project ${saved.name} updated` : `Project ${saved.name} created`);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to save project.");
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
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                {isEditing ? "Edit Project" : "New Project"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Maintain reusable projects for document tagging and profitability reporting.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Project name</Label>
                <Input className="mt-1.5" value={name} onChange={(event) => setName(event.target.value)} />
              </div>

              <div>
                <Label>Project code</Label>
                <Input className="mt-1.5" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as "active" | "inactive")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Customer / owner</Label>
                <Input
                  className="mt-1.5"
                  list="project-customers"
                  value={customer}
                  onChange={(event) => setCustomer(event.target.value)}
                  placeholder="Optional customer or internal owner"
                />
                <datalist id="project-customers">
                  {data.customers.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>

              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea className="mt-1.5 min-h-[110px]" value={description} onChange={(event) => setDescription(event.target.value)} />
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
              {isEditing ? "Save Project" : "Create Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={isEditing ? "Saving project..." : "Creating project..."}
        message="Updating the shared project list for reporting and document tagging."
      />
    </>
  );
};
