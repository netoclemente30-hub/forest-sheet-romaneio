import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ result: { data: 'RJ' as string | null, error: null as unknown } }));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:()=>({abortSignal:()=>Promise.resolve(mocks.result)})}}));
import { informarConexao, redeDisponivel, verificarBackend } from './conexao';
afterEach(()=>{vi.restoreAllMocks();informarConexao(true);});
it('Wi-Fi ativo não basta quando backend falha',async()=>{
 vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
 mocks.result={data:null,error:{message:'Failed to fetch'}}; expect(await verificarBackend()).toBe(false); expect(redeDisponivel()).toBe(false);
});
it('resposta autorizada de empresa confirma reconexão',async()=>{
 mocks.result={data:'RJ',error:null}; expect(await verificarBackend()).toBe(true); expect(redeDisponivel()).toBe(true);
});
it('erro de permissão é servidor alcançável mas não libera replay',async()=>{
 mocks.result={data:null,error:{code:'42501',message:'permission denied'}};
 expect(await verificarBackend()).toBe(false); expect(redeDisponivel()).toBe(true);
});
