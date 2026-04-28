import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Images } from 'lucide-react';

export default function ProfileGallery({ gallery_urls }) {
  const [lightbox, setLightbox] = useState(null); // index or null

  if (!gallery_urls || gallery_urls.length === 0) return null;

  const prev = () => setLightbox(i => (i > 0 ? i - 1 : gallery_urls.length - 1));
  const next = () => setLightbox(i => (i < gallery_urls.length - 1 ? i + 1 : 0));

  return (
    <>
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Images className="w-5 h-5 text-muted-foreground" />
          Galeria
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {gallery_urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setLightbox(i)}
              className="aspect-square rounded-xl overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85" onClick={() => setLightbox(null)}>
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); prev(); }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <img
            src={gallery_urls[lightbox]}
            alt={`Foto ${lightbox + 1}`}
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); next(); }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightbox + 1} / {gallery_urls.length}
          </p>
        </div>
      )}
    </>
  );
}
