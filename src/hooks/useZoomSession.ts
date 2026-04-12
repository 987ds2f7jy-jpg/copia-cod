import { useCallback, useEffect, useRef, useState } from 'react';
import ZoomVideo, { VideoQuality } from '@zoom/videosdk';
import { requestZoomToken } from '@/client-api/teleconsulta';
import { logUiWarning, serializeError } from '@/lib/observability';

export interface ZoomParticipant {
  userId: number;
  displayName: string;
  bVideoOn?: boolean;
  isHost?: boolean;
}

export interface ZoomChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isSelf: boolean;
}

interface UseZoomSessionOptions {
  consultationId: string;
  participantRole: 'professional' | 'patient';
  userId: string;
  userName: string;
}

interface ZoomSessionState {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  participants: ZoomParticipant[];
  chatMessages: ZoomChatMessage[];
  currentUserId: number | null;
  sessionName: string | null;
}

interface ZoomTokenResponse {
  signature: string;
  sessionName: string;
  sessionKey: string;
  userIdentity: string;
  userName: string;
}

function buildChatMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
  return new Promise<T>((resolve, reject) => {
    const timerId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timerId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timerId);
        reject(error);
      });
  });
}

function getZoomConnectionErrorMessage(error: unknown) {
  const rawMessage = String(
    (error as any)?.context?.statusText ||
    (error as any)?.message ||
    error ||
    '',
  ).toLowerCase();
  const statusCode = (error as any)?.context?.status;

  if (statusCode === 409 || rawMessage.includes('409') || rawMessage.includes('consulta indisponivel')) {
    return 'Esta consulta ja foi encerrada e nao aceita nova conexao de video.';
  }

  if (
    statusCode === 404 ||
    rawMessage.includes('404') ||
    rawMessage.includes('not found') ||
    rawMessage.includes('edge function') ||
    rawMessage.includes('functions/v1/zoom-token')
  ) {
    return 'Servico de video ainda nao publicado. Publique a funcao zoom-token no backend.';
  }

  if (rawMessage.includes('403') || rawMessage.includes('forbidden')) {
    return 'Acesso negado ao token da consulta. Verifique se este usuario pertence a esta consulta.';
  }

  if (
    statusCode === 401 ||
    rawMessage.includes('401') ||
    rawMessage.includes('invalid jwt') ||
    rawMessage.includes('sessao autenticada obrigatoria')
  ) {
    return 'Sua sessao expirou ou ficou invalida. Entre novamente para continuar a consulta.';
  }

  if (rawMessage.includes('tempo limite') || rawMessage.includes('timeout')) {
    return 'A conexao com a sala segura demorou demais para responder. Tente novamente.';
  }

  return 'Erro ao conectar na consulta por video.';
}

