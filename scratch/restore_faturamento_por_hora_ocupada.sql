CREATE OR REPLACE VIEW public.vw_mt_faturamento_por_hora_ocupada AS
 WITH participantes_por_booking AS (
         SELECT mt_booking_participantes.booking_id,
            count(*) AS qtd_participantes,
            count(DISTINCT mt_booking_participantes.customer_code) AS qtd_clientes_unicos
           FROM mt_booking_participantes
          GROUP BY mt_booking_participantes.booking_id
        ), bookings_classificados AS (
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
          WHERE b.status = 'ACTIVE'::text AND b.booking_type <> 'reserva_mantenimiento'::text AND
                CASE
                    WHEN (b.booking_type = ANY (ARRAY['clase_colectiva'::text, 'clase_suelta'::text])) AND b.description !~~* '%RESERVA MENSAL%'::text THEN (EXISTS ( SELECT 1
                       FROM vw_mt_comissoes_detalhadas cd
                      WHERE cd.booking_id = b.booking_id AND cd.is_paid = true))
                    WHEN b.description ~~* '%RESERVA MENSAL%'::text THEN (EXISTS ( SELECT 1
                       FROM mt_booking_participantes bp
                         JOIN vw_mt_faturamento_itens_pago fi ON fi.customer_code = bp.customer_code
                      WHERE bp.booking_id = b.booking_id AND fi.categoria = 'Locação'::text AND fi.subcategoria = 'Reserva Mensal'::text AND fi.pay_date >= date_trunc('month'::text, b.booking_date::timestamp with time zone)::date AND fi.pay_date < (date_trunc('month'::text, b.booking_date::timestamp with time zone)::date + '1 mon'::interval)))
                    ELSE (EXISTS ( SELECT 1
                       FROM mt_booking_pagamentos bp
                      WHERE bp.booking_id = b.booking_id))
                END
        ), agenda_mes AS (
         SELECT bookings_classificados.mes,
            bookings_classificados.ano_mes,
            bookings_classificados.tipo_operacional,
            count(DISTINCT bookings_classificados.booking_id) AS qtd_bookings,
            sum(bookings_classificados.duration_minutes) AS minutos_ocupados,
            round(sum(bookings_classificados.duration_minutes)::numeric / 60::numeric, 2) AS horas_ocupadas,
            sum(bookings_classificados.qtd_participantes) AS qtd_participantes,
            sum(bookings_classificados.qtd_clientes_unicos) AS soma_clientes_unicos_por_booking
           FROM bookings_classificados
          WHERE bookings_classificados.tipo_operacional <> 'Outros'::text
          GROUP BY bookings_classificados.mes, bookings_classificados.ano_mes, bookings_classificados.tipo_operacional
        ), faturamento_mes AS (
         SELECT date_trunc('month'::text, cd.booking_date::timestamp with time zone)::date AS mes,
            to_char(date_trunc('month'::text, cd.booking_date::timestamp with time zone), 'YYYY-MM'::text) AS ano_mes,
                CASE
                    WHEN cd.description ~~* '%TÊNIS%'::text AND (cd.description ~~* '%TÊNIS KIDS%'::text OR cd.description ~~* '%TENIS KIDS%'::text OR cd.description ~~* '%KIDS%'::text OR cd.description ~~* '%BABY%'::text OR cd.description ~~* '%/ 8)%'::text OR cd.description ~~* '%/8)%'::text) THEN 'Aulas - Kids'::text
                    WHEN (cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text) AND (cd.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text OR cd.booking_type = 'clase_suelta'::text OR cd.description ~~* '%INDIVIDUAL%'::text) THEN 'Aulas - Adulto - Individual'::text
                    WHEN (cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text) AND (cd.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text OR cd.description ~~* '%DUPLA%'::text) THEN 'Aulas - Adulto - Dupla'::text
                    WHEN (cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text) AND (cd.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text OR cd.description ~~* '%TRIO%'::text) THEN 'Aulas - Adulto - Trio'::text
                    WHEN cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text THEN 'Aulas - Adulto - Grupo'::text
                    WHEN cd.booking_type = 'clase_suelta'::text THEN 'Aulas - Avulsa Particular'::text
                    ELSE 'Outros'::text
                END AS tipo_operacional,
            count(DISTINCT cd.booking_id) AS qtd_vendas,
            count(DISTINCT cd.customer_code) AS qtd_clientes_faturamento,
            sum(cd.booking_value) AS valor_faturado
           FROM vw_mt_comissoes_detalhadas cd
          WHERE cd.is_paid = true AND cd.description !~~* '%RESERVA MENSAL%'::text
          GROUP BY (date_trunc('month'::text, cd.booking_date::timestamp with time zone)::date), (to_char(date_trunc('month'::text, cd.booking_date::timestamp with time zone), 'YYYY-MM'::text)), (
                CASE
                    WHEN cd.description ~~* '%TÊNIS%'::text AND (cd.description ~~* '%TÊNIS KIDS%'::text OR cd.description ~~* '%TENIS KIDS%'::text OR cd.description ~~* '%KIDS%'::text OR cd.description ~~* '%BABY%'::text OR cd.description ~~* '%/ 8)%'::text OR cd.description ~~* '%/8)%'::text) THEN 'Aulas - Kids'::text
                    WHEN (cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text) AND (cd.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text OR cd.booking_type = 'clase_suelta'::text OR cd.description ~~* '%INDIVIDUAL%'::text) THEN 'Aulas - Adulto - Individual'::text
                    WHEN (cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text) AND (cd.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text OR cd.description ~~* '%DUPLA%'::text) THEN 'Aulas - Adulto - Dupla'::text
                    WHEN (cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text) AND (cd.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text OR cd.description ~~* '%TRIO%'::text) THEN 'Aulas - Adulto - Trio'::text
                    WHEN cd.booking_type = 'clase_colectiva'::text OR cd.description ~~* '%TÊNIS%'::text OR cd.description ~~* '%TENIS%'::text OR cd.description ~~* '%AULA%'::text THEN 'Aulas - Adulto - Grupo'::text
                    WHEN cd.booking_type = 'clase_suelta'::text THEN 'Aulas - Avulsa Particular'::text
                    ELSE 'Outros'::text
                END)
        UNION ALL
         SELECT date_trunc('month'::text, fi.data_venda::timestamp with time zone)::date AS mes,
            to_char(date_trunc('month'::text, fi.data_venda::timestamp with time zone), 'YYYY-MM'::text) AS ano_mes,
                CASE
                    WHEN fi.categoria = 'Locação'::text AND fi.subcategoria = 'Reserva Mensal'::text THEN 'Locação - Reserva Mensal'::text
                    WHEN fi.categoria = 'Locação'::text AND fi.subcategoria = 'Quadra Avulsa'::text THEN 'Locação - Quadra Avulsa'::text
                    ELSE 'Fora da agenda'::text
                END AS tipo_operacional,
            count(DISTINCT fi.venda_external_id) AS qtd_vendas,
            count(DISTINCT fi.customer_code) AS qtd_clientes_faturamento,
            sum(fi.valor_faturamento) AS valor_faturado
           FROM vw_mt_faturamento_itens_pago fi
          WHERE fi.categoria = 'Locação'::text
          GROUP BY (date_trunc('month'::text, fi.data_venda::timestamp with time zone)::date), (to_char(date_trunc('month'::text, fi.data_venda::timestamp with time zone), 'YYYY-MM'::text)), (
                CASE
                    WHEN fi.categoria = 'Locação'::text AND fi.subcategoria = 'Reserva Mensal'::text THEN 'Locação - Reserva Mensal'::text
                    WHEN fi.categoria = 'Locação'::text AND fi.subcategoria = 'Quadra Avulsa'::text THEN 'Locação - Quadra Avulsa'::text
                    ELSE 'Fora da agenda'::text
                END)
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
  WHERE COALESCE(a.tipo_operacional, f.tipo_operacional) <> 'Fora da agenda'::text AND COALESCE(a.tipo_operacional, f.tipo_operacional) <> 'Outros'::text
  ORDER BY (COALESCE(a.mes, f.mes)), (COALESCE(f.valor_faturado, 0::numeric)) DESC;