export const readFormString = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

export const readFormNumber = (formData: FormData, name: string) => {
  const raw = readFormString(formData, name).replace(/,/g, "");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const createClientId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `tmp-${Date.now()}-${Math.round(Math.random() * 100000)}`;
};
