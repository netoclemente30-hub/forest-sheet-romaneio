// Ilustrações da página de apresentação.
// Só usam currentColor + classes de tema (text-primary / text-accent),
// nunca cores fixas, para continuarem legíveis no modo escuro.

type Props = { className?: string };

const base = "h-full w-full";

/** Tora com as duas pontas medidas e a régua de comprimento comercial. */
export function IlusManejo({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Tora medida nas duas pontas com comprimento arredondado para baixo" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <rect x="58" y="26" width="150" height="58" rx="10" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <ellipse cx="58" cy="55" rx="13" ry="29" strokeWidth="2" fill="currentColor" fillOpacity="0.14" />
        <path d="M196 33c6 5 6 39 0 44" strokeWidth="2" opacity="0.5" />
        {/* diâmetros na ponta */}
        <path d="M46 55h24M58 41v28" strokeWidth="2" opacity="0.75" />
        <circle cx="58" cy="55" r="3" fill="currentColor" stroke="none" />
        {/* diâmetros na outra ponta */}
        <path d="M196 47v16M188 55h16" strokeWidth="2" opacity="0.75" />
        <circle cx="196" cy="55" r="3" fill="currentColor" stroke="none" />
      </g>
      <g className="text-accent" fill="none" stroke="currentColor">
        <path d="M58 108h150" strokeWidth="2" />
        <path d="M58 102v12M208 102v12" strokeWidth="2" />
        <path d="M96 104v8M134 104v8M171 104v8" strokeWidth="1.5" opacity="0.6" />
        <path d="M208 108l-9-5v10z" fill="currentColor" stroke="none" />
      </g>
      <text x="58" y="126" fill="currentColor" fontSize="11" className="text-muted-foreground">comprimento para baixo, de meio em meio metro</text>
    </svg>
  );
}