export function useZoomSession({
  consultationId,
  participantRole,
  userId,
  userName,
}: UseZoomSessionOptions) {
  const clientRef = useRef<any>(null);
  const videoElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const listenersRef = useRef<Array<{ event: string; handler: (...args: any[]) => void }>>([]);

  const [state, setState] = useState<ZoomSessionState>({
    isConnecting: false,
    isConnected: false,
    error: null,
    participants: [],
    chatMessages: [],
    currentUserId: null,
    sessionName: null,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const updateState = useCallback((patch: Partial<ZoomSessionState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const ensureVideoPlayer = useCallback((host: HTMLElement) => {
    let playerContainer = host.querySelector('video-player-container') as HTMLElement | null;

    if (!playerContainer) {
      playerContainer = document.createElement('video-player-container');
      playerContainer.style.display = 'block';
      playerContainer.style.width = '100%';
      playerContainer.style.height = '100%';
      host.appendChild(playerContainer);
    }

    let player = playerContainer.querySelector('video-player') as HTMLElement | null;

    if (!player) {
      player = document.createElement('video-player');
      player.style.display = 'block';
      player.style.width = '100%';
      player.style.height = '100%';
      player.style.aspectRatio = '16 / 9';
      playerContainer.appendChild(player);
    }

    return player;
  }, []);

  const fetchToken = useCallback(async () => {
    return requestZoomToken({
      consultationId,
      participantRole,
      userName,
    }) as Promise<ZoomTokenResponse>;
  }, [consultationId, participantRole, userName]);

  const getClientParticipants = useCallback((client: any): ZoomParticipant[] => {
    const users = client.getAllUser?.() ?? [];

    return users.map((participant: any) => ({
      userId: participant.userId,
      displayName: participant.displayName || participant.userName || 'Participante',
      bVideoOn: Boolean(participant.bVideoOn),
      isHost: Boolean(participant.isHost),
    }));
  }, []);

  const renderVideo = useCallback(
    async (client: any, targetUserId: number, attempt = 0) => {
      const container = videoElementsRef.current.get(targetUserId);

      if (!container) {
        if (attempt < 10) {
          window.setTimeout(() => {
            void renderVideo(client, targetUserId, attempt + 1);
          }, 200);
        }
        return;
      }

      try {
        const mediaStream = client.getMediaStream();
        const playerElement = ensureVideoPlayer(container);
        const attachedVideo = await mediaStream.attachVideo(
          targetUserId,
          VideoQuality.Video_360P,
          playerElement,
        );

        if (attachedVideo instanceof HTMLElement) {
          if (attachedVideo !== playerElement && !container.contains(attachedVideo)) {
            container.innerHTML = '';
            attachedVideo.style.width = '100%';
            attachedVideo.style.height = '100%';
            attachedVideo.style.objectFit = 'cover';
            container.appendChild(attachedVideo);
          }
        }
      } catch (error) {
        logUiWarning('zoom', {
          stage: 'render-video',
          targetUserId,
          error: serializeError(error),
        });
      }
    },
    [ensureVideoPlayer],
  );

  const stopVideo = useCallback(async (client: any, targetUserId: number) => {
    try {
      const container = videoElementsRef.current.get(targetUserId);
      const mediaStream = client.getMediaStream();
      const playerElement =
        (container?.querySelector('video-player') as HTMLElement | null) ?? undefined;
      const elements = await mediaStream.detachVideo(targetUserId, playerElement);

      if (Array.isArray(elements)) {
        elements.forEach((element: any) => element?.remove?.());
      } else {
        elements?.remove?.();
      }

      if (container) {
        container.innerHTML = '';
      }
    } catch (error) {
      logUiWarning('zoom', {
        stage: 'stop-video',
        targetUserId,
        error: serializeError(error),
      });
    }
  }, []);

  const syncParticipants = useCallback((client: any) => {
    updateState({
      participants: getClientParticipants(client),
      currentUserId: client.getCurrentUserInfo?.()?.userId ?? null,
    });
  }, [getClientParticipants, updateState]);

  const clearListeners = useCallback(() => {
    const client = clientRef.current;

    if (!client?.off) {
      listenersRef.current = [];
      return;
    }

    listenersRef.current.forEach(({ event, handler }) => {
      client.off(event, handler);
    });
    listenersRef.current = [];
  }, []);

  const registerVideoContainer = useCallback((targetUserId: number, element: HTMLDivElement | null) => {
    if (!element) {
      videoElementsRef.current.delete(targetUserId);
      return;
    }

    videoElementsRef.current.set(targetUserId, element);

    const client = clientRef.current;
    if (!client) {
      return;
    }

    const participant = client.getAllUser?.().find((item: any) => item.userId === targetUserId);
    if (participant?.bVideoOn) {
      void renderVideo(client, targetUserId);
    }
  }, [renderVideo]);

  const sendChatMessage = useCallback(async (text: string) => {
    const client = clientRef.current;
    const trimmed = text.trim();

    if (!client || !trimmed) {
      return;
    }

    try {
      const chatClient = client.getChatClient?.();
      const sendMessage =
        chatClient?.sendToAll ??
        chatClient?.sendChatToAll ??
        chatClient?.sendMessageToAll;

      if (typeof sendMessage !== 'function') {
        throw new Error('Chat do Zoom indisponivel nesta sessao.');
      }

      await sendMessage.call(chatClient, trimmed);

      setState((current) => ({
        ...current,
        chatMessages: [
          ...current.chatMessages,
          {
            id: buildChatMessageId(),
            sender: userName,
            text: trimmed,
            timestamp: new Date(),
            isSelf: true,
          },
        ],
      }));
    } catch (error) {
      updateState({ error: 'Nao foi possivel enviar a mensagem no chat.' });
      logUiWarning('zoom', {
        stage: 'chat-send',
        error: serializeError(error),
      });
      throw error;
    }
  }, [updateState, userName]);

  const join = useCallback(async () => {
    if (!consultationId || !userId || !userName) {
      return;
    }

    if (clientRef.current && state.isConnected) {
      return;
    }

    try {
      updateState({
        isConnecting: true,
        error: null,
        chatMessages: [],
      });

      const client = ZoomVideo.createClient();
      clientRef.current = client;

      await client.init('pt-BR', 'Global', {
        patchJsMedia: true,
        enforceMultipleVideos: true,
      });

      const token = await fetchToken();
      await withTimeout(
        client.join(token.sessionName, token.signature, token.userName),
        20000,
        'Tempo limite ao conectar com a sala segura do Zoom.',
      );

      const mediaStream = client.getMediaStream();

      try {
        await mediaStream.startAudio();
      } catch (audioError) {
        logUiWarning('zoom', {
          stage: 'audio-start',
          error: serializeError(audioError),
        });
      }

      setIsMuted(Boolean(mediaStream.isAudioMuted?.()));

      try {
        await mediaStream.startVideo();
        setIsCameraOn(true);
      } catch (videoError) {
        setIsCameraOn(false);
        logUiWarning('zoom', {
          stage: 'video-start',
          error: serializeError(videoError),
        });
      }

      updateState({
        isConnected: true,
        error: null,
        sessionName: token.sessionName,
      });

      syncParticipants(client);

      getClientParticipants(client).forEach((participant) => {
        if (participant.bVideoOn) {
          void renderVideo(client, participant.userId);
        }
      });

      const handleUsersChanged = () => {
        syncParticipants(client);
      };

      const handleUserUpdated = (payload: any) => {
        const updatedUsers = Array.isArray(payload) ? payload : [payload];

        updatedUsers.forEach((participant: any) => {
          if (!participant?.userId) {
            return;
          }

          if (participant.bVideoOn) {
            void renderVideo(client, participant.userId);
          } else {
            void stopVideo(client, participant.userId);
          }
        });

        syncParticipants(client);
      };

      const handleChatMessage = (payload: any) => {
        const senderId = payload?.senderId ?? payload?.userId ?? payload?.from;
        const messageText = payload?.message ?? payload?.text ?? payload?.content ?? '';

        if (!messageText) {
          return;
        }

        setState((current) => {
          if (
            senderId != null &&
            current.currentUserId != null &&
            Number(senderId) === Number(current.currentUserId)
          ) {
            return current;
          }

          const now = Date.now();
          const isDuplicate = current.chatMessages.some((message) =>
            message.text === messageText &&
            Math.abs(now - message.timestamp.getTime()) < 2000,
          );

          if (isDuplicate) {
            return current;
          }

          return {
            ...current,
            chatMessages: [
              ...current.chatMessages,
              {
                id: buildChatMessageId(),
                sender: payload?.senderName || payload?.displayName || payload?.userName || 'Participante',
                text: messageText,
                timestamp: new Date(),
                isSelf: false,
              },
            ],
          };
        });
      };

      client.on('user-added', handleUsersChanged);
      client.on('user-removed', handleUsersChanged);
      client.on('user-updated', handleUserUpdated);
      client.on('chat-on-message', handleChatMessage);

      listenersRef.current = [
        { event: 'user-added', handler: handleUsersChanged },
        { event: 'user-removed', handler: handleUsersChanged },
        { event: 'user-updated', handler: handleUserUpdated },
        { event: 'chat-on-message', handler: handleChatMessage },
      ];
    } catch (error) {
      clientRef.current = null;
      updateState({
        isConnected: false,
        error: getZoomConnectionErrorMessage(error),
      });
      logUiWarning('zoom', {
        stage: 'join-session',
        consultationId,
        error: serializeError(error),
      });
    } finally {
      updateState({ isConnecting: false });
    }
  }, [
    consultationId,
    fetchToken,
    getClientParticipants,
    renderVideo,
    state.isConnected,
    stopVideo,
    syncParticipants,
    updateState,
    userId,
    userName,
  ]);

  const leave = useCallback(async () => {
    const client = clientRef.current;

    clearListeners();

    if (client) {
      try {
        const participants = client.getAllUser?.() ?? [];
        await Promise.allSettled(participants.map((participant: any) => stopVideo(client, participant.userId)));
        await client.leave();
      } catch (error) {
        logUiWarning('zoom', {
          stage: 'leave-session',
          error: serializeError(error),
        });
      } finally {
        clientRef.current = null;
      }
    }

    videoElementsRef.current.clear();
    setState({
      isConnecting: false,
      isConnected: false,
      error: null,
      participants: [],
      chatMessages: [],
      currentUserId: null,
      sessionName: null,
    });
    setIsMuted(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
  }, [clearListeners, stopVideo]);

  const toggleMute = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    const mediaStream = client.getMediaStream();

    try {
      if (mediaStream.isAudioMuted?.()) {
        await mediaStream.unmuteAudio();
        setIsMuted(false);
        return;
      }

      await mediaStream.muteAudio();
      setIsMuted(true);
    } catch (error) {
      updateState({ error: 'Nao foi possivel alternar o microfone.' });
      logUiWarning('zoom', {
        stage: 'toggle-mute',
        error: serializeError(error),
      });
    }
  }, [updateState]);

  const toggleCamera = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    const mediaStream = client.getMediaStream();
    const currentUserId = client.getCurrentUserInfo?.()?.userId;

    try {
      if (isCameraOn) {
        await mediaStream.stopVideo();
        setIsCameraOn(false);

        if (currentUserId) {
          await stopVideo(client, currentUserId);
        }
      } else {
        await mediaStream.startVideo();
        setIsCameraOn(true);

        if (currentUserId) {
          await renderVideo(client, currentUserId);
        }
      }

      syncParticipants(client);
    } catch (error) {
      updateState({ error: 'Nao foi possivel alternar a camera.' });
      logUiWarning('zoom', {
        stage: 'toggle-camera',
        error: serializeError(error),
      });
    }
  }, [isCameraOn, renderVideo, stopVideo, syncParticipants, updateState]);

  const toggleScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    const mediaStream = client.getMediaStream();

    try {
      if (isScreenSharing) {
        await mediaStream.stopShareScreen?.();
        setIsScreenSharing(false);
      } else {
        await mediaStream.startShareScreen?.();
        setIsScreenSharing(true);
      }
    } catch (error) {
      updateState({ error: 'Nao foi possivel compartilhar a tela.' });
      logUiWarning('zoom', {
        stage: 'toggle-screen-share',
        error: serializeError(error),
      });
    }
  }, [isScreenSharing, updateState]);

  useEffect(() => {
    return () => {
      void leave();
    };
  }, [leave]);

  return {
    ...state,
    isMuted,
    isCameraOn,
    isScreenSharing,
    join,
    leave,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    sendChatMessage,
    registerVideoContainer,
  };
}
