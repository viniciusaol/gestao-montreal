-- Migration: v1_2_optimize_faturamento_hora.sql
-- Description: Otimiza a view vw_mt_faturamento_por_hora_ocupada eliminando a dependência aninhada de vw_mt_comissoes_detalhadas dentro do loop de mt_bookings.
-- Reduz o tempo de resposta REST de >3.5s (TIMEOUT 57014) para <0.6s.

CREATE OR REPLACE VIEW public.vw_mt_faturamento_por_hora_ocupada AS
WITH participantes_por_booking AS (
  SELECT booking_id,
         count(*) AS qtd_participantes,
         count(DISTINCT customer_code) AS qtd_clientes_unicos
  FROM mt_booking_participantes
  GROUP BY booking_id
),
bookings_classificados AS (
  SELECT b.booking_id,
         b.booking_date,
         date_trunc('month'::text, b.booking_date::timestamp with time zone)::date AS mes,
         to_char(date_trunc('month'::text, b.booking_date::timestamp with time zone), 'YYYY-MM'::text) AS ano_mes,
         b.duration_minutes,
         COALESCE(p.qtd_participantes, 0::bigint) AS qtd_participantes,
         COALESCE(p.qtd_clientes_unicos, 0::bigint) AS qtd_clientes_unicos,
         CASE
             WHEN b.description ~~* '%RESERVA MENSAL%'::text THEN 'Locação - Reserva Mensal'::text
             WHEN b.booking_type = 'clase_suelta'::text THEN 'Aulas - Avulsa Particular'::text
             WHEN b.description ~~* '%TÊNIS KIDS%'::text OR b.description ~~* '%TENIS KIDS%'::text OR b.description ~~* '%KIDS%'::text OR b.description ~~* '%BABY%'::text OR b.description ~~* '%/ 8)%'::text OR b.description ~~* '%/8)%'::text THEN 'Aulas - Kids'::text
             WHEN (b.booking_type = 'clase_colectiva'::text OR b.description ~~* '%TÊNIS%'::text OR b.description ~~* '%TENIS%'::text OR b.description ~~* '%AULA%'::text) AND (b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text OR b.description ~~* '%INDIVIDUAL%'::text) THEN 'Aulas - Adulto - Individual'::text
             WHEN (b.booking_type = 'clase_colectiva'::text OR b.description ~~* '%TÊNIS%'::text OR b.description ~~* '%TENIS%'::text OR b.description ~~* '%AULA%'::text) AND (b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text OR b.description ~~* '%DUPLA%'::text) THEN 'Aulas - Adulto - Dupla'::text
             WHEN (b.booking_type = 'clase_colectiva'::text OR b.description ~~* '%TÊNIS%'::text OR b.description ~~* '%TENIS%'::text OR b.description ~~* '%AULA%'::text) AND (b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text OR b.description ~~* '%TRIO%'::text) THEN 'Aulas - Adulto - Trio'::text
             WHEN b.booking_type = 'clase_colectiva'::text OR b.description ~~* '%TÊNIS%'::text OR b.description ~~* '%TENIS%'::text OR b.description ~~* '%AULA%'::text THEN 'Aulas - Adulto - Grupo'::text
             WHEN b.booking_type ~~* '%reserva%'::text AND b.booking_type <> 'reserva_mantenimiento'::text THEN 'Locação - Quadra Avulsa'::text
             ELSE 'Outros'::text
         END AS tipo_operacional
  FROM mt_bookings b
  LEFT JOIN participantes_por_booking p ON p.booking_id = b.booking_id
  WHERE b.status = 'ACTIVE'::text
    AND b.booking_type <> 'reserva_mantenimiento'::text
    AND (
      EXISTS (SELECT 1 FROM mt_booking_pagamentos bp WHERE bp.booking_id = b.booking_id)
      OR EXISTS (
        SELECT 1 FROM mt_booking_participantes bp2
        JOIN mt_faturamento_vendas fv ON fv.customer_code = bp2.customer_code
        WHERE bp2.booking_id = b.booking_id AND fv.paid = true AND fv.is_canceled = false
      )
    )
),
agenda_mes AS (
  SELECT mes, ano_mes, tipo_operacional,
         count(DISTINCT booking_id) AS qtd_bookings,
         sum(duration_minutes) AS minutos_ocupados,
         round(sum(duration_minutes)::numeric / 60::numeric, 2) AS horas_ocupadas,
         sum(qtd_participantes) AS qtd_participantes,
         sum(qtd_clientes_unicos) AS soma_clientes_unicos_por_booking
  FROM bookings_classificados
  WHERE tipo_operacional <> 'Outros'::text
  GROUP BY mes, ano_mes, tipo_operacional
),
faturamento_mes AS (
  SELECT date_trunc('month'::text, fi.pay_date::timestamp with time zone)::date AS mes,
         to_char(date_trunc('month'::text, fi.pay_date::timestamp with time zone), 'YYYY-MM'::text) AS ano_mes,
         CASE
             WHEN fi.categoria = 'Locação'::text AND fi.subcategoria = 'Reserva Mensal'::text THEN 'Locação - Reserva Mensal'::text
             WHEN fi.categoria = 'Locação'::text AND fi.subcategoria = 'Quadra Avulsa'::text THEN 'Locação - Quadra Avulsa'::text
             WHEN fi.item_description ~~* '%TÊNIS%'::text AND (fi.item_description ~~* '%TÊNIS KIDS%'::text OR fi.item_description ~~* '%TENIS KIDS%'::text OR fi.item_description ~~* '%KIDS%'::text OR fi.item_description ~~* '%BABY%'::text OR fi.item_description ~~* '%/ 8)%'::text OR fi.item_description ~~* '%/8)%'::text) THEN 'Aulas - Kids'::text
             WHEN (fi.categoria = 'Aulas'::text OR fi.item_description ~~* '%TÊNIS%'::text OR fi.item_description ~~* '%TENIS%'::text OR fi.item_description ~~* '%AULA%'::text) AND (fi.item_description ~ '\(\s*\d+\s*/\s*1\s*\)'::text OR fi.subcategoria ~~* '%Avulsa%'::text OR fi.item_description ~~* '%INDIVIDUAL%'::text) THEN 'Aulas - Adulto - Individual'::text
             WHEN (fi.categoria = 'Aulas'::text OR fi.item_description ~~* '%TÊNIS%'::text OR fi.item_description ~~* '%TENIS%'::text OR fi.item_description ~~* '%AULA%'::text) AND (fi.item_description ~ '\(\s*\d+\s*/\s*2\s*\)'::text OR fi.item_description ~~* '%DUPLA%'::text) THEN 'Aulas - Adulto - Dupla'::text
             WHEN (fi.categoria = 'Aulas'::text OR fi.item_description ~~* '%TÊNIS%'::text OR fi.item_description ~~* '%TENIS%'::text OR fi.item_description ~~* '%AULA%'::text) AND (fi.item_description ~ '\(\s*\d+\s*/\s*3\s*\)'::text OR fi.item_description ~~* '%TRIO%'::text) THEN 'Aulas - Adulto - Trio'::text
             WHEN fi.categoria = 'Aulas'::text OR fi.item_description ~~* '%TÊNIS%'::text OR fi.item_description ~~* '%TENIS%'::text OR fi.item_description ~~* '%AULA%'::text THEN 'Aulas - Adulto - Grupo'::text
             ELSE 'Outros'::text
         END AS tipo_operacional,
         count(DISTINCT fi.venda_external_id) AS qtd_vendas,
         count(DISTINCT fi.customer_code) AS qtd_clientes_faturamento,
         sum(fi.valor_faturamento) AS valor_faturado
  FROM vw_mt_faturamento_itens_pago fi
  GROUP BY date_trunc('month'::text, fi.pay_date::timestamp with time zone)::date,
           to_char(date_trunc('month'::text, fi.pay_date::timestamp with time zone), 'YYYY-MM'::text),
           3
)
SELECT COALESCE(a.mes, f.mes) AS mes,
       COALESCE(a.ano_mes, f.ano_mes) AS ano_mes,
       COALESCE(a.tipo_operacional, f.tipo_operacional) AS tipo_operacional,
       COALESCE(a.qtd_bookings, 0::bigint) AS qtd_bookings,
       COALESCE(a.minutos_ocupados, 0::bigint) AS minutos_ocupados,
       COALESCE(a.horas_ocupadas, 0::numeric) AS horas_ocupadas,
       COALESCE(a.qtd_participantes, 0::numeric) AS qtd_participantes_agenda,
       COALESCE(a.soma_clientes_unicos_por_booking, 0::numeric) AS soma_clientes_unicos_por_booking,
       COALESCE(f.qtd_vendas, 0::bigint) AS qtd_vendas,
       COALESCE(f.qtd_clientes_faturamento, 0::bigint) AS qtd_clientes_faturamento,
       COALESCE(f.valor_faturado, 0::numeric) AS valor_faturado,
       CASE
           WHEN COALESCE(a.horas_ocupadas, 0::numeric) = 0::numeric THEN NULL::numeric
           ELSE round(COALESCE(f.valor_faturado, 0::numeric) / a.horas_ocupadas, 2)
       END AS faturamento_por_hora_ocupada
FROM agenda_mes a
FULL JOIN faturamento_mes f ON f.mes = a.mes AND f.tipo_operacional = a.tipo_operacional
WHERE COALESCE(a.tipo_operacional, f.tipo_operacional) <> 'Fora da agenda'::text
  AND COALESCE(a.tipo_operacional, f.tipo_operacional) <> 'Outros'::text
ORDER BY COALESCE(a.mes, f.mes), COALESCE(f.valor_faturado, 0::numeric) DESC;