/** Etiqueta com QR Code sendo lida pelo celular. */
export function IlusEtiqueta({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Etiqueta com QR Code lida pelo celular abrindo a página da tora" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <rect x="18" y="24" width="118" height="84" rx="8" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M34 40h44M34 52h30" strokeWidth="2" opacity="0.5" />
        <text x="34" y="76" fill="currentColor" fontSize="18" stroke="none" className="font-display" fontWeight="700">Árv. 353</text>
        <path d="M34 88h40" strokeWidth="2" opacity="0.5" />
        {/* QR */}
        <rect x="94" y="42" width="30" height="30" rx="3" strokeWidth="2" />
        <g fill="currentColor" stroke="none">
          <rect x="98" y="46" width="7" height="7" /><rect x="113" y="46" width="7" height="7" />
          <rect x="98" y="61" width="7" height="7" /><rect x="107" y="54" width="4" height="4" />
          <rect x="115" y="60" width="5" height="5" /><rect x="107" y="65" width="5" height="4" />
        </g>
        {/* celular */}
        <rect x="164" y="18" width="58" height="96" rx="10" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M180 30h26" strokeWidth="2" opacity="0.4" />
        <rect x="176" y="46" width="34" height="34" rx="4" strokeWidth="2" />
        <path d="M184 62h18" strokeWidth="2" opacity="0.5" />
      </g>
      <g className="text-accent" fill="none" stroke="currentColor">
        <path d="M150 60l-14-8v16z" fill="currentColor" stroke="none" opacity="0.8" />
        <path d="M140 52c6 5 6 11 0 16" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** Tora entrando na serraria e virando pacotes de madeira serrada. */
export function IlusSerraria({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Tora conferida no saldo e transformada em pacotes de madeira serrada" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <ellipse cx="40" cy="52" rx="11" ry="24" strokeWidth="2" fill="currentColor" fillOpacity="0.14" />
        <path d="M40 28h52v48H40" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        {/* serra */}
        <circle cx="132" cy="52" r="16" strokeWidth="2" strokeDasharray="5 4" />
        <circle cx="132" cy="52" r="4" fill="currentColor" stroke="none" />
        {/* pacotes */}
        <rect x="164" y="24" width="58" height="14" rx="3" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
        <rect x="164" y="44" width="58" height="14" rx="3" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
        <rect x="164" y="64" width="58" height="14" rx="3" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
        <path d="M182 24v14M200 24v14M182 44v14M200 44v14M182 64v14M200 64v14" strokeWidth="1.5" opacity="0.5" />
      </g>
      <g className="text-accent" fill="none" stroke="currentColor">
        <path d="M96 52h14M148 52h12" strokeWidth="2" />
        <path d="M110 47l6 5-6 5" strokeWidth="2" />
        <path d="M160 47l6 5-6 5" strokeWidth="2" />
      </g>
      <text x="20" y="112" fill="currentColor" fontSize="11" className="text-muted-foreground">saldo conferido · encaixe por volume · pacotes 5×15, 5×10, 5×7</text>
    </svg>
  );
}

/** Romaneio de carga com motorista, placas e o TXT da NF-e. */
export function IlusRomaneio({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Carga com motorista e placas e o arquivo TXT da NF-e" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <rect x="14" y="40" width="82" height="42" rx="5" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M96 52h22l14 14v16H96z" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <circle cx="42" cy="90" r="9" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <circle cx="112" cy="90" r="9" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M24 52h40M24 62h28" strokeWidth="2" opacity="0.5" />
        {/* documento TXT */}
        <rect x="158" y="18" width="68" height="96" rx="6" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <g strokeWidth="1.5" opacity="0.6">
          <path d="M168 36h48M168 48h48M168 60h48M168 72h48M168 84h34" />
        </g>
      </g>
      <g className="text-accent" fill="currentColor" stroke="none">
        <rect x="188" y="30" width="2" height="12" opacity="0.9" />
        <rect x="204" y="42" width="2" height="12" opacity="0.9" />
        <rect x="180" y="54" width="2" height="12" opacity="0.9" />
        <rect x="196" y="66" width="2" height="12" opacity="0.9" />
      </g>
      <text x="158" y="128" fill="currentColor" fontSize="11" className="text-muted-foreground">TXT NF-e pronto para baixar ou enviar</text>
    </svg>
  );
}

/** Celular no mato, sem sinal, com a fila de lançamentos guardada. */
export function IlusOffline({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Celular sem sinal guardando os lançamentos para enviar quando o sinal voltar" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <rect x="26" y="14" width="62" height="104" rx="10" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M46 24h22" strokeWidth="2" opacity="0.4" />
        <g strokeWidth="2" opacity="0.55">
          <path d="M40 46v-6M50 46v-10M60 46v-14" />
        </g>
        <path d="M38 52l30-22" strokeWidth="2" className="text-destructive" stroke="currentColor" />
        <g strokeWidth="1.5" opacity="0.6">
          <path d="M38 66h38M38 78h38M38 90h28" />
        </g>
        {/* nuvem */}
        <path d="M132 44c0-9 8-15 17-13 3-8 15-9 20-2 9-1 15 7 12 15h-49z" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
      </g>
      <g className="text-accent" fill="none" stroke="currentColor">
        <path d="M172 66v34" strokeWidth="2" strokeDasharray="6 5" />
        <path d="M166 94l6 8 6-8" strokeWidth="2" />
        <path d="M112 40l-14 4 8 6" strokeWidth="2" opacity="0.7" />
      </g>
      <text x="126" y="122" fill="currentColor" fontSize="11" className="text-muted-foreground">fila no aparelho · envia sozinha ao voltar o sinal</text>
    </svg>
  );
}

/** Mapa georreferenciado com o cortador em campo. */
export function IlusMapa({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Mapa georreferenciado com o número das árvores e o cortador em campo" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <rect x="20" y="16" width="200" height="100" rx="8" strokeWidth="2" fill="currentColor" fillOpacity="0.06" />
        <g strokeWidth="1.5" opacity="0.35">
          <path d="M20 46h200M20 76h200M80 16v100M140 16v100" />
        </g>
        <g strokeWidth="2">
          <circle cx="72" cy="58" r="6" /><circle cx="118" cy="42" r="6" /><circle cx="158" cy="70" r="6" /><circle cx="96" cy="86" r="6" />
        </g>
        <text x="82" y="56" fill="currentColor" fontSize="10" stroke="none">351</text>
        <text x="128" y="40" fill="currentColor" fontSize="10" stroke="none">352</text>
        <text x="168" y="68" fill="currentColor" fontSize="10" stroke="none">353</text>
      </g>
      <g className="text-gps">
        <circle cx="132" cy="94" r="9" fill="currentColor" fillOpacity="0.25" />
        <circle cx="132" cy="94" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}

/** Relatórios em PDF e Excel. */
export function IlusRelatorio({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Relatórios de rendimento e estoque em PDF e Excel" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <rect x="30" y="18" width="86" height="96" rx="6" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <g strokeWidth="2">
          <path d="M44 92v-22M58 92v-34M72 92v-14M86 92v-42M100 92v-26" />
        </g>
        <path d="M44 60l14-12 14 10 14-16 14 8" strokeWidth="2" opacity="0.6" />
        <rect x="134" y="30" width="76" height="72" rx="6" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <g strokeWidth="1.5" opacity="0.55">
          <path d="M134 48h76M134 64h76M134 80h76M160 30v72M186 30v72" />
        </g>
      </g>
      <g className="text-accent" fill="currentColor" stroke="none">
        <rect x="150" y="54" width="16" height="8" rx="2" opacity="0.8" />
        <rect x="176" y="70" width="16" height="8" rx="2" opacity="0.8" />
      </g>
    </svg>
  );
}

/** Auditoria: quem lançou, quando e onde. */
export function IlusAuditoria({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Registro de quem lançou cada tora, quando e em qual lugar" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <path d="M120 16l40 14v34c0 22-18 38-40 46-22-8-40-24-40-46V30z" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M104 62l12 12 22-26" strokeWidth="3" />
        <g strokeWidth="1.5" opacity="0.5">
          <path d="M24 40h44M24 58h36M24 76h40M172 40h44M172 58h36M172 76h40" />
        </g>
      </g>
      <g className="text-accent" fill="currentColor" stroke="none">
        <circle cx="30" cy="40" r="3" /><circle cx="30" cy="58" r="3" /><circle cx="30" cy="76" r="3" />
        <circle cx="178" cy="40" r="3" /><circle cx="178" cy="58" r="3" /><circle cx="178" cy="76" r="3" />
      </g>
    </svg>
  );
}

/** Várias empresas, cada uma com seus próprios dados. */
export function IlusEmpresas({ className = base }: Props) {
  return (
    <svg viewBox="0 0 240 132" role="img" aria-label="Cada empresa com seus próprios saldos e toras, separados por acesso" className={className}>
      <g className="text-primary" fill="none" stroke="currentColor">
        <rect x="22" y="42" width="70" height="70" rx="6" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M40 60h12M62 60h12M40 76h12M62 76h12M40 92h12M62 92h12" strokeWidth="1.5" opacity="0.55" />
        <rect x="148" y="42" width="70" height="70" rx="6" strokeWidth="2" fill="currentColor" fillOpacity="0.07" />
        <path d="M166 60h12M188 60h12M166 76h12M188 76h12M166 92h12M188 92h12" strokeWidth="1.5" opacity="0.55" />
        <path d="M120 20v14" strokeWidth="2" opacity="0.5" />
        <circle cx="120" cy="16" r="6" strokeWidth="2" />
      </g>
      <g className="text-accent" fill="none" stroke="currentColor">
        <path d="M104 76h32" strokeWidth="2" strokeDasharray="5 5" />
        <path d="M112 68l-8 8 8 8" strokeWidth="2" opacity="0.7" />
      </g>
    </svg>
  );
}
