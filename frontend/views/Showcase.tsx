import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReceiptText, Paperclip, FileText, Sparkles, Loader2 } from "lucide-react";
import { EvidenceAttachmentModal, ExpenseDocumentModal } from "@/components/modals/DomainModals";
import {
  MascotLoader,
  ProcessingCard,
  InlineLoader,
  FullPageLoader,
} from "@/components/brand/MascotLoader";

const Showcase = () => {
  const [openReceive, setOpenReceive] = useState(false);
  const [openEvidence, setOpenEvidence] = useState(false);
  const [openPO, setOpenPO] = useState(false);
  const [openProcessing, setOpenProcessing] = useState(false);
  const [showFullPage, setShowFullPage] = useState(false);
  const [progress, setProgress] = useState(42);

  return (
    <AppShell>
      <PageHeader
        title="UI Showcase"
        description="Preview the new modals and loading states."
      />

      <Tabs defaultValue="modals" className="mt-6">
        <TabsList>
          <TabsTrigger value="modals">Modals</TabsTrigger>
          <TabsTrigger value="loaders">Loading System</TabsTrigger>
        </TabsList>

        {/* Modals */}
        <TabsContent value="modals" className="mt-6 grid md:grid-cols-3 gap-4">
          {[
            { icon: ReceiptText, title: "New Receive", desc: "Workflow modal with evidence upload + 5 stacked form blocks.", action: () => setOpenReceive(true), label: "Open New Receive" },
            { icon: Paperclip, title: "Attach Evidence", desc: "Multi-file attachment to a linked receive record with metadata.", action: () => setOpenEvidence(true), label: "Open Attach Evidence" },
            { icon: FileText, title: "Purchase Order", desc: "Paper-style document modal — vendor, line items, signatures.", action: () => setOpenPO(true), label: "Open Purchase Order" },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.title} className="p-6 card-premium flex flex-col">
                <div className="h-11 w-11 rounded-xl bg-gradient-brand text-primary-foreground flex items-center justify-center shadow-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display font-bold text-base">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground flex-1">{c.desc}</p>
                <Button onClick={c.action} className="mt-4 bg-gradient-brand text-primary-foreground border-0 shadow-brand">
                  {c.label}
                </Button>
              </Card>
            );
          })}
        </TabsContent>

        {/* Loaders */}
        <TabsContent value="loaders" className="mt-6 space-y-6">
          {/* Atomic loaders */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-8 card-premium flex flex-col items-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">Circular ring · indeterminate</p>
              <MascotLoader size={120} variant="ring" />
              <p className="mt-6 text-sm font-medium">Loading your workspace…</p>
            </Card>
            <Card className="p-8 card-premium flex flex-col items-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">Horizontal bar · {progress}%</p>
              <MascotLoader size={120} variant="bar" progress={progress} />
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setProgress((p) => Math.max(0, p - 15))}>− 15%</Button>
                <Button size="sm" variant="outline" onClick={() => setProgress((p) => Math.min(100, p + 15))}>+ 15%</Button>
              </div>
            </Card>
          </div>

          {/* Composed loaders */}
          <div className="grid md:grid-cols-3 gap-4">
            <ProcessingCard
              title="Generating your report…"
              message="Compiling Q1 2025 financial statements."
              variant="bar"
            />
            <ProcessingCard
              title="Switching page…"
              message="Almost there."
              variant="ring"
            />
            <Card className="p-6 card-premium flex flex-col gap-4 justify-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inline loaders</p>
              <InlineLoader label="Saving draft…" />
              <InlineLoader label="Syncing with bank…" size={32} />
              <InlineLoader label="Almost there…" />
            </Card>
          </div>

          {/* Trigger buttons */}
          <Card className="p-6 card-premium flex flex-wrap gap-3 items-center">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Try the full-screen states:</p>
            <Button onClick={() => setOpenProcessing(true)} variant="outline" className="gap-1.5">
              <Loader2 className="h-3.5 w-3.5" /> Open processing modal
            </Button>
            <Button
              onClick={() => {
                setShowFullPage(true);
                setTimeout(() => setShowFullPage(false), 3500);
              }}
              variant="outline"
            >
              Show full-page loader (3s)
            </Button>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Modals */}
      <ExpenseDocumentModal kind="receive" open={openReceive} onOpenChange={setOpenReceive} />
      <EvidenceAttachmentModal open={openEvidence} onOpenChange={setOpenEvidence} />
      <ExpenseDocumentModal kind="purchase_order" open={openPO} onOpenChange={setOpenPO} />

      {/* Processing demo modal */}
      <Dialog open={openProcessing} onOpenChange={setOpenProcessing}>
        <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none">
          <ProcessingCard
            title="Processing your request…"
            message="Validating evidence and posting to the ledger."
            progress={progress}
            variant="bar"
          />
        </DialogContent>
      </Dialog>

      {/* Full-page demo */}
      {showFullPage && (
        <FullPageLoader title="Preparing your dashboard…" message="Almost there." />
      )}
    </AppShell>
  );
};

export default Showcase;
