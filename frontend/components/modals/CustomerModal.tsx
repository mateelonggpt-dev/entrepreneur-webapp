import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = Boolean(customer);
  const title = useMemo(() => (isEditing ? t("contacts.editCustomer") : t("contacts.newCustomer")), [isEditing, t]);
  const description = useMemo(
    () =>
      isEditing
        ? t("contacts.modals.customerEditDescription")
        : t("contacts.modals.customerCreateDescription"),
    [isEditing, t]
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
      nextErrors.name = t("contacts.validation.customerNameRequired");
    }

    if (!email) {
      nextErrors.email = t("contacts.validation.emailRequired");
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(t("contacts.validation.completeCustomerForm"));
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
        customer
          ? t("contacts.toast.customerUpdated", { id: saved.id })
          : t("contacts.toast.customerCreated", { id: saved.id }),
        {
          description: t("contacts.toast.customerAvailable", { name: saved.name }),
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contacts.toast.unableToSaveCustomer"));
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
                <Label htmlFor="customer-name">{t("contacts.fields.customerName")}</Label>
                <Input id="customer-name" name="name" defaultValue={customer?.name ?? ""} className="mt-1.5" />
                {errors.name ? <p className="mt-1 text-[11px] text-destructive">{errors.name}</p> : null}
              </div>

              <div>
                <Label htmlFor="customer-contact">{t("contacts.fields.contactPerson")}</Label>
                <Input id="customer-contact" name="contact" defaultValue={customer?.contact ?? ""} className="mt-1.5" />
              </div>

              <div>
                <Label>{t("contacts.fields.status")}</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as "active" | "inactive")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("status.active")}</SelectItem>
                    <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="customer-phone">{t("contacts.fields.phone")}</Label>
                <Input id="customer-phone" name="phone" defaultValue={customer?.phone ?? ""} className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="customer-tax-id">{t("contacts.fields.taxId")}</Label>
                <Input
                  id="customer-tax-id"
                  name="taxId"
                  defaultValue={customer?.taxId ?? ""}
                  className="mt-1.5 font-mono"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="customer-email">{t("contacts.fields.email")}</Label>
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
                <Label htmlFor="customer-address">{t("contacts.fields.address")}</Label>
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
              {t("common.cancel")}
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {isEditing ? t("contacts.actions.saveCustomer") : t("contacts.actions.createCustomer")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={isEditing ? t("contacts.processing.savingCustomer") : t("contacts.processing.creatingCustomer")}
        message={t("contacts.processing.customerMessage")}
      />
    </>
  );
};
