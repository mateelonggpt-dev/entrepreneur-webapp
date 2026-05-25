import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/document-utils";
import { FileText, Image, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

interface PoAttachmentBoxProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

const acceptedPoTypes = "application/pdf,image/*";

export const PoAttachmentBox = ({ files, onFilesChange, disabled }: PoAttachmentBoxProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { i18n } = useTranslation();
  const isThai = i18n.language === "th";

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    onFilesChange([...files, ...Array.from(incoming)]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  return (
    <Card className="border-dashed border-sky-200 bg-sky-50/50 p-5 shadow-none">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <Paperclip className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold">{isThai ? "PO ลูกค้า / เอกสารอ้างอิงจากลูกค้า" : "Customer PO / Customer reference evidence"}</h3>
            <p className="text-sm font-medium text-slate-700">{isThai ? "แนบใบสั่งซื้อหรือเอกสารยืนยันจากลูกค้า" : "Attach the purchase order or confirmation from your customer"}</p>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              {isThai ? "ไฟล์นี้ใช้เป็นหลักฐานภายในเท่านั้น และจะไม่แสดงบนเอกสารพิมพ์หรือ PDF" : "These files are internal evidence only and will not appear on the printed document or PDF."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 bg-white"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> {isThai ? "แนบไฟล์ PO ลูกค้า" : "Add customer PO files"}
        </Button>
      </div>

      <Input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedPoTypes}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="mt-4 space-y-2">
        {files.length > 0 ? (
          files.map((file, index) => {
            const Icon = file.type.startsWith("image/") ? Image : FileText;
            return (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-lg border border-sky-100 bg-white p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={disabled}
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center rounded-lg border border-dashed border-sky-200 bg-white/80 px-4 py-5 text-center text-sm text-muted-foreground transition hover:border-sky-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isThai ? "ลากไฟล์มาวาง หรือเลือกไฟล์ PDF, JPG, PNG สำหรับ PO ลูกค้า" : "Drop or choose PDF, JPG, or PNG files for this customer PO."}
          </button>
        )}
      </div>
    </Card>
  );
};
