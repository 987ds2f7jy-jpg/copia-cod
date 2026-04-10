export async function searchMapboxPlaces({ query, token, limit = 5 }) {
  const normalizedQuery = String(query || '').trim();
  const normalizedToken = String(token || '').trim();

  if (!normalizedQuery || normalizedQuery.length < 3 || !normalizedToken) {
    return [];
  }

  const params = new URLSearchParams({
    country: 'BR',
    language: 'pt',
    access_token: normalizedToken,
    limit: String(limit),
  });
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Nao foi possivel buscar o endereco no mapa.');
  }

  const data = await response.json();
  return Array.isArray(data?.features) ? data.features : [];
}
