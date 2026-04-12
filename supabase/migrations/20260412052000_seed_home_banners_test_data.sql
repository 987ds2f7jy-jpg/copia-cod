DELETE FROM public.home_banners
WHERE storage_path IN (
  'hero/consultas-online-com-profissionais-qualificados.webp',
  'hero/app-em-breve-rapido-doutor-nutricao.webp',
  'hero/saude-digital-para-empresas-e-municipios.webp'
);

INSERT INTO public.home_banners (
  title,
  alt_text,
  storage_path,
  sort_order,
  is_active,
  desktop_only,
  focal_x,
  focal_y
)
VALUES
  (
    'Consultas online com profissionais qualificados',
    'Banner com medico segurando celular e chamada de video em notebook',
    'hero/consultas-online-com-profissionais-qualificados.webp',
    1,
    true,
    true,
    0.5,
    0.5
  ),
  (
    'App em breve Rápido Doutor Nutrição',
    'Banner do aplicativo de nutricao com nutricionistas e celular em destaque',
    'hero/app-em-breve-rapido-doutor-nutricao.webp',
    2,
    true,
    true,
    0.5,
    0.5
  ),
  (
    'Saúde digital para empresas e municípios',
    'Banner institucional com equipe medica e oferta para empresas e municipios',
    'hero/saude-digital-para-empresas-e-municipios.webp',
    3,
    true,
    true,
    0.5,
    0.5
  );
