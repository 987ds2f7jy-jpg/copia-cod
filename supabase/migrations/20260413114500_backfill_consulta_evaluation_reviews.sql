BEGIN;

INSERT INTO public.reviews (
  professional_id,
  patient_id,
  patient_name,
  rating,
  comment,
  appointment_id
)
SELECT
  ap.professional_id,
  ev.paciente_id,
  coalesce(au.full_name, au.email, 'Paciente'),
  ev.nota,
  coalesce(ev.comentario, ''),
  ap.id::TEXT
FROM public.avaliacao_consulta AS ev
JOIN public.appointments AS ap
  ON trim(coalesce(ap.consulta_id, '')) = trim(coalesce(ev.consulta_id, ''))
LEFT JOIN public.app_users AS au
  ON trim(coalesce(au.id::TEXT, '')) = trim(coalesce(ev.paciente_id, ''))
WHERE trim(coalesce(ap.professional_id, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.reviews AS r
    WHERE trim(coalesce(r.appointment_id, '')) = trim(ap.id::TEXT)
      AND trim(coalesce(r.patient_id, '')) = trim(coalesce(ev.paciente_id, ''))
  );

WITH review_stats AS (
  SELECT
    professional_id,
    round(avg(rating)::numeric, 1) AS average_rating,
    count(*)::integer AS total_reviews
  FROM public.reviews
  WHERE trim(coalesce(professional_id, '')) <> ''
  GROUP BY professional_id
)
UPDATE public.professional_profiles AS p
SET rating = rs.average_rating,
    total_reviews = rs.total_reviews
FROM review_stats AS rs
WHERE trim(coalesce(p.id::TEXT, '')) = trim(coalesce(rs.professional_id, ''));

WITH review_stats AS (
  SELECT
    professional_id,
    round(avg(rating)::numeric, 1) AS average_rating,
    count(*)::integer AS total_reviews
  FROM public.reviews
  WHERE trim(coalesce(professional_id, '')) <> ''
  GROUP BY professional_id
)
UPDATE public.professional_public_profiles AS p
SET rating = rs.average_rating,
    total_reviews = rs.total_reviews
FROM review_stats AS rs
WHERE trim(coalesce(p.professional_profile_id, '')) = trim(coalesce(rs.professional_id, ''));

COMMIT;
