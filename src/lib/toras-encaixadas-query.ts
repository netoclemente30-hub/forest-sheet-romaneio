import { supabase } from '@/integrations/supabase/client';
import { comCache } from './offline/cache';
import type { RegistroEncaixe } from './toras-encaixadas';

export const torasEncaixadasQuery = (empresa: string | null) => ({
  queryKey: ['toras-encaixadas', empresa],
  enabled: !!empresa,
  networkMode: 'always' as const,
  queryFn: () => comCache<RegistroEncaixe>(`toras-encaixadas:${empresa}`, async () => {
    if (!empresa) return [];
    const todos: RegistroEncaixe[] = [];
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await supabase.from('registros')
        .select('id,empresa_id,acao,detalhe,criado_em,revertido_em,mudancas')
        .eq('empresa_id', empresa).eq('acao', 'Encaixe confirmado')
        .order('numero', { ascending: false }).range(inicio, inicio + 999);
      if (error) throw error;
      todos.push(...(data ?? []));
      if (!data || data.length < 1000) return todos;
    }
  }),
});