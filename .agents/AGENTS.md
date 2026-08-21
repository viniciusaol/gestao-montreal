# Regras do Projeto

## Idioma
- Sempre responda, comente e comunique-se em **português (do Brasil)**.

---

## 🔒 Regras de Negócio Permanente para Comissões (`vw_mt_comissoes_detalhadas`)

> **ATENÇÃO DE PRESERVAÇÃO DE REGRAS**: Qualquer alteração, refatoração ou atualização da view `vw_mt_comissoes_detalhadas` no Supabase DEVE OBRIGATORIAMENTE manter intactas as seguintes regras de negócio customizadas:

### 1. Divisão 50%/50% da Aula Kids (Sábado às 10:00 - Quadra 03)
- Todas as aulas da turma Kids de Sábado às 10:00 (`EXTRACT(isodow FROM booking_date) = 6 AND start_time = '10:00:00' AND professor = 'Leandro Bonete'`) **devem ter suas bases de faturamento e comissão divididas igualmente (50% / 50%) entre o Prof. Leandro Bonete e o Prof. Elinton Sanches**.
- A view deve gerar duas entradas de comissão (uma para Leandro Bonete e outra para Elinton Sanches), cada uma com 50% do valor da aula.

### 2. Atribuição Estrita de Vendas Avulsas pelo Nome do Professor na Descrição
- Vendas marcadas como avulsas (`is_avulsa = true`) que não possuem agendamento avulso (`clase_suelta`) na agenda devem fluir para `unallocated_payments`.
- A comissão dessas vendas avulsas deve ser atribuída **estritamente pelo nome do professor presente no texto da descrição** (`description`).
- Nunca utilizar fallback por proximidade de data de agendamento para vendas avulsas sem professor no texto (devem ficar como `"Sem professor"` caso a descrição não contenha nome de professor).

### 3. Alocação Proporcional por Aulas Realizadas para Anna Miguel (`000602`)
- Para o cadastro da aluna Anna Miguel (`000602`), a distribuição da mensalidade entre diferentes turmas/professores no mês deve considerar a multiplicação do peso do horário pela quantidade de aulas realizadas (`schedule_weight * bookings_count`).

