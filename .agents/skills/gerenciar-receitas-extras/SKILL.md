---
name: gerenciar-receitas-extras
description: Gerencia e atualiza lançamentos de receitas extras (Comissões, Eventos, Patrocínios e Svila) no Supabase.
---

# Skill: Gerenciamento de Receitas Extras

Esta skill define a inteligência do agente para processar comandos de receitas não vindas do MatchPoint.

## Categorias Suportadas:
1. `comissoes_eventos_patrocinios`: Comissões, Eventos e Patrocínios.
2. `svila`: Receitas de gravação e análise de jogos (Svila).

## Padrão de Execução:
Quando o usuário informar um valor e um mês para uma dessas categorias (ex: *"381,38 - setembro em comissões, eventos, patrocinios"* ou *"Svila 1.200 em outubro"*):

1. **Mapeamento SQL**:
   ```sql
   INSERT INTO public.mt_receitas_extras (month_key, tipo, valor, descricao)
   VALUES ('YYYY-MM', '<TIPO>', <VALOR>, '<DESCRICAO>')
   ON CONFLICT (month_key, tipo) DO UPDATE SET
     valor = EXCLUDED.valor,
     updated_at = NOW();
   ```

2. **Resposta ao Usuário**:
   Confirmar o valor registrado para o mês, o tipo de receita e o impacto no Faturamento Líquido total do mês.
