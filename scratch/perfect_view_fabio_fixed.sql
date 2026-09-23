CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS
WITH view_base AS (
         WITH unique_participants AS MATERIALIZED (
                 SELECT DISTINCT ON (mt_booking_participantes.participant_name) mt_booking_participantes.participant_name,
                    mt_booking_participantes.customer_code
                   FROM mt_booking_participantes
                  WHERE ((mt_booking_participantes.participant_name IS NOT NULL) AND (length(mt_booking_participantes.participant_name) > 5))
                ), booking_min_pay_dates AS (
                 SELECT mt_booking_pagamentos.booking_id,
                    min(mt_booking_pagamentos.payment_date) AS min_payment_date
                   FROM mt_booking_pagamentos
                  GROUP BY mt_booking_pagamentos.booking_id
                ), loose_class_matches AS (
                 SELECT b.booking_id,
                    p.customer_code,
                    fi.item_key,
                    fi.valor_faturamento AS payment_value,
                        CASE
                            WHEN (fi.description ~~* '%Sócio Montreal%'::text) THEN COALESCE(fi.valor_bruto, (fi.valor_faturamento * (2)::numeric))
                            WHEN ((fi.description ~~* '%Leonardo Assunção%'::text) OR (fi.description ~~* '%Leonardo Assuncao%'::text)) THEN (fi.valor_faturamento * (2)::numeric)
                            ELSE fi.valor_faturamento
                        END AS payment_value_comissao,
                        CASE
                            WHEN ((fi.description ~~* '%Sócio Montreal%'::text) OR (fi.description ~~* '%Leonardo Assunção%'::text) OR (fi.description ~~* '%Leonardo Assuncao%'::text)) THEN true
                            ELSE false
                        END AS is_socio,
                    fv.paid AS is_paid,
                    COALESCE(bmpd.min_payment_date, fv.pay_date) AS pay_date,
                        CASE
                            WHEN (fv.customer_code = '000917'::text OR fv.customer_code = '000932'::text) THEN 'Leandro Bonete'::text
                            WHEN ((fv.customer_code = '000815'::text) OR ((fv.customer_code = '000475'::text) AND (((fv.pay_date >= '2026-07-01 00:00:00'::timestamp without time zone) AND (fv.pay_date < '2026-08-01 00:00:00'::timestamp without time zone)) OR (fi.description ~~* '%15/07/2026%'::text))) OR (fi.description ~~* '%João Assunção%'::text) OR (fi.description ~~* '%Joao Assuncao%'::text) OR (fi.description ~~* '%Joao Assunção%'::text) OR (fi.description ~~* '%João Assuncao%'::text) OR (fi.description ~~* '%Joao A.%'::text)) THEN 'João Assunção'::text
                            WHEN ((fi.description ~~* '%Rodrigo Assunção%'::text) OR (fi.description ~~* '%Rodrigo Assuncao%'::text) OR (fi.description ~~* '%Rodrigo A.%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN ((fi.description ~~* '%Leandro Bonete%'::text) OR (fi.description ~~* '%Leandro B.%'::text) OR (fi.description ~~* '%Leandro B'::text)) THEN 'Leandro Bonete'::text
                            WHEN ((fi.description ~~* '%Tatiana Araújo%'::text) OR (fi.description ~~* '%Tatiana Araujo%'::text) OR (fi.description ~~* '%Tatiana A.%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN ((fi.description ~~* '%Leciane Silva%'::text) OR (fi.description ~~* '%Leciane S.%'::text)) THEN 'Leciane Silva'::text
                            WHEN ((fi.description ~~* '%Elinton Sanches%'::text) OR (fi.description ~~* '%Eliton Sanches%'::text) OR (fi.description ~~* '%Élinton Sanches%'::text) OR (fi.description ~~* '%Éliton Sanches%'::text) OR (fi.description ~~* '%Elinton S.%'::text)) THEN 'Elinton Sanches'::text
                            ELSE NULL::text
                        END AS professor
                   FROM ((((mt_booking_participantes p
                     JOIN mt_bookings b ON ((b.booking_id = p.booking_id)))
                     LEFT JOIN booking_min_pay_dates bmpd ON ((bmpd.booking_id = b.booking_id)))
                     JOIN mt_faturamento_vendas fv ON ((fv.customer_code = p.customer_code)))
                     JOIN mt_faturamento_itens fi ON ((fi.venda_external_id = fv.external_id)))
                  WHERE ((fv.paid = true) AND (b.status = 'ACTIVE'::text) AND (b.booking_type = 'clase_suelta'::text) AND (b.description !~~* '%RESERVA MENSAL%'::text) AND (fi.is_canceled = false) AND (fv.is_canceled = false) AND (fi.valor_faturamento > (0)::numeric) AND (fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text, 'Locação'::text])) AND (((fi.description ~~ (('%'::text || to_char((b.booking_date)::timestamp with time zone, 'DD/MM/YYYY'::text)) || '%'::text)) AND (fi.description ~~ (('%'::text || to_char((b.start_time)::interval, 'HH24:MI'::text)) || '%'::text))) OR (EXISTS ( SELECT 1
                           FROM mt_booking_pagamentos bpay
                          WHERE ((bpay.booking_id = b.booking_id) AND (bpay.payment_date = fv.pay_date) AND (bpay.amount = fi.valor_faturamento))))))
                ), resolved_faturamento AS MATERIALIZED (
                 SELECT i.item_key,
                    COALESCE(( SELECT p_1.customer_code
                       FROM unique_participants p_1
                      WHERE i.description ~~* (('%'::text || p_1.participant_name) || '%'::text)
                     LIMIT 1), v.customer_code) AS customer_code,
                    v.pay_date,
                    v.data_venda,
                    i.valor_faturamento,
                    i.valor_bruto,
                    i.description,
                    v.paid,
                    COALESCE(i.description ~~* '%AULA AVULSA%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text OR i.subcategoria = 'Avulsa - Particular'::text, false) AS is_avulsa,
                    COALESCE(i.description ~~* '%AULA AVULSA - GRUPO FIXO%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text, false) AS is_avulsa_grupo_fixo,
                    CASE WHEN i.description ~~* '%Sócio Montreal%'::text OR i.description ~~* '%Leonardo Assunção%'::text OR i.description ~~* '%Leonardo Assuncao%'::text THEN true ELSE false END AS is_socio,
                    i.is_canceled AS item_canceled,
                    v.is_canceled AS sale_canceled,
                    v.tipo AS sale_type,
                    i.categoria
                   FROM mt_faturamento_itens i
                     JOIN mt_faturamento_vendas v ON v.external_id = i.venda_external_id
                ), plan_items_raw AS MATERIALIZED (
                 SELECT rf.item_key,
                    rf.customer_code,
                    (COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone))::date AS pay_date,
                    (date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)))::date AS plan_month,
                    rf.paid,
                        CASE
                            WHEN (rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text) THEN round((((CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, (0)::numeric), (rf.valor_faturamento * (2.0)::numeric)) ELSE rf.valor_faturamento END) * (((((date_trunc('month'::text, (to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text))::timestamp with time zone) + '1 mon -1 days'::interval))::date - (date_trunc('month'::text, (to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text))::timestamp with time zone))::date) + 1))::numeric) / (GREATEST(((to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)) + 1), 1))::numeric), 2)
                            ELSE CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, (0)::numeric), (rf.valor_faturamento * (2.0)::numeric)) ELSE rf.valor_faturamento END
                        END AS valor_bruto_derived,
                    rf.is_socio,
                    COALESCE(
                        CASE
                            WHEN (rf.description ~~* '%AULA AVULSA%'::text) THEN 'OUTRO'::text
                            WHEN (rf.description ~~* '%INDIVIDUAL%'::text) THEN 'INDIVIDUAL'::text
                            WHEN (rf.description ~~* '%DUPLA%'::text) THEN 'DUPLA'::text
                            WHEN (rf.description ~~* '%TRIO%'::text) THEN 'TRIO'::text
                            WHEN ((rf.description ~~* '%GRUPO%'::text) OR (rf.description ~~* '%QUARTETO%'::text) OR (rf.description ~~* '%KIDS%'::text)) THEN 'GRUPO'::text
                            ELSE NULL::text
                        END, 
                        ( SELECT bp.plan_class_type
                          FROM ( VALUES ('INDIVIDUAL'::text, 720.00), ('DUPLA'::text, 430.00), ('TRIO'::text, 395.00), ('GRUPO'::text, 335.00), ('GRUPO'::text, 245.00) ) bp(plan_class_type, base_value)
                          WHERE abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value) <= 150.00
                             OR abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - (2.0 * bp.base_value)) <= 200.00
                          ORDER BY LEAST(abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - bp.base_value), abs(COALESCE(rf.valor_bruto, rf.valor_faturamento) - (2.0 * bp.base_value))) ASC
                          LIMIT 1
                        ),
                        ( SELECT CASE
                             WHEN (b_sub.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text) THEN 'INDIVIDUAL'::text
                             WHEN (b_sub.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text) THEN 'DUPLA'::text
                             WHEN (b_sub.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text) THEN 'TRIO'::text
                             WHEN (b_sub.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text) THEN 'GRUPO'::text
                             ELSE 'GRUPO'::text
                           END
                         FROM (mt_booking_participantes p_sub
                           JOIN mt_bookings b_sub ON ((b_sub.booking_id = p_sub.booking_id)))
                        WHERE ((p_sub.customer_code = rf.customer_code) AND (b_sub.status = 'ACTIVE'::text) AND (b_sub.booking_type = 'clase_colectiva'::text))
                       LIMIT 1),
                        'GRUPO'::text
                    ) AS plan_class_type,
                    rf.is_avulsa,
                    rf.is_avulsa_grupo_fixo,
                    rf.valor_faturamento AS valor_faturamento_monthly,
                    CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, (0)::numeric), (rf.valor_faturamento * (2.0)::numeric)) ELSE rf.valor_faturamento END AS valor_bruto_monthly,
                    rf.description
                   FROM resolved_faturamento rf
                  WHERE ((rf.paid = true) AND (rf.is_avulsa = false) AND (rf.item_canceled = false) AND (rf.sale_canceled = false) AND (COALESCE(rf.sale_type, ''::text) <> 'refund'::text) AND (rf.valor_faturamento > (0)::numeric) AND ((rf.categoria = 'Aulas'::text) OR ((rf.categoria = 'Outros'::text) AND (rf.description ~~* '%TÊNIS%'::text) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text)))))
                ), schedules AS (
                 SELECT p.customer_code,
                    (date_trunc('month'::text, (b.booking_date)::timestamp with time zone))::date AS plan_month,
                    EXTRACT(isodow FROM b.booking_date) AS day_of_week,
                    b.start_time,
                        CASE
                            WHEN ((p.customer_code = '000815'::text) OR ((p.customer_code = '000475'::text) AND (b.booking_date >= '2026-07-01'::date) AND (b.booking_date <= '2026-07-31'::date)) OR (b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
                            WHEN ((b.description ~~* '%Elinton Sanches%'::text) OR (b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Élinton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Elinton Sanches'::text
                            WHEN ((b.description ~~* '%Rodrigo Assunção%'::text) OR (b.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                            WHEN ((b.description ~~* '%Tatiana Araújo%'::text) OR (b.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN (b.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END AS professor,
                        CASE
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text) THEN 'INDIVIDUAL'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text) THEN 'DUPLA'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text) THEN 'TRIO'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text) THEN 'GRUPO'::text
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN 'INDIVIDUAL'::text
                            ELSE 'GRUPO'::text
                        END AS booking_class_type,
                    count(*) AS bookings_count
                   FROM (mt_booking_participantes p
                     JOIN mt_bookings b ON ((b.booking_id = p.booking_id)))
                  WHERE ((b.status = 'ACTIVE'::text) AND (b.booking_type = 'clase_colectiva'::text) AND (b.description !~~* '%RESERVA MENSAL%'::text))
                  GROUP BY p.customer_code, ((date_trunc('month'::text, (b.booking_date)::timestamp with time zone))::date), (EXTRACT(isodow FROM b.booking_date)), b.start_time,
                        CASE
                            WHEN ((p.customer_code = '000815'::text) OR ((p.customer_code = '000475'::text) AND (b.booking_date >= '2026-07-01'::date) AND (b.booking_date <= '2026-07-31'::date)) OR (b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
                            WHEN ((b.description ~~* '%Elinton Sanches%'::text) OR (b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Élinton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Elinton Sanches'::text
                            WHEN ((b.description ~~* '%Rodrigo Assunção%'::text) OR (b.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                            WHEN ((b.description ~~* '%Tatiana Araújo%'::text) OR (b.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN (b.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END,
                        CASE
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text) THEN 'INDIVIDUAL'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text) THEN 'DUPLA'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text) THEN 'TRIO'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text) THEN 'GRUPO'::text
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN 'INDIVIDUAL'::text
                            ELSE 'GRUPO'::text
                        END
                ), pi_exact AS (
                 SELECT pir.item_key,
                    pir.customer_code,
                    pir.plan_month,
                    pir.pay_date,
                    pir.paid,
                    pir.is_socio,
                    pir.plan_class_type,
                    pir.valor_faturamento_monthly,
                    pir.valor_bruto_monthly
                   FROM plan_items_raw pir
                ), exact_schedule_matches AS (
                 SELECT s.customer_code,
                    s.plan_month,
                    s.day_of_week,
                    s.start_time,
                    s.professor,
                    s.booking_class_type,
                    s.bookings_count,
                    count(pe.item_key) AS exact_match_count
                   FROM (schedules s
                     LEFT JOIN pi_exact pe ON (((pe.customer_code = s.customer_code) AND (pe.plan_month = s.plan_month) AND (pe.plan_class_type = s.booking_class_type))))
                  GROUP BY s.customer_code, s.plan_month, s.day_of_week, s.start_time, s.professor, s.booking_class_type, s.bookings_count
                ), schedules_with_sums AS (
                 SELECT s.customer_code,
                    s.plan_month,
                    s.day_of_week,
                    s.start_time,
                    s.professor,
                    s.booking_class_type,
                    s.bookings_count,
                    esm.exact_match_count,
                    CASE
                        WHEN (s.customer_code = '000602'::text) THEN (100.00 * (s.bookings_count)::numeric)
                        ELSE 1.0
                    END AS schedule_weight,
                    sum(
                        CASE
                            WHEN (s.customer_code = '000602'::text) THEN (100.00 * (s.bookings_count)::numeric)
                            ELSE 1.0
                        END
                    ) OVER (PARTITION BY s.customer_code, s.plan_month) AS total_customer_weighted_bookings_all
                   FROM (schedules s
                     JOIN exact_schedule_matches esm ON (((esm.customer_code = s.customer_code) AND (esm.plan_month = s.plan_month) AND (esm.day_of_week = s.day_of_week) AND (esm.start_time = s.start_time) AND (esm.professor = s.professor) AND (esm.booking_class_type = s.booking_class_type))))
                ), exact_item_schedule_allocations AS (
                 SELECT pe.customer_code,
                    pe.plan_month,
                    s.day_of_week,
                    s.start_time,
                    s.professor,
                    s.booking_class_type,
                    s.bookings_count,
                    pe.pay_date,
                    pe.paid,
                    pe.is_socio,
                    false AS is_avulsa,
                    false AS is_avulsa_grupo_fixo,
                    (pe.valor_faturamento_monthly / (NULLIF(count(*) OVER (PARTITION BY pe.item_key), 0))::numeric) AS allocated_valor_faturamento_monthly,
                    CASE 
                      WHEN pe.customer_code = '000007'::text THEN (pe.valor_bruto_monthly * (0.88)::numeric / (NULLIF(count(*) OVER (PARTITION BY pe.item_key), 0))::numeric)
                      ELSE (pe.valor_bruto_monthly / (NULLIF(count(*) OVER (PARTITION BY pe.item_key), 0))::numeric)
                    END AS allocated_valor_bruto_monthly
                   FROM (pi_exact pe
                     JOIN schedules s ON (((s.customer_code = pe.customer_code) AND (s.plan_month = pe.plan_month) AND (s.booking_class_type = pe.plan_class_type))))
                ), fallback_plan_totals AS (
                 SELECT pir.customer_code,
                    pir.plan_month,
                    max(pir.pay_date) AS pay_date,
                    bool_or(pir.paid) AS paid,
                    bool_or(pir.is_socio) AS is_socio,
                    bool_or(pir.is_avulsa) AS is_avulsa,
                    bool_or(pir.is_avulsa_grupo_fixo) AS is_avulsa_grupo_fixo,
                    sum(pir.valor_faturamento_monthly) AS total_valor_faturamento_monthly,
                    sum(pir.valor_bruto_monthly) AS total_valor_bruto_monthly
                   FROM plan_items_raw pir
                  WHERE (NOT (EXISTS ( SELECT 1
                           FROM schedules s
                          WHERE ((s.customer_code = pir.customer_code) AND (s.plan_month = pir.plan_month) AND (s.booking_class_type = pir.plan_class_type)))))
                  GROUP BY pir.customer_code, pir.plan_month
                ), fallback_schedule_allocations AS (
                 SELECT sws.customer_code,
                    sws.plan_month,
                    sws.day_of_week,
                    sws.start_time,
                    sws.professor,
                    sws.booking_class_type,
                    sws.bookings_count,
                    fpt.pay_date,
                    fpt.paid,
                    fpt.is_socio,
                    fpt.is_avulsa,
                    fpt.is_avulsa_grupo_fixo,
                    ((fpt.total_valor_faturamento_monthly * sws.schedule_weight) / NULLIF(sum(sws.schedule_weight) OVER (PARTITION BY sws.customer_code, sws.plan_month), (0)::numeric)) AS allocated_valor_faturamento_monthly,
                    CASE
                        WHEN (sws.customer_code = '000007'::text)
                        THEN (((fpt.total_valor_bruto_monthly * (0.88)::numeric) * sws.schedule_weight) / NULLIF(sum(sws.schedule_weight) OVER (PARTITION BY sws.customer_code, sws.plan_month), (0)::numeric))
                        ELSE ((fpt.total_valor_bruto_monthly * sws.schedule_weight) / NULLIF(sum(sws.schedule_weight) OVER (PARTITION BY sws.customer_code, sws.plan_month), (0)::numeric))
                    END AS allocated_valor_bruto_monthly
                   FROM (schedules_with_sums sws
                     JOIN fallback_plan_totals fpt ON (((fpt.customer_code = sws.customer_code) AND (fpt.plan_month = sws.plan_month))))
                  WHERE (sws.exact_match_count = 0)
                ), schedule_allocations AS (
                 SELECT exact_item_schedule_allocations.customer_code,
                    exact_item_schedule_allocations.plan_month,
                    exact_item_schedule_allocations.day_of_week,
                    exact_item_schedule_allocations.start_time,
                    exact_item_schedule_allocations.professor,
                    exact_item_schedule_allocations.booking_class_type,
                    exact_item_schedule_allocations.bookings_count,
                    exact_item_schedule_allocations.pay_date,
                    exact_item_schedule_allocations.paid,
                    exact_item_schedule_allocations.is_socio,
                    exact_item_schedule_allocations.is_avulsa,
                    exact_item_schedule_allocations.is_avulsa_grupo_fixo,
                    exact_item_schedule_allocations.allocated_valor_faturamento_monthly,
                    exact_item_schedule_allocations.allocated_valor_bruto_monthly
                   FROM exact_item_schedule_allocations
                UNION ALL
                 SELECT fallback_schedule_allocations.customer_code,
                    fallback_schedule_allocations.plan_month,
                    fallback_schedule_allocations.day_of_week,
                    fallback_schedule_allocations.start_time,
                    fallback_schedule_allocations.professor,
                    fallback_schedule_allocations.booking_class_type,
                    fallback_schedule_allocations.bookings_count,
                    fallback_schedule_allocations.pay_date,
                    fallback_schedule_allocations.paid,
                    fallback_schedule_allocations.is_socio,
                    fallback_schedule_allocations.is_avulsa,
                    fallback_schedule_allocations.is_avulsa_grupo_fixo,
                    fallback_schedule_allocations.allocated_valor_faturamento_monthly,
                    fallback_schedule_allocations.allocated_valor_bruto_monthly
                   FROM fallback_schedule_allocations
                ), schedule_totals AS (
                 SELECT schedule_allocations.customer_code,
                    schedule_allocations.plan_month,
                    schedule_allocations.day_of_week,
                    schedule_allocations.start_time,
                    schedule_allocations.professor,
                    schedule_allocations.booking_class_type,
                    schedule_allocations.bookings_count,
                    COALESCE(sum(schedule_allocations.allocated_valor_faturamento_monthly), (0)::numeric) AS schedule_monthly_value,
                    COALESCE(sum(schedule_allocations.allocated_valor_bruto_monthly), (0)::numeric) AS schedule_monthly_commission_base,
                    COALESCE(bool_or(schedule_allocations.is_socio), false) AS is_socio,
                    COALESCE(bool_or(schedule_allocations.paid), false) AS is_paid,
                    max(schedule_allocations.pay_date) AS pay_date,
                    COALESCE(sum(schedule_allocations.allocated_valor_faturamento_monthly), (0)::numeric) AS schedule_monthly_value_monthly,
                    COALESCE(sum(schedule_allocations.allocated_valor_bruto_monthly), (0)::numeric) AS schedule_monthly_commission_base_monthly,
                    COALESCE(bool_or(schedule_allocations.is_avulsa), false) AS is_avulsa,
                    COALESCE(bool_or(schedule_allocations.is_avulsa_grupo_fixo), false) AS is_avulsa_grupo_fixo
                   FROM schedule_allocations
                  GROUP BY schedule_allocations.customer_code, schedule_allocations.plan_month, schedule_allocations.day_of_week, schedule_allocations.start_time, schedule_allocations.professor, schedule_allocations.booking_class_type, schedule_allocations.bookings_count
                ), final_bookings AS (
                 SELECT b.booking_id,
                    b.booking_date,
                    b.start_time,
                    b.booking_type,
                    b.venue,
                    b.resource_name,
                    b.description,
                    COALESCE(
                        CASE
                            WHEN (p.customer_code = '000917'::text OR p.customer_code = '000932'::text) THEN 'Leandro Bonete'::text
                            WHEN (b.booking_id = 4725) THEN 'Rodrigo Assunção'::text
                            WHEN ((p.customer_code = '000815'::text) OR ((p.customer_code = '000475'::text) AND (b.booking_date >= '2026-07-01'::date) AND (b.booking_date <= '2026-07-31'::date)) OR (b.description ~~* '%Julio Souza%'::text) OR (b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
                            WHEN ((b.description ~~* '%Elinton Sanches%'::text) OR (b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Élinton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Elinton Sanches'::text
                            WHEN ((b.description ~~* '%Rodrigo Assunção%'::text) OR (b.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                            WHEN ((b.description ~~* '%Tatiana Araújo%'::text) OR (b.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN (b.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END, lcm.professor, 'Sem professor'::text) AS professor,
                    p.customer_code,
                    COALESCE(( SELECT c.name
                           FROM mt_clientes c
                          WHERE (c.customer_code = p.customer_code)
                         LIMIT 1), p.participant_name) AS participant_name,
                        CASE
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN COALESCE(lcm.payment_value, (0)::numeric)
                            ELSE COALESCE((st.schedule_monthly_value / (NULLIF(st.bookings_count, 0))::numeric), (0)::numeric)
                        END AS booking_value,
                        CASE
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN COALESCE(lcm.payment_value_comissao, (0)::numeric)
                            ELSE COALESCE((st.schedule_monthly_commission_base / (NULLIF(st.bookings_count, 0))::numeric), (0)::numeric)
                        END AS booking_commission_base,
                    COALESCE(lcm.is_socio, st.is_socio, false) AS is_socio_benefit,
                        CASE
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN COALESCE(lcm.is_paid, false)
                            ELSE COALESCE(st.is_paid, false)
                        END AS is_paid,
                        CASE
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN lcm.pay_date
                            ELSE st.pay_date
                        END AS pay_date,
                        CASE
                            WHEN (b.booking_type = 'clase_colectiva'::text) THEN COALESCE((st.schedule_monthly_value_monthly / (NULLIF(st.bookings_count, 0))::numeric), (0)::numeric)
                            ELSE (0)::numeric
                        END AS booking_value_monthly,
                        CASE
                            WHEN (b.booking_type = 'clase_colectiva'::text) THEN COALESCE((st.schedule_monthly_commission_base_monthly / (NULLIF(st.bookings_count, 0))::numeric), (0)::numeric)
                            ELSE (0)::numeric
                        END AS booking_commission_base_monthly,
                        CASE
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN true
                            ELSE COALESCE(st.is_avulsa, false)
                        END AS is_avulsa,
                        CASE
                            WHEN (b.booking_type = 'clase_colectiva'::text) THEN false
                            ELSE COALESCE(st.is_avulsa_grupo_fixo, false)
                        END AS is_avulsa_grupo_fixo
                   FROM (((mt_booking_participantes p
                     JOIN mt_bookings b ON ((b.booking_id = p.booking_id)))
                     LEFT JOIN loose_class_matches lcm ON (((lcm.booking_id = b.booking_id) AND (lcm.customer_code = p.customer_code))))
                     LEFT JOIN schedule_totals st ON (((b.booking_type = 'clase_colectiva'::text) AND (st.customer_code = p.customer_code) AND (st.plan_month = (date_trunc('month'::text, (b.booking_date)::timestamp with time zone))::date) AND (st.day_of_week = EXTRACT(isodow FROM b.booking_date)) AND (st.start_time = b.start_time) AND (st.booking_class_type =
                        CASE
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text) THEN 'INDIVIDUAL'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text) THEN 'DUPLA'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text) THEN 'TRIO'::text
                            WHEN (b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text) THEN 'GRUPO'::text
                            WHEN (b.booking_type = 'clase_suelta'::text) THEN 'INDIVIDUAL'::text
                            ELSE 'GRUPO'::text
                        END) AND (st.professor =
                        CASE
                            WHEN (p.customer_code = '000917'::text OR p.customer_code = '000932'::text) THEN 'Leandro Bonete'::text
                            WHEN (b.booking_id = 4725) THEN 'Rodrigo Assunção'::text
                            WHEN ((p.customer_code = '000815'::text) OR ((p.customer_code = '000475'::text) AND (b.booking_date >= '2026-07-01'::date) AND (b.booking_date <= '2026-07-31'::date)) OR (b.description ~~* '%Julio Souza%'::text) OR (b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
                            WHEN ((b.description ~~* '%Elinton Sanches%'::text) OR (b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Élinton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Elinton Sanches'::text
                            WHEN ((b.description ~~* '%Rodrigo Assunção%'::text) OR (b.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                            WHEN ((b.description ~~* '%Tatiana Araújo%'::text) OR (b.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN (b.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END))))
                  WHERE ((b.status = 'ACTIVE'::text) AND (b.booking_type = ANY (ARRAY['clase_colectiva'::text, 'clase_suelta'::text])) AND (b.description !~~* '%RESERVA MENSAL%'::text))
                ), unallocated_payments AS (
                 SELECT rf.item_key,
                    COALESCE(
                        CASE
                            WHEN (rf.customer_code = '000815'::text) THEN 'João Assunção'::text
                            WHEN (rf.customer_code = '000917'::text OR rf.customer_code = '000932'::text) THEN 'Leandro Bonete'::text
                            WHEN ((rf.description ~~* '%João Assunção%'::text) OR (rf.description ~~* '%Joao Assuncao%'::text) OR (rf.description ~~* '%Joao Assunção%'::text) OR (rf.description ~~* '%João Assuncao%'::text) OR (rf.description ~~* '%Joao A.%'::text)) THEN 'João Assunção'::text
                            WHEN ((rf.description ~~* '%Rodrigo Assunção%'::text) OR (rf.description ~~* '%Rodrigo Assuncao%'::text) OR (rf.description ~~* '%Rodrigo A.%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN ((rf.description ~~* '%Leandro Bonete%'::text) OR (rf.description ~~* '%Leandro B.%'::text) OR (rf.description ~~* '%Leandro B'::text)) THEN 'Leandro Bonete'::text
                            WHEN ((rf.description ~~* '%Tatiana Araújo%'::text) OR (rf.description ~~* '%Tatiana Araujo%'::text) OR (rf.description ~~* '%Tatiana A.%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN ((rf.description ~~* '%Leciane Silva%'::text) OR (rf.description ~~* '%Leciane S.%'::text)) THEN 'Leciane Silva'::text
                            WHEN ((rf.description ~~* '%Elinton Sanches%'::text) OR (rf.description ~~* '%Eliton Sanches%'::text) OR (rf.description ~~* '%Élinton Sanches%'::text) OR (rf.description ~~* '%Éliton Sanches%'::text) OR (rf.description ~~* '%Elinton S.%'::text)) THEN 'Elinton Sanches'::text
                            WHEN (rf.description ~~* '%Alan%'::text) THEN 'Alan'::text
                            ELSE NULL::text
                        END,
                        CASE
                            WHEN rf.is_avulsa THEN 'Sem professor'::text
                            ELSE NULL::text
                        END, ( SELECT prof.professor
                           FROM ( SELECT DISTINCT ON (p_sub.customer_code) p_sub.customer_code,
                                    COALESCE(
                                        CASE
                                            WHEN (b_sub.booking_id = 4725) THEN 'Rodrigo Assunção'::text
                                            WHEN ((p_sub.customer_code = '000815'::text) OR ((p_sub.customer_code = '000475'::text) AND (b_sub.booking_date >= '2026-07-01'::date) AND (b_sub.booking_date <= '2026-07-31'::date))) THEN 'João Assunção'::text
                                            WHEN ((b_sub.description ~~* '%Elinton Sanches%'::text) OR (b_sub.description ~~* '%Eliton Sanches%'::text) OR (b_sub.description ~~* '%Élinton Sanches%'::text) OR (b_sub.description ~~* '%Éliton Sanches%'::text)) THEN 'Elinton Sanches'::text
                                            WHEN ((b_sub.description ~~* '%Rodrigo Assunção%'::text) OR (b_sub.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                                            WHEN (b_sub.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                                            WHEN ((b_sub.description ~~* '%Tatiana Araújo%'::text) OR (b_sub.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                                            WHEN (b_sub.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b_sub.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                                        END, 'Sem professor'::text) AS professor
                                   FROM (mt_booking_participantes p_sub
                                     JOIN mt_bookings b_sub ON ((b_sub.booking_id = p_sub.booking_id)))
                                  WHERE ((p_sub.customer_code = rf.customer_code) AND (b_sub.status = 'ACTIVE'::text) AND (b_sub.booking_type = 'clase_colectiva'::text))
                                  ORDER BY p_sub.customer_code, (abs((b_sub.booking_date - (COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone))::date)))) prof), 'Sem professor'::text) AS professor,
                    rf.customer_code,
                    COALESCE(( SELECT c.name
                           FROM mt_clientes c
                          WHERE (c.customer_code = rf.customer_code)
                         LIMIT 1), 'Cliente Desconhecido'::text) AS participant_name,
                    rf.valor_faturamento,
                    CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, (0)::numeric), (rf.valor_faturamento * (2.0)::numeric)) ELSE rf.valor_faturamento END AS valor_bruto,
                    rf.pay_date,
                    rf.paid,
                    rf.is_avulsa,
                    rf.is_avulsa_grupo_fixo,
                    rf.description,
                    rf.data_venda
                   FROM resolved_faturamento rf
                  WHERE ((rf.paid = true) AND (NOT (EXISTS ( SELECT 1
                           FROM final_bookings fb
                          WHERE ((fb.customer_code = rf.customer_code) AND (date_trunc('month'::text, (fb.booking_date)::timestamp without time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone))))))) AND (NOT (EXISTS ( SELECT 1
                           FROM loose_class_matches lcm
                          WHERE (lcm.item_key = rf.item_key)))) AND (rf.item_canceled = false) AND (rf.sale_canceled = false) AND (COALESCE(rf.sale_type, ''::text) <> 'refund'::text) AND (rf.valor_faturamento > (0)::numeric) AND ((rf.categoria = 'Aulas'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)))))
                ), all_combined AS (
                 SELECT fb.booking_id,
                    fb.booking_date,
                    fb.is_socio_benefit,
                    fb.is_paid,
                    fb.pay_date,
                    fb.booking_value_monthly,
                    fb.booking_commission_base_monthly,
                    fb.is_avulsa,
                    fb.is_avulsa_grupo_fixo,
                    fb.start_time,
                    fb.booking_value,
                    fb.booking_commission_base,
                    fb.booking_type,
                    fb.participant_name,
                    fb.venue,
                    fb.resource_name,
                    fb.description,
                    fb.professor,
                    fb.customer_code
                   FROM final_bookings fb
                UNION ALL
                 SELECT NULL::bigint AS booking_id,
                    (COALESCE(up.pay_date, (up.data_venda)::timestamp without time zone))::date AS booking_date,
                    false AS is_socio_benefit,
                    up.paid AS is_paid,
                    up.pay_date,
                    (0)::numeric AS booking_value_monthly,
                    (0)::numeric AS booking_commission_base_monthly,
                    up.is_avulsa,
                    up.is_avulsa_grupo_fixo,
                    NULL::time without time zone AS start_time,
                    up.valor_faturamento AS booking_value,
                    up.valor_bruto AS booking_commission_base,
                    'unallocated_payment'::text AS booking_type,
                    up.participant_name,
                    'MONTREAL TENIS CLUBE LTDA'::text AS venue,
                    'N/A'::text AS resource_name,
                    up.description,
                    up.professor,
                    up.customer_code
                   FROM unallocated_payments up
                ), kids_saturday_split AS (
                 SELECT c.booking_id,
                    c.booking_date,
                    c.is_socio_benefit,
                    c.is_paid,
                    c.pay_date,
                    (c.booking_value_monthly / 2.0) AS booking_value_monthly,
                    (c.booking_commission_base_monthly / 2.0) AS booking_commission_base_monthly,
                    c.is_avulsa,
                    c.is_avulsa_grupo_fixo,
                    c.start_time,
                    (c.booking_value / 2.0) AS booking_value,
                    (c.booking_commission_base / 2.0) AS booking_commission_base,
                    c.booking_type,
                    c.participant_name,
                    c.venue,
                    c.resource_name,
                    c.description,
                    'Leandro Bonete'::text AS professor,
                    c.customer_code
                   FROM all_combined c
                  WHERE (c.start_time IS NOT NULL AND (EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))
                UNION ALL
                 SELECT c.booking_id,
                    c.booking_date,
                    c.is_socio_benefit,
                    c.is_paid,
                    c.pay_date,
                    (c.booking_value_monthly / 2.0) AS booking_value_monthly,
                    (c.booking_commission_base_monthly / 2.0) AS booking_commission_base_monthly,
                    c.is_avulsa,
                    c.is_avulsa_grupo_fixo,
                    c.start_time,
                    (c.booking_value / 2.0) AS booking_value,
                    (c.booking_commission_base / 2.0) AS booking_commission_base,
                    c.booking_type,
                    c.participant_name,
                    c.venue,
                    c.resource_name,
                    c.description,
                    'Elinton Sanches'::text AS professor,
                    c.customer_code
                   FROM all_combined c
                  WHERE (c.start_time IS NOT NULL AND (EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))
                ), pre_result AS (
                 SELECT c.booking_id,
                    c.booking_date,
                    c.booking_type,
                    c.start_time,
                    c.venue,
                    c.resource_name,
                    c.description,
                    c.professor,
                    c.customer_code,
                    c.participant_name,
                    c.booking_value,
                    c.booking_commission_base,
                    c.is_socio_benefit,
                    c.is_paid,
                    c.pay_date,
                    c.booking_value_monthly,
                    c.booking_commission_base_monthly,
                    c.is_avulsa,
                    c.is_avulsa_grupo_fixo
                   FROM all_combined c
                  WHERE (c.start_time IS NULL OR NOT ((EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text)))
                UNION ALL
                 SELECT kids_saturday_split.booking_id,
                    kids_saturday_split.booking_date,
                    kids_saturday_split.booking_type,
                    kids_saturday_split.start_time,
                    kids_saturday_split.venue,
                    kids_saturday_split.resource_name,
                    kids_saturday_split.description,
                    kids_saturday_split.professor,
                    kids_saturday_split.customer_code,
                    kids_saturday_split.participant_name,
                    kids_saturday_split.booking_value,
                    kids_saturday_split.booking_commission_base,
                    kids_saturday_split.is_socio_benefit,
                    kids_saturday_split.is_paid,
                    kids_saturday_split.pay_date,
                    kids_saturday_split.booking_value_monthly,
                    kids_saturday_split.booking_commission_base_monthly,
                    kids_saturday_split.is_avulsa,
                    kids_saturday_split.is_avulsa_grupo_fixo
                   FROM kids_saturday_split
                )
         SELECT pre_result.booking_id,
            pre_result.booking_date,
            pre_result.booking_type,
            pre_result.start_time,
            pre_result.venue,
            pre_result.resource_name,
            pre_result.description,
            pre_result.professor,
            pre_result.customer_code,
            pre_result.participant_name,
            pre_result.booking_value,
            pre_result.booking_commission_base,
            pre_result.is_socio_benefit,
            pre_result.is_paid,
            pre_result.pay_date,
            pre_result.booking_value_monthly,
            pre_result.booking_commission_base_monthly,
            pre_result.is_avulsa,
            pre_result.is_avulsa_grupo_fixo
           FROM pre_result
        )
 SELECT booking_id,
    booking_date,
    booking_type,
    start_time,
    venue,
    resource_name,
    description,
    professor,
    customer_code,
    participant_name,
    booking_value,
    booking_commission_base,
    is_socio_benefit,
    is_paid,
    pay_date,
    booking_value_monthly,
    booking_commission_base_monthly,
    is_avulsa,
    is_avulsa_grupo_fixo
   FROM view_base;