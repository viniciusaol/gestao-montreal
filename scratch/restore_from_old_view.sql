DROP VIEW IF EXISTS public.vw_mt_faturamento_por_hora_ocupada CASCADE;
DROP VIEW IF EXISTS public.vw_mt_comissoes_detalhadas CASCADE;

CREATE VIEW public.vw_mt_comissoes_detalhadas AS
SELECT * FROM public.vw_mt_comissoes_detalhadas_old;

CREATE VIEW public.vw_mt_faturamento_por_hora_ocupada AS
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
            b.start_time,
            b.end_time,
            b.venue,
            b.resource_name,
            b.description,
            b.booking_type,
            b.status,
                CASE
                    WHEN b.description ~~* '%João Assunção%'::text OR b.description ~~* '%Joao Assuncao%'::text OR b.description ~~* '%Joao Assunção%'::text OR b.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                    WHEN b.description ~~* '%Rodrigo Assunção%'::text OR b.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                    WHEN b.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                    WHEN b.description ~~* '%Tatiana Araújo%'::text OR b.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                    WHEN b.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                    WHEN b.description ~~* '%Elinton Sanches%'::text OR b.description ~~* '%Eliton Sanches%'::text OR b.description ~~* '%Élinton Sanches%'::text OR b.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                    ELSE NULL::text
                END AS professor,
                CASE
                    WHEN b.booking_type = 'clase_suelta'::text THEN 'Aula Avulsa'::text
                    WHEN b.description ~~* '%AULA AVULSA%'::text THEN 'Aula Avulsa'::text
                    WHEN b.description ~~* '%RESERVA DE QUADRA%'::text THEN 'Locação'::text
                    WHEN
                    CASE
                        WHEN b.description ~~* '%João Assunção%'::text OR b.description ~~* '%Joao Assuncao%'::text OR b.description ~~* '%Joao Assunção%'::text OR b.description ~~* '%João Assuncao%'::text THEN 'João Assunção'::text
                        WHEN b.description ~~* '%Rodrigo Assunção%'::text OR b.description ~~* '%Rodrigo Assuncao%'::text THEN 'Rodrigo Assunção'::text
                        WHEN b.description ~~* '%Leandro Bonete%'::text THEN 'Leandro Bonete'::text
                        WHEN b.description ~~* '%Tatiana Araújo%'::text OR b.description ~~* '%Tatiana Araujo%'::text THEN 'Tatiana Araújo'::text
                        WHEN b.description ~~* '%Leciane Silva%'::text THEN 'Leciane Silva'::text
                        WHEN b.description ~~* '%Elinton Sanches%'::text OR b.description ~~* '%Eliton Sanches%'::text OR b.description ~~* '%Élinton Sanches%'::text OR b.description ~~* '%Éliton Sanches%'::text THEN 'Elinton Sanches'::text
                        ELSE NULL::text
                    END IS NOT NULL THEN 'Aula Mensal'::text
                    WHEN COALESCE(p.qtd_participantes, 0::bigint) > 0 THEN 'Outras Aulas'::text
                    ELSE 'Locação / Outros'::text
                END AS categoria_booking,
            COALESCE(p.qtd_participantes, 0::bigint) AS qtd_participantes,
            COALESCE(p.qtd_clientes_unicos, 0::bigint) AS qtd_clientes_unicos
           FROM mt_bookings b
             LEFT JOIN participantes_por_booking p ON p.booking_id = b.booking_id
          WHERE b.status = 'ACTIVE'::text
        ), faturamento_avulso AS (
         SELECT c.booking_id,
            c.booking_date,
            date_trunc('month'::text, c.booking_date::timestamp with time zone)::date AS mes,
            to_char(date_trunc('month'::text, c.booking_date::timestamp with time zone), 'YYYY-MM'::text) AS ano_mes,
            60 AS duration_minutes,
            c.venue,
            c.resource_name,
            c.description,
            c.professor,
            'Aula Avulsa'::text AS categoria_booking,
            sum(c.booking_value) AS fat_direto_booking,
            sum(c.booking_commission_base) AS comissao_base_booking
           FROM vw_mt_comissoes_detalhadas c
          WHERE c.booking_type = 'clase_suelta'::text
          GROUP BY c.booking_id, c.booking_date, (date_trunc('month'::text, c.booking_date::timestamp with time zone)::date), (to_char(date_trunc('month'::text, c.booking_date::timestamp with time zone), 'YYYY-MM'::text)), c.venue, c.resource_name, c.description, c.professor
        ), faturamento_mensalidades AS (
         SELECT c.booking_id,
            sum(COALESCE(c.booking_value_monthly, 0::numeric)) AS fat_mensalidade_booking,
            sum(COALESCE(c.booking_commission_base_monthly, 0::numeric)) AS comissao_base_mensalidade_booking
           FROM vw_mt_comissoes_detalhadas c
          WHERE c.booking_type <> 'clase_suelta'::text
          GROUP BY c.booking_id
        ), faturamento_locacoes AS (
         SELECT b.booking_date,
            date_trunc('month'::text, b.booking_date::timestamp with time zone)::date AS mes,
            to_char(date_trunc('month'::text, b.booking_date::timestamp with time zone), 'YYYY-MM'::text) AS ano_mes,
            b.booking_id,
            b.venue,
            b.resource_name,
            b.description,
            b.duration_minutes,
            fi.valor_faturamento AS fat_locacao,
            fi.valor_faturamento AS comissao_base_locacao
           FROM mt_bookings b
             JOIN mt_faturamento_vendas fv ON NOT fv.customer_code IS DISTINCT FROM b.access_code AND fv.pay_date = b.booking_date
             JOIN mt_faturamento_itens fi ON fi.venda_external_id = fv.external_id AND fi.categoria = 'Locação de Quadras'::text
          WHERE b.status = 'ACTIVE'::text AND b.description ~~* '%RESERVA DE QUADRA%'::text AND fi.is_canceled = false AND fv.is_canceled = false
        ), unallocated_fat AS (
         SELECT c.booking_date,
            date_trunc('month'::text, c.booking_date::timestamp with time zone)::date AS mes,
            to_char(date_trunc('month'::text, c.booking_date::timestamp with time zone), 'YYYY-MM'::text) AS ano_mes,
            c.description,
            c.professor,
            sum(c.booking_value) AS fat_direto_unallocated,
            sum(c.booking_commission_base) AS comissao_base_unallocated
           FROM vw_mt_comissoes_detalhadas c
          WHERE c.booking_type = 'unallocated_payment'::text
          GROUP BY c.booking_date, (date_trunc('month'::text, c.booking_date::timestamp with time zone)::date), (to_char(date_trunc('month'::text, c.booking_date::timestamp with time zone), 'YYYY-MM'::text)), c.description, c.professor
        ), bookings_unificados AS (
         SELECT bc.booking_id,
            bc.booking_date,
            bc.mes,
            bc.ano_mes,
            bc.duration_minutes,
            bc.start_time,
            bc.end_time,
            bc.venue,
            bc.resource_name,
            bc.description,
            bc.booking_type,
            bc.status,
            bc.professor,
            bc.categoria_booking,
            bc.qtd_participantes,
            bc.qtd_clientes_unicos,
            COALESCE(fa.fat_direto_booking, 0::numeric) AS fat_direto,
            COALESCE(fa.comissao_base_booking, 0::numeric) AS comissao_base_direta,
            COALESCE(fm.fat_mensalidade_booking, 0::numeric) AS fat_mensalidade,
            COALESCE(fm.comissao_base_mensalidade_booking, 0::numeric) AS comissao_base_mensalidade,
            COALESCE(fl.fat_locacao, 0::numeric) AS fat_locacao,
            COALESCE(fl.comissao_base_locacao, 0::numeric) AS comissao_base_locacao,
            COALESCE(fa.fat_direto_booking, 0::numeric) + COALESCE(fm.fat_mensalidade_booking, 0::numeric) + COALESCE(fl.fat_locacao, 0::numeric) AS faturamento_total_booking,
            COALESCE(fa.comissao_base_booking, 0::numeric) + COALESCE(fm.comissao_base_mensalidade_booking, 0::numeric) + COALESCE(fl.comissao_base_locacao, 0::numeric) AS comissao_base_total_booking
           FROM bookings_classificados bc
             LEFT JOIN faturamento_avulso fa ON fa.booking_id = bc.booking_id
             LEFT JOIN faturamento_mensalidades fm ON fm.booking_id = bc.booking_id
             LEFT JOIN faturamento_locacoes fl ON fl.booking_id = bc.booking_id
        UNION ALL
         SELECT NULL::integer AS booking_id,
            uf.booking_date,
            uf.mes,
            uf.ano_mes,
            60 AS duration_minutes,
            NULL::time without time zone AS start_time,
            NULL::time without time zone AS end_time,
            'Venda Avulsa sem Agendamento'::text AS venue,
            NULL::text AS resource_name,
            uf.description,
            'unallocated_payment'::text AS booking_type,
            'ACTIVE'::text AS status,
            uf.professor,
            'Aula Avulsa (Sem Agendamento)'::text AS categoria_booking,
            1 AS qtd_participantes,
            1 AS qtd_clientes_unicos,
            uf.fat_direto_unallocated AS fat_direto,
            uf.comissao_base_unallocated AS comissao_base_direta,
            0::numeric AS fat_mensalidade,
            0::numeric AS comissao_base_mensalidade,
            0::numeric AS fat_locacao,
            0::numeric AS comissao_base_locacao,
            uf.fat_direto_unallocated AS faturamento_total_booking,
            uf.comissao_base_unallocated AS comissao_base_total_booking
           FROM unallocated_fat uf
        )
 SELECT booking_id,
    booking_date,
    mes,
    ano_mes,
    duration_minutes,
    duration_minutes::numeric / 60.0 AS horas_ocupadas,
    start_time,
    end_time,
    venue,
    resource_name,
    description,
    booking_type,
    status,
    professor,
    categoria_booking,
    qtd_participantes,
    qtd_clientes_unicos,
    fat_direto,
    comissao_base_direta,
    fat_mensalidade,
    comissao_base_mensalidade,
    fat_locacao,
    comissao_base_locacao,
    faturamento_total_booking,
    comissao_base_total_booking,
        CASE
            WHEN duration_minutes > 0 THEN faturamento_total_booking / (duration_minutes::numeric / 60.0)
            ELSE 0::numeric
        END AS faturamento_por_hora,
        CASE
            WHEN duration_minutes > 0 THEN comissao_base_total_booking / (duration_minutes::numeric / 60.0)
            ELSE 0::numeric
        END AS comissao_base_por_hora
   FROM bookings_unificados bu
