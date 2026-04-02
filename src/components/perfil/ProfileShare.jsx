import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, X, Printer, MessageCircle, Instagram } from 'lucide-react';

// Tiny QR Code via QR Server API (no npm needed)
function QRCode({ url, size = 200 }) {
  const encoded = encodeURIComponent(url);
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=ffffff&color=065f46&margin=10`}
      alt="QR Code do perfil"
      className="rounded-xl border border-gray-200"
      width={size}
      height={size}
    />
  );
}

export default function ProfileShare({ professional, profileUrl }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const printRef = useRef(null);

  const url = profileUrl || window.location.href;
  const name = professional?.full_name || 'Profissional';
  const prefix = professional?.profession === 'Medicina' ? 'Dr(a). ' : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`Confira o perfil de ${prefix}${name} na Rápido Doutor: ${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR Code - ${prefix}${name}</title>
      <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
        img { max-width: 300px; }
        h2 { color: #065f46; font-size: 20px; margin-top: 16px; }
        p { color: #6b7280; font-size: 14px; }
      </style></head>
      <body>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=065f46&margin=15" />
        <h2>${prefix}${name}</h2>
        <p>${professional?.specialty || ''}</p>
        <p style="font-size:11px;color:#9ca3af;margin-top:8px;">${url}</p>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body></html>
    `);
    win.document.close();
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Compartilhar</span>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative" onClick={e => e.stopPropagation()}>
        <button onClick={() => setOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Compartilhar Perfil</h2>
        <p className="text-sm text-gray-500 mb-5">{prefix}{name}</p>

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          <QRCode url={url} size={180} />
        </div>

        {/* URL copy */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 truncate">
            {url}
          </div>
          <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleWhatsApp} className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2 text-gray-700 border-gray-200 hover:bg-gray-50">
            <Printer className="w-4 h-4" />
            Imprimir QR
          </Button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Compartilhe este link ou imprima o QR Code para seu consultório
        </p>
      </div>
    </div>
  );
}