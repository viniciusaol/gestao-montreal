-- ==========================================
-- BACKUP: vw_mt_comissoes_detalhadas
-- Versão original (somente alunos pagos)
-- ==========================================

CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS
WITH target_bookings AS (
    SELECT b.booking_id,
        b.booking_date,
        b.booking_type,
        b.start_time,
        b.venue,
        b.resource_name,
        p.customer_code,
        p.participant_name,
        CASE
            WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'::text
            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE(substring(b.description, '(?i)prof[:.]?\\s*([^.(]+)'::text), ''::text), '\\s+'::text, ' '::text, 'g'::text)), ''::text)
        END AS professor_from_description
    FROM mt_booking_participantes p
    JOIN mt_bookings b ON b.booking_id = p.booking_id
    WHERE b.status = 'ACTIVE'::text 
      AND (b.booking_type = ANY (ARRAY['clase_colectiva'::text, 'clase_suelta'::text])) 
      AND b.description !~~* '%RESERVA MENSAL%'::text
), loose_class_matches AS (
    SELECT tb_1.booking_id,
        fi.valor_faturamento AS payment_value,
        fv.paid AS is_paid,
        fv.pay_date,
        CASE
            WHEN fi.description ~~* '%João Assunção%'::text THEN 'João Assunção'::text
            WHEN fi.description ~~* '%Rodrigo Assunção%'::text THEN 'Rodrigo Assunção'::text
            WHEN fi.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
            WHEN fi.description ~~* '%Tatiana Araújo%'::text THEN 'Tatiana Araújo'::text
            ELSE NULL::text
        END AS professor
    FROM target_bookings tb_1
    JOIN mt_faturamento_vendas fv ON fv.customer_code = tb_1.customer_code
    JOIN mt_faturamento_itens fi ON fi.venda_external_id = fv.external_id
    WHERE tb_1.booking_type = 'clase_suelta'::text 
      AND fi.is_canceled = false 
      AND fv.is_canceled = false 
      AND fi.valor_faturamento > 0::numeric 
      AND (
        fi.description ~~ (('%'::text || to_char(tb_1.booking_date::timestamp with time zone, 'DD/MM/YYYY'::text)) || '%'::text) 
        AND fi.description ~~ (('%'::text || to_char(tb_1.start_time::interval, 'HH24:MI'::text)) || '%'::text) 
        OR (EXISTS ( SELECT 1 FROM mt_booking_pagamentos bpay WHERE bpay.booking_id = tb_1.booking_id AND bpay.payment_date = fv.pay_date))
      )
), monthly_booking_counts AS (
    SELECT tb_1.customer_code,
        date_trunc('month'::text, tb_1.booking_date::timestamp with time zone) AS booking_month,
        count(DISTINCT tb_1.booking_id) AS total_monthly_bookings
    FROM target_bookings tb_1
    WHERE tb_1.booking_type = 'clase_colectiva'::text
    GROUP BY tb_1.customer_code, (date_trunc('month'::text, tb_1.booking_date::timestamp with time zone))
), monthly_student_plans AS (
    SELECT v.customer_code,
        date_trunc('month'::text, v.pay_date) AS plan_month,
        sum(i.valor_faturamento) AS total_faturamento,
        v.paid,
        v.pay_date
    FROM mt_faturamento_itens i
    JOIN mt_faturamento_vendas v ON v.external_id = i.venda_external_id
    WHERE i.is_canceled = false 
      AND v.is_canceled = false 
      AND COALESCE(v.tipo, ''::text) <> 'refund'::text 
      AND i.valor_faturamento > 0::numeric 
      AND (i.subcategoria IS NULL OR i.subcategoria <> 'Avulsa - Particular'::text) 
      AND i.description !~~* '%AULA AVULSA%'::text 
      AND (i.categoria = 'Aulas'::text OR i.categoria = 'Outros'::text AND i.description ~~* '%TÊNIS%'::text AND i.description ~~* '%ADULTO%'::text)
    GROUP BY v.customer_code, (date_trunc('month'::text, v.pay_date)), v.paid, v.pay_date
)
SELECT tb.booking_id,
    tb.booking_date,
    tb.booking_type,
    tb.start_time,
    tb.venue,
    tb.resource_name,
    COALESCE(tb.professor_from_description, lcm.professor, 'Sem professor'::text) AS professor,
    tb.customer_code,
    tb.participant_name,
    CASE
        WHEN tb.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.payment_value, 0::numeric)
        ELSE COALESCE(sp.total_faturamento, 0::numeric) / NULLIF(mbc.total_monthly_bookings, 0)::numeric
    END AS booking_value,
    CASE
        WHEN tb.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.is_paid, false)
        ELSE COALESCE(sp.paid, false)
    END AS is_paid,
    CASE
        WHEN tb.booking_type = 'clase_suelta'::text THEN lcm.pay_date
        ELSE sp.pay_date
    END AS pay_date
FROM target_bookings tb
LEFT JOIN loose_class_matches lcm ON lcm.booking_id = tb.booking_id
LEFT JOIN monthly_booking_counts mbc ON mbc.customer_code = tb.customer_code AND mbc.booking_month = date_trunc('month'::text, tb.booking_date::timestamp with zone)
LEFT JOIN monthly_student_plans sp ON sp.customer_code = tb.customer_code AND sp.plan_month = date_trunc('month'::text, tb.booking_date::timestamp with zone);
