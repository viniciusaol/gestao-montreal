-- View: public.vw_mt_comissoes_detalhadas
-- Updated: 2026-07-15
-- Description: View to calculate detailed commission allocations for teachers based on student schedules and plan weights.

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
        CASE
            WHEN (rf.description ~~* '%AULA AVULSA%'::text) THEN 'OUTRO'::text
            WHEN (rf.description ~~* '%INDIVIDUAL%'::text) THEN 'INDIVIDUAL'::text
            WHEN (rf.description ~~* '%DUPLA%'::text) THEN 'DUPLA'::text
            WHEN (rf.description ~~* '%TRIO%'::text) THEN 'TRIO'::text
            WHEN ((rf.description ~~* '%GRUPO%'::text) OR (rf.description ~~* '%QUARTETO%'::text)) THEN 'GRUPO'::text
            -- Fallback by modular gross price (only for items >= R$ 100 to avoid snacks/drinks matching):
            WHEN (COALESCE(rf.valor_bruto, rf.valor_faturamento) >= 100::numeric AND (mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 720::numeric) < 10::numeric OR mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 720::numeric) > 710::numeric)) THEN 'INDIVIDUAL'::text
            WHEN (COALESCE(rf.valor_bruto, rf.valor_faturamento) >= 100::numeric AND (mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 430::numeric) < 10::numeric OR mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 430::numeric) > 420::numeric)) THEN 'DUPLA'::text
            WHEN (COALESCE(rf.valor_bruto, rf.valor_faturamento) >= 100::numeric AND (mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 395::numeric) < 10::numeric OR mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 395::numeric) > 385::numeric)) THEN 'TRIO'::text
            WHEN (COALESCE(rf.valor_bruto, rf.valor_faturamento) >= 100::numeric AND (mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 335::numeric) < 10::numeric OR mod(COALESCE(rf.valor_bruto, rf.valor_faturamento), 335::numeric) > 325::numeric)) THEN 'GRUPO'::text
            ELSE 'OUTRO'::text
        END AS plan_class_type,
        rf.is_avulsa,
        rf.is_avulsa_grupo_fixo,
        CASE WHEN rf.is_avulsa THEN (0)::numeric ELSE rf.valor_faturamento END AS valor_faturamento_monthly,
        CASE WHEN rf.is_avulsa THEN (0)::numeric ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento) END AS valor_bruto_monthly,
        COALESCE(
            CASE
                WHEN (rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text) THEN to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)
                WHEN (rf.description ~* '(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:20)?(\d{2})'::text) THEN to_date(((
                CASE lower((regexp_match(rf.description, '(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:20)?(\d{2})'::text, 'i'::text))[1])
                    WHEN 'janeiro'::text THEN '01'::text
                    WHEN 'fevereiro'::text THEN '02'::text
                    WHEN 'março'::text THEN '03'::text
                    WHEN 'marco'::text THEN '03'::text
                    WHEN 'abril'::text THEN '04'::text
                    WHEN 'maio'::text THEN '05'::text
                    WHEN 'junho'::text THEN '06'::text
                    WHEN 'julho'::text THEN '07'::text
                    WHEN 'agosto'::text THEN '08'::text
                    WHEN 'setembro'::text THEN '09'::text
                    WHEN 'outubro'::text THEN '10'::text
                    WHEN 'novembro'::text THEN '11'::text
                    WHEN 'dezembro'::text THEN '12'::text
                    ELSE NULL::text
                END || '/'::text) || (regexp_match(rf.description, '(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:20)?(\d{2})'::text, 'i'::text))[2]), 'MM/YY'::text)
                ELSE NULL::date
            END, (date_trunc('month'::text, COALESCE(rf.pay_date, (rf.data_venda)::timestamp without time zone)))::date) AS item_start_date,
        COALESCE(
            CASE
                WHEN (rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text) THEN to_date((regexp_match(rf.description, '\d{2}/\d{2}/\d{4}-(\d{2}/\d{2}/\d{4})'::text))[1], 'DD/MM/YYYY'::text)
                WHEN (rf.description ~* '(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:20)?(\d{2})'::text) THEN (((to_date(((
                CASE lower((regexp_match(rf.description, '(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:20)?(\d{2})'::text, 'i'::text))[1])
                    WHEN 'janeiro'::text THEN '01'::text
                    WHEN 'fevereiro'::text THEN '02'::text
                    WHEN 'março'::text THEN '03'::text
                    WHEN 'marco'::text THEN '03'::text
                    WHEN 'abril'::text THEN '04'::text
                    WHEN 'maio'::text THEN '05'::text
                    WHEN 'junho'::text THEN '06'::text
                    WHEN 'julho'::text THEN '07'::text
                    WHEN 'agosto'::text THEN '08'::text
                    WHEN 'setembro'::text THEN '09'::text
                    WHEN 'outubro'::text THEN '10'::text
                    WHEN 'novembro'::text THEN '11'::text
                    WHEN 'dezembro'::text THEN '12'::text
                    ELSE NULL::text
                END || '/'::text) || (regexp_match(rf.description, '(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:20)?(\d{2})'::text, 'i'::text))[2]), 'MM/YY'::text) + '1 mon'::interval) - '1 day'::interval))::date
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
        COALESCE(date_trunc('month'::text, pay_date)::date, date_trunc('month'::text, item_start_date)::date) AS plan_month,
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
), schedules_with_sums AS (
    SELECT *,
        SUM(schedule_weight) OVER (PARTITION BY customer_code, plan_month, booking_class_type) AS sum_weight_of_type,
        SUM(schedule_weight) OVER (PARTITION BY customer_code, plan_month) AS sum_weight_total
    FROM schedules_with_weights
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
                    (valor_faturamento * (schedule_weight::numeric / sum_weight_total))
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
                    (
                        CASE WHEN is_socio THEN valor_bruto ELSE valor_faturamento END 
                        * (schedule_weight::numeric / sum_weight_total)
                    )
            END
        ) AS schedule_monthly_commission_base,
        bool_or(paid) AS is_paid,
        max(pay_date) AS pay_date,
        bool_or(is_socio) AS is_socio,
        SUM(
            CASE
                WHEN has_type_match THEN
                    CASE WHEN is_type_match THEN (valor_faturamento_monthly * (schedule_weight::numeric / sum_weight_of_type)) ELSE 0 END
                ELSE
                    (valor_faturamento_monthly * (schedule_weight::numeric / sum_weight_total))
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
                    (
                        CASE WHEN is_socio THEN valor_bruto_monthly ELSE valor_faturamento_monthly END 
                        * (schedule_weight::numeric / sum_weight_total)
                    )
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
FROM final_bookings;
