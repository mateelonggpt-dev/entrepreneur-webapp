export const fmtTHB = (n: number) =>
  "\u0e3f" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
