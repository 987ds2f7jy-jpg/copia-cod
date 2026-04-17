import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { getHomeBannersRequest } from '@/client-api/homeBanners';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

const FALLBACK_BANNERS = [
  {
    id: 'fallback-home-hero',
    title: 'Banner principal',
    altText: 'Medica sorrindo',
    imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=1440&h=1680&fit=crop',
    sortOrder: 0,
    desktopOnly: true,
    focalPoint: {
      x: 0.5,
      y: 0.5,
    },
  },
];

function getObjectPosition(banner) {
  const x = Math.max(0, Math.min(1, Number(banner?.focalPoint?.x ?? 0.5)));
  const y = Math.max(0, Math.min(1, Number(banner?.focalPoint?.y ?? 0.5)));

  return `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
}

export default function HomeHeroCarousel() {
  const [api, setApi] = React.useState(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isAutoPlayPaused, setIsAutoPlayPaused] = React.useState(false);
  const { data, isLoading, isFetched } = useQuery({
    queryKey: ['home-banners', 'hero'],
    queryFn: getHomeBannersRequest,
    staleTime: 15 * 60 * 1000,
  });

  const resolvedBanners = Array.isArray(data) && data.length > 0 ? data : null;
  const shouldShowFallback = isFetched && !resolvedBanners;
  const banners = resolvedBanners ?? (shouldShowFallback ? FALLBACK_BANNERS : []);
  const hasMultipleBanners = banners.length > 1;

  React.useEffect(() => {
    if (!api) {
      return undefined;
    }

    const syncSelectedIndex = () => {
      setSelectedIndex(api.selectedScrollSnap());
    };

    syncSelectedIndex();
    api.on('select', syncSelectedIndex);
    api.on('reInit', syncSelectedIndex);

    return () => {
      api.off('select', syncSelectedIndex);
      api.off('reInit', syncSelectedIndex);
    };
  }, [api]);

  React.useEffect(() => {
    if (!api || !hasMultipleBanners || isAutoPlayPaused) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      api.scrollNext();
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [api, hasMultipleBanners, isAutoPlayPaused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsAutoPlayPaused(true)}
      onMouseLeave={() => setIsAutoPlayPaused(false)}
      onFocusCapture={() => setIsAutoPlayPaused(true)}
      onBlurCapture={() => setIsAutoPlayPaused(false)}
    >
      <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-emerald-50">
        {isLoading && banners.length === 0 ? (
          <div className="relative aspect-[6/7] w-full overflow-hidden bg-gradient-to-br from-emerald-100 via-white to-teal-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.18),transparent_34%)]" />
            <div className="absolute inset-0 animate-pulse bg-white/20" aria-hidden="true" />
          </div>
        ) : (
          <Carousel
            setApi={setApi}
            opts={{
              loop: hasMultipleBanners,
              align: 'start',
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-0">
              {banners.map((banner, index) => (
                <CarouselItem key={banner.id} className="pl-0">
                  <div className="aspect-[6/7] w-full overflow-hidden">
                    <img
                      src={banner.imageUrl}
                      alt={banner.altText || banner.title || 'Banner da home'}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: getObjectPosition(banner) }}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      draggable={false}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        )}

        {hasMultipleBanners && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4">
              <button
                type="button"
                onClick={() => api?.scrollPrev()}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg transition hover:bg-white"
                aria-label="Banner anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => api?.scrollNext()}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg transition hover:bg-white"
                aria-label="Proximo banner"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/45 px-3 py-2 backdrop-blur-sm">
              {banners.map((banner, index) => {
                const isActive = selectedIndex === index;

                return (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => api?.scrollTo(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      isActive ? 'w-7 bg-white' : 'w-2.5 bg-white/55 hover:bg-white/80'
                    }`}
                    aria-label={`Ir para banner ${index + 1}`}
                    aria-pressed={isActive}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">500+ Profissionais</p>
          <p className="text-sm text-gray-500">Verificados e ativos</p>
        </div>
      </div>
    </div>
  );
}
