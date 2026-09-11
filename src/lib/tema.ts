export type Tema = "light" | "dark" | "system";

export function applicaTema(tema: Tema) {
  if (typeof document === "undefined") return;
  const scuro =
    tema === "dark" ||
    (tema === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", scuro);
}
