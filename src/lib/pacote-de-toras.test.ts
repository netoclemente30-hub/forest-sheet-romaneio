import { expect,it } from 'vitest';
import { gruposParaPacote } from './pacote-de-toras';
import type { Tora } from './data';
const tora=(plaqueta:number,especie:string,autex:string,empresa_id='empresa',serrada_em:string|null='2026-11-08')=>({plaqueta,especie,autex,empresa_id,serrada_em} as Tora);
it('sugere espécie e AUTEX diretamente para seleção homogênea',()=>{
  expect(gruposParaPacote([tora(1,'Cupiúba','123'),tora(2,'Cupiúba','123')],'empresa')).toEqual([{especie:'Cupiúba',autex:'123',plaquetas:[1,2]}]);
});
it('separa espécies e AUTEX diferentes sem inventar combinação',()=>{
  const g=gruposParaPacote([tora(1,'Cupiúba','123'),tora(2,'Cupiúba','456'),tora(3,'Abiurana','123')],'empresa');
  expect(g).toHaveLength(3);expect(g.map(i=>i.plaquetas)).toEqual([[1],[2],[3]]);
});
it('não usa toras não serradas ou de outra empresa',()=>{
  expect(gruposParaPacote([tora(1,'Cupiúba','123','outra'),tora(2,'Cupiúba','123','empresa',null)],'empresa')).toEqual([]);
});