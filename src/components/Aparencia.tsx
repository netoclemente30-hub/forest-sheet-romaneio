import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Tema = "light" | "dark";
const Contexto = createContext<{ tema: Tema; escolher: (tema: Tema) => void }>({ tema: "light", escolher: () => {} });

export function AparenciaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("light");
  useEffect(() => {
    let salvo: string | null = null;
    try { salvo = localStorage.getItem("gestor-aparencia"); } catch { /* Storage may be unavailable. */ }
    const inicial = salvo === "dark" ? "dark" : "light";
    setTema(inicial);
    document.documentElement.classList.toggle("dark", inicial === "dark");
    document.documentElement.style.colorScheme = inicial;
  }, []);
  function escolher(proximo: Tema) {
    setTema(proximo);
    document.documentElement.classList.toggle("dark", proximo === "dark");
    document.documentElement.style.colorScheme = proximo;
    try { localStorage.setItem("gestor-aparencia", proximo); } catch { /* Keep the choice for this visit. */ }
  }
  return <Contexto.Provider value={{ tema, escolher }}>{children}</Contexto.Provider>;
}

export function EscolherAparencia() {
  const { tema, escolher } = useContext(Contexto);
  return (
    <ToggleGroup type="single" value={tema} onValueChange={(valor) => { if (valor === "light" || valor === "dark") escolher(valor); }} aria-label="Aparência" className="gap-0 rounded-md bg-card p-0.5 text-foreground">
      <ToggleGroupItem value="light" aria-label="Versão clara" title="Versão clara" className="h-8 w-8 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"><Sun className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Versão escura" title="Versão escura" className="h-8 w-8 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"><Moon className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  );
}