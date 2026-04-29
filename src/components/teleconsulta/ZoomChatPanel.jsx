import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';

export default function ZoomChatPanel({ messages, onSend, disabled = false }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();

    if (!trimmed || disabled || isSending) {
      return;
    }

    try {
      setIsSending(true);
      await onSend(trimmed);
      setText('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-card text-foreground dark:bg-gray-900 dark:text-white">
      <ScrollArea className="flex-1 min-h-0 px-3">
        <div className="space-y-3 py-3">
          {messages.length === 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground dark:text-gray-400">
              O chat da consulta aparece aqui em tempo real.
            </p>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.isSelf ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  message.isSelf
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-foreground dark:bg-gray-100 dark:text-gray-800'
                }`}
              >
                {!message.isSelf && (
                  <p className="mb-1 text-xs font-medium opacity-70">{message.sender}</p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                <p className={`mt-1 text-xs ${message.isSelf ? 'text-emerald-100' : 'text-muted-foreground dark:text-gray-400'}`}>
                  {format(message.timestamp, 'HH:mm')}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 dark:border-gray-800">
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            className="min-h-[40px] resize-none text-sm max-h-24 bg-background dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            rows={1}
            disabled={disabled || isSending}
          />
          <Button
            size="icon"
            className="shrink-0 self-end bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void handleSend()}
            disabled={disabled || !text.trim() || isSending}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
