import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'read-home-banners';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};
const BUCKET_NAME = 'home-banners';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

type HomeBannerRecord = {
  id: string;
  title: string;
  alt_text: string;
  storage_path: string;
  sort_order: number | null;
  desktop_only: boolean | null;
  focal_x: number | null;
  focal_y: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

function isBannerActiveNow(banner: HomeBannerRecord, nowMs: number) {
  const startsAtMs = banner.starts_at ? Date.parse(banner.starts_at) : Number.NaN;
  const endsAtMs = banner.ends_at ? Date.parse(banner.ends_at) : Number.NaN;
  const startsOk = Number.isNaN(startsAtMs) || startsAtMs <= nowMs;
  const endsOk = Number.isNaN(endsAtMs) || endsAtMs >= nowMs;

  return startsOk && endsOk;
}

async function createSignedBanner(client: ReturnType<typeof createServiceRoleClient>, banner: HomeBannerRecord) {
  const normalizedPath = String(banner.storage_path || '').trim().replace(/^\/+/, '');

  if (!normalizedPath) {
    return null;
  }

  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn(`[${FUNCTION_NAME}] banner:sign-failed`, {
      bannerId: banner.id,
      path: normalizedPath,
      error: error?.message || 'missing signed URL',
    });
    return null;
  }

  return {
    id: banner.id,
    title: banner.title || '',
    altText: banner.alt_text || banner.title || 'Banner da home',
    imageUrl: data.signedUrl,
    sortOrder: Number(banner.sort_order ?? 0),
    desktopOnly: banner.desktop_only !== false,
    focalPoint: {
      x: typeof banner.focal_x === 'number' ? banner.focal_x : 0.5,
      y: typeof banner.focal_y === 'number' ? banner.focal_y : 0.5,
    },
  };
}

async function handleReadHomeBannersRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from('home_banners')
      .select('id, title, alt_text, storage_path, sort_order, desktop_only, focal_x, focal_y, starts_at, ends_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError({
        status: 500,
        code: 'HOME_BANNERS_READ_FAILED',
        message: 'Unable to load home banners.',
        details: error.message,
      });
    }

    const nowMs = Date.now();
    const activeBanners = (Array.isArray(data) ? data : [])
      .filter((banner) => isBannerActiveNow(banner as HomeBannerRecord, nowMs));

    const signedBanners = (await Promise.all(
      activeBanners.map((banner) => createSignedBanner(client, banner as HomeBannerRecord)),
    )).filter(Boolean);

    return successResponse({
      banners: signedBanners,
    }, requestId, {
      status: 200,
      cors: CORS,
    });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

Deno.serve(handleReadHomeBannersRequest);
