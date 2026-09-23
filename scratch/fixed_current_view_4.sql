CREATE OR REPLACE VIEW public.vw_mt_comissoes_detalhadas AS
 WITH view_base AS (
         WITH unique_participants AS MATERIALIZED (
                 SELECT DISTINCT ON (mt_booking_participantes.participant_name) mt_booking_participantes.participant_name,
                    mt_booking_participantes.customer_code
                   FROM mt_booking_participantes
                  WHERE mt_booking_participantes.participant_name IS NOT NULL AND length(mt_booking_participantes.participant_name) > 5
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
                  WHERE b.status = 'ACTIVE'::text AND b.booking_type = 'clase_suelta'::text AND b.description !~~* '%RESERVA MENSAL%'::text AND fi.is_canceled = false AND fv.is_canceled = false AND fi.valor_faturamento > 0::numeric AND (fi.categoria = ANY (ARRAY['Aulas'::text, 'Outros'::text])) AND (fi.description ~~ (('%'::text || to_char(b.booking_date::timestamp with time zone, 'DD/MM/YYYY'::text)) || '%'::text) AND fi.description ~~ (('%'::text || to_char(b.start_time::interval, 'HH24:MI'::text)) || '%'::text) OR (EXISTS ( SELECT 1
                           FROM mt_booking_pagamentos bpay
                          WHERE bpay.booking_id = b.booking_id AND bpay.payment_date = fv.pay_date AND bpay.amount = fi.valor_faturamento)))
                ), resolved_faturamento AS (
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
                            WHEN i.categoria = 'Aulas'::text OR i.categoria = 'Outros'::text AND i.description ~~* '%TÊNIS%'::text AND i.description ~~* '%ADULTO%'::text THEN COALESCE(( SELECT p_1.customer_code
                               FROM unique_participants p_1
                              WHERE i.description ~~* (('%'::text || p_1.participant_name) || '%'::text)
                             LIMIT 1), v.customer_code)
                            ELSE v.customer_code
                        END AS customer_code,
                    v.paid,
                    v.data_venda,
                    COALESCE(i.description ~~* '%AULA AVULSA%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text OR i.subcategoria = 'Avulsa - Particular'::text, false) AS is_avulsa,
                    COALESCE(i.description ~~* '%AULA AVULSA - GRUPO FIXO%'::text OR i.subcategoria = 'Avulsa - Grupo Fixo'::text, false) AS is_avulsa_grupo_fixo
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
                        END, ( SELECT bp.plan_class_type
                           FROM ( VALUES ('INDIVIDUAL'::text,720::numeric), ('DUPLA'::text,430::numeric), ('TRIO'::text,395::numeric), ('GRUPO'::text,335::numeric), ('GRUPO'::text,245::numeric)) bp(plan_class_type, base_value)
                          WHERE COALESCE(
                                CASE
                                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
                                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) >= 50::numeric AND ((COALESCE(
                                CASE
                                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
                                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / bp.base_value) >= 0.15 AND (COALESCE(
                                CASE
                                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
                                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / bp.base_value) <= 1.05 OR (COALESCE(
                                CASE
                                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
                                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / (2.0 * bp.base_value)) >= 0.85 AND (COALESCE(
                                CASE
                                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
                                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / (2.0 * bp.base_value)) <= 1.15)
                          ORDER BY (
                                CASE
                                    WHEN (COALESCE(
                                    CASE
WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                    END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / bp.base_value) <= 1.05 THEN 1
                                    ELSE 2
                                END), (abs(round(COALESCE(
                                CASE
                                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
                                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / (
                                CASE
                                    WHEN (COALESCE(
                                    CASE
WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                    END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / bp.base_value) > 1.3 THEN 2.0
                                    ELSE 1.0
                                END * bp.base_value) * 20::numeric) - COALESCE(
                                CASE
                                    WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
                                    ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / (
                                CASE
                                    WHEN (COALESCE(
                                    CASE
WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN round(COALESCE(rf.valor_bruto, rf.valor_faturamento) * ((date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone) + '1 mon -1 days'::interval)::date - date_trunc('month'::text, to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)::timestamp with time zone)::date + 1)::numeric / GREATEST(to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-(\d{2}/\d{2}/\d{4})'::text))[2], 'DD/MM/YYYY'::text) - to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text) + 1, 1)::numeric, 2)
ELSE COALESCE(rf.valor_bruto, rf.valor_faturamento)
                                    END, COALESCE(rf.valor_bruto, rf.valor_faturamento)) / bp.base_value) > 1.3 THEN 2.0
                                    ELSE 1.0
                                END * bp.base_value) * 20::numeric))
                         LIMIT 1), 'OUTRO'::text) AS plan_class_type,
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
                    COALESCE(
                        CASE
                            WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN to_date((regexp_match(rf.description, '(\d{2}/\d{2}/\d{4})-\d{2}/\d{2}/\d{4}'::text))[1], 'DD/MM/YYYY'::text)
                            WHEN rf.description ~~* '%janeiro 26%'::text THEN '2026-01-01'::date
                            WHEN rf.description ~~* '%fevereiro 26%'::text THEN '2026-02-01'::date
                            WHEN rf.description ~~* '%março 26%'::text OR rf.description ~~* '%marco 26%'::text THEN '2026-03-01'::date
                            WHEN rf.description ~~* '%abril 26%'::text THEN '2026-04-01'::date
                            WHEN rf.description ~~* '%maio 26%'::text THEN '2026-05-01'::date
                            WHEN rf.description ~~* '%junho 26%'::text THEN '2026-06-01'::date
                            WHEN rf.description ~~* '%julho 26%'::text THEN '2026-07-01'::date
                            WHEN rf.description ~~* '%agosto 26%'::text THEN '2026-08-01'::date
                            WHEN rf.description ~~* '%setembro 26%'::text THEN '2026-09-01'::date
                            WHEN rf.description ~~* '%outubro 26%'::text THEN '2026-10-01'::date
                            WHEN rf.description ~~* '%novembro 26%'::text THEN '2026-11-01'::date
                            WHEN rf.description ~~* '%dezembro 26%'::text THEN '2026-12-31'::date
                            ELSE NULL::date
                        END, date_trunc('month'::text, COALESCE(rf.pay_date, rf.data_venda::timestamp without time zone))::date) AS item_start_date,
                    COALESCE(
                        CASE
                            WHEN rf.description ~ '\d{2}/\d{2}/\d{4}-\d{2}/\d{2}/\d{4}'::text THEN to_date((regexp_match(rf.description, '\d{2}/\d{2}/\d{4}-(\d{2}/\d{2}/\d{4})'::text))[1], 'DD/MM/YYYY'::text)
                            WHEN rf.description ~~* '%janeiro 26%'::text THEN '2026-01-31'::date
                            WHEN rf.description ~~* '%fevereiro 26%'::text THEN '2026-02-28'::date
                            WHEN rf.description ~~* '%março 26%'::text OR rf.description ~~* '%marco 26%'::text THEN '2026-03-31'::date
                            WHEN rf.description ~~* '%abril 26%'::text THEN '2026-04-30'::date
                            WHEN rf.description ~~* '%maio 26%'::text THEN '2026-05-31'::date
                            WHEN rf.description ~~* '%junho 26%'::text THEN '2026-06-30'::date
                            WHEN rf.description ~~* '%julho 26%'::text THEN '2026-07-31'::date
                            WHEN rf.description ~~* '%agosto 26%'::text THEN '2026-08-31'::date
                            WHEN rf.description ~~* '%setembro 26%'::text THEN '2026-09-30'::date
                            WHEN rf.description ~~* '%outubro 26%'::text THEN '2026-10-31'::date
                            WHEN rf.description ~~* '%novembro 26%'::text THEN '2026-11-30'::date
                            WHEN rf.description ~~* '%dezembro 26%'::text THEN '2026-12-31'::date
                            ELSE NULL::date
                        END, (date_trunc('month'::text, COALESCE(rf.pay_date, rf.data_venda::timestamp without time zone)) + '1 mon'::interval - '1 day'::interval)::date) AS item_end_date
                   FROM resolved_faturamento rf
                  WHERE rf.item_canceled = false AND rf.sale_canceled = false AND COALESCE(rf.sale_type, ''::text) <> 'refund'::text AND rf.valor_faturamento > 0::numeric AND (rf.subcategoria IS NULL OR rf.subcategoria <> 'Avulsa - Particular'::text) AND rf.is_avulsa = false AND (rf.categoria = 'Aulas'::text OR rf.categoria = 'Outros'::text AND rf.description ~~* '%TÊNIS%'::text AND rf.description ~~* '%ADULTO%'::text)
                ), plan_items AS (
                 SELECT plan_items_raw.item_key,
                    plan_items_raw.customer_code,
                    COALESCE(date_trunc('month'::text, plan_items_raw.item_start_date::timestamp with time zone)::date, date_trunc('month'::text, plan_items_raw.pay_date)::date) AS plan_month,
                    plan_items_raw.paid,
                    plan_items_raw.pay_date,
                    plan_items_raw.valor_faturamento,
                    plan_items_raw.valor_bruto_derived AS valor_bruto,
                    plan_items_raw.is_socio,
                    plan_items_raw.plan_class_type,
                    plan_items_raw.is_avulsa,
                    plan_items_raw.is_avulsa_grupo_fixo,
                    plan_items_raw.valor_faturamento_monthly,
                    plan_items_raw.valor_bruto_monthly
                   FROM plan_items_raw
                ), schedules AS (
                 SELECT p.customer_code,
                    date_trunc('month'::text, b.booking_date::timestamp with time zone)::date AS plan_month,
                    EXTRACT(isodow FROM b.booking_date) AS day_of_week,
                    b.start_time,
                        CASE
                            WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'::text
                            WHEN p.customer_code = '000815'::text OR p.customer_code = '000475'::text AND b.booking_date >= '2026-07-01'::date AND b.booking_date <= '2026-07-31'::date OR b.description ~~* '%João Assunção%'::text OR b.description ~~* '%Joao Assuncao%'::text OR b.description ~~* '%Joao Assunção%'::text OR b.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                            WHEN b.description ~~* '%Elinton Sanches%'::text OR b.description ~~* '%Eliton Sanches%'::text OR b.description ~~* '%Élinton Sanches%'::text OR b.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                            WHEN b.description ~~* '%Rodrigo Assunção%'::text OR b.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                            WHEN b.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                            WHEN b.description ~~* '%Tatiana Araújo%'::text OR b.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                            WHEN b.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END AS professor,
                        CASE
                            WHEN b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text THEN 'INDIVIDUAL'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text THEN 'DUPLA'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text THEN 'TRIO'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text THEN 'GRUPO'::text
                            WHEN b.booking_type = 'clase_suelta'::text THEN 'INDIVIDUAL'::text
                            ELSE 'GRUPO'::text
                        END AS booking_class_type,
                    count(*) AS bookings_count
                   FROM mt_booking_participantes p
                     JOIN mt_bookings b ON b.booking_id = p.booking_id
                  WHERE b.status = 'ACTIVE'::text AND b.booking_type = 'clase_colectiva'::text AND b.description !~~* '%RESERVA MENSAL%'::text
                  GROUP BY p.customer_code, (date_trunc('month'::text, b.booking_date::timestamp with time zone)::date), (EXTRACT(isodow FROM b.booking_date)), b.start_time, (
                        CASE
                            WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'::text
                            WHEN p.customer_code = '000815'::text OR p.customer_code = '000475'::text AND b.booking_date >= '2026-07-01'::date AND b.booking_date <= '2026-07-31'::date OR b.description ~~* '%João Assunção%'::text OR b.description ~~* '%Joao Assuncao%'::text OR b.description ~~* '%Joao Assunção%'::text OR b.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                            WHEN b.description ~~* '%Elinton Sanches%'::text OR b.description ~~* '%Eliton Sanches%'::text OR b.description ~~* '%Élinton Sanches%'::text OR b.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                            WHEN b.description ~~* '%Rodrigo Assunção%'::text OR b.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                            WHEN b.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                            WHEN b.description ~~* '%Tatiana Araújo%'::text OR b.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                            WHEN b.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END), (
                        CASE
                            WHEN b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text THEN 'INDIVIDUAL'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text THEN 'DUPLA'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text THEN 'TRIO'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text THEN 'GRUPO'::text
                            WHEN b.booking_type = 'clase_suelta'::text THEN 'INDIVIDUAL'::text
                            ELSE 'GRUPO'::text
                        END)
                ), schedules_with_weights AS (
                 SELECT schedules.customer_code,
                    schedules.plan_month,
                    schedules.day_of_week,
                    schedules.start_time,
                    schedules.professor,
                    schedules.booking_class_type,
                    schedules.bookings_count,
                        CASE
                            WHEN schedules.booking_class_type = 'INDIVIDUAL'::text THEN 720
                            WHEN schedules.booking_class_type = 'DUPLA'::text THEN 430
                            WHEN schedules.booking_class_type = 'TRIO'::text THEN 395
                            ELSE 335
                        END *
                        CASE
                            WHEN schedules.customer_code = '000602'::text THEN schedules.bookings_count
                            ELSE 1::bigint
                        END AS schedule_weight
                   FROM schedules
                ), schedules_coverage AS (
                 SELECT s.customer_code,
                    s.plan_month,
                    s.day_of_week,
                    s.start_time,
                    s.professor,
                    s.booking_class_type,
                    s.bookings_count,
                    s.schedule_weight,
                    (EXISTS ( SELECT 1
                           FROM plan_items p
                          WHERE p.customer_code = s.customer_code AND p.plan_month = s.plan_month AND p.plan_class_type = s.booking_class_type)) AS is_schedule_covered
                   FROM schedules_with_weights s
                ), schedules_with_sums AS (
                 SELECT schedules_coverage.customer_code,
                    schedules_coverage.plan_month,
                    schedules_coverage.day_of_week,
                    schedules_coverage.start_time,
                    schedules_coverage.professor,
                    schedules_coverage.booking_class_type,
                    schedules_coverage.bookings_count,
                    schedules_coverage.schedule_weight,
                    schedules_coverage.is_schedule_covered,
                    sum(schedules_coverage.schedule_weight) OVER (PARTITION BY schedules_coverage.customer_code, schedules_coverage.plan_month, schedules_coverage.booking_class_type) AS sum_weight_of_type,
                    sum(schedules_coverage.schedule_weight) OVER (PARTITION BY schedules_coverage.customer_code, schedules_coverage.plan_month) AS sum_weight_total,
                    sum(
                        CASE
                            WHEN NOT schedules_coverage.is_schedule_covered THEN schedules_coverage.schedule_weight
                            ELSE 0::bigint
                        END) OVER (PARTITION BY schedules_coverage.customer_code, schedules_coverage.plan_month) AS sum_weight_uncovered
                   FROM schedules_coverage
                ), schedule_allocations AS (
                 SELECT s.customer_code,
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
                    p.plan_class_type = s.booking_class_type AS is_type_match,
                    max(
                        CASE
                            WHEN p.plan_class_type = s.booking_class_type THEN 1
                            ELSE 0
                        END) OVER (PARTITION BY p.item_key) = 1 AS has_type_match
                   FROM schedules_with_sums s
                     JOIN plan_items p ON p.customer_code = s.customer_code AND p.plan_month = s.plan_month
                ), schedule_totals AS (
                 SELECT schedule_allocations.customer_code,
                    schedule_allocations.plan_month,
                    schedule_allocations.day_of_week,
                    schedule_allocations.start_time,
                    schedule_allocations.professor,
                    schedule_allocations.booking_class_type,
                    schedule_allocations.bookings_count,
                    sum(
                        CASE
                            WHEN schedule_allocations.has_type_match THEN
                            CASE
                                WHEN schedule_allocations.is_type_match THEN schedule_allocations.valor_faturamento * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_of_type)
                                ELSE 0::numeric
                            END
                            ELSE
                            CASE
                                WHEN schedule_allocations.sum_weight_uncovered > 0::numeric THEN
                                CASE
                                    WHEN NOT schedule_allocations.is_schedule_covered THEN schedule_allocations.valor_faturamento * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_uncovered)
                                    ELSE 0::numeric
                                END
                                ELSE schedule_allocations.valor_faturamento * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_total)
                            END
                        END) AS schedule_monthly_value,
                    sum(
                        CASE
                            WHEN schedule_allocations.has_type_match THEN
                            CASE
                                WHEN schedule_allocations.is_type_match THEN
                                CASE
                                    WHEN schedule_allocations.is_socio THEN schedule_allocations.valor_bruto
                                    ELSE schedule_allocations.valor_faturamento
                                END * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_of_type)
                                ELSE 0::numeric
                            END
                            ELSE
                            CASE
                                WHEN schedule_allocations.sum_weight_uncovered > 0::numeric THEN
                                CASE
                                    WHEN NOT schedule_allocations.is_schedule_covered THEN
                                    CASE
WHEN schedule_allocations.is_socio THEN schedule_allocations.valor_bruto
ELSE schedule_allocations.valor_faturamento
                                    END * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_uncovered)
                                    ELSE 0::numeric
                                END
                                ELSE
                                CASE
                                    WHEN schedule_allocations.is_socio THEN schedule_allocations.valor_bruto
                                    ELSE schedule_allocations.valor_faturamento
                                END * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_total)
                            END
                        END) AS schedule_monthly_commission_base,
                    COALESCE(schedule_allocations.paid, false) AS is_paid,
                    max(
                        CASE
                            WHEN
                            CASE
                                WHEN schedule_allocations.has_type_match THEN
                                CASE
                                    WHEN schedule_allocations.is_type_match THEN schedule_allocations.valor_faturamento
                                    ELSE 0::numeric
                                END
                                ELSE
                                CASE
                                    WHEN schedule_allocations.sum_weight_uncovered > 0::numeric THEN
                                    CASE
WHEN NOT schedule_allocations.is_schedule_covered THEN schedule_allocations.valor_faturamento
ELSE 0::numeric
                                    END
                                    ELSE schedule_allocations.valor_faturamento
                                END
                            END > 0::numeric THEN schedule_allocations.pay_date
                            ELSE NULL::timestamp without time zone
                        END) AS pay_date,
                    bool_or(schedule_allocations.is_socio) AS is_socio,
                    sum(
                        CASE
                            WHEN schedule_allocations.has_type_match THEN
                            CASE
                                WHEN schedule_allocations.is_type_match THEN schedule_allocations.valor_faturamento_monthly * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_of_type)
                                ELSE 0::numeric
                            END
                            ELSE
                            CASE
                                WHEN schedule_allocations.sum_weight_uncovered > 0::numeric THEN
                                CASE
                                    WHEN NOT schedule_allocations.is_schedule_covered THEN schedule_allocations.valor_faturamento_monthly * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_uncovered)
                                    ELSE 0::numeric
                                END
                                ELSE schedule_allocations.valor_faturamento_monthly * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_total)
                            END
                        END) AS schedule_monthly_value_monthly,
                    sum(
                        CASE
                            WHEN schedule_allocations.has_type_match THEN
                            CASE
                                WHEN schedule_allocations.is_type_match THEN
                                CASE
                                    WHEN schedule_allocations.is_socio THEN schedule_allocations.valor_bruto_monthly
                                    ELSE schedule_allocations.valor_faturamento_monthly
                                END * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_of_type)
                                ELSE 0::numeric
                            END
                            ELSE
                            CASE
                                WHEN schedule_allocations.sum_weight_uncovered > 0::numeric THEN
                                CASE
                                    WHEN NOT schedule_allocations.is_schedule_covered THEN
                                    CASE
WHEN schedule_allocations.is_socio THEN schedule_allocations.valor_bruto_monthly
ELSE schedule_allocations.valor_faturamento_monthly
                                    END * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_uncovered)
                                    ELSE 0::numeric
                                END
                                ELSE
                                CASE
                                    WHEN schedule_allocations.is_socio THEN schedule_allocations.valor_bruto_monthly
                                    ELSE schedule_allocations.valor_bruto_monthly
                                END * (schedule_allocations.schedule_weight::numeric / schedule_allocations.sum_weight_total)
                            END
                        END) AS schedule_monthly_commission_base_monthly,
                    bool_or(schedule_allocations.is_avulsa) AS is_avulsa,
                    bool_or(schedule_allocations.is_avulsa_grupo_fixo) AS is_avulsa_grupo_fixo
                   FROM schedule_allocations
                  GROUP BY schedule_allocations.customer_code, schedule_allocations.plan_month, schedule_allocations.day_of_week, schedule_allocations.start_time, schedule_allocations.professor, schedule_allocations.booking_class_type, schedule_allocations.bookings_count, schedule_allocations.paid
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
                            WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'::text
                            WHEN p.customer_code = '000815'::text OR p.customer_code = '000475'::text AND b.booking_date >= '2026-07-01'::date AND b.booking_date <= '2026-07-31'::date OR b.description ~~* '%Julio Souza%'::text OR b.description ~~* '%João Assunção%'::text OR b.description ~~* '%Joao Assuncao%'::text OR b.description ~~* '%Joao Assunção%'::text OR b.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                            WHEN b.description ~~* '%Elinton Sanches%'::text OR b.description ~~* '%Eliton Sanches%'::text OR b.description ~~* '%Élinton Sanches%'::text OR b.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                            WHEN b.description ~~* '%Rodrigo Assunção%'::text OR b.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                            WHEN b.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                            WHEN b.description ~~* '%Tatiana Araújo%'::text OR b.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                            WHEN b.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END, lcm.professor, 'Sem professor'::text) AS professor,
                    p.customer_code,
                    COALESCE(( SELECT c.name
                           FROM mt_clientes c
                          WHERE c.customer_code = p.customer_code
                         LIMIT 1), p.participant_name) AS participant_name,
                        CASE
                            WHEN b.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.payment_value, 0::numeric)
                            ELSE COALESCE(st.schedule_monthly_value / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
                        END AS booking_value,
                        CASE
                            WHEN b.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.payment_value_comissao, 0::numeric)
                            ELSE COALESCE(st.schedule_monthly_commission_base / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
                        END AS booking_commission_base,
                    COALESCE(lcm.is_socio, st.is_socio, false) AS is_socio_benefit,
                        CASE
                            WHEN b.booking_type = 'clase_suelta'::text THEN COALESCE(lcm.is_paid, false)
                            ELSE COALESCE(st.is_paid, false)
                        END AS is_paid,
                        CASE
                            WHEN b.booking_type = 'clase_suelta'::text THEN lcm.pay_date
                            ELSE st.pay_date
                        END AS pay_date,
                        CASE
                            WHEN b.booking_type = 'clase_colectiva'::text THEN COALESCE(st.schedule_monthly_value_monthly / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
                            ELSE 0::numeric
                        END AS booking_value_monthly,
                        CASE
                            WHEN b.booking_type = 'clase_colectiva'::text THEN COALESCE(st.schedule_monthly_commission_base_monthly / NULLIF(st.bookings_count, 0)::numeric, 0::numeric)
                            ELSE 0::numeric
                        END AS booking_commission_base_monthly,
                        CASE
                            WHEN b.booking_type = 'clase_suelta'::text THEN true
                            ELSE COALESCE(st.is_avulsa, false)
                        END AS is_avulsa,
                        CASE
                            WHEN b.booking_type = 'clase_colectiva'::text THEN false
                            ELSE COALESCE(st.is_avulsa_grupo_fixo, false)
                        END AS is_avulsa_grupo_fixo
                   FROM mt_booking_participantes p
                     JOIN mt_bookings b ON b.booking_id = p.booking_id
                     LEFT JOIN loose_class_matches lcm ON lcm.booking_id = b.booking_id AND lcm.customer_code = p.customer_code
                     LEFT JOIN schedule_totals st ON b.booking_type = 'clase_colectiva'::text AND st.customer_code = p.customer_code AND st.plan_month = date_trunc('month'::text, b.booking_date::timestamp with time zone)::date AND st.day_of_week = EXTRACT(isodow FROM b.booking_date) AND st.start_time = b.start_time AND st.booking_class_type =
                        CASE
                            WHEN b.description ~ '\(\s*\d+\s*/\s*1\s*\)'::text THEN 'INDIVIDUAL'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*2\s*\)'::text THEN 'DUPLA'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*3\s*\)'::text THEN 'TRIO'::text
                            WHEN b.description ~ '\(\s*\d+\s*/\s*[456789]\d*\s*\)'::text THEN 'GRUPO'::text
                            WHEN b.booking_type = 'clase_suelta'::text THEN 'INDIVIDUAL'::text
                            ELSE 'GRUPO'::text
                        END AND st.professor =
                        CASE
                            WHEN b.booking_id = 4725 THEN 'Rodrigo Assunção'::text
                            WHEN p.customer_code = '000815'::text OR p.customer_code = '000475'::text AND b.booking_date >= '2026-07-01'::date AND b.booking_date <= '2026-07-31'::date OR b.description ~~* '%Julio Souza%'::text OR b.description ~~* '%João Assunção%'::text OR b.description ~~* '%Joao Assuncao%'::text OR b.description ~~* '%Joao Assunção%'::text OR b.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                            WHEN b.description ~~* '%Elinton Sanches%'::text OR b.description ~~* '%Eliton Sanches%'::text OR b.description ~~* '%Élinton Sanches%'::text OR b.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                            WHEN b.description ~~* '%Rodrigo Assunção%'::text OR b.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                            WHEN b.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                            WHEN b.description ~~* '%Tatiana Araújo%'::text OR b.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                            WHEN b.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                            ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
                        END
                  WHERE b.status = 'ACTIVE'::text AND (b.booking_type = ANY (ARRAY['clase_colectiva'::text, 'clase_suelta'::text])) AND b.description !~~* '%RESERVA MENSAL%'::text
                ), unallocated_payments AS (
                 SELECT rf.item_key,
                    rf.customer_code,
                    rf.pay_date,
                    rf.data_venda,
                    rf.valor_faturamento,
                    rf.valor_bruto,
                    rf.description,
                    rf.paid,
                    rf.is_avulsa,
                    rf.is_avulsa_grupo_fixo,
                    COALESCE(
                        CASE
                            WHEN rf.customer_code = '000815'::text OR rf.customer_code = '000475'::text AND (rf.pay_date >= '2026-07-01 00:00:00'::timestamp without time zone AND rf.pay_date < '2026-08-01 00:00:00'::timestamp without time zone OR rf.description ~~* '%15/07/2026%'::text) OR rf.description ~~* '%João Assunção%'::text OR rf.description ~~* '%Joao Assuncao%'::text OR rf.description ~~* '%Joao Assunção%'::text OR rf.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                            WHEN rf.description ~~* '%Rodrigo Assunção%'::text OR rf.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                            WHEN rf.description ~~* '%Leandro Bonete%'::text OR rf.description ~~* '%Leandro B.%'::text THEN 'Leandro Bonete'::text
                            WHEN rf.description ~~* '%Tatiana Araújo%'::text OR rf.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                            WHEN rf.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                            WHEN rf.description ~~* '%Elinton Sanches%'::text OR rf.description ~~* '%Eliton Sanches%'::text OR rf.description ~~* '%Élinton Sanches%'::text OR rf.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                            ELSE NULL::text
                        END,
                        CASE
                            WHEN rf.is_avulsa THEN 'Sem professor'::text
                            ELSE NULL::text
                        END, ( SELECT prof.professor
                           FROM ( SELECT DISTINCT ON (p_sub.customer_code) p_sub.customer_code,
                                    COALESCE(
CASE
 WHEN b_sub.booking_id = 4725 THEN 'Rodrigo Assunção'::text
 WHEN p_sub.customer_code = '000815'::text OR p_sub.customer_code = '000475'::text AND b_sub.booking_date >= '2026-07-01'::date AND b_sub.booking_date <= '2026-07-31'::date THEN 'João Assunção'::text
 WHEN b_sub.description ~~* '%Elinton Sanches%'::text OR b_sub.description ~~* '%Eliton Sanches%'::text OR b_sub.description ~~* '%Élinton Sanches%'::text OR b_sub.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
 WHEN b_sub.description ~~* '%Rodrigo Assunção%'::text OR b_sub.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
 WHEN b_sub.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
 WHEN b_sub.description ~~* '%Tatiana Araújo%'::text OR b_sub.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
 WHEN b_sub.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
 ELSE NULLIF(TRIM(BOTH FROM regexp_replace(COALESCE("substring"(b_sub.description, '(?i)prof[:.]?[[:space:]]*([^.(]+)'::text), ''::text), '[[:space:]]+'::text, ' '::text, 'g'::text)), ''::text)
END, 'Sem professor'::text) AS professor
                                   FROM mt_booking_participantes p_sub
                                     JOIN mt_bookings b_sub ON b_sub.booking_id = p_sub.booking_id
                                  WHERE p_sub.customer_code = rf.customer_code AND b_sub.status = 'ACTIVE'::text AND b_sub.booking_type = 'clase_colectiva'::text
                                  ORDER BY p_sub.customer_code, (abs(b_sub.booking_date - COALESCE(rf.pay_date, rf.data_venda::timestamp without time zone)::date))) prof), 'Sem professor'::text) AS professor,
                    COALESCE(( SELECT c.name
                           FROM mt_clientes c
                          WHERE c.customer_code = rf.customer_code
                         LIMIT 1), 'Cliente Desconhecido'::text) AS participant_name
                   FROM resolved_faturamento rf
                  WHERE NOT (EXISTS ( SELECT 1
                           FROM final_bookings fb
                          WHERE fb.customer_code = rf.customer_code AND date_trunc('month'::text, fb.booking_date::timestamp with time zone) = date_trunc('month'::text, COALESCE(rf.pay_date, rf.data_venda::timestamp without time zone)))) AND NOT (EXISTS ( SELECT 1
                           FROM loose_class_matches lcm
                          WHERE lcm.item_key = rf.item_key)) AND rf.item_canceled = false AND rf.sale_canceled = false AND COALESCE(rf.sale_type, ''::text) <> 'refund'::text AND rf.valor_faturamento > 0::numeric AND (rf.categoria = 'Aulas'::text OR rf.categoria = 'Outros'::text AND rf.description ~~* '%TÊNIS%'::text AND rf.description ~~* '%ADULTO%'::text)
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
                    COALESCE(up.pay_date, up.data_venda::timestamp without time zone)::date AS booking_date,
                    false AS is_socio_benefit,
                    up.paid AS is_paid,
                    up.pay_date,
                    0::numeric AS booking_value_monthly,
                    0::numeric AS booking_commission_base_monthly,
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
                    c.booking_value_monthly / 2.0 AS booking_value_monthly,
                    c.booking_commission_base_monthly / 2.0 AS booking_commission_base_monthly,
                    c.is_avulsa,
                    c.is_avulsa_grupo_fixo,
                    c.start_time,
                    c.booking_value / 2.0 AS booking_value,
                    c.booking_commission_base / 2.0 AS booking_commission_base,
                    c.booking_type,
                    c.participant_name,
                    c.venue,
                    c.resource_name,
                    c.description,
                    'Leandro Bonete'::text AS professor,
                    c.customer_code
                   FROM all_combined c
                  WHERE EXTRACT(isodow FROM c.booking_date) = 6::numeric AND c.start_time = '10:00:00'::time without time zone AND c.professor = 'Leandro Bonete'::text
                UNION ALL
                 SELECT c.booking_id,
                    c.booking_date,
                    c.is_socio_benefit,
                    c.is_paid,
                    c.pay_date,
                    c.booking_value_monthly / 2.0 AS booking_value_monthly,
                    c.booking_commission_base_monthly / 2.0 AS booking_commission_base_monthly,
                    c.is_avulsa,
                    c.is_avulsa_grupo_fixo,
                    c.start_time,
                    c.booking_value / 2.0 AS booking_value,
                    c.booking_commission_base / 2.0 AS booking_commission_base,
                    c.booking_type,
                    c.participant_name,
                    c.venue,
                    c.resource_name,
                    c.description,
                    'Elinton Sanches'::text AS professor,
                    c.customer_code
                   FROM all_combined c
                  WHERE EXTRACT(isodow FROM c.booking_date) = 6::numeric AND c.start_time = '10:00:00'::time without time zone AND c.professor = 'Leandro Bonete'::text
                ), pre_result AS (
                 SELECT all_combined.booking_id,
                    all_combined.booking_date,
                    all_combined.is_socio_benefit,
                    all_combined.is_paid,
                    all_combined.pay_date,
                    all_combined.booking_value_monthly,
                    all_combined.booking_commission_base_monthly,
                    all_combined.is_avulsa,
                    all_combined.is_avulsa_grupo_fixo,
                    all_combined.start_time,
                    all_combined.booking_value,
                    all_combined.booking_commission_base,
                    all_combined.booking_type,
                    all_combined.participant_name,
                    all_combined.venue,
                    all_combined.resource_name,
                    all_combined.description,
                    all_combined.professor,
                    all_combined.customer_code
                   FROM all_combined
                  WHERE NOT (EXTRACT(isodow FROM all_combined.booking_date) = 6::numeric AND all_combined.start_time = '10:00:00'::time without time zone AND all_combined.professor = 'Leandro Bonete'::text)
                UNION ALL
                 SELECT kids_saturday_split.booking_id,
                    kids_saturday_split.booking_date,
                    kids_saturday_split.is_socio_benefit,
                    kids_saturday_split.is_paid,
                    kids_saturday_split.pay_date,
                    kids_saturday_split.booking_value_monthly,
                    kids_saturday_split.booking_commission_base_monthly,
                    kids_saturday_split.is_avulsa,
                    kids_saturday_split.is_avulsa_grupo_fixo,
                    kids_saturday_split.start_time,
                    kids_saturday_split.booking_value,
                    kids_saturday_split.booking_commission_base,
                    kids_saturday_split.booking_type,
                    kids_saturday_split.participant_name,
                    kids_saturday_split.venue,
                    kids_saturday_split.resource_name,
                    kids_saturday_split.description,
                    kids_saturday_split.professor,
                    kids_saturday_split.customer_code
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
            pre_result.schedule_monthly_value_monthly AS booking_value_monthly,
            pre_result.schedule_monthly_commission_base_monthly AS booking_commission_base_monthly,
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