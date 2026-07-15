-- View: public.vw_mt_comissoes_detalhadas
-- Updated: 2026-07-15
-- Description: View to calculate detailed commission allocations for teachers based on student schedules and plan weights.
-- Incorporates smart prorated ratio checks, coverage fallback for complement/switch plans, and correct is_paid/pay_date tracking based on funding plan items.

CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS
WITH booking_min_pay_dates AS (
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
            WHEN (fi.description ~~* '%Sócio Montreal%'::text) THEN COALESCE(fi.valor_bruto, fi.valor_faturamento)
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
            WHEN ((fi.description ~~* '%João Assunção%'::text) OR (fi.description ~~* '%Joao Assuncao%'::text) OR (fi.description ~~* '%Joao Assunção%'::text) OR (fi.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
            WHEN ((fi.description ~~* '%Rodrigo Assunção%'::text) OR (fi.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
            WHEN (fi.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
            WHEN ((fi.description ~~* '%Tatiana Araújo%'::text) OR (fi.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
            WHEN (fi.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
            WHEN ((fi.description ~~* '%Eliton Sanches%'::text) OR (fi.description ~~* '%Éliton Sanches%'::text)) THEN 'Eliton Sanches'::text
            ELSE NULL::text
        END AS professor
    FROM mt_booking_participantes p
    JOIN mt_bookings b ON b.booking_id = p.booking_id
    LEFT JOIN booking_min_pay_dates bmpd ON bmpd.booking_id = b.booking_id
    JOIN mt_faturamento_vendas fv ON fv.customer_code = p.customer_code
    JOIN mt_faturamento_itens fi ON fi.venda_external_id = fv.external_id
    WHERE b.status = 'ACTIVE'::text
      AND b.booking_type = 'clase_suelta'::text
      AND b.description !~~* '%RESERVA MENSAL%'::text
      AND fi.is_canceled = false
      AND fv.is_canceled = false
      AND fi.valor_faturamento > 0
      AND fi.categoria IN ('Aulas', 'Outros')
      AND (
        (fi.description ~~ (('%'::text || to_char(b.booking_date, 'DD/MM/YYYY'::text) || '%'::text))
         AND fi.description ~~ (('%'::text || to_char(b.start_time::interval, 'HH24:MI'::text) || '%'::text)))
        OR EXISTS (
            SELECT 1 FROM mt_booking_pagamentos bpay
            WHERE bpay.booking_id = b.booking_id AND bpay.payment_date = fv.pay_date
        )
      )
), resolved_faturamento AS MATERIALIZED (
    SELECT i.item_key,
        i.valor_faturamento,
        i.valor_bruto,
        v.pay_date,
        i.is_canceled AS item_canceled,
        v.is_canceled AS sale_canceled,
        v.tipo AS sale_type,
        i.categoria,
        i.subcategoria,
        i.description,
        CASE
            WHEN (i.categoria = 'Aulas'::text OR (i.categoria = 'Outros'::text AND i.description ~~* '%TÊNIS%'::text AND i.description ~~* '%ADULTO%'::text)) THEN
                COALESCE(( SELECT DISTINCT p_1.customer_code
                       FROM mt_booking_participantes p_1
                      WHERE p_1.participant_name IS NOT NULL AND length(p_1.participant_name) > 5 AND i.description ~~* (('%'::text || p_1.participant_name) || '%'::text)
                     LIMIT 1), v.customer_code)
            ELSE v.customer_code
        END AS customer_code,
        v.paid,
        v.data_venda,
        COALESCE(((i.description ~~* '%AULA AVULSA%'::text) OR (i.subcategoria = 'Avulsa - Grupo Fixo'::text) OR (i.subcategoria = 'Avulsa - Particular'::text)), false) AS is_avulsa,
        COALESCE(((i.description ~~* '%AULA AVULSA - GRUPO FIXO%'::text) OR (i.subcategoria = 'Avulsa - Grupo Fixo'::text)), false) AS is_avulsa_grupo_fixo
    FROM mt_faturamento_itens i
    JOIN mt_faturamento_vendas v ON v.external_id = i.venda_external_id
), plan_items_raw AS (
    SELECT rf.item_key,
        rf.valor_faturamento,
        rf.valor_bruto,
        rf.pay_date,
        rf.customer_code,
        rf.paid,
        rf.data_venda,
        CASE
            WHEN ((rf.description ~~* '%Leonardo Assunção%'::text) OR (rf.description ~~* '%Leonardo Assuncao%'::text)) THEN (rf.valor_faturamento * (2)::numeric)
            ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
        END AS valor_bruto_derived,
        CASE
            WHEN ((rf.description ~~* '%Sócio Montreal%'::text) OR (rf.description ~~* '%Leonardo Assunção%'::text) OR (rf.description ~~* '%Leonardo Assuncao%'::text)) THEN true
            ELSE false
        END AS is_socio,
        COALESCE(
            CASE
                WHEN (rf.description ~~* '%AULA AVULSA%'::text) THEN 'OUTRO'::text
                WHEN (rf.description ~~* '%INDIVIDUAL%'::text) THEN 'INDIVIDUAL'::text
                WHEN (rf.description ~~* '%DUPLA%'::text) THEN 'DUPLA'::text
                WHEN (rf.description ~~* '%TRIO%'::text) THEN 'TRIO'::text
                WHEN ((rf.description ~~* '%GRUPO%'::text) OR (rf.description ~~* '%QUARTETO%'::text)) THEN 'GRUPO'::text
                ELSE NULL::text
            END,
            -- Smart prorated ratio check fallback:
            (
                SELECT bp.plan_class_type
                FROM (VALUES 
                    ('INDIVIDUAL'::text, 720::numeric),
                    ('DUPLA'::text, 430::numeric),
                    ('TRIO'::text, 395::numeric),
                    ('GRUPO'::text, 335::numeric)
                ) AS bp(plan_class_type, base_value)
                WHERE COALESCE(rf.valor_bruto, rf.valor_faturamento) >= 50::numeric
                  AND (COALESCE(rf.valor_bruto, rf.valor_faturamento) / bp.base_value) >= 0.15
                  AND (COALESCE(rf.valor_bruto, rf.valor_faturamento) / bp.base_value) <= 1.05
                  AND abs(round((COALESCE(rf.valor_bruto, rf.valor_faturamento) / bp.base_value) * 20::numeric) - (COALESCE(rf.valor_bruto, rf.valor_faturamento) / bp.base_value) * 20::numeric) < 0.15
                ORDER BY abs(round((COALESCE(rf.valor_bruto, rf.valor_faturamento) / bp.base_value) * 20::numeric) - (COALESCE(rf.valor_bruto, rf.valor_faturamento) / bp.base_value) * 20::numeric) ASC
                LIMIT 1
            ),
            'OUTRO'::text
        ) AS plan_class_type,
        rf.is_avulsa,
        rf.is_avulsa_grupo_fixo,
        CASE WHEN rf.is_avulsa THEN (0)::numeric ELSE rf.valor_faturamento END AS valor_faturamento_monthly,
        CASE WHEN rf.is_avulsa THEN (0)::numeric ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento) END AS valor_bruto_monthly,
        COALESCE(
            CASE
                WHEN (rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text) THEN to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)
                WHEN (rf.description ~~* '%janeiro 26%'::text) THEN '2026-01-01'::date
                WHEN (rf.description ~~* '%fevereiro 26%'::text) THEN '2026-02-01'::date
                WHEN (rf.description ~~* '%março 26%'::text OR rf.description ~~* '%marco 26%'::text) THEN '2026-03-01'::date
                WHEN (rf.description ~~* '%abril 26%'::text) THEN '2026-04-01'::date
                WHEN (rf.description ~~* '%maio 26%'::text) THEN '2026-05-01'::date
                WHEN (rf.description ~~* '%junho 26%'::text) THEN '2026-06-01'::date
                WHEN (rf.description ~~* '%julho 26%'::text) THEN '2026-07-01'::date
                WHEN (rf.description ~~* '%agosto 26%'::text) THEN '2026-08-01'::date
                WHEN (rf.description ~~* '%setembro 26%'::text) THEN '2026-09-01'::date
                WHEN (rf.description ~~* '%outubro 26%'::text) THEN '2026-10-01'::date
                WHEN (rf.description ~~* '%novembro 26%'::text) THEN '2026-11-01'::date
                WHEN (rf.description ~~* '%dezembro 26%'::text) THEN '2026-12-01'::date
                ELSE NULL::date
            END, (date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)))::date) AS item_start_date,
        COALESCE(
            CASE
                WHEN (rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text) THEN to_date((regexp_match(rf.description, '\d{2}/\d{2}/\d{4}-(\d{2}/\d{2}/\d{4})'::text))[1], 'DD/MM/YYYY'::text)
                WHEN (rf.description ~~* '%janeiro 26%'::text) THEN '2026-01-31'::date
                WHEN (rf.description ~~* '%fevereiro 26%'::text) THEN '2026-02-28'::date
                WHEN (rf.description ~~* '%março 26%'::text OR rf.description ~~* '%marco 26%'::text) THEN '2026-03-31'::date
                WHEN (rf.description ~~* '%abril 26%'::text) THEN '2026-04-30'::date
                WHEN (rf.description ~~* '%maio 26%'::text) THEN '2026-05-31'::date
                WHEN (rf.description ~~* '%junho 26%'::text) THEN '2026-06-30'::date
                WHEN (rf.description ~~* '%julho 26%'::text) THEN '2026-07-31'::date
                WHEN (rf.description ~~* '%agosto 26%'::text) THEN '2026-08-31'::date
                WHEN (rf.description ~~* '%setembro 26%'::text) THEN '2026-09-30'::date
                WHEN (rf.description ~~* '%outubro 26%'::text) THEN '2026-10-31'::date
                WHEN (rf.description ~~* '%novembro 26%'::text) THEN '2026-11-30'::date
                WHEN (rf.description ~~* '%dezembro 26%'::text) THEN '2026-12-31'::date
                ELSE NULL::date
            END, (((date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)) + '1 mon'::interval) - '1 day'::interval))::date) AS item_end_date
    FROM resolved_faturamento rf
    WHERE rf.item_canceled = false AND rf.sale_canceled = false 
      AND COALESCE(rf.sale_type, ''::text) <> 'refund'::text 
      AND rf.valor_faturamento > 0 
      AND (rf.subcategoria IS NULL OR rf.subcategoria <> 'Avulsa - Particular'::text) 
      AND rf.is_avulsa = false
      AND (rf.categoria = 'Aulas'::text OR (rf.categoria = 'Outros'::text AND rf.description ~~* '%TÊNIS%'::text AND rf.description ~~* '%ADULTO%'::text))
), plan_items AS (
    SELECT item_key,
        customer_code,
        COALESCE(date_trunc('month'::text, item_start_date)::date, date_trunc('month'::text, pay_date)::date) AS plan_month,
        paid,
        pay_date,
        valor_faturamento,
        valor_bruto_derived AS valor_bruto,
        is_socio,
        plan_class_type,
        is_avulsa,
        is_avulsa_grupo_fixo,
        valor_faturamento_monthly,
        valor_bruto_monthly
    FROM plan_items_raw
), schedules AS (
    SELECT 
        p.customer_code,
        date_trunc('month', b.booking_date)::date AS plan_month,
        EXTRACT(ISODOW FROM b.booking_date) AS day_of_week,
        b.start_time,
        CASE
            WHEN (b.booking_id = 4725) THEN 'Rodrigo Assunção'::text
            WHEN ((b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Eliton Sanches'::text
            WHEN ((b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
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
    FROM mt_booking_participantes p
    JOIN mt_bookings b ON b.booking_id = p.booking_id
    WHERE b.status = 'ACTIVE'::text 
      AND b.booking_type = 'clase_colectiva'::text
      AND b.description !~~* '%RESERVA MENSAL%'::text
    GROUP BY p.customer_code, date_trunc('month', b.booking_date)::date, EXTRACT(ISODOW FROM b.booking_date), b.start_time, professor, booking_class_type
), schedules_with_weights AS (
    SELECT 
        customer_code,
        plan_month,
        day_of_week,
        start_time,
        professor,
        booking_class_type,
        bookings_count,
        CASE
            WHEN booking_class_type = 'INDIVIDUAL' THEN 720
            WHEN booking_class_type = 'DUPLA' THEN 430
            WHEN booking_class_type = 'TRIO' THEN 395
            ELSE 335
        END AS schedule_weight
    FROM schedules
), schedules_coverage AS (
    SELECT s.*,
        EXISTS (
            SELECT 1 FROM plan_items p
            WHERE p.customer_code = s.customer_code 
              AND p.plan_month = s.plan_month
              AND p.plan_class_type = s.booking_class_type
        ) AS is_schedule_covered
    FROM schedules_with_weights s
), schedules_with_sums AS (
    SELECT *,
        SUM(schedule_weight) OVER (PARTITION BY customer_code, plan_month, booking_class_type) AS sum_weight_of_type,
        SUM(schedule_weight) OVER (PARTITION BY customer_code, plan_month) AS sum_weight_total,
        SUM(CASE WHEN NOT is_schedule_covered THEN schedule_weight ELSE 0 END) OVER (PARTITION BY customer_code, plan_month) AS sum_weight_uncovered
    FROM schedules_coverage
), schedule_allocations AS (
    SELECT 
        s.customer_code,
        s.plan_month,
        s.day_of_week,
        s.start_time,
        s.professor,
        s.booking_class_type,
        s.bookings_count,
        s.schedule_weight,
        s.sum_weight_of_type,
        s.sum_weight_total,
        s.sum_weight_uncovered,
        s.is_schedule_covered,
        p.item_key,
        p.valor_faturamento,
        p.valor_bruto,
        p.paid,
        p.pay_date,
        p.is_socio,
        p.plan_class_type,
        p.is_avulsa,
        p.is_avulsa_grupo_fixo,
        p.valor_faturamento_monthly,
        p.valor_bruto_monthly,
        (p.plan_class_type = s.booking_class_type) AS is_type_match,
        MAX(CASE WHEN (p.plan_class_type = s.booking_class_type) THEN 1 ELSE 0 END) OVER (PARTITION BY p.item_key) = 1 AS has_type_match
    FROM schedules_with_sums s
    JOIN plan_items p ON p.customer_code = s.customer_code AND p.plan_month = s.plan_month
), schedule_totals AS (
    SELECT 
        customer_code,
        plan_month,
        day_of_week,
        start_time,
        professor,
        booking_class_type,
        bookings_count,
        SUM(
            CASE
                WHEN has_type_match THEN
                    CASE WHEN is_type_match THEN (valor_faturamento * (schedule_weight::numeric / sum_weight_of_type)) ELSE 0 END
                ELSE
                    CASE
                        WHEN sum_weight_uncovered > 0 THEN
                            CASE WHEN NOT is_schedule_covered THEN (valor_faturamento * (schedule_weight::numeric / sum_weight_uncovered)) ELSE 0 END
                        ELSE
                            (valor_faturamento * (schedule_weight::numeric / sum_weight_total))
                    END
            END
        ) AS schedule_monthly_value,
        SUM(
            CASE
                WHEN has_type_match THEN
                    CASE WHEN is_type_match THEN (
                        CASE WHEN is_socio THEN valor_bruto ELSE valor_faturamento END 
                        * (schedule_weight::numeric / sum_weight_of_type)
                    ) ELSE 0 END
                ELSE
                    CASE
                        WHEN sum_weight_uncovered > 0 THEN
                            CASE WHEN NOT is_schedule_covered THEN (
                                CASE WHEN is_socio THEN valor_bruto ELSE valor_faturamento END 
                                * (schedule_weight::numeric / sum_weight_uncovered)
                            ) ELSE 0 END
                        ELSE
                            (
                                CASE WHEN is_socio THEN valor_bruto ELSE valor_faturamento END 
                                * (schedule_weight::numeric / sum_weight_total)
                            )
                    END
            END
        ) AS schedule_monthly_commission_base,
        COALESCE(
            bool_and(
                CASE
                    WHEN (
                        CASE
                            WHEN has_type_match THEN
                                CASE WHEN is_type_match THEN valor_faturamento ELSE 0 END
                            ELSE
                                CASE
                                    WHEN sum_weight_uncovered > 0 THEN
                                        CASE WHEN NOT is_schedule_covered THEN valor_faturamento ELSE 0 END
                                    ELSE
                                        valor_faturamento
                                END
                        END
                    ) > 0 THEN paid
                    ELSE NULL::boolean
                END
            ),
            false
        ) AS is_paid,
        MAX(
            CASE
                WHEN (
                    CASE
                        WHEN has_type_match THEN
                            CASE WHEN is_type_match THEN valor_faturamento ELSE 0 END
                        ELSE
                            CASE
                                WHEN sum_weight_uncovered > 0 THEN
                                    CASE WHEN NOT is_schedule_covered THEN valor_faturamento ELSE 0 END
                                ELSE
                                    valor_faturamento
                            END
                    END
                ) > 0 THEN pay_date
                ELSE NULL::timestamp without time zone
            END
        ) AS pay_date,
        bool_or(is_socio) AS is_socio,
        SUM(
            CASE
                WHEN has_type_match THEN
                    CASE WHEN is_type_match THEN (valor_faturamento_monthly * (schedule_weight::numeric / sum_weight_of_type)) ELSE 0 END
                ELSE
                    CASE
                        WHEN sum_weight_uncovered > 0 THEN
                            CASE WHEN NOT is_schedule_covered THEN (valor_faturamento_monthly * (schedule_weight::numeric / sum_weight_uncovered)) ELSE 0 END
                        ELSE
                            (valor_faturamento_monthly * (schedule_weight::numeric / sum_weight_total))
                    END
            END
        ) AS schedule_monthly_value_monthly,
        SUM(
            CASE
                WHEN has_type_match THEN
                    CASE WHEN is_type_match THEN (
                        CASE WHEN is_socio THEN valor_bruto_monthly ELSE valor_faturamento_monthly END 
                        * (schedule_weight::numeric / sum_weight_of_type)
                    ) ELSE 0 END
                ELSE
                    CASE
                        WHEN sum_weight_uncovered > 0 THEN
                            CASE WHEN NOT is_schedule_covered THEN (
                                CASE WHEN is_socio THEN valor_bruto_monthly ELSE valor_faturamento_monthly END 
                                * (schedule_weight::numeric / sum_weight_uncovered)
                            ) ELSE 0 END
                        ELSE
                            (
                                CASE WHEN is_socio THEN valor_bruto_monthly ELSE valor_faturamento_monthly END 
                                * (schedule_weight::numeric / sum_weight_total)
                            )
                    END
            END
        ) AS schedule_monthly_commission_base_monthly,
        bool_or(is_avulsa) AS is_avulsa,
        bool_or(is_avulsa_grupo_fixo) AS is_avulsa_grupo_fixo
    FROM schedule_allocations
    GROUP BY customer_code, plan_month, day_of_week, start_time, professor, booking_class_type, bookings_count
), final_bookings AS (
    SELECT b.booking_id,
        b.booking_date,
        b.booking_type,
        b.start_time,
        b.venue,
        b.resource_name,
        b.description,
        COALESCE(
            CASE
                WHEN (b.booking_id = 4725) THEN 'Rodrigo Assunção'::text
                WHEN ((b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Eliton Sanches'::text
                WHEN ((b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
                WHEN ((b.description ~~* '%Rodrigo Assunção%'::text) OR (b.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                WHEN ((b.description ~~* '%Tatiana Araújo%'::text) OR (b.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                WHEN (b.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
            END,
            lcm.professor,
            'Sem professor'::text
        ) AS professor,
        p.customer_code,
        p.participant_name,
        CASE
            WHEN (b.booking_type = 'clase_suelta'::text) THEN COALESCE(lcm.payment_value, (0)::numeric)
            ELSE COALESCE(st.schedule_monthly_value / NULLIF(st.bookings_count, 0), (0)::numeric)
        END AS booking_value,
        CASE
            WHEN (b.booking_type = 'clase_suelta'::text) THEN COALESCE(lcm.payment_value_comissao, (0)::numeric)
            ELSE COALESCE(st.schedule_monthly_commission_base / NULLIF(st.bookings_count, 0), (0)::numeric)
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
            WHEN (b.booking_type = 'clase_colectiva'::text) THEN COALESCE(st.schedule_monthly_value_monthly / NULLIF(st.bookings_count, 0), (0)::numeric)
            ELSE (0)::numeric
        END AS booking_value_monthly,
        CASE
            WHEN (b.booking_type = 'clase_colectiva'::text) THEN COALESCE(st.schedule_monthly_commission_base_monthly / NULLIF(st.bookings_count, 0), (0)::numeric)
            ELSE (0)::numeric
        END AS booking_commission_base_monthly,
        CASE
            WHEN (b.booking_type = 'clase_suelta'::text) THEN true
            ELSE COALESCE(st.is_avulsa, false)
        END AS is_avulsa,
        CASE
            WHEN (b.booking_type = 'clase_suelta'::text) THEN false
            ELSE COALESCE(st.is_avulsa_grupo_fixo, false)
        END AS is_avulsa_grupo_fixo
    FROM mt_booking_participantes p
    JOIN mt_bookings b ON b.booking_id = p.booking_id
    LEFT JOIN loose_class_matches lcm ON lcm.booking_id = b.booking_id AND lcm.customer_code = p.customer_code
    LEFT JOIN schedule_totals st ON b.booking_type = 'clase_colectiva'::text
        AND st.customer_code = p.customer_code
        AND st.plan_month = date_trunc('month', b.booking_date)::date
        AND st.day_of_week = EXTRACT(ISODOW FROM b.booking_date)
        AND st.start_time = b.start_time
        AND st.booking_class_type = (
            CASE
                WHEN (b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text) THEN 'INDIVIDUAL'::text
                WHEN (b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text) THEN 'DUPLA'::text
                WHEN (b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text) THEN 'TRIO'::text
                WHEN (b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text) THEN 'GRUPO'::text
                WHEN (b.booking_type = 'clase_suelta'::text) THEN 'INDIVIDUAL'::text
                ELSE 'GRUPO'::text
            END
        )
        AND st.professor = (
            CASE
                WHEN (b.booking_id = 4725) THEN 'Rodrigo Assunção'::text
                WHEN ((b.description ~~* '%Eliton Sanches%'::text) OR (b.description ~~* '%Éliton Sanches%'::text)) THEN 'Eliton Sanches'::text
                WHEN ((b.description ~~* '%João Assunção%'::text) OR (b.description ~~* '%Joao Assuncao%'::text) OR (b.description ~~* '%Joao Assunção%'::text) OR (b.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
                WHEN ((b.description ~~* '%Rodrigo Assunção%'::text) OR (b.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
                WHEN (b.description ~~* '%Leandro Bonete%'::text) THEN 'Leandro Bonete'::text
                WHEN ((b.description ~~* '%Tatiana Araújo%'::text) OR (b.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
                WHEN (b.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
                ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
            END
        )
    WHERE b.status = 'ACTIVE'::text 
      AND b.booking_type IN ('clase_colectiva', 'clase_suelta')
      AND b.description !~~* '%RESERVA MENSAL%'::text
)
, unallocated_payments AS (
    SELECT 
        rf.item_key,
        rf.customer_code,
        rf.pay_date,
        rf.data_venda,
        rf.valor_faturamento,
        rf.valor_bruto,
        rf.description,
        rf.paid,
        rf.is_avulsa,
        rf.is_avulsa_grupo_fixo,
        CASE
            WHEN ((rf.description ~~* '%João Assunção%'::text) OR (rf.description ~~* '%Joao Assuncao%'::text) OR (rf.description ~~* '%Joao Assunção%'::text) OR (rf.description ~~* '%João Assuncao%'::text)) THEN 'João Assunção'::text
            WHEN ((rf.description ~~* '%Rodrigo Assunção%'::text) OR (rf.description ~~* '%Rodrigo Assuncao%'::text)) THEN 'Rodrigo Assunção'::text
            WHEN (rf.description ~~* '%Leandro Bonete%'::text OR rf.description ~~* '%Leandro B.%'::text) THEN 'Leandro Bonete'::text
            WHEN ((rf.description ~~* '%Tatiana Araújo%'::text) OR (rf.description ~~* '%Tatiana Araujo%'::text)) THEN 'Tatiana Araújo'::text
            WHEN (rf.description ~~* '%Leciane Silva%'::text) THEN 'Leciane Silva'::text
            WHEN ((rf.description ~~* '%Eliton Sanches%'::text) OR (rf.description ~~* '%Éliton Sanches%'::text)) THEN 'Eliton Sanches'::text
            ELSE NULL::text
        END AS professor,
        CASE
            WHEN ((rf.description ~~* '%Sócio Montreal%'::text) OR (rf.description ~~* '%Leonardo Assunção%'::text) OR (rf.description ~~* '%Leonardo Assuncao%'::text)) THEN true
            ELSE false
        END AS is_socio
    FROM resolved_faturamento rf
    WHERE rf.item_canceled = false AND rf.sale_canceled = false 
      AND COALESCE(rf.sale_type, ''::text) <> 'refund'::text 
      AND rf.valor_faturamento > 0 
      AND (rf.subcategoria IS NULL OR rf.subcategoria <> 'Avulsa - Particular'::text) 
      AND (rf.categoria = 'Aulas'::text OR (rf.categoria = 'Outros'::text AND rf.description ~~* '%TÊNIS%'::text AND rf.description ~~* '%ADULTO%'::text))
      AND rf.item_key NOT IN (
          SELECT DISTINCT item_key FROM loose_class_matches WHERE item_key IS NOT NULL
          UNION
          SELECT DISTINCT item_key FROM schedule_allocations WHERE item_key IS NOT NULL
      )
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
FROM final_bookings

UNION ALL

SELECT
    NULL::integer AS booking_id,
    COALESCE(pay_date, data_venda::timestamp without time zone)::date AS booking_date,
    CASE WHEN is_avulsa THEN 'clase_suelta'::text ELSE 'clase_colectiva'::text END AS booking_type,
    '00:00:00'::time without time zone AS start_time,
    'Montreal'::text AS venue,
    'Quadra'::text AS resource_name,
    'Mensalidade/Avulsa sem agendamento no sistema - ' || description AS description,
    COALESCE(
        professor,
        (
            SELECT DISTINCT b.professor 
            FROM final_bookings b 
            WHERE b.customer_code = unallocated_payments.customer_code 
              AND b.professor <> 'Sem professor'::text
            LIMIT 1
        ),
        'Sem professor'::text
    ) AS professor,
    customer_code,
    COALESCE(
        (SELECT participant_name FROM mt_booking_participantes WHERE customer_code = unallocated_payments.customer_code LIMIT 1),
        'Aluno sem agendamento'::text
    ) AS participant_name,
    valor_faturamento AS booking_value,
    COALESCE(valor_bruto, valor_faturamento) AS booking_commission_base,
    is_socio AS is_socio_benefit,
    paid AS is_paid,
    pay_date,
    CASE WHEN is_avulsa THEN 0::numeric ELSE valor_faturamento END AS booking_value_monthly,
    CASE WHEN is_avulsa THEN 0::numeric ELSE COALESCE(valor_bruto, valor_faturamento) END AS booking_commission_base_monthly,
    is_avulsa,
    is_avulsa_grupo_fixo
FROM unallocated_payments;
