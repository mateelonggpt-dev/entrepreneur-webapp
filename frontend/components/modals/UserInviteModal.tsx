import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { readFormString } from "@/lib/document-utils";
import type { TeamMember, UserRole } from "@/lib/types";
import { ProcessingDialog } from "./ProcessingDialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onInvite: (member: TeamMember) => Promise<void>;
}

export const UserInviteModal = ({ open, onOpenChange, onInvite }: Props) => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<TeamMember["role"]>("employee");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    formRef.current?.reset();
    setRole("employee");
    setSubmitting(false);
    setErrors({});
  }, [open]);

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
      nextErrors.name = t("userInvite.errors.nameRequired", { defaultValue: "Name is required." });
    }
    if (!email) {
      nextErrors.email = t("userInvite.errors.emailRequired", { defaultValue: "Email is required." });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(t("userInvite.errors.completeForm", { defaultValue: "Please complete the invite form." }));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onInvite({
        id: `USR-${Date.now()}`,
        name,
        email,
        role,
        status: "pending",
        lastSeen: "Invitation pending",
      });
      onOpenChange(false);
      toast.success(t("userInvite.invited", { defaultValue: "Team member invited" }), {
        description: t("userInvite.invitedDescription", {
          defaultValue: "{{name}} was added to the workspace list.",
          name,
        }),
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("userInvite.errors.unable", { defaultValue: "Unable to invite the user." })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                {t("userInvite.title", { defaultValue: "Invite Team Member" })}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("userInvite.description", {
                  defaultValue: "Add a teammate to the users list with a lightweight role assignment.",
                })}
              </p>
            </div>
          </div>

          <form ref={formRef} className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="invite-name">{t("userInvite.fullName", { defaultValue: "Full name" })}</Label>
                <Input id="invite-name" name="name" className="mt-1.5" />
                {errors.name ? <p className="mt-1 text-[11px] text-destructive">{errors.name}</p> : null}
              </div>

              <div className="col-span-2">
                <Label htmlFor="invite-email">{t("userInvite.email", { defaultValue: "Email" })}</Label>
                <Input id="invite-email" name="email" type="email" className="mt-1.5" />
                {errors.email ? <p className="mt-1 text-[11px] text-destructive">{errors.email}</p> : null}
              </div>

              <div className="col-span-2">
                <Label>{t("userInvite.role", { defaultValue: "Role" })}</Label>
                <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">
                      {t("userInvite.roles.employee", { defaultValue: "Employee" })}
                    </SelectItem>
                  </SelectContent>
                </Select>
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
              {t("userInvite.sendInvite", { defaultValue: "Send Invite" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={t("userInvite.savingTitle", { defaultValue: "Saving invitation..." })}
        message={t("userInvite.savingMessage", {
          defaultValue: "Persisting the team member to the backend settings store.",
        })}
      />
    </>
  );
};
