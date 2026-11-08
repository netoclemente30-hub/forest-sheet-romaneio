import type { Tora } from './data';
export type SugestaoPacote = { especie:string; autex:string; plaquetas:number[] };
export function gruposParaPacote(toras:Tora[], empresa:string):SugestaoPacote[] {
  const grupos=new Map<string,SugestaoPacote>();
  for(const t of toras) {
    if(t.empresa_id!==empresa||!t.serrada_em) continue;
    const especie=(t.especie??'').trim(), autex=(t.autex??'').trim();
    const chave=JSON.stringify([especie.toLocaleLowerCase('pt-BR'),autex.toLocaleLowerCase('pt-BR')]);
    const g=grupos.get(chave)??{especie,autex,plaquetas:[]};
    g.plaquetas.push(t.plaqueta); grupos.set(chave,g);
  }
  return [...grupos.values()];
}