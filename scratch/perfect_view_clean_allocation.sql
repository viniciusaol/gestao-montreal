
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
                    COALESCE(i.description ~~* '%AVULSA%'::text OR i.description ~~* '%GRUPO%FIXO%'::text OR i.subcategoria ~~* '%Avulsa%'::text OR i.subcategoria ~~* '%Grupo Fixo%'::text, false) AS is_avulsa,
                    COALESCE(i.description ~~* '%GRUPO%FIXO%'::text OR i.subcategoria ~~* '%Grupo Fixo%'::text, false) AS is_avulsa_grupo_fixo,
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
                    rf.is_socio,
                    rf.is_avulsa,
                    rf.is_avulsa_grupo_fixo,
                    rf.valor_faturamento AS valor_faturamento_monthly,
                    CASE WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, (0)::numeric), (rf.valor_faturamento * (2.0)::numeric)) ELSE rf.valor_faturamento END AS valor_bruto_monthly,
                    rf.description
                   FROM resolved_faturamento rf
                  WHERE ((rf.paid = true) AND (rf.is_avulsa = false) AND (rf.item_canceled = false) AND (rf.sale_canceled = false) AND (COALESCE(rf.sale_type, ''::text) <> 'refund'::text) AND (rf.valor_faturamento > (0)::numeric) AND ((rf.categoria = 'Aulas'::text) OR ((rf.categoria = 'Outros'::text) AND (rf.description ~~* '%TÊNIS%'::text) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text)))))
                ), customer_plan_totals AS (
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
                  GROUP BY pir.customer_code, pir.plan_month
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
                ), schedules_with_sums AS (
                 SELECT s.customer_code,
                    s.plan_month,
                    s.day_of_week,
                    s.start_time,
                    s.professor,
                    s.booking_class_type,
                    s.bookings_count,
                    CASE
                        WHEN (s.customer_code = '000602'::text) THEN (100.00 * (s.bookings_count)::numeric)
                        ELSE (1.0 * (s.bookings_count)::numeric)
                    END AS schedule_weight,
                    sum(
                        CASE
                            WHEN (s.customer_code = '000602'::text) THEN (100.00 * (s.bookings_count)::numeric)
                            ELSE (1.0 * (s.bookings_count)::numeric)
                        END
                    ) OVER (PARTITION BY s.customer_code, s.plan_month) AS total_customer_weighted_bookings
                   FROM schedules s
                ), schedule_allocations AS (
                 SELECT sws.customer_code,
                    sws.plan_month,
                    sws.day_of_week,
                    sws.start_time,
                    sws.professor,
                    sws.booking_class_type,
                    sws.bookings_count,
                    cpt.pay_date,
                    cpt.paid,
                    cpt.is_socio,
                    cpt.is_avulsa,
                    cpt.is_avulsa_grupo_fixo,
                    ((cpt.total_valor_faturamento_monthly * sws.schedule_weight) / NULLIF(sws.total_customer_weighted_bookings, (0)::numeric)) AS allocated_valor_faturamento_monthly,
                    CASE
                        WHEN (sws.customer_code = '000007'::text)
                        THEN (((cpt.total_valor_bruto_monthly * (0.88)::numeric) * sws.schedule_weight) / NULLIF(sws.total_customer_weighted_bookings, (0)::numeric))
                        ELSE ((cpt.total_valor_bruto_monthly * sws.schedule_weight) / NULLIF(sws.total_customer_weighted_bookings, (0)::numeric))
                    END AS allocated_valor_bruto_monthly
                   FROM (schedules_with_sums sws
                     JOIN customer_plan_totals cpt ON (((cpt.customer_code = sws.customer_code) AND (cpt.plan_month = sws.plan_month))))
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
                    b.booking_type,
                    b.start_time,
                    b.venue,
                    b.resource_name,
                    b.description,
                    COALESCE(st.professor,
                        CASE
                            WHEN ((p.customer_code = '000815'::text) OR ((p.customer_code = '000475'::text) AND (b.booking_date >= '2026-07-01'::date) AND (b.booking_date <= '2026-07-31'::date)) OR (b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
                            WHEN ((b.description ~~* '%Elinton Sanches%'::text) OR (b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Élinton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Elinton Sanches'::text
                            WHEN ((b.description ~~* '%Rodrigo Assunção%'::text) OR (b.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                            WHEN ((b.description ~~* '%Tatiana Araújo%'::text) OR (b.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN (b.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END) AS professor,
                    p.customer_code,
                    p.participant_name,
                    (st.schedule_monthly_value / (NULLIF(st.bookings_count, 0))::numeric) AS booking_value,
                    (st.schedule_monthly_commission_base / (NULLIF(st.bookings_count, 0))::numeric) AS booking_commission_base,
                    COALESCE(st.is_socio, false) AS is_socio_benefit,
                    COALESCE(st.is_paid, false) AS is_paid,
                    st.pay_date,
                    (st.schedule_monthly_value_monthly / (NULLIF(st.bookings_count, 0))::numeric) AS booking_value_monthly,
                    (st.schedule_monthly_commission_base_monthly / (NULLIF(st.bookings_count, 0))::numeric) AS booking_commission_base_monthly,
                    COALESCE(st.is_avulsa, false) AS is_avulsa,
                    COALESCE(st.is_avulsa_grupo_fixo, false) AS is_avulsa_grupo_fixo
                   FROM ((mt_booking_participantes p
                     JOIN mt_bookings b ON ((b.booking_id = p.booking_id)))
                     JOIN schedule_totals st ON (((st.customer_code = p.customer_code) AND (st.plan_month = (date_trunc('month'::text, (b.booking_date)::timestamp with time zone))::date) AND (st.day_of_week = EXTRACT(isodow FROM b.booking_date)) AND (st.start_time = b.start_time))))
                  WHERE ((b.status = 'ACTIVE'::text) AND (b.booking_type = 'clase_colectiva'::text) AND (b.description !~~* '%RESERVA MENSAL%'::text))
                ), unallocated_payments AS (
                 SELECT NULL::bigint AS booking_id,
                    (COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone))::date AS booking_date,
                    'unallocated_payment'::text AS booking_type,
                    NULL::time without time zone AS start_time,
                    'MONTREAL TENIS CLUBE LTDA'::text AS venue,
                    'Faturamento sem agendamento'::text AS resource_name,
                    rf.description,
                        CASE
                            WHEN ((rf.description ~~* '%Leandro Bonete%'::text) OR (rf.description ~~* '%Leandro B.%'::text) OR (rf.description ~~* '%Leandro B'::text) OR (rf.description ~~* '%Leandro%'::text)) THEN 'Leandro Bonete'::text
                            WHEN ((rf.description ~~* '%João Assunção%'::text) OR (rf.description ~~* '%Joao Assuncao%'::text) OR (rf.description ~~* '%Joao Assunção%'::text) OR (rf.description ~~* '%João Assuncao%'::text) OR (rf.description ~~* '%Joao A.%'::text)) THEN 'João Assunção'::text
                            WHEN ((rf.description ~~* '%Rodrigo Assunção%'::text) OR (rf.description ~~* '%Rodrigo Assuncao%'::text) OR (rf.description ~~* '%Rodrigo A.%'::text)) THEN 'Rodrigo Assunção'::text
                            WHEN ((rf.description ~~* '%Tatiana Araújo%'::text) OR (rf.description ~~* '%Tatiana Araujo%'::text) OR (rf.description ~~* '%Tatiana A.%'::text)) THEN 'Tatiana Araújo'::text
                            WHEN ((rf.description ~~* '%Leciane Silva%'::text) OR (rf.description ~~* '%Leciane S.%'::text)) THEN 'Leciane Silva'::text
                            WHEN ((rf.description ~~* '%Elinton Sanches%'::text) OR (rf.description ~~* '%Eliton Sanches%'::text) OR (rf.description ~~* '%Élinton Sanches%'::text) OR (rf.description ~~* '%Éliton Sanches%'::text) OR (rf.description ~~* '%Elinton S.%'::text)) THEN 'Elinton Sanches'::text
                            ELSE 'Sem professor'::text
                        END AS professor,
                    rf.customer_code,
                    COALESCE(rf.description, 'Cliente sem agendamento'::text) AS participant_name,
                    rf.valor_faturamento AS booking_value,
                    CASE
                        WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, (0)::numeric), (rf.valor_faturamento * (2.0)::numeric))
                        WHEN (rf.customer_code = '000007'::text) THEN (rf.valor_faturamento * (0.88)::numeric)
                        ELSE rf.valor_faturamento
                    END AS booking_commission_base,
                    rf.is_socio AS is_socio_benefit,
                    rf.paid AS is_paid,
                    rf.pay_date,
                    rf.valor_faturamento AS booking_value_monthly,
                    CASE
                        WHEN rf.is_socio THEN GREATEST(COALESCE(rf.valor_bruto, (0)::numeric), (rf.valor_faturamento * (2.0)::numeric))
                        WHEN (rf.customer_code = '000007'::text) THEN (rf.valor_faturamento * (0.88)::numeric)
                        ELSE rf.valor_faturamento
                    END AS booking_commission_base_monthly,
                    rf.is_avulsa,
                    rf.is_avulsa_grupo_fixo
                   FROM resolved_faturamento rf
                  WHERE ((rf.paid = true) AND (NOT (EXISTS ( SELECT 1
                           FROM final_bookings fb
                          WHERE ((fb.customer_code = rf.customer_code) AND (date_trunc('month'::text, (fb.booking_date)::timestamp without time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone))))))) AND (NOT (EXISTS ( SELECT 1
                           FROM loose_class_matches lcm
                          WHERE (lcm.item_key = rf.item_key)))) AND (rf.item_canceled = false) AND (rf.sale_canceled = false) AND (COALESCE(rf.sale_type, ''::text) <> 'refund'::text) AND (rf.valor_faturamento > (0)::numeric) AND ((rf.categoria = 'Aulas'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text) OR ((rf.categoria = 'Outros'::text) AND ((rf.description ~~* '%TÊNIS%'::text) OR (rf.description ~~* '%AULA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)) AND ((rf.description ~~* '%ADULTO%'::text) OR (rf.description ~~* '%KIDS%'::text) OR (rf.description ~~* '%AVULSA%'::text) OR (rf.description ~~* '%GRUPO FIXO%'::text)))))
                ), all_combined AS (
                 SELECT fb.booking_id,
                    fb.booking_date,
                    fb.booking_type,
                    fb.start_time,
                    fb.venue,
                    fb.resource_name,
                    fb.description,
                    fb.professor,
                    fb.customer_code,
                    fb.participant_name,
                    fb.booking_value,
                    fb.booking_commission_base,
                    fb.is_socio_benefit,
                    fb.is_paid,
                    fb.pay_date,
                    fb.booking_value_monthly,
                    fb.booking_commission_base_monthly,
                    fb.is_avulsa,
                    fb.is_avulsa_grupo_fixo
                   FROM final_bookings fb
                UNION ALL
                 SELECT lcm.booking_id,
                    b.booking_date,
                    b.booking_type,
                    b.start_time,
                    b.venue,
                    b.resource_name,
                    b.description,
                    lcm.professor,
                    lcm.customer_code,
                    p.participant_name,
                    lcm.payment_value AS booking_value,
                    lcm.payment_value_comissao AS booking_commission_base,
                    lcm.is_socio AS is_socio_benefit,
                    lcm.is_paid,
                    lcm.pay_date,
                    lcm.payment_value AS booking_value_monthly,
                    lcm.payment_value_comissao AS booking_commission_base_monthly,
                    true AS is_avulsa,
                    COALESCE(b.description ~~* '%GRUPO FIXO%'::text, false) AS is_avulsa_grupo_fixo
                   FROM ((loose_class_matches lcm
                     JOIN mt_bookings b ON ((b.booking_id = lcm.booking_id)))
                     JOIN mt_booking_participantes p ON (((p.booking_id = lcm.booking_id) AND (p.customer_code = lcm.customer_code))))
                UNION ALL
                 SELECT up.booking_id,
                    up.booking_date,
                    up.booking_type,
                    up.start_time,
                    up.venue,
                    up.resource_name,
                    up.description,
                    up.professor,
                    up.customer_code,
                    up.participant_name,
                    up.booking_value,
                    up.booking_commission_base,
                    up.is_socio_benefit,
                    up.is_paid,
                    up.pay_date,
                    up.booking_value_monthly,
                    up.booking_commission_base_monthly,
                    up.is_avulsa,
                    up.is_avulsa_grupo_fixo
                   FROM unallocated_payments up
                ), kids_saturday_split AS (
                 SELECT c.booking_id,
                    c.booking_date,
                    c.booking_type,
                    c.start_time,
                    c.venue,
                    c.resource_name,
                    c.description,
                    c.participant_name,
                    (c.booking_value / (2.0)::numeric) AS booking_value,
                    (c.booking_commission_base / (2.0)::numeric) AS booking_commission_base,
                    c.is_socio_benefit,
                    c.is_paid,
                    c.pay_date,
                    (c.booking_value_monthly / (2.0)::numeric) AS booking_value_monthly,
                    (c.booking_commission_base_monthly / (2.0)::numeric) AS booking_commission_base_monthly,
                    c.is_avulsa,
                    c.is_avulsa_grupo_fixo,
                    'Leandro Bonete'::text AS professor,
                    c.customer_code
                   FROM all_combined c
                  WHERE (c.start_time IS NOT NULL AND (EXTRACT(isodow FROM c.booking_date) = (6)::numeric) AND (c.start_time = '10:00:00'::time without time zone) AND (c.professor = 'Leandro Bonete'::text))
                UNION ALL
                 SELECT c.booking_id,
                    c.booking_date,
                    c.booking_type,
                    c.start_time,
                    c.venue,
                    c.resource_name,
                    c.description,
                    c.participant_name,
                    (c.booking_value / (2.0)::numeric) AS booking_value,
                    (c.booking_commission_base / (2.0)::numeric) AS booking_commission_base,
                    c.is_socio_benefit,
                    c.is_paid,
                    c.pay_date,
                    (c.booking_value_monthly / (2.0)::numeric) AS booking_value_monthly,
                    (c.booking_commission_base_monthly / (2.0)::numeric) AS booking_commission_base_monthly,
                    c.is_avulsa,
                    c.is_avulsa_grupo_fixo,
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
         SELECT DISTINCT ON (pre_result.customer_code, pre_result.booking_id, pre_result.professor, pre_result.description, pre_result.booking_value, pre_result.pay_date) pre_result.booking_id,
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
 SELECT view_base.booking_id,
    view_base.booking_date,
    view_base.booking_type,
    view_base.start_time,
    view_base.venue,
    view_base.resource_name,
    view_base.description,
    view_base.professor,
    view_base.customer_code,
    view_base.participant_name,
    view_base.booking_value,
    view_base.booking_commission_base,
    view_base.is_socio_benefit,
    view_base.is_paid,
    view_base.pay_date,
    view_base.booking_value_monthly,
    view_base.booking_commission_base_monthly,
    view_base.is_avulsa,
    view_base.is_avulsa_grupo_fixo
   FROM view_base;
