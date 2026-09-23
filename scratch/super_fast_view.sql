CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS
WITH view_base AS (
    WITH unique_participants AS MATERIALIZED (
        SELECT DISTINCT ON (customer_code) 
            customer_code,
            participant_name
        FROM mt_booking_participantes
        WHERE participant_name IS NOT NULL AND length(participant_name) > 5
        ORDER BY customer_code, booking_id DESC
    ),
    booking_min_pay_dates AS (
        SELECT booking_id,
            min(payment_date) AS min_payment_date
        FROM mt_booking_pagamentos
        GROUP BY booking_id
    ),
    loose_class_matches AS (
        SELECT b.booking_id,
            p.customer_code,
            fi.item_key,
            fi.valor_faturamento AS payment_value,
            CASE
                WHEN fi.description ~~* '%Sócio Montreal%'::text THEN COALESCE(fi.valor_bruto, fi.valor_faturamento)
                WHEN fi.description ~~* '%Leonardo Assunção%'::text OR fi.description ~~* '%Leonardo Assuncao%'::text THEN fi.valor_faturamento * 2::numeric
                ELSE fi.valor_faturamento
            END AS payment_value_comissao,
            CASE
                WHEN fi.description ~~* '%Sócio Montreal%'::text OR fi.description ~~* '%Leonardo Assunção%'::text OR fi.description ~~* '%Leonardo Assuncao%'::text THEN true
                ELSE false
            END AS is_socio,
            fv.paid AS is_paid,
            COALESCE(bmpd.min_payment_date, fv.pay_date) AS pay_date,
            CASE
                WHEN fv.customer_code = '000815'::text OR fv.customer_code = '000475'::text AND (fv.pay_date >= '2026-07-01 00:00:00'::timestamp without time zone AND fv.pay_date < '2026-08-01 00:00:00'::timestamp without time zone OR fi.description ~~* '%15/07/2026%'::text) OR fi.description ~~* '%João Assunção%'::text OR fi.description ~~* '%Joao Assuncao%'::text OR fi.description ~~* '%Joao Assunção%'::text OR fi.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                WHEN fi.description ~~* '%Rodrigo Assunção%'::text OR fi.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                WHEN fi.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                WHEN fi.description ~~* '%Tatiana Araújo%'::text OR fi.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                WHEN fi.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                WHEN fi.description ~~* '%Elinton Sanches%'::text OR fi.description ~~* '%Eliton Sanches%'::text OR fi.description ~~* '%Élinton Sanches%'::text OR fi.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
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
          AND fi.valor_faturamento > 0::numeric 
          AND (fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text])) 
          AND (
            (fi.description ~~ (('%'::text || to_char(b.booking_date::timestamp with time zone, 'DD/MM/YYYY'::text)) || '%'::text) AND fi.description ~~ (('%'::text || to_char(b.start_time::interval, 'HH24:MI'::text)) || '%'::text)) 
            OR EXISTS (SELECT 1 FROM mt_booking_pagamentos bpay WHERE bpay.booking_id = b.booking_id AND bpay.payment_date = fv.pay_date AND bpay.amount = fi.valor_faturamento)
          )
    ),
    resolved_faturamento AS (
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
            v.customer_code,
            v.paid,
            v.data_venda,
            COALESCE(i.description ~~* '%AULA AVULSA%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text OR i.subcategoria = 'Avulsa - Particular'::text, false) AS is_avulsa,
            COALESCE(i.description ~~* '%AULA AVULSA - GRUPO FIXO%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text, false) AS is_avulsa_grupo_fixo
        FROM mt_faturamento_itens i
        JOIN mt_faturamento_vendas v ON v.external_id = i.venda_external_id
    ),
    plan_items_raw AS (
        SELECT rf.item_key,
            rf.valor_faturamento,
            rf.valor_bruto,
            rf.pay_date,
            rf.customer_code,
            rf.paid,
            rf.data_venda,
            rf.description,
            CASE
                WHEN rf.description ~~* '%Leonardo Assunção%'::text OR rf.description ~~* '%Leonardo Assuncao%'::text THEN rf.valor_faturamento * 2::numeric
                ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
            END AS valor_bruto_derived,
            CASE
                WHEN rf.description ~~* '%Sócio Montreal%'::text OR rf.description ~~* '%Leonardo Assunção%'::text OR rf.description ~~* '%Leonardo Assuncao%'::text THEN true
                ELSE false
            END AS is_socio,
            COALESCE(
                CASE
                    WHEN rf.description ~~* '%AULA AVULSA%'::text THEN 'OUTRO'::text
                    WHEN rf.description ~~* '%INDIVIDUAL%'::text THEN 'INDIVIDUAL'::text
                    WHEN rf.description ~~* '%DUPLA%'::text THEN 'DUPLA'::text
                    WHEN rf.description ~~* '%TRIO%'::text THEN 'TRIO'::text
                    WHEN rf.description ~~* '%GRUPO%'::text OR rf.description ~~* '%QUARTETO%'::text THEN 'GRUPO'::text
                    ELSE NULL::text
                END, 'GRUPO'::text
            ) AS plan_class_type
        FROM resolved_faturamento rf
        WHERE rf.item_canceled = false 
          AND rf.sale_canceled = false 
          AND (rf.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text])) 
          AND rf.valor_faturamento > 0::numeric 
          AND rf.description !~~* '%REPOSI%'::text 
          AND (rf.description !~~* '%AULA AVULSA%'::text AND rf.subcategoria <> 'Avulsa - Grupo Fixo'::text AND rf.subcategoria <> 'Avulsa - Particular'::text OR rf.description ~~* '%MATRICULA%'::text OR rf.description ~~* '%MATRÍCULA%'::text)
    ),
    plan_items AS (
        SELECT item_key,
            valor_faturamento,
            valor_bruto,
            pay_date,
            customer_code,
            paid,
            data_venda,
            description,
            valor_bruto_derived,
            is_socio,
            plan_class_type,
            date_trunc('month'::text, pay_date::timestamp with time zone)::date AS plan_month,
            valor_bruto_derived AS effective_valor_bruto,
            valor_faturamento AS effective_valor_faturamento
        FROM plan_items_raw
    ),
    plan_month_aggregates AS (
        SELECT customer_code,
            plan_month,
            sum(effective_valor_bruto) AS month_fat_bruto,
            sum(effective_valor_faturamento) AS month_fat_net,
            bool_or(is_socio) AS month_has_socio,
            bool_or(paid) AS month_is_paid,
            max(pay_date) AS month_pay_date
        FROM plan_items
        GROUP BY customer_code, plan_month
    ),
    schedules AS (
        SELECT p.customer_code,
            p.participant_name,
            b.booking_id,
            b.booking_date,
            b.booking_type,
            b.start_time,
            b.venue,
            b.resource_name,
            b.description,
            date_trunc('month'::text, b.booking_date::timestamp with time zone)::date AS booking_month,
            EXTRACT(isodow FROM b.booking_date) AS day_of_week,
            CASE
                WHEN b.booking_id = 11830 THEN 'Leandro Bonete'::text
                WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'::text
                WHEN p.customer_code = '000815'::text OR p.customer_code = '000475'::text AND (b.booking_date >= '2026-07-01'::date AND b.booking_date <= '2026-07-31'::date OR b.description ~~* '%15/07/2026%'::text) OR b.description ~~* '%João Assunção%'::text OR b.description ~~* '%Joao Assuncao%'::text OR b.description ~~* '%Joao Assunção%'::text OR b.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                WHEN b.description ~~* '%Elinton Sanches%'::text OR b.description ~~* '%Eliton Sanches%'::text OR b.description ~~* '%Élinton Sanches%'::text OR b.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                WHEN b.description ~~* '%Rodrigo Assunção%'::text OR b.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                WHEN b.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                WHEN b.description ~~* '%Tatiana Araújo%'::text OR b.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                WHEN b.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
            END AS professor,
            CASE
                WHEN b.description ~~* '%INDIVIDUAL%'::text OR b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text THEN 'INDIVIDUAL'::text
                WHEN b.description ~~* '%DUPLA%'::text OR b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text THEN 'DUPLA'::text
                WHEN b.description ~~* '%TRIO%'::text OR b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text THEN 'TRIO'::text
                WHEN b.description ~~* '%GRUPO%'::text OR b.description ~ '\(\s*\d+\s*/\s*4\s*\)'::text THEN 'GRUPO'::text
                ELSE 'GRUPO'::text
            END AS schedule_class_type
        FROM mt_booking_participantes p
        JOIN mt_bookings b ON b.booking_id = p.booking_id
        WHERE b.status = 'ACTIVE'::text AND b.description !~~* '%RESERVA MENSAL%'::text
    ),
    schedules_with_weights AS (
        SELECT s.customer_code,
            s.participant_name,
            s.booking_id,
            s.booking_date,
            s.booking_type,
            s.start_time,
            s.venue,
            s.resource_name,
            s.description,
            s.booking_month,
            s.day_of_week,
            s.professor,
            s.schedule_class_type,
            CASE s.schedule_class_type
                WHEN 'INDIVIDUAL'::text THEN 1.0
                WHEN 'DUPLA'::text THEN 0.5
                WHEN 'TRIO'::text THEN 0.33333333333333333333
                WHEN 'GRUPO'::text THEN 0.25
                ELSE 0.25
            END AS schedule_weight
        FROM schedules s
    ),
    schedules_coverage AS (
        SELECT sw.customer_code,
            sw.participant_name,
            sw.booking_id,
            sw.booking_date,
            sw.booking_type,
            sw.start_time,
            sw.venue,
            sw.resource_name,
            sw.description,
            sw.booking_month,
            sw.day_of_week,
            sw.professor,
            sw.schedule_class_type,
            sw.schedule_weight,
            count(DISTINCT sw.booking_id) OVER (PARTITION BY sw.customer_code, sw.booking_month, sw.day_of_week, sw.start_time, sw.schedule_class_type) AS bookings_in_slot,
            sum(sw.schedule_weight) OVER (PARTITION BY sw.customer_code, sw.booking_month) AS sum_weights_month
        FROM schedules_with_weights sw
    ),
    schedule_totals AS (
        SELECT sc.customer_code,
            sc.booking_month,
            sum(
                CASE
                    WHEN sc.customer_code = '000602'::text THEN sc.schedule_weight * sc.bookings_in_slot::numeric
                    ELSE sc.schedule_weight
                END) AS total_weighted_slots
        FROM schedules_coverage sc
        GROUP BY sc.customer_code, sc.booking_month
    ),
    final_bookings AS (
        SELECT sc.booking_id,
            sc.booking_date,
            sc.booking_type,
            sc.start_time,
            sc.venue,
            sc.resource_name,
            sc.description,
            sc.professor,
            sc.customer_code,
            sc.participant_name,
            CASE
                WHEN sc.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.payment_value, 0::numeric)
                WHEN COALESCE(pma.month_has_socio, false) THEN 0::numeric
                WHEN sc.sum_weights_month > 0::numeric AND sc.bookings_in_slot > 0 THEN COALESCE(pma.month_fat_bruto, 0::numeric) * sc.schedule_weight / sc.sum_weights_month / sc.bookings_in_slot::numeric
                ELSE 0::numeric
            END AS booking_value,
            CASE
                WHEN sc.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.payment_value_comissao, 0::numeric)
                WHEN sc.customer_code = '000602'::text AND st.total_weighted_slots > 0::numeric AND sc.bookings_in_slot > 0 THEN COALESCE(pma.month_fat_net, 0::numeric) * (sc.schedule_weight * sc.bookings_in_slot::numeric) / st.total_weighted_slots / sc.bookings_in_slot::numeric
                WHEN sc.sum_weights_month > 0::numeric AND sc.bookings_in_slot > 0 THEN COALESCE(pma.month_fat_net, 0::numeric) * sc.schedule_weight / sc.sum_weights_month / sc.bookings_in_slot::numeric
                ELSE 0::numeric
            END AS booking_commission_base,
            COALESCE(pma.month_has_socio, false) AS is_socio_benefit,
            COALESCE(lcm.is_paid, pma.month_is_paid, false) AS is_paid,
            COALESCE(lcm.pay_date, pma.month_pay_date) AS pay_date,
            CASE
                WHEN sc.booking_type = 'clase_suelta'::text THEN 0::numeric
                WHEN COALESCE(pma.month_has_socio, false) THEN 0::numeric
                WHEN sc.sum_weights_month > 0::numeric AND sc.bookings_in_slot > 0 THEN COALESCE(pma.month_fat_bruto, 0::numeric) * sc.schedule_weight / sc.sum_weights_month / sc.bookings_in_slot::numeric
                ELSE 0::numeric
            END AS booking_value_monthly,
            CASE
                WHEN sc.booking_type = 'clase_suelta'::text THEN 0::numeric
                WHEN sc.customer_code = '000602'::text AND st.total_weighted_slots > 0::numeric AND sc.bookings_in_slot > 0 THEN COALESCE(pma.month_fat_net, 0::numeric) * (sc.schedule_weight * sc.bookings_in_slot::numeric) / st.total_weighted_slots / sc.bookings_in_slot::numeric
                WHEN sc.sum_weights_month > 0::numeric AND sc.bookings_in_slot > 0 THEN COALESCE(pma.month_fat_net, 0::numeric) * sc.schedule_weight / sc.sum_weights_month / sc.bookings_in_slot::numeric
                ELSE 0::numeric
            END AS booking_commission_base_monthly,
            COALESCE(lcm.booking_id IS NOT NULL, false) AS is_avulsa,
            false AS is_avulsa_grupo_fixo
        FROM schedules_coverage sc
        LEFT JOIN loose_class_matches lcm ON lcm.booking_id = sc.booking_id AND lcm.customer_code = sc.customer_code
        LEFT JOIN schedule_totals st ON st.customer_code = sc.customer_code AND st.booking_month = sc.booking_month
        LEFT JOIN plan_month_aggregates pma ON pma.customer_code = sc.customer_code AND pma.plan_month = sc.booking_month
    ),
    unallocated_payments AS (
        SELECT NULL::bigint AS booking_id,
            rf.pay_date::date AS booking_date,
            'clase_suelta'::text AS booking_type,
            NULL::time without time zone AS start_time,
            'MONTREAL TENIS CLUBE LTDA'::text AS venue,
            'Quadra 01'::text AS resource_name,
            rf.description,
            CASE
                WHEN rf.customer_code = '000815'::text OR rf.customer_code = '000475'::text AND (rf.pay_date >= '2026-07-01 00:00:00'::timestamp without time zone AND rf.pay_date < '2026-08-01 00:00:00'::timestamp without time zone OR rf.description ~~* '%15/07/2026%'::text) OR rf.description ~~* '%João Assunção%'::text OR rf.description ~~* '%Joao Assuncao%'::text OR rf.description ~~* '%Joao Assunção%'::text OR rf.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                WHEN rf.description ~~* '%Rodrigo Assunção%'::text OR rf.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                WHEN rf.description ~~* '%Leandro Bonete%'::text OR rf.description ~~* '%Leandro B.%'::text OR rf.description ~~* '%Leandro%'::text THEN 'Leandro Bonete'::text
                WHEN rf.description ~~* '%Tatiana Araújo%'::text OR rf.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                WHEN rf.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                WHEN rf.description ~~* '%Elinton Sanches%'::text OR rf.description ~~* '%Eliton Sanches%'::text OR rf.description ~~* '%Élinton Sanches%'::text OR rf.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                ELSE 'Sem professor'::text
            END AS professor,
            rf.customer_code,
            COALESCE(up_name.participant_name, 'Cliente Não Identificado'::text) AS participant_name,
            rf.valor_faturamento AS booking_value,
            CASE
                WHEN rf.description ~~* '%Sócio Montreal%'::text THEN COALESCE(rf.valor_bruto, rf.valor_faturamento)
                WHEN rf.description ~~* '%Leonardo Assunção%'::text OR rf.description ~~* '%Leonardo Assuncao%'::text THEN rf.valor_faturamento * 2::numeric
                ELSE rf.valor_faturamento
            END AS booking_commission_base,
            false AS is_socio_benefit,
            rf.paid AS is_paid,
            rf.pay_date,
            0::numeric AS booking_value_monthly,
            0::numeric AS booking_commission_base_monthly,
            rf.is_avulsa,
            rf.is_avulsa_grupo_fixo
        FROM resolved_faturamento rf
        LEFT JOIN unique_participants up_name ON up_name.customer_code = rf.customer_code
        WHERE NOT EXISTS (SELECT 1 FROM loose_class_matches lcm WHERE lcm.item_key = rf.item_key) 
          AND NOT EXISTS (SELECT 1 FROM plan_items pi WHERE pi.item_key = rf.item_key)
    ),
    all_combined AS (
        SELECT fb.booking_id, fb.booking_date, fb.booking_type, fb.start_time, fb.venue, fb.resource_name, fb.description, fb.professor, fb.customer_code, fb.participant_name, fb.booking_value, fb.booking_commission_base, fb.is_socio_benefit, fb.is_paid, fb.pay_date, fb.booking_value_monthly, fb.booking_commission_base_monthly, fb.is_avulsa, fb.is_avulsa_grupo_fixo FROM final_bookings fb
        UNION ALL
        SELECT up.booking_id, up.booking_date, up.booking_type, up.start_time, up.venue, up.resource_name, up.description, up.professor, up.customer_code, up.participant_name, up.booking_value, up.booking_commission_base, up.is_socio_benefit, up.is_paid, up.pay_date, up.booking_value_monthly, up.booking_commission_base_monthly, up.is_avulsa, up.is_avulsa_grupo_fixo FROM unallocated_payments up
    ),
    kids_saturday_split AS (
        SELECT c.booking_id, c.booking_date, c.booking_type, c.start_time, c.venue, c.resource_name, c.description, 'Leandro Bonete'::text AS professor, c.customer_code, c.participant_name, c.booking_value / 2.0 AS booking_value, c.booking_commission_base / 2.0 AS booking_commission_base, c.is_socio_benefit, c.is_paid, c.pay_date, c.booking_value_monthly / 2.0 AS booking_value_monthly, c.booking_commission_base_monthly / 2.0 AS booking_commission_base_monthly, c.is_avulsa, c.is_avulsa_grupo_fixo
        FROM all_combined c
        WHERE EXTRACT(isodow FROM c.booking_date) = 6::numeric AND c.start_time = '10:00:00'::time without time zone AND c.professor = 'Leandro Bonete'::text
        UNION ALL
        SELECT c.booking_id, c.booking_date, c.booking_type, c.start_time, c.venue, c.resource_name, c.description, 'Elinton Sanches'::text AS professor, c.customer_code, c.participant_name, c.booking_value / 2.0 AS booking_value, c.booking_commission_base / 2.0 AS booking_commission_base, c.is_socio_benefit, c.is_paid, c.pay_date, c.booking_value_monthly / 2.0 AS booking_value_monthly, c.booking_commission_base_monthly / 2.0 AS booking_commission_base_monthly, c.is_avulsa, c.is_avulsa_grupo_fixo
        FROM all_combined c
        WHERE EXTRACT(isodow FROM c.booking_date) = 6::numeric AND c.start_time = '10:00:00'::time without time zone AND c.professor = 'Leandro Bonete'::text
    ),
    pre_result AS (
        SELECT all_combined.booking_id, all_combined.booking_date, all_combined.booking_type, all_combined.start_time, all_combined.venue, all_combined.resource_name, all_combined.description, all_combined.professor, all_combined.customer_code, all_combined.participant_name, all_combined.booking_value, all_combined.booking_commission_base, all_combined.is_socio_benefit, all_combined.is_paid, all_combined.pay_date, all_combined.booking_value_monthly, all_combined.booking_commission_base_monthly, all_combined.is_avulsa, all_combined.is_avulsa_grupo_fixo
        FROM all_combined
        WHERE NOT (all_combined.start_time IS NOT NULL AND EXTRACT(isodow FROM all_combined.booking_date) = 6::numeric AND all_combined.start_time = '10:00:00'::time without time zone AND all_combined.professor = 'Leandro Bonete'::text)
        UNION ALL
        SELECT kids_saturday_split.booking_id, kids_saturday_split.booking_date, kids_saturday_split.booking_type, kids_saturday_split.start_time, kids_saturday_split.venue, kids_saturday_split.resource_name, kids_saturday_split.description, kids_saturday_split.professor, kids_saturday_split.customer_code, kids_saturday_split.participant_name, kids_saturday_split.booking_value, kids_saturday_split.booking_commission_base, kids_saturday_split.is_socio_benefit, kids_saturday_split.is_paid, kids_saturday_split.pay_date, kids_saturday_split.booking_value_monthly, kids_saturday_split.booking_commission_base_monthly, kids_saturday_split.is_avulsa, kids_saturday_split.is_avulsa_grupo_fixo
        FROM kids_saturday_split
    )
    SELECT pre_result.booking_id, pre_result.booking_date, pre_result.booking_type, pre_result.start_time, pre_result.venue, pre_result.resource_name, pre_result.description, pre_result.professor, pre_result.customer_code, pre_result.participant_name, pre_result.booking_value, pre_result.booking_commission_base, pre_result.is_socio_benefit, pre_result.is_paid, pre_result.pay_date, pre_result.booking_value_monthly, pre_result.booking_commission_base_monthly, pre_result.is_avulsa, pre_result.is_avulsa_grupo_fixo
    FROM pre_result
)
SELECT view_base.booking_id, view_base.booking_date, view_base.booking_type, view_base.start_time, view_base.venue, view_base.resource_name, view_base.description, view_base.professor, view_base.customer_code, view_base.participant_name, view_base.booking_value, view_base.booking_commission_base, view_base.is_socio_benefit, view_base.is_paid, view_base.pay_date, view_base.booking_value_monthly, view_base.booking_commission_base_monthly, view_base.is_avulsa, view_base.is_avulsa_grupo_fixo
FROM view_base;