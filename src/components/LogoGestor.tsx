import { LOGO_GESTOR_FLORESTAL } from "@/lib/logo-gestor";

export function LogoGestor({ className = "size-8", alt = "" }: { className?: string; alt?: string }) {
  return <img src={LOGO_GESTOR_FLORESTAL} alt={alt} className={`shrink-0 rounded object-contain ${className}`} />;
}
