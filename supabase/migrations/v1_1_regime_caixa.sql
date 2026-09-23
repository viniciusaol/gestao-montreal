-- ============================================================================
-- MIGRATION V1.1: REGIME DE CAIXA PURA E CONCILIAÇÃO DE PRÓ-RATAS
-- Descrição: Garante que todo pagamento de mensalidade/pró-rata efetuado no mês
--            (pay_date) seja 100% contabilizado no faturamento comissionável
--            do mês vigente, independentemente da data citada na descrição.
-- Data de Aplicação: 2026-09-22
-- ============================================================================

CREATE OR REPLACE VIEW vw_mt_comissoes_detalhadas AS
WITH view_base AS (
    WITH unique_participants AS MATERIALIZED (
        SELECT DISTINCT ON (mt_booking_participantes.participant_name) 
            mt_booking_participantes.participant_name,
            mt_booking_participantes.customer_code
        FROM mt_booking_participantes
        WHERE mt_booking_participantes.participant_name IS NOT NULL 
          AND length(mt_booking_participantes.participant_name) > 5
    ), 
    booking_min_pay_dates AS (
        SELECT mt_booking_pagamentos.booking_id,
            min(mt_booking_pagamentos.payment_date) AS min_payment_date
        FROM mt_booking_pagamentos
        GROUP BY mt_booking_pagamentos.booking_id
    ), 
    loose_class_matches AS (
        SELECT b.booking_id,
            p.customer_code,
            fi.item_key,
            fi.valor_faturamento AS payment_value,
            CASE
                WHEN fi.description ~~* '%Sócio Montreal%' THEN COALESCE(fi.valor_bruto, fi.valor_faturamento * 2::numeric)
                WHEN fi.description ~~* '%Leonardo Assunção%' OR fi.description ~~* '%Leonardo Assuncao%' THEN fi.valor_faturamento * 2::numeric
                ELSE fi.valor_faturamento
            END AS payment_value_comissao,
            CASE
                WHEN fi.description ~~* '%Sócio Montreal%' OR fi.description ~~* '%Leonardo Assunção%' OR fi.description ~~* '%Leonardo Assuncao%' THEN true
                ELSE false
            END AS is_socio,
            fv.paid AS is_paid,
            COALESCE(bmpd.min_payment_date, fv.pay_date) AS pay_date,
            CASE
                WHEN fv.customer_code = '000917' OR fv.customer_code = '000932' THEN 'Leandro Bonete'
                WHEN fv.customer_code = '000815' OR fv.customer_code = '000475' AND (fv.pay_date >= '2026-07-01 00:00:00' AND fv.pay_date < '2026-08-01 00:00:00' OR fi.description ~~* '%15/07/2026%') OR fi.description ~~* '%João Assunção%' OR fi.description ~~* '%Joao Assuncao%' OR fi.description ~~* '%Joao Assunção%' OR fi.description ~~* '%João Assuncao%' OR fi.description ~~* '%Joao A.%' THEN 'João Assunção'
                WHEN fi.description ~~* '%Rodrigo Assunção%' OR fi.description ~~* '%Rodrigo Assuncao%' OR fi.description ~~* '%Rodrigo A.%' THEN 'Rodrigo Assunção'
                WHEN fi.description ~~* '%Leandro Bonete%' OR fi.description ~~* '%Leandro B.%' OR fi.description ~~* '%Leandro B' THEN 'Leandro Bonete'
                WHEN fi.description ~~* '%Tatiana Araújo%' OR fi.description ~~* '%Tatiana Araujo%' OR fi.description ~~* '%Tatiana A.%' THEN 'Tatiana Araújo'
                WHEN fi.description ~~* '%Leciane Silva%' OR fi.description ~~* '%Leciane S.%' THEN 'Leciane Silva'
                WHEN fi.description ~~* '%Elinton Sanches%' OR fi.description ~~* '%Eliton Sanches%' OR fi.description ~~* '%Élinton Sanches%' OR fi.description ~~* '%Éliton Sanches%' OR fi.description ~~* '%Elinton S.%' THEN 'Elinton Sanches'
                ELSE NULL
            END AS professor
        FROM mt_booking_participantes p
        JOIN mt_bookings b ON b.booking_id = p.booking_id
        LEFT JOIN booking_min_pay_dates bmpd ON bmpd.booking_id = b.booking_id
        JOIN mt_faturamento_vendas fv ON fv.customer_code = p.customer_code
        JOIN mt_faturamento_itens fi ON fi.venda_external_id = fv.external_id
        WHERE fv.paid = true AND b.status = 'ACTIVE' AND b.booking_type = 'clase_suelta' AND b.description !~~* '%RESERVA MENSAL%' AND fi.is_canceled = false AND fv.is_canceled = false AND fi.valor_faturamento > 0 AND (fi.categoria = ANY (ARRAY['Aulas', 'Outros', 'Locação'])) AND (fi.description ~~ ('%' || to_char(b.booking_date, 'DD/MM/YYYY') || '%') AND fi.description ~~ ('%' || to_char(b.start_time, 'HH24:MI') || '%') OR (EXISTS ( SELECT 1 FROM mt_booking_pagamentos bpay WHERE bpay.booking_id = b.booking_id AND bpay.payment_date = fv.pay_date AND bpay.amount = fi.valor_faturamento)))
    ), 
    resolved_faturamento AS MATERIALIZED (
        SELECT i.item_key,
            COALESCE(( SELECT p_1.customer_code FROM unique_participants p_1 WHERE i.description ~~* (('%' || p_1.participant_name) || '%') LIMIT 1), v.customer_code) AS customer_code,
            v.pay_date,
            v.data_venda,
            i.valor_faturamento,
            i.valor_bruto,
            i.description,
            v.paid,
            COALESCE(i.description ~~* '%AVULSA%' OR i.description ~~* '%GRUPO%FIXO%' OR i.subcategoria ~~* '%Avulsa%' OR i.subcategoria ~~* '%Grupo Fixo%', false) AS is_avulsa,
            COALESCE(i.description ~~* '%GRUPO%FIXO%' OR i.subcategoria ~~* '%Grupo Fixo%', false) AS is_avulsa_grupo_fixo,
            CASE WHEN i.description ~~* '%Sócio Montreal%' OR i.description ~~* '%Leonardo Assunção%' OR i.description ~~* '%Leonardo Assuncao%' THEN true ELSE false END AS is_socio,
            i.is_canceled AS item_canceled,
            v.is_canceled AS sale_canceled,
            v.tipo AS sale_type,
            i.categoria
        FROM mt_faturamento_itens i
        JOIN mt_faturamento_vendas v ON v.external_id = i.venda_external_id
    ), 
    plan_items_raw AS MATERIALIZED (
        SELECT rf.item_key,
            rf.customer_code,
            COALESCE(rf.pay_date, rf.data_venda::timestamp)::date AS pay_date,
            date_trunc('month', COALESCE(rf.pay_date, rf.data_venda::timestamp))::date AS plan_month,
            rf.paid,
            CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, 0), rf.valor_faturamento * 2.0) ELSE rf.valor_faturamento END AS valor_bruto_derived,
            rf.is_socio,
            COALESCE(
                CASE
                    WHEN rf.description ~~* '%AULA AVULSA%' THEN 'OUTRO'
                    WHEN rf.description ~~* '%INDIVIDUAL%' THEN 'INDIVIDUAL'
                    WHEN rf.description ~~* '%DUPLA%' THEN 'DUPLA'
                    WHEN rf.description ~~* '%TRIO%' THEN 'TRIO'
                    WHEN rf.description ~~* '%GRUPO%' OR rf.description ~~* '%QUARTETO%' OR rf.description ~~* '%KIDS%' THEN 'GRUPO'
                    ELSE NULL
                END,
                ( SELECT bp.plan_class_type
                  FROM ( VALUES ('INDIVIDUAL'::text,720.00), ('DUPLA'::text,430.00), ('TRIO'::text,395.00), ('GRUPO'::text,335.00), ('GRUPO'::text,245.00)) bp(plan_class_type, base_value)
                  WHERE abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value) <= 150.00 OR abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - 2.0 * bp.base_value) <= 200.00
                  ORDER BY (LEAST(abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value), abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - 2.0 * bp.base_value)))
                  LIMIT 1),
                ( SELECT CASE
                            WHEN b_sub.description ~ '\(\s*\d+\s*/\s*1\s*\)' THEN 'INDIVIDUAL'
                            WHEN b_sub.description ~ '\(\s*\d+\s*/\s*2\s*\)' THEN 'DUPLA'
                            WHEN b_sub.description ~ '\(\s*\d+\s*/\s*3\s*\)' THEN 'TRIO'
                            WHEN b_sub.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)' THEN 'GRUPO'
                            ELSE 'GRUPO'
                        END
                   FROM mt_booking_participantes p_sub
                   JOIN mt_bookings b_sub ON b_sub.booking_id = p_sub.booking_id
                  WHERE p_sub.customer_code = rf.customer_code AND b_sub.status = 'ACTIVE' AND b_sub.booking_type = 'clase_colectiva'
                  LIMIT 1), 
                'GRUPO'
            ) AS plan_class_type,
            rf.is_avulsa,
            rf.is_avulsa_grupo_fixo,
            rf.valor_faturamento AS valor_faturamento_monthly,
            CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, 0), rf.valor_faturamento * 2.0) ELSE rf.valor_faturamento END AS valor_bruto_monthly,
            rf.description
        FROM resolved_faturamento rf
        WHERE rf.paid = true AND rf.is_avulsa = false AND rf.item_canceled = false AND rf.sale_canceled = false AND COALESCE(rf.sale_type, '') <> 'refund' AND rf.valor_faturamento > 0 AND (rf.categoria = 'Aulas' OR rf.categoria = 'Outros' AND rf.description ~~* '%TÊNIS%' AND (rf.description ~~* '%ADULTO%' OR rf.description ~~* '%KIDS%'))
    ),
    schedules AS (
        SELECT p.customer_code,
            date_trunc('month', b.booking_date)::date AS plan_month,
            EXTRACT(isodow FROM b.booking_date) AS day_of_week,
            b.start_time,
            CASE
                WHEN p.customer_code = '000815' OR p.customer_code = '000475' AND b.booking_date >= '2026-07-01' AND b.booking_date <= '2026-07-31' OR b.description ~~* '%João Assunção%' OR b.description ~~* '%Joao Assuncao%' OR b.description ~~* '%Joao Assunção%' OR b.description ~~* '%João Assuncao%' THEN 'João Assunção'
                WHEN b.description ~~* '%Elinton Sanches%' OR b.description ~~* '%Eliton Sanches%' OR b.description ~~* '%Élinton Sanches%' OR b.description ~~* '%Éliton Sanches%' THEN 'Elinton Sanches'
                WHEN b.description ~~* '%Rodrigo Assunção%' OR b.description ~~* '%Rodrigo Assuncao%' THEN 'Rodrigo Assunção'
                WHEN b.description ~~* '%Leandro Bonete%' THEN 'Leandro Bonete'
                WHEN b.description ~~* '%Tatiana Araújo%' OR b.description ~~* '%Tatiana Araujo%' THEN 'Tatiana Araújo'
                WHEN b.description ~~* '%Leciane Silva%' THEN 'Leciane Silva'
                ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE(substring(b.description from '(?i)prof[:.]?[[:space:]]*([^.(]+)'), ''), '[[:space:]]+', ' ', 'g')), '')
            END AS professor,
            CASE
                WHEN b.description ~ '\(\s*\d+\s*/\s*1\s*\)' THEN 'INDIVIDUAL'
                WHEN b.description ~ '\(\s*\d+\s*/\s*2\s*\)' THEN 'DUPLA'
                WHEN b.description ~ '\(\s*\d+\s*/\s*3\s*\)' THEN 'TRIO'
                WHEN b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)' THEN 'GRUPO'
                WHEN b.booking_type = 'clase_suelta' THEN 'INDIVIDUAL'
                ELSE 'GRUPO'
            END AS booking_class_type,
            count(*) AS bookings_count
        FROM mt_booking_participantes p
        JOIN mt_bookings b ON b.booking_id = p.booking_id
        WHERE b.status = 'ACTIVE' AND b.booking_type = 'clase_colectiva' AND b.description !~~* '%RESERVA MENSAL%'
        GROUP BY p.customer_code, date_trunc('month', b.booking_date)::date, EXTRACT(isodow FROM b.booking_date), b.start_time, 5, 6
    ),
    pi_exact AS (
        SELECT pir.item_key, pir.customer_code, pir.plan_month, pir.pay_date, pir.paid, pir.is_socio, pir.plan_class_type, pir.valor_faturamento_monthly, pir.valor_bruto_monthly, pir.description
        FROM plan_items_raw pir
    ), 
    exact_schedule_matches AS (
        SELECT s.customer_code, s.plan_month, s.day_of_week, s.start_time, s.professor, s.booking_class_type, s.bookings_count,
            count(pe.item_key) AS exact_match_count
        FROM schedules s
        LEFT JOIN pi_exact pe ON pe.customer_code = s.customer_code AND pe.plan_month = s.plan_month AND (pe.plan_class_type = s.booking_class_type OR NOT EXISTS (SELECT 1 FROM schedules s2 WHERE s2.customer_code = pe.customer_code AND s2.plan_month = pe.plan_month AND s2.booking_class_type = pe.plan_class_type))
        GROUP BY s.customer_code, s.plan_month, s.day_of_week, s.start_time, s.professor, s.booking_class_type, s.bookings_count
    ), 
    schedules_with_sums AS (
        SELECT s.customer_code, s.plan_month, s.day_of_week, s.start_time, s.professor, s.booking_class_type, s.bookings_count, esm.exact_match_count,
            CASE WHEN s.customer_code = '000602' THEN 100.00 * s.bookings_count::numeric ELSE 1.0 END AS schedule_weight,
            sum(CASE WHEN s.customer_code = '000602' THEN 100.00 * s.bookings_count::numeric ELSE 1.0 END) OVER (PARTITION BY s.customer_code, s.plan_month) AS total_customer_weighted_bookings_all
        FROM schedules s
        JOIN exact_schedule_matches esm ON esm.customer_code = s.customer_code AND esm.plan_month = s.plan_month AND esm.day_of_week = s.day_of_week AND esm.start_time = s.start_time AND esm.professor = s.professor AND esm.booking_class_type = s.booking_class_type
    ), 
    exact_item_schedule_allocations AS (
        SELECT pe.customer_code, pe.plan_month, s.day_of_week, s.start_time, s.professor, s.booking_class_type, s.bookings_count, pe.pay_date, pe.paid, pe.is_socio, false AS is_avulsa, false AS is_avulsa_grupo_fixo,
            pe.valor_faturamento_monthly / NULLIF(count(*) OVER (PARTITION BY pe.item_key), 0)::numeric AS allocated_valor_faturamento_monthly,
            CASE WHEN pe.customer_code = '000007' THEN pe.valor_bruto_monthly * 0.88 / NULLIF(count(*) OVER (PARTITION BY pe.item_key), 0)::numeric ELSE pe.valor_bruto_monthly / NULLIF(count(*) OVER (PARTITION BY pe.item_key), 0)::numeric END AS allocated_valor_bruto_monthly
        FROM pi_exact pe
        JOIN schedules s ON s.customer_code = pe.customer_code AND s.plan_month = pe.plan_month AND (pe.plan_class_type = s.booking_class_type OR NOT EXISTS (SELECT 1 FROM schedules s2 WHERE s2.customer_code = pe.customer_code AND s2.plan_month = pe.plan_month AND s2.booking_class_type = pe.plan_class_type))
    ), 
    fallback_plan_totals AS (
        SELECT pir.customer_code, pir.plan_month, max(pir.pay_date) AS pay_date, bool_or(pir.paid) AS paid, bool_or(pir.is_socio) AS is_socio, bool_or(pir.is_avulsa) AS is_avulsa, bool_or(pir.is_avulsa_grupo_fixo) AS is_avulsa_grupo_fixo,
            sum(pir.valor_faturamento_monthly) AS total_valor_faturamento_monthly,
            sum(pir.valor_bruto_monthly) AS total_valor_bruto_monthly
        FROM plan_items_raw pir
        WHERE NOT (EXISTS ( SELECT 1 FROM exact_item_schedule_allocations eisa WHERE eisa.customer_code = pir.customer_code AND eisa.plan_month = pir.plan_month))
        GROUP BY pir.customer_code, pir.plan_month
    ), 
    fallback_schedule_allocations AS (
        SELECT sws.customer_code, sws.plan_month, sws.day_of_week, sws.start_time, sws.professor, sws.booking_class_type, sws.bookings_count, fpt.pay_date, fpt.paid, fpt.is_socio, fpt.is_avulsa, fpt.is_avulsa_grupo_fixo,
            fpt.total_valor_faturamento_monthly * sws.schedule_weight / NULLIF(sum(sws.schedule_weight) OVER (PARTITION BY sws.customer_code, sws.plan_month), 0::numeric) AS allocated_valor_faturamento_monthly,
            CASE WHEN sws.customer_code = '000007' THEN fpt.total_valor_bruto_monthly * 0.88 * sws.schedule_weight / NULLIF(sum(sws.schedule_weight) OVER (PARTITION BY sws.customer_code, sws.plan_month), 0::numeric) ELSE fpt.total_valor_bruto_monthly * sws.schedule_weight / NULLIF(sum(sws.schedule_weight) OVER (PARTITION BY sws.customer_code, sws.plan_month), 0::numeric) END AS allocated_valor_bruto_monthly
        FROM schedules_with_sums sws
        JOIN fallback_plan_totals fpt ON fpt.customer_code = sws.customer_code AND fpt.plan_month = sws.plan_month
    ), 
    schedule_allocations AS (
        SELECT * FROM exact_item_schedule_allocations
        UNION ALL
        SELECT * FROM fallback_schedule_allocations
    ), 
    schedule_totals AS (
        SELECT customer_code, plan_month, day_of_week, start_time, professor, booking_class_type, bookings_count,
            COALESCE(sum(allocated_valor_faturamento_monthly), 0::numeric) AS schedule_monthly_value,
            COALESCE(sum(allocated_valor_bruto_monthly), 0::numeric) AS schedule_monthly_commission_base,
            COALESCE(bool_or(is_socio), false) AS is_socio,
            COALESCE(bool_or(paid), false) AS is_paid,
            max(pay_date) AS pay_date,
            COALESCE(sum(allocated_valor_faturamento_monthly), 0::numeric) AS schedule_monthly_value_monthly,
            COALESCE(sum(allocated_valor_bruto_monthly), 0::numeric) AS schedule_monthly_commission_base_monthly,
            COALESCE(bool_or(is_avulsa), false) AS is_avulsa,
            COALESCE(bool_or(is_avulsa_grupo_fixo), false) AS is_avulsa_grupo_fixo
        FROM schedule_allocations
        GROUP BY customer_code, plan_month, day_of_week, start_time, professor, booking_class_type, bookings_count
    ), 
    final_bookings AS (
        SELECT b.booking_id, b.booking_date, b.start_time, b.booking_type, b.venue, b.resource_name, b.description,
            COALESCE(
                CASE
                    WHEN p.customer_code = '000917' OR p.customer_code = '000932' THEN 'Leandro Bonete'
                    WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'
                    WHEN p.customer_code = '000815' OR p.customer_code = '000475' AND b.booking_date >= '2026-07-01' AND b.booking_date <= '2026-07-31' OR b.description ~~* '%Julio Souza%' OR b.description ~~* '%João Assunção%' OR b.description ~~* '%Joao Assuncao%' OR b.description ~~* '%Joao Assunção%' OR b.description ~~* '%João Assuncao%' THEN 'João Assunção'
                    WHEN b.description ~~* '%Elinton Sanches%' OR b.description ~~* '%Eliton Sanches%' OR b.description ~~* '%Élinton Sanches%' OR b.description ~~* '%Éliton Sanches%' THEN 'Elinton Sanches'
                    WHEN b.description ~~* '%Rodrigo Assunção%' OR b.description ~~* '%Rodrigo Assuncao%' THEN 'Rodrigo Assunção'
                    WHEN b.description ~~* '%Leandro Bonete%' THEN 'Leandro Bonete'
                    WHEN b.description ~~* '%Tatiana Araújo%' OR b.description ~~* '%Tatiana Araujo%' THEN 'Tatiana Araújo'
                    WHEN b.description ~~* '%Leciane Silva%' THEN 'Leciane Silva'
                    ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE(substring(b.description from '(?i)prof[:.]?[[:space:]]*([^.(]+)'), ''), '[[:space:]]+', ' ', 'g')), '')
                END, lcm.professor, 'Sem professor') AS professor,
            p.customer_code,
            COALESCE(( SELECT c.name FROM mt_clientes c WHERE c.customer_code = p.customer_code LIMIT 1), p.participant_name) AS participant_name,
            CASE
                WHEN b.booking_type = 'clase_suelta' THEN COALESCE(lcm.payment_value, 0::numeric)
                ELSE COALESCE(st.schedule_monthly_value / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
            END AS booking_value,
            CASE
                WHEN b.booking_type = 'clase_suelta' THEN COALESCE(lcm.payment_value_comissao, 0::numeric)
                ELSE COALESCE(st.schedule_monthly_commission_base / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
            END AS booking_commission_base,
            COALESCE(lcm.is_socio, st.is_socio, false) AS is_socio_benefit,
            CASE
                WHEN b.booking_type = 'clase_suelta' THEN COALESCE(lcm.is_paid, false)
                ELSE COALESCE(st.is_paid, false)
            END AS is_paid,
            CASE
                WHEN b.booking_type = 'clase_suelta' THEN lcm.pay_date
                ELSE st.pay_date::timestamp without time zone
            END AS pay_date,
            CASE
                WHEN b.booking_type = 'clase_colectiva' THEN COALESCE(st.schedule_monthly_value_monthly / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
                ELSE 0::numeric
            END AS booking_value_monthly,
            CASE
                WHEN b.booking_type = 'clase_colectiva' THEN COALESCE(st.schedule_monthly_commission_base_monthly / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
                ELSE 0::numeric
            END AS booking_commission_base_monthly,
            CASE
                WHEN b.booking_type = 'clase_suelta' THEN true
                ELSE COALESCE(st.is_avulsa, false)
            END AS is_avulsa,
            CASE
                WHEN b.booking_type = 'clase_colectiva' THEN false
                ELSE COALESCE(st.is_avulsa_grupo_fixo, false)
            END AS is_avulsa_grupo_fixo
        FROM mt_booking_participantes p
        JOIN mt_bookings b ON b.booking_id = p.booking_id
        LEFT JOIN loose_class_matches lcm ON lcm.booking_id = b.booking_id AND lcm.customer_code = p.customer_code
        LEFT JOIN schedule_totals st ON b.booking_type = 'clase_colectiva' AND st.customer_code = p.customer_code AND st.plan_month = date_trunc('month', b.booking_date)::date AND st.day_of_week = EXTRACT(isodow FROM b.booking_date) AND st.start_time = b.start_time AND st.booking_class_type = CASE WHEN b.description ~ '\(\s*\d+\s*/\s*1\s*\)' THEN 'INDIVIDUAL' WHEN b.description ~ '\(\s*\d+\s*/\s*2\s*\)' THEN 'DUPLA' WHEN b.description ~ '\(\s*\d+\s*/\s*3\s*\)' THEN 'TRIO' WHEN b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)' THEN 'GRUPO' WHEN b.booking_type = 'clase_suelta' THEN 'INDIVIDUAL' ELSE 'GRUPO' END AND st.professor = COALESCE(CASE WHEN p.customer_code = '000917' OR p.customer_code = '000932' THEN 'Leandro Bonete' WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção' WHEN p.customer_code = '000815' OR p.customer_code = '000475' AND b.booking_date >= '2026-07-01' AND b.booking_date <= '2026-07-31' OR b.description ~~* '%Julio Souza%' OR b.description ~~* '%João Assunção%' OR b.description ~~* '%Joao Assuncao%' OR b.description ~~* '%Joao Assunção%' OR b.description ~~* '%João Assuncao%' THEN 'João Assunção' WHEN b.description ~~* '%Elinton Sanches%' OR b.description ~~* '%Eliton Sanches%' OR b.description ~~* '%Élinton Sanches%' OR b.description ~~* '%Éliton Sanches%' THEN 'Elinton Sanches' WHEN b.description ~~* '%Rodrigo Assunção%' OR b.description ~~* '%Rodrigo Assuncao%' THEN 'Rodrigo Assunção' WHEN b.description ~~* '%Leandro Bonete%' THEN 'Leandro Bonete' WHEN b.description ~~* '%Tatiana Araújo%' OR b.description ~~* '%Tatiana Araujo%' THEN 'Tatiana Araújo' WHEN b.description ~~* '%Leciane Silva%' THEN 'Leciane Silva' ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE(substring(b.description from '(?i)prof[:.]?[[:space:]]*([^.(]+)'), ''), '[[:space:]]+', ' ', 'g')), '') END, 'Sem professor')
        WHERE b.status = 'ACTIVE' AND (b.booking_type = ANY (ARRAY['clase_colectiva', 'clase_suelta'])) AND b.description !~~* '%RESERVA MENSAL%'
    ), 
    unallocated_payments AS (
        SELECT rf.item_key,
            COALESCE(
                CASE
                    WHEN rf.customer_code = '000815' THEN 'João Assunção'
                    WHEN rf.customer_code = '000917' OR rf.customer_code = '000932' THEN 'Leandro Bonete'
                    WHEN rf.description ~~* '%João Assunção%' OR rf.description ~~* '%Joao Assuncao%' OR rf.description ~~* '%Joao Assunção%' OR rf.description ~~* '%João Assuncao%' OR rf.description ~~* '%Joao A.%' THEN 'João Assunção'
                    WHEN rf.description ~~* '%Rodrigo Assunção%' OR rf.description ~~* '%Rodrigo Assuncao%' OR rf.description ~~* '%Rodrigo A.%' THEN 'Rodrigo Assunção'
                    WHEN rf.description ~~* '%Leandro Bonete%' OR rf.description ~~* '%Leandro B.%' OR rf.description ~~* '%Leandro B' THEN 'Leandro Bonete'
                    WHEN rf.description ~~* '%Tatiana Araújo%' OR rf.description ~~* '%Tatiana Araujo%' OR rf.description ~~* '%Tatiana A.%' THEN 'Tatiana Araújo'
                    WHEN rf.description ~~* '%Leciane Silva%' OR rf.description ~~* '%Leciane S.%' THEN 'Leciane Silva'
                    WHEN rf.description ~~* '%Elinton Sanches%' OR rf.description ~~* '%Eliton Sanches%' OR rf.description ~~* '%Élinton Sanches%' OR rf.description ~~* '%Éliton Sanches%' OR rf.description ~~* '%Elinton S.%' THEN 'Elinton Sanches'
                    WHEN rf.description ~~* '%Alan%' THEN 'Alan'
                    ELSE NULL
                END,
                CASE WHEN rf.is_avulsa THEN 'Sem professor' ELSE NULL END,
                ( SELECT prof.professor
                  FROM ( SELECT DISTINCT ON (p_sub.customer_code) p_sub.customer_code,
                            COALESCE(
                                CASE
                                    WHEN b_sub.booking_id = 4725 THEN 'Rodrigo Assunção'
                                    WHEN p_sub.customer_code = '000815' OR p_sub.customer_code = '000475' AND b_sub.booking_date >= '2026-07-01' AND b_sub.booking_date <= '2026-07-31' THEN 'João Assunção'
                                    WHEN b_sub.description ~~* '%Elinton Sanches%' OR b_sub.description ~~* '%Eliton Sanches%' OR b_sub.description ~~* '%Élinton Sanches%' OR b_sub.description ~~* '%Éliton Sanches%' THEN 'Elinton Sanches'
                                    WHEN b_sub.description ~~* '%Rodrigo Assunção%' OR b_sub.description ~~* '%Rodrigo Assuncao%' THEN 'Rodrigo Assunção'
                                    WHEN b_sub.description ~~* '%Leandro Bonete%' THEN 'Leandro Bonete'
                                    WHEN b_sub.description ~~* '%Tatiana Araújo%' OR b_sub.description ~~* '%Tatiana Araujo%' THEN 'Tatiana Araújo'
                                    WHEN b_sub.description ~~* '%Leciane Silva%' THEN 'Leciane Silva'
                                    ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE(substring(b_sub.description from '(?i)prof[:.]?[[:space:]]*([^.(]+)'), ''), '[[:space:]]+', ' ', 'g')), '')
                                END, 'Sem professor') AS professor
                           FROM mt_booking_participantes p_sub
                           JOIN mt_bookings b_sub ON b_sub.booking_id = p_sub.booking_id
                          WHERE p_sub.customer_code = rf.customer_code AND b_sub.status = 'ACTIVE' AND b_sub.booking_type = 'clase_colectiva'
                          ORDER BY p_sub.customer_code, (abs(b_sub.booking_date - COALESCE(rf.pay_date, rf.data_venda::timestamp)::date))) prof), 
                'Sem professor') AS professor,
            rf.customer_code,
            COALESCE(( SELECT c.name FROM mt_clientes c WHERE c.customer_code = rf.customer_code LIMIT 1), 'Cliente Desconhecido') AS participant_name,
            rf.valor_faturamento,
            CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, 0), rf.valor_faturamento * 2.0) ELSE rf.valor_faturamento END AS valor_bruto,
            rf.pay_date,
            rf.paid,
            rf.is_avulsa,
            rf.is_avulsa_grupo_fixo,
            rf.description,
            rf.data_venda
        FROM resolved_faturamento rf
        WHERE rf.paid = true AND (rf.is_avulsa = true OR NOT (EXISTS ( SELECT 1 FROM final_bookings fb WHERE fb.customer_code = rf.customer_code AND date_trunc('month', fb.booking_date) = date_trunc('month', COALESCE(rf.pay_date, rf.data_venda::timestamp))))) AND NOT (EXISTS ( SELECT 1 FROM loose_class_matches lcm WHERE lcm.item_key = rf.item_key)) AND rf.item_canceled = false AND rf.sale_canceled = false AND COALESCE(rf.sale_type, '') <> 'refund' AND rf.valor_faturamento > 0 AND (rf.categoria = 'Aulas' OR rf.description ~~* '%AULA%' OR rf.description ~~* '%GRUPO FIXO%' OR rf.categoria = 'Outros' AND (rf.description ~~* '%TÊNIS%' OR rf.description ~~* '%AULA%' OR rf.description ~~* '%GRUPO FIXO%') AND (rf.description ~~* '%ADULTO%' OR rf.description ~~* '%KIDS%' OR rf.description ~~* '%AVULSA%' OR rf.description ~~* '%GRUPO FIXO%'))
    ), 
    all_combined AS (
        SELECT fb.booking_id, fb.booking_date, fb.is_socio_benefit, fb.is_paid, fb.pay_date, fb.booking_value_monthly, fb.booking_commission_base_monthly, fb.is_avulsa, fb.is_avulsa_grupo_fixo, fb.start_time, fb.booking_value, fb.booking_commission_base, fb.booking_type, fb.participant_name, fb.venue, fb.resource_name, fb.description, fb.professor, fb.customer_code
        FROM final_bookings fb
        UNION ALL
        SELECT NULL::bigint AS booking_id, COALESCE(up.pay_date, up.data_venda::timestamp)::date AS booking_date, false AS is_socio_benefit, up.paid AS is_paid, up.pay_date, 0::numeric AS booking_value_monthly, 0::numeric AS booking_commission_base_monthly, up.is_avulsa, up.is_avulsa_grupo_fixo, NULL::time AS start_time, up.valor_faturamento AS booking_value, up.valor_bruto AS booking_commission_base, 'unallocated_payment' AS booking_type, up.participant_name, 'MONTREAL TENIS CLUBE LTDA' AS venue, 'N/A' AS resource_name, up.description, up.professor, up.customer_code
        FROM unallocated_payments up
    ), 
    kids_saturday_split AS (
        SELECT c.booking_id, c.booking_date, c.is_socio_benefit, c.is_paid, c.pay_date, c.booking_value_monthly / 2.0 AS booking_value_monthly, c.booking_commission_base_monthly / 2.0 AS booking_commission_base_monthly, c.is_avulsa, c.is_avulsa_grupo_fixo, c.start_time, c.booking_value / 2.0 AS booking_value, c.booking_commission_base / 2.0 AS booking_commission_base, c.booking_type, c.participant_name, c.venue, c.resource_name, c.description, 'Leandro Bonete' AS professor, c.customer_code
        FROM all_combined c
        WHERE c.start_time IS NOT NULL AND EXTRACT(isodow FROM c.booking_date) = 6 AND c.start_time = '10:00:00'::time AND c.professor = 'Leandro Bonete'
        UNION ALL
        SELECT c.booking_id, c.booking_date, c.is_socio_benefit, c.is_paid, c.pay_date, c.booking_value_monthly / 2.0 AS booking_value_monthly, c.booking_commission_base_monthly / 2.0 AS booking_commission_base_monthly, c.is_avulsa, c.is_avulsa_grupo_fixo, c.start_time, c.booking_value / 2.0 AS booking_value, c.booking_commission_base / 2.0 AS booking_commission_base, c.booking_type, c.participant_name, c.venue, c.resource_name, c.description, 'Elinton Sanches' AS professor, c.customer_code
        FROM all_combined c
        WHERE c.start_time IS NOT NULL AND EXTRACT(isodow FROM c.booking_date) = 6 AND c.start_time = '10:00:00'::time AND c.professor = 'Leandro Bonete'
    ), 
    pre_result AS (
        SELECT c.booking_id, c.booking_date, c.booking_type, c.start_time, c.venue, c.resource_name, c.description, c.professor, c.customer_code, c.participant_name, c.booking_value, c.booking_commission_base, c.is_socio_benefit, c.is_paid, c.pay_date, c.booking_value_monthly, c.booking_commission_base_monthly, c.is_avulsa, c.is_avulsa_grupo_fixo
        FROM all_combined c
        WHERE NOT (c.start_time IS NOT NULL AND EXTRACT(isodow FROM c.booking_date) = 6 AND c.start_time = '10:00:00'::time AND c.professor = 'Leandro Bonete')
        UNION ALL
        SELECT k.booking_id, k.booking_date, k.booking_type, k.start_time, k.venue, k.resource_name, k.description, k.professor, k.customer_code, k.participant_name, k.booking_value, k.booking_commission_base, k.is_socio_benefit, k.is_paid, k.pay_date, k.booking_value_monthly, k.booking_commission_base_monthly, k.is_avulsa, k.is_avulsa_grupo_fixo
        FROM kids_saturday_split k
    )
    SELECT pre_result.booking_id, pre_result.booking_date, pre_result.booking_type, pre_result.start_time, pre_result.venue, pre_result.resource_name, pre_result.description, pre_result.professor, pre_result.customer_code, pre_result.participant_name, pre_result.booking_value, pre_result.booking_commission_base, pre_result.is_socio_benefit, pre_result.is_paid, pre_result.pay_date, pre_result.booking_value_monthly, pre_result.booking_commission_base_monthly, pre_result.is_avulsa, pre_result.is_avulsa_grupo_fixo
    FROM pre_result
)
SELECT * FROM view_base;
