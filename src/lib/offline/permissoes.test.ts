import { beforeEach, expect, it } from 'vitest';
import { invalidarPermissoes, lerPermissoes, salvarPermissoes } from './permissoes';
const original = { usuario: 'u1', empresa: 'RJ', admin: false, superadmin: false, funcao: 'romaneador' as const, validadoEm: 1 };
beforeEach(() => localStorage.clear());
it('só restaura papel previamente validado para a mesma conta/empresa', () => {
 expect(lerPermissoes('u1','RJ')).toBeNull(); salvarPermissoes(original);
 expect(lerPermissoes('u1','RJ')).toEqual(original);
 expect(lerPermissoes('u2','RJ')).toBeNull(); expect(lerPermissoes('u1','OUTRA')).toBeNull();
});
it('cópia corrompida ou papel desconhecido não concede acesso', () => {
 localStorage.setItem('permissoes-validadas-v2:u1:RJ','invalid'); expect(lerPermissoes('u1','RJ')).toBeNull();
 localStorage.setItem('permissoes-validadas-v2:u1:RJ',JSON.stringify({...original,funcao:'dono'})); expect(lerPermissoes('u1','RJ')).toBeNull();
});
it('sign-out invalida todas empresas da conta sem apagar outra conta', () => {
 salvarPermissoes(original); salvarPermissoes({...original,empresa:'OUTRA'}); salvarPermissoes({...original,usuario:'u2'});
 invalidarPermissoes('u1'); expect(lerPermissoes('u1','RJ')).toBeNull(); expect(lerPermissoes('u1','OUTRA')).toBeNull(); expect(lerPermissoes('u2','RJ')).not.toBeNull();
});
