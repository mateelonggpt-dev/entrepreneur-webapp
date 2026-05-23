import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IntegrationConnection, IntegrationStatus } from "@/lib/types";
import { Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  connection: IntegrationConnection | null;
  onSave: (connection: IntegrationConnection) => Promise<void>;
}

const configLabels: Record<string, string> = {
  merchantId: "Merchant ID",
  branchCode: "Branch code",
  apiKeyLabel: "API key label",
  senderEmail: "Sender email",
  certificateLabel: "Certificate label",
  baseUrl: "Base URL",
  notes: "Notes",
};

export const IntegrationConfigModal = ({ open, onOpenChange, connection, onSave }: Props) => {
  const [status, setStatus] = useState<IntegrationStatus>("disconnected");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !connection) {
      return;
    }
    setStatus(connection.status);
    setConfig(connection.config ?? {});
    setSubmitting(false);
  }, [connection, open]);

  if (!connection) {
    return null;
  }

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave({
        ...connection,
        status,
        lastSync: status === "connected" ? new Date().toISOString().slice(0, 16).replace("T", " ") : connection.lastSync,
        config,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save integration configuration.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">{connection.name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{connection.description}</p>
          </div>
        </div>

        <div className="space-y-5 bg-background px-6 py-5">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as IntegrationStatus)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="needs_configuration">Needs configuration</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
                <SelectItem value="coming_soon">Coming soon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(config).map(([key, value]) =>
              key === "notes" ? null : (
                <div key={key}>
                  <Label>{configLabels[key] ?? key}</Label>
                  <Input
                    className="mt-1.5"
                    value={value}
                    onChange={(event) =>
                      setConfig((previous) => ({ ...previous, [key]: event.target.value }))
                    }
                  />
                </div>
              )
            )}
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              className="mt-1.5 min-h-[96px]"
              value={config.notes ?? ""}
              onChange={(event) =>
                setConfig((previous) => ({ ...previous, notes: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
