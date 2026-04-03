import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, VideoOff } from 'lucide-react';

function ParticipantTile({
  participant,
  label,
  registerVideoContainer,
  showLiveBadge = false,
  className = '',
  compact = false,
}) {
  const participantId = participant?.userId;

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl bg-gray-900 ${className}`}>
      {participantId ? (
        <div
          ref={(element) => registerVideoContainer(participantId, element)}
          className="absolute inset-0 h-full w-full"
        />
      ) : null}

      {!participant?.bVideoOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <div className={`${compact ? 'h-12 w-12' : 'h-20 w-20'} rounded-full bg-gray-800 flex items-center justify-center`}>
            {participant ? (
              <User className={`${compact ? 'h-6 w-6' : 'h-10 w-10'} text-gray-400`} />
            ) : (
              <VideoOff className={`${compact ? 'h-6 w-6' : 'h-10 w-10'} text-gray-400`} />
            )}
          </div>
          <div>
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-white`}>
              {participant?.displayName || label || 'Aguardando participante'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {participant ? 'Camera desligada' : 'Entrando na sala segura'}
            </p>
          </div>
        </div>
      )}

      {showLiveBadge && (
        <div className="absolute left-3 top-3">
          <Badge className="bg-red-500 text-white text-xs animate-pulse">AO VIVO</Badge>
        </div>
      )}

      <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {label || participant?.displayName || 'Participante'}
      </div>
    </div>
  );
}

export default function ZoomVideoStage({
  participants,
  currentUserId,
  isConnecting,
  isConnected,
  registerVideoContainer,
  selfLabel,
  remoteLabel,
}) {
  const currentParticipant = participants.find((participant) => participant.userId === currentUserId) || null;
  const remoteParticipants = participants.filter((participant) => participant.userId !== currentUserId);
  const featuredParticipant = remoteParticipants[0] || currentParticipant;
  const extraRemoteCount = Math.max(remoteParticipants.length - 1, 0);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gray-900 shadow-2xl shadow-black/20">
      <ParticipantTile
        participant={featuredParticipant}
        label={featuredParticipant?.userId === currentUserId ? selfLabel : remoteLabel}
        registerVideoContainer={registerVideoContainer}
        showLiveBadge={isConnected}
      />

      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full bg-gray-950/80 px-4 py-2 text-sm text-white">
            <Loader2 className="h-4 w-4 animate-spin" />
            Conectando a consulta
          </div>
        </div>
      )}

      {currentParticipant && featuredParticipant?.userId !== currentParticipant.userId && (
        <div className="absolute bottom-4 right-4 h-24 w-36 rounded-xl border-2 border-gray-700 bg-gray-950/80 shadow-lg">
          <ParticipantTile
            participant={currentParticipant}
            label={selfLabel}
            registerVideoContainer={registerVideoContainer}
            compact
          />
        </div>
      )}

      {extraRemoteCount > 0 && (
        <div className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          +{extraRemoteCount} participante{extraRemoteCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
