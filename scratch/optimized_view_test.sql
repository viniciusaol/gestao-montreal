CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS
WITH unique_participants AS MATERIALIZED (
    SELECT DISTINCT ON (participant_name) participant_name, customer_code
    FROM mt_booking_participantes
    WHERE participant_name IS NOT NULL AND length(participant_name) > 5
),
target_bookings AS (
         SELECT b.booking_id,
            b.booking_date,
            b.booking_type,
            b.start_time,
            b.venue,
            b.resource_name,
            b.description,
            p.customer_code,
            p.participant_name,
                CASE
                    WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'::text
                    ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                END AS professor_from_description,
                CASE
                    WHEN b.description ~ '\\(\\s*\\d+\\s*/\\s*1\\s*\\)'::text THEN 'INDIVIDUAL'::text
                    WHEN b.description ~ '\\(\\s*\\d+\\s*/\\s*2\\s*\\)'::text THEN 'DUPLA'::text
                    WHEN b.description ~ '\\(\\s*\\d+\\s*/\\s*3\\s*\\)'::text THEN 'TRIO'::text
                    WHEN b.description ~ '\\(\\s*\\d+\\s*/\\s*[456789]\\d*\\s*\\)'::text THEN 'GRUPO'::text
                    WHEN b.booking_type = 'clase_suelta'::text THEN 'INDIVIDUAL'::text
                    ELSE 'GRUPO'::text
                END AS booking_class_type
           FROM mt_booking_participantes p
             JOIN mt_bookings b ON b.booking_id = p.booking_id
          WHERE b.status = 'ACTIVE'::text AND (b.booking_type = ANY (ARRAY['clase_colectiva'::text, 'clase_suelta'::text])) AND b.description !~~* '%RESERVA MENSAL%'::text
        ), loose_class_matches AS (
         SELECT tb_1.booking_id,
            tb_1.customer_code,
            fi.item_key,
            fi.valor_faturamento AS payment_value,
                CASE
                    WHEN fi.description ~~* '%Sócio Montreal%'::text THEN COALESCE(fi.valor_bruto, fi.valor_faturamento)
                    ELSE fi.valor_faturamento
                END AS payment_value_comissao,
                CASE
                    WHEN fi.description ~~* '%Sócio Montreal%'::text THEN true
                    ELSE false
                END AS is_socio,
            fv.paid AS is_paid,
            fv.pay_date,
                CASE
                    WHEN fi.description ~~* '%João Assunção%'::text OR fi.description ~~* '%Joao Assuncao%'::text OR fi.description ~~* '%Joao Assunção%'::text OR fi.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                    WHEN fi.description ~~* '%Rodrigo Assunção%'::text OR fi.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                    WHEN fi.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                    WHEN fi.description ~~* '%Tatiana Araújo%'::text OR fi.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                    WHEN fi.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                    ELSE NULL::text
                END AS professor
           FROM target_bookings tb_1
             JOIN mt_faturamento_vendas fv ON fv.customer_code = tb_1.customer_code
             JOIN mt_faturamento_itens fi ON fi.venda_external_id = fv.external_id
          WHERE tb_1.booking_type = 'clase_suelta'::text AND fi.is_canceled = false AND fv.is_canceled = false AND fi.valor_faturamento > 0::numeric AND (fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text])) AND (fi.description ~~ (('%'::text || to_char(tb_1.booking_date::timestamp with time zone, 'DD/MM/YYYY'::text)) || '%'::text) AND fi.description ~~ (('%'::text || to_char(tb_1.start_time::interval, 'HH24:MI'::text)) || '%'::text) OR (EXISTS ( SELECT 1
                   FROM mt_booking_pagamentos bpay
                  WHERE bpay.booking_id = tb_1.booking_id AND bpay.payment_date = fv.pay_date)))
        ), resolved_faturamento AS (
         SELECT i.item_key,
            i.venda_external_id,
            i.description,
            i.valor_faturamento,
            i.valor_bruto,
            i.is_canceled AS item_canceled,
            v.customer_code AS payer_customer_code,
            COALESCE(( SELECT p.customer_code
                   FROM unique_participants p
                  WHERE i.description ~~* (('%'::text || p.participant_name) || '%'::text)
                 LIMIT 1), v.customer_code) AS customer_code,
            v.paid,
            v.pay_date,
            v.data_venda,
            v.is_canceled AS sale_canceled,
            v.tipo AS sale_type,
            i.categoria,
            i.subcategoria,
            i.description ~~* '%AULA AVULSA%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text OR i.subcategoria = 'Avulsa - Particular'::text AS is_avulsa,
            i.description ~~* '%AULA AVULSA - GRUPO FIXO%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text AS is_avulsa_grupo_fixo
           FROM mt_faturamento_itens i
             JOIN mt_faturamento_vendas v ON v.external_id = i.venda_external_id
        ), plan_items AS (
         SELECT rf.item_key,
            rf.customer_code,
            date_trunc('month'::text, COALESCE(rf.pay_date, rf.data_venda::timestamp without time zone)) AS plan_month,
            rf.paid,
            rf.pay_date,
            rf.valor_faturamento,
            COALESCE(rf.valor_bruto, rf.valor_faturamento) AS valor_bruto,
                CASE
                    WHEN rf.description ~~* '%Sócio Montreal%'::text THEN true
                    ELSE false
                END AS is_socio,
                CASE
                    WHEN rf.description ~~* '%AULA AVULSA%'::text THEN 'OUTRO'::text
                    WHEN rf.description ~~* '%INDIVIDUAL%'::text THEN 'INDIVIDUAL'::text
                    WHEN rf.description ~~* '%DUPLA%'::text THEN 'DUPLA'::text
                    WHEN rf.description ~~* '%TRIO%'::text THEN 'TRIO'::text
                    WHEN rf.description ~~* '%GRUPO%'::text OR rf.description ~~* '%QUARTETO%'::text THEN 'GRUPO'::text
                    ELSE 'OUTRO'::text
                END AS plan_class_type,
            bool_or(rf.paid) OVER (PARTITION BY rf.customer_code, (date_trunc('month'::text, COALESCE(rf.pay_date, rf.data_venda::timestamp without time zone)))) AS has_paid_plan,
            rf.is_avulsa,
            rf.is_avulsa_grupo_fixo,
                CASE
                    WHEN rf.is_avulsa THEN 0::numeric
                    ELSE rf.valor_faturamento
                END AS valor_faturamento_monthly,
                CASE
                    WHEN rf.is_avulsa THEN 0::numeric
                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                END AS valor_bruto_monthly,
                CASE
                    WHEN rf.description ~ '\\d{2}/\\d{2}/\\d{4}-\\d{2}/\\d{2}/\\d{4}'::text THEN to_date((regexp_match(rf.description, '(\\d{2}/\\d{2}/\\d{4})-\\d{2}/\\d{2}/\\d{4}'::text))[1], 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END AS item_start_date,
                CASE
                    WHEN rf.description ~ '\\d{2}/\\d{2}/\\d{4}-\\d{2}/\\d{2}/\\d{4}'::text THEN to_date((regexp_match(rf.description, '\\d{2}/\\d{2}/\\d{4}-(\\d{2}/\\d{2}/\\d{4})'::text))[1], 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END AS item_end_date
           FROM resolved_faturamento rf
          WHERE rf.item_canceled = false AND rf.sale_canceled = false AND COALESCE(rf.sale_type, ''::text) <> 'refund'::text AND rf.valor_faturamento > 0::numeric AND (rf.subcategoria IS NULL OR rf.subcategoria <> 'Avulsa - Particular'::text) AND NOT (rf.item_key IN ( SELECT loose_class_matches.item_key
                   FROM loose_class_matches)) AND (rf.categoria = 'Aulas'::text OR rf.categoria = 'Outros'::text AND rf.description ~~* '%TÊNIS%'::text AND rf.description ~~* '%ADULTO%'::text)
        ), booking_plan_priority AS (
         SELECT tb.booking_id,
            tb.customer_code,
            pi.item_key,
            row_number() OVER (PARTITION BY tb.booking_id, tb.customer_code ORDER BY pi.item_start_date DESC, (abs(pi.valor_bruto / NULLIF((pi.item_end_date - pi.item_start_date + 1)::numeric, 0::numeric) * 30::numeric -
                CASE tb.booking_class_type
                    WHEN 'INDIVIDUAL'::text THEN 720
                    WHEN 'DUPLA'::text THEN 430
                    WHEN 'TRIO'::text THEN 395
                    ELSE 335
                END::numeric))) AS rn
           FROM target_bookings tb
             JOIN plan_items pi ON pi.customer_code = tb.customer_code AND tb.booking_date >= pi.item_start_date AND tb.booking_date <= pi.item_end_date
          WHERE tb.booking_type = 'clase_colectiva'::text AND pi.item_start_date IS NOT NULL
        ), plan_item_ranged_counts AS (
         SELECT bpp.item_key,
            bpp.customer_code,
            count(*) AS bookings_in_range
           FROM booking_plan_priority bpp
          WHERE bpp.rn = 1
          GROUP BY bpp.item_key, bpp.customer_code
        ), booking_ranged_values AS (
         SELECT tb.booking_id,
            tb.customer_code,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN pi.valor_faturamento / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_value,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN
                    CASE
                        WHEN pi.is_socio THEN pi.valor_bruto
                        ELSE pi.valor_faturamento
                    END / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_commission_base,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN pi.valor_faturamento_monthly / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_value_monthly,
                CASE
                    WHEN pi.paid = pi.has_paid_plan THEN
                    CASE
                        WHEN pi.is_socio THEN pi.valor_bruto_monthly
                        ELSE pi.valor_faturamento_monthly
                    END / NULLIF(pirc.bookings_in_range, 0)::numeric
                    ELSE 0::numeric
                END AS booking_commission_base_monthly,
            pi.is_socio,
            pi.paid AS is_paid,
            pi.pay_date,
            pi.is_avulsa AS has_avulsa,
            pi.is_avulsa_grupo_fixo AS has_avulsa_grupo_fixo
           FROM booking_plan_priority bpp
             JOIN plan_items pi ON pi.item_key = bpp.item_key
             JOIN target_bookings tb ON tb.booking_id = bpp.booking_id AND tb.customer_code = bpp.customer_code
             JOIN plan_item_ranged_counts pirc ON pirc.item_key = bpp.item_key AND pirc.customer_code = bpp.customer_code
          WHERE bpp.rn = 1
        ), monthly_student_plans AS (
         SELECT plan_items.customer_code,
            plan_items.plan_month,
            plan_items.plan_class_type,
            plan_items.has_paid_plan AS paid,
            sum(
                CASE
                    WHEN plan_items.paid = plan_items.has_paid_plan THEN plan_items.valor_faturamento
                    ELSE 0::numeric
                END) AS total_faturamento,
            sum(
                CASE
                    WHEN plan_items.paid = plan_items.has_paid_plan THEN
                    CASE
                        WHEN plan_items.is_socio THEN plan_items.valor_bruto
                        ELSE plan_items.valor_faturamento
                    END
                    ELSE 0::numeric
                END) AS total_comissao_base,
            sum(
                CASE
                    WHEN plan_items.paid = plan_items.has_paid_plan THEN plan_items.valor_faturamento_monthly
                    ELSE 0::numeric
                END) AS total_faturamento_monthly,
            sum(
                CASE
                    WHEN plan_items.paid = plan_items.has_paid_plan THEN
                    CASE
                        WHEN plan_items.is_socio THEN plan_items.valor_bruto_monthly
                        ELSE plan_items.valor_faturamento_monthly
                    END
                    ELSE 0::numeric
                END) AS total_comissao_base_monthly,
            bool_or(plan_items.is_socio) AS is_socio,
            max(
                CASE
                    WHEN plan_items.paid = plan_items.has_paid_plan THEN plan_items.pay_date
                    ELSE NULL::timestamp without time zone
                END) AS pay_date,
            bool_or(plan_items.is_avulsa) AS has_avulsa,
            bool_or(plan_items.is_avulsa_grupo_fixo) AS has_avulsa_grupo_fixo
           FROM plan_items
          WHERE NOT (plan_items.item_key IN ( SELECT plan_item_ranged_counts.item_key
                   FROM plan_item_ranged_counts))
          GROUP BY plan_items.customer_code, plan_items.plan_month, plan_items.plan_class_type, plan_items.has_paid_plan
        ), monthly_booking_counts AS (
         SELECT target_bookings.customer_code,
            target_bookings.booking_class_type,
            date_trunc('month'::text, target_bookings.booking_date::timestamp with time zone) AS booking_month,
            count(DISTINCT target_bookings.booking_id) AS total_monthly_bookings
           FROM target_bookings
          WHERE target_bookings.booking_type = 'clase_colectiva'::text
          GROUP BY target_bookings.customer_code, target_bookings.booking_class_type, (date_trunc('month'::text, target_bookings.booking_date::timestamp with time zone))
        ), student_monthly_summary AS (
         SELECT monthly_student_plans.customer_code,
            monthly_student_plans.plan_month,
            bool_or(monthly_student_plans.paid) AS paid,
            max(monthly_student_plans.pay_date) AS pay_date,
            sum(
                CASE
                    WHEN monthly_student_plans.plan_class_type = 'OUTRO'::text THEN monthly_student_plans.total_faturamento
                    ELSE 0::numeric
                END) AS outro_faturamento,
            sum(
                CASE
                    WHEN monthly_student_plans.plan_class_type = 'OUTRO'::text THEN monthly_student_plans.total_comissao_base
                    ELSE 0::numeric
                END) AS outro_comissao_base,
            sum(
                CASE
                    WHEN monthly_student_plans.plan_class_type = 'OUTRO'::text THEN monthly_student_plans.total_faturamento_monthly
                    ELSE 0::numeric
                END) AS outro_faturamento_monthly,
            sum(
                CASE
                    WHEN monthly_student_plans.plan_class_type = 'OUTRO'::text THEN
                    CASE
                        WHEN monthly_student_plans.is_socio THEN monthly_student_plans.total_comissao_base_monthly
                        ELSE monthly_student_plans.total_faturamento_monthly
                    END
                    ELSE 0::numeric
                END) AS outro_comissao_base_monthly,
            bool_or(monthly_student_plans.is_socio) AS is_socio,
            bool_or(monthly_student_plans.has_avulsa) AS has_avulsa,
            bool_or(monthly_student_plans.has_avulsa_grupo_fixo) AS has_avulsa_grupo_fixo
           FROM monthly_student_plans
          GROUP BY monthly_student_plans.customer_code, monthly_student_plans.plan_month
        ), outro_booking_counts AS (
         SELECT tb_1.customer_code,
            date_trunc('month'::text, tb_1.booking_date::timestamp with time zone) AS booking_month,
            count(DISTINCT tb_1.booking_id) AS total_outro_bookings
           FROM target_bookings tb_1
             LEFT JOIN monthly_student_plans sp_1 ON sp_1.customer_code = tb_1.customer_code AND sp_1.plan_month = date_trunc('month'::text, tb_1.booking_date::timestamp with time zone) AND sp_1.plan_class_type = tb_1.booking_class_type AND sp_1.total_faturamento > 0::numeric
          WHERE tb_1.booking_type = 'clase_colectiva'::text AND sp_1.plan_class_type IS NULL
          GROUP BY tb_1.customer_code, (date_trunc('month'::text, tb_1.booking_date::timestamp with time zone))
        ), final_bookings AS (
         SELECT tb.booking_id,
            tb.booking_date,
            tb.booking_type,
            tb.start_time,
            tb.venue,
            tb.resource_name,
            tb.description,
            COALESCE(tb.professor_from_description, lcm.professor, 'Sem professor'::text) AS professor,
            tb.customer_code,
            tb.participant_name,
            COALESCE(
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN lcm.payment_value
                    ELSE brv.booking_value
                END, 0::numeric) + COALESCE(sp.total_faturamento / NULLIF(mbc.total_monthly_bookings, 0)::numeric, sms.outro_faturamento / NULLIF(obc.total_outro_bookings, 0)::numeric, 0::numeric) AS booking_value,
            COALESCE(
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN lcm.payment_value_comissao
                    ELSE brv.booking_commission_base
                END, 0::numeric) + COALESCE(sp.total_comissao_base / NULLIF(mbc.total_monthly_bookings, 0)::numeric, sms.outro_comissao_base / NULLIF(obc.total_outro_bookings, 0)::numeric, 0::numeric) AS booking_commission_base,
            COALESCE(lcm.is_socio, brv.is_socio, sp.is_socio, sms.is_socio, false) AS is_socio_benefit,
            COALESCE(lcm.is_paid, false) OR
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.is_paid, false)
                    WHEN brv.booking_id IS NOT NULL THEN COALESCE(brv.is_paid, false)
                    ELSE COALESCE(sp.paid, sms.paid, false)
                END AS is_paid,
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN lcm.pay_date
                    WHEN brv.booking_id IS NOT NULL THEN brv.pay_date
                    ELSE COALESCE(sp.pay_date, sms.pay_date)
                END AS pay_date,
            COALESCE(
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN 0::numeric
                    ELSE brv.booking_value_monthly
                END, 0::numeric) + COALESCE(sp.total_faturamento_monthly / NULLIF(mbc.total_monthly_bookings, 0)::numeric, sms.outro_faturamento_monthly / NULLIF(obc.total_outro_bookings, 0)::numeric, 0::numeric) AS booking_value_monthly,
            COALESCE(
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN 0::numeric
                    ELSE brv.booking_commission_base_monthly
                END, 0::numeric) + COALESCE(sp.total_comissao_base_monthly / NULLIF(mbc.total_monthly_bookings, 0)::numeric, sms.outro_comissao_base_monthly / NULLIF(obc.total_outro_bookings, 0)::numeric, 0::numeric) AS booking_commission_base_monthly,
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN true
                    WHEN brv.booking_id IS NOT NULL THEN COALESCE(brv.has_avulsa, false)
                    ELSE COALESCE(sp.has_avulsa, sms.has_avulsa, false)
                END AS is_avulsa,
                CASE
                    WHEN tb.booking_type = 'clase_suelta'::text THEN false
                    WHEN brv.booking_id IS NOT NULL THEN COALESCE(brv.has_avulsa_grupo_fixo, false)
                    ELSE COALESCE(sp.has_avulsa_grupo_fixo, sms.has_avulsa_grupo_fixo, false)
                END AS is_avulsa_grupo_fixo
           FROM target_bookings tb
             LEFT JOIN loose_class_matches lcm ON lcm.booking_id = tb.booking_id AND lcm.customer_code = tb.customer_code
             LEFT JOIN booking_ranged_values brv ON brv.booking_id = tb.booking_id AND brv.customer_code = tb.customer_code
             LEFT JOIN monthly_booking_counts mbc ON mbc.customer_code = tb.customer_code AND mbc.booking_class_type = tb.booking_class_type AND mbc.booking_month = date_trunc('month'::text, tb.booking_date::timestamp with time zone)
             LEFT JOIN monthly_student_plans sp ON sp.customer_code = tb.customer_code AND sp.plan_class_type = tb.booking_class_type AND sp.plan_month = date_trunc('month'::text, tb.booking_date::timestamp with time zone)
             LEFT JOIN student_monthly_summary sms ON sms.customer_code = tb.customer_code AND sms.plan_month = date_trunc('month'::text, tb.booking_date::timestamp with time zone)
             LEFT JOIN outro_booking_counts obc ON obc.customer_code = tb.customer_code AND obc.booking_month = date_trunc('month'::text, tb.booking_date::timestamp with time zone)
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