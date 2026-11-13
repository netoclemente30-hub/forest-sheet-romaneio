import { Trees } from "lucide-react";
import { FormularioLogin } from "@/components/FormularioLogin";

export function LoginScreen() {
  return (
    <div className="min-h-screen bg-forest flex flex-col justify-end sm:justify-center">
      <div className="px-6 pb-8 pt-16 text-primary-foreground">
        <Trees className="size-12 mb-3 text-accent" />
        <h1 className="text-5xl font-bold uppercase leading-none">Manejo<br />Florestal</h1>
        <p className="mt-2 opacity-80">Inventário, toras e romaneios de carga</p>
      </div>
      <div className="bg-card rounded-t-3xl sm:rounded-3xl sm:mx-auto sm:w-full sm:max-w-sm p-6">
        <FormularioLogin />
      </div>
    </div>
  );
}
