import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createCustomer, updateCustomer } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { readFormString } from "@/lib/document-utils";
import type { Customer } from "@/lib/types";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customer?: Customer | null;
  onSaved?: (customer: Customer) => void;
}

export const CustomerModal = ({ open, onOpenChange, customer, onSaved }: Props) => {
  const { refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = Boolean(customer);
  const title = useMemo(() => (isEditing ? "Edit Customer" : "New Customer"), [isEditing]);
  const description = useMemo(
    () =>
      isEditing
        ? "Update the customer profile used in sales and receivables."
        : "Create a customer profile for invoicing and receivables.",
    [isEditing]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSubmitting(false);
    setErrors({});
    setStatus(customer?.status === "inactive" ? "inactive" : "active");

    const form = formRef.current;
    if (!form) {
      return;
    }

    form.reset();
  }, [customer, open]);

  const handleSubmit = async () => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const name = readFormString(formData, "name");
    const email = readFormString(formData, "email");
    const nextErrors: Record<string, string> = {};

    if (!name) {
      nextErrors.name = "Customer name is required.";
    }

    if (!email) {
      nextErrors.email = "Email is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Please complete the customer form.");
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const payload = {
        name,
        contact: readFormString(formData, "contact"),
        email,
        phone: readFormString(formData, "phone"),
        taxId: readFormString(formData, "taxId"),
        address: readFormString(formData, "address"),
        status,
      };

      const saved = customer
        ? await updateCustomer(customer.id, payload)
        : await createCustomer(payload);

      await refresh();
      onSaved?.(saved);
      onOpenChange(false);
      toast.success(
        customer ? `Customer ${saved.id} updated` : `Customer ${saved.id} created`,
        {
          description: `${saved.name} is now available in Contacts.`,
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save customer.");
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
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>

          <form ref={formRef} className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="customer-name">Customer name</Label>
                <Input id="customer-name" name="name" defaultValue={customer?.name ?? ""} className="mt-1.5" />
                {errors.name ? <p className="mt-1 text-[11px] text-destructive">{errors.name}</p> : null}
              </div>

              <div>
                <Label htmlFor="customer-contact">Primary contact</Label>
                <Input id="customer-contact" name="contact" defaultValue={customer?.contact ?? ""} className="mt-1.5" />
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

              <div>
                <Label htmlFor="customer-phone">Phone</Label>
                <Input id="customer-phone" name="phone" defaultValue={customer?.phone ?? ""} className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="customer-tax-id">Tax ID</Label>
                <Input
                  id="customer-tax-id"
                  name="taxId"
                  defaultValue={customer?.taxId ?? ""}
                  className="mt-1.5 font-mono"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  name="email"
                  type="email"
                  defaultValue={customer?.email ?? ""}
                  className="mt-1.5"
                />
                {errors.email ? <p className="mt-1 text-[11px] text-destructive">{errors.email}</p> : null}
              </div>

              <div className="col-span-2">
                <Label htmlFor="customer-address">Address</Label>
                <Textarea
                  id="customer-address"
                  name="address"
                  defaultValue={customer?.address ?? ""}
                  className="mt-1.5 min-h-[92px]"
                />
              </div>
            </div>
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
              {isEditing ? "Save Customer" : "Create Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={isEditing ? "Saving customer..." : "Creating customer..."}
        message="Saving the customer profile to the backend."
      />
    </>
  );
};
