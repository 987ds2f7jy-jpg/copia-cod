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

interface PendingOutgoingMessage {
  id: string;
  text: string;
  sentAt: number;
}

interface ZoomRenderSurface {
  mode: 'attach' | 'legacy-canvas' | 'legacy-video';
  element: HTMLElement;
  host: HTMLDivElement;
  mount: HTMLDivElement;
  resizeObserver?: ResizeObserver;
}

const CHAT_DEDUPLICATION_WINDOW_MS = 5000;

function buildChatMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeChatText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeChatTimestamp(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return Date.now();
  }

  return numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
}

function isLikelyMobileZoomClient() {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent || '';
  const isTouchMac = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;

  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) || isTouchMac;
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
  const currentUserIdRef = useRef<number | null>(null);
  const pendingOutgoingMessagesRef = useRef<PendingOutgoingMessage[]>([]);
  const seenIncomingMessageIdsRef = useRef<Set<string>>(new Set());
  const recentIncomingMessagesRef = useRef<Array<{ signature: string; timestamp: number }>>([]);
  const renderSurfacesRef = useRef<Map<number, ZoomRenderSurface>>(new Map());
  // Per-participant serialization includes cleanup; leave drains it before SDK reuse.
  const surfaceJobsRef = useRef(new Map<number, Promise<void>>());
  const surfaceTimersRef = useRef(new Map<number, number>());
  const renderOwnersRef = useRef(new Map<number, object>());
  const leavingRef = useRef<Promise<void> | null>(null);
  const joiningRef = useRef<Promise<void> | null>(null);
  const cameraJobRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

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
  const [prefersSingleVideoLayout, setPrefersSingleVideoLayout] = useState(false);

  const updateState = useCallback((patch: Partial<ZoomSessionState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const enqueueSurface = useCallback((id: number, operation: () => Promise<void>) => {
    const previous = surfaceJobsRef.current.get(id) ?? Promise.resolve();
    const job = previous.then(operation).catch((error) => {
      logUiWarning('zoom', { stage: 'video-lifecycle', error: serializeError(error) });
    });
    surfaceJobsRef.current.set(id, job);
    void job.then(() => {
      if (surfaceJobsRef.current.get(id) === job) surfaceJobsRef.current.delete(id);
    });
    return job;
  }, []);

  const cancelSurfaceTimer = useCallback((id: number) => {
    window.clearTimeout(surfaceTimersRef.current.get(id));
    surfaceTimersRef.current.delete(id);
  }, []);

  const getContainerDimensions = useCallback((host: HTMLElement) => {
    return {
      width: Math.max(Math.round(host.clientWidth || 0), 1),
      height: Math.max(Math.round(host.clientHeight || 0), 1),
    };
  }, []);

  const createLegacyRenderElement = useCallback((
    host: HTMLDivElement,
    useVideoElement: boolean,
    isSelfView: boolean,
  ) => {
    if (useVideoElement) {
      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = isSelfView;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.style.display = 'block';
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      host.appendChild(videoElement);

      return {
        mode: 'legacy-video' as const,
        element: videoElement,
      };
    }

    const canvasElement = document.createElement('canvas');
    const { width, height } = getContainerDimensions(host);
    canvasElement.width = width;
    canvasElement.height = height;
    canvasElement.style.display = 'block';
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';
    host.appendChild(canvasElement);

    return {
      mode: 'legacy-canvas' as const,
      element: canvasElement,
    };
  }, [getContainerDimensions]);

  const ensureVideoPlayer = useCallback((host: HTMLElement) => {
    let playerContainer = host.querySelector('video-player-container') as HTMLElement | null;

    if (!playerContainer) {
      playerContainer = document.createElement('video-player-container');
      playerContainer.style.display = 'block';
      playerContainer.style.position = 'relative';
      playerContainer.style.width = '100%';
      playerContainer.style.height = '100%';
      playerContainer.style.overflow = 'hidden';
      host.appendChild(playerContainer);
    }

    let player = playerContainer.querySelector('video-player') as HTMLElement | null;

    if (!player) {
      player = document.createElement('video-player');
      player.style.display = 'block';
      player.style.position = 'absolute';
      player.style.top = '0';
      player.style.right = '0';
      player.style.bottom = '0';
      player.style.left = '0';
      player.style.width = '100%';
      player.style.height = '100%';
      playerContainer.appendChild(player);
    }

    return {
      playerContainer,
      player,
    };
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

  const releaseRenderSurface = useCallback(async (client: any, targetUserId: number) => {
    const existingSurface = renderSurfacesRef.current.get(targetUserId);
    const mediaStream = client.getMediaStream?.();

    if (!existingSurface || !mediaStream) {
      return;
    }

    try {
      if (existingSurface.mode === 'attach') {
        const detached = await mediaStream.detachVideo(targetUserId, existingSurface.element as any);

        if (Array.isArray(detached)) {
          detached.forEach((element: any) => element?.remove?.());
        } else {
          detached?.remove?.();
        }
      } else {
        await mediaStream.stopRenderVideo?.(existingSurface.element as any, targetUserId);
      }
    } catch (error) {
      logUiWarning('zoom', {
        stage: 'release-video-surface',
        targetUserId,
        error: serializeError(error),
      });
    } finally {
      existingSurface.resizeObserver?.disconnect?.();
      const parent = existingSurface.element.parentElement;
      existingSurface.element.remove();
      if (parent?.tagName === 'VIDEO-PLAYER-CONTAINER' && !parent.childElementCount) parent.remove();
      existingSurface.mount.remove();
      if (renderSurfacesRef.current.get(targetUserId) === existingSurface) {
        renderSurfacesRef.current.delete(targetUserId);
      }
    }
  }, []);

  const attachSurface = useCallback(
    async (client: any, targetUserId: number, isCurrent: () => boolean) => {
      const host = videoElementsRef.current.get(targetUserId);

      if (!host) {
        return;
      }

      const existingSurface = renderSurfacesRef.current.get(targetUserId);
      if (existingSurface && existingSurface.host === host) {
        return;
      }

      const mediaStream = client.getMediaStream();
      const supportsMultipleVideos = mediaStream.isSupportMultipleVideos?.() !== false;
      const shouldUseLegacyRender = isLikelyMobileZoomClient() || !supportsMultipleVideos;
      const isSelfView =
        currentUserIdRef.current != null &&
        Number(targetUserId) === Number(currentUserIdRef.current);
      const preferredQuality = shouldUseLegacyRender ? VideoQuality.Video_180P : VideoQuality.Video_360P;

      if (existingSurface) {
        await releaseRenderSurface(client, targetUserId);
      }
      if (!isCurrent()) return;
      // React may reuse one host for another participant. Own a separate mount,
      // never query/clear a different participant's children during delayed cleanup.
      const container = document.createElement('div');
      container.style.width = '100%';
      container.style.height = '100%';
      host.appendChild(container);

      if (shouldUseLegacyRender && mediaStream.renderVideo) {
        let legacyElement: HTMLElement | undefined;
        try {
          const useVideoElement = Boolean(
            isSelfView && mediaStream.isRenderSelfViewWithVideoElement?.(),
          );
          const legacySurface = createLegacyRenderElement(container, useVideoElement, isSelfView);
          legacyElement = legacySurface.element;

          if (legacySurface.mode === 'legacy-video') {
            const result = await mediaStream.renderVideo(
              legacySurface.element as HTMLVideoElement,
              targetUserId,
              undefined,
              undefined,
              undefined,
              undefined,
              preferredQuality,
            );

            if (result instanceof Error) {
              throw result;
            }

            renderSurfacesRef.current.set(targetUserId, {
              ...legacySurface,
              host,
              mount: container,
            });
            return;
          }

          const canvasElement = legacySurface.element as HTMLCanvasElement;
          const { width, height } = getContainerDimensions(container);

          canvasElement.width = width;
          canvasElement.height = height;

          const result = await mediaStream.renderVideo(
            canvasElement,
            targetUserId,
            width,
            height,
            0,
            0,
            preferredQuality,
          );

          if (result instanceof Error) {
            throw result;
          }

          let resizeObserver: ResizeObserver | undefined;

          if (isCurrent() && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver((entries) => {
              const entry = entries[0];
              if (!entry || !isCurrent()) {
                return;
              }

              const nextWidth = Math.max(Math.round(entry.contentRect.width || 0), 1);
              const nextHeight = Math.max(Math.round(entry.contentRect.height || 0), 1);

              canvasElement.width = nextWidth;
              canvasElement.height = nextHeight;
              mediaStream.updateVideoCanvasDimension?.(canvasElement, nextWidth, nextHeight);
              mediaStream.adjustRenderedVideoPosition?.(
                canvasElement,
                targetUserId,
                nextWidth,
                nextHeight,
                0,
                0,
              );
            });

            resizeObserver.observe(container);
          }

          renderSurfacesRef.current.set(targetUserId, {
            ...legacySurface,
            host,
            mount: container,
            resizeObserver,
          });
          return;
        } catch (legacyError) {
          legacyElement?.remove();
          logUiWarning('zoom', {
            stage: 'render-video-legacy',
            targetUserId,
            error: serializeError(legacyError),
          });
        }
      }
      if (!isCurrent()) { container.remove(); return; }

      try {
        const { playerContainer, player } = ensureVideoPlayer(container);
        const attachedVideo = await mediaStream.attachVideo(
          targetUserId,
          preferredQuality,
          player,
        );

        if (!(attachedVideo instanceof HTMLElement)) {
          throw attachedVideo;
        }

        attachedVideo.style.width = '100%';
        attachedVideo.style.height = '100%';
        attachedVideo.style.objectFit = 'cover';

        if (attachedVideo !== player) {
          player.remove();
          if (isCurrent()) playerContainer.appendChild(attachedVideo);
        }

        renderSurfacesRef.current.set(targetUserId, {
          mode: 'attach',
          element: attachedVideo,
          host,
          mount: container,
        });
      } catch (primaryError) {
        if (!isCurrent()) { container.remove(); return; }
        try {
          const attachedVideo = await mediaStream.attachVideo(
            targetUserId,
            preferredQuality,
          );

          if (!(attachedVideo instanceof HTMLElement)) {
            throw attachedVideo;
          }
          if (!isCurrent()) {
            renderSurfacesRef.current.set(targetUserId, { mode: 'attach', element: attachedVideo, host, mount: container });
            return;
          }

          const { playerContainer, player } = ensureVideoPlayer(container);
          if (player !== attachedVideo) player.remove();
          attachedVideo.style.width = '100%';
          attachedVideo.style.height = '100%';
          attachedVideo.style.objectFit = 'cover';
          playerContainer.appendChild(attachedVideo);

          renderSurfacesRef.current.set(targetUserId, {
            mode: 'attach',
            element: attachedVideo,
            host,
            mount: container,
          });
        } catch (fallbackError) {
          container.remove();
          logUiWarning('zoom', {
            stage: 'render-video',
            targetUserId,
            error: serializeError(primaryError),
            fallbackError: serializeError(fallbackError),
          });
        }
      }
    },
    [
      createLegacyRenderElement,
      ensureVideoPlayer,
      getContainerDimensions,
      releaseRenderSurface,
    ],
  );

  const renderVideo = useCallback(function requestRender(client: ReturnType<typeof ZoomVideo.createClient>, id: number, attempt = 0): Promise<void> {
    const host = videoElementsRef.current.get(id);
    const generation = generationRef.current;
    if (!host || clientRef.current !== client) return Promise.resolve();
    const owner = renderOwnersRef.current.get(id) ?? {};
    renderOwnersRef.current.set(id, owner);
    cancelSurfaceTimer(id);
    return enqueueSurface(id, async () => {
      const isCurrent = () => (
        generationRef.current === generation &&
        clientRef.current === client &&
        videoElementsRef.current.get(id) === host &&
        renderOwnersRef.current.get(id) === owner
      );
      if (!isCurrent()) return;
      cancelSurfaceTimer(id);
      const { width, height } = getContainerDimensions(host);
      if ((width < 40 || height < 40) && attempt < 12) {
        surfaceTimersRef.current.set(id, window.setTimeout(() => {
          surfaceTimersRef.current.delete(id);
          if (isCurrent()) void requestRender(client, id, attempt + 1);
        }, 150));
        return;
      }
      await attachSurface(client, id, isCurrent);
      // Even an attach that completed after unmount/leave is detached by exact element,
      // before the next operation for this participant is allowed to start.
      if (!isCurrent()) await releaseRenderSurface(client, id);
    });
  }, [attachSurface, cancelSurfaceTimer, enqueueSurface, getContainerDimensions, releaseRenderSurface]);

  const stopVideo = useCallback((client: any, id: number) => {
    renderOwnersRef.current.delete(id);
    cancelSurfaceTimer(id);
    return enqueueSurface(id, () => releaseRenderSurface(client, id));
  }, [cancelSurfaceTimer, enqueueSurface, releaseRenderSurface]);

  const syncParticipants = useCallback((client: any) => {
    const currentUserId = client.getCurrentUserInfo?.()?.userId ?? null;
    currentUserIdRef.current = currentUserId;
    updateState({
      participants: getClientParticipants(client),
      currentUserId,
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
      const client = clientRef.current;
      if (client) {
        void stopVideo(client, targetUserId);
      }
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
  }, [stopVideo, renderVideo]);

  const sendChatMessage = useCallback(async (text: string) => {
    const client = clientRef.current;
    const trimmed = text.trim();
    const optimisticMessageId = buildChatMessageId();
    const sentAt = Date.now();

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

      pendingOutgoingMessagesRef.current = pendingOutgoingMessagesRef.current
        .filter((message) => sentAt - message.sentAt < CHAT_DEDUPLICATION_WINDOW_MS)
        .concat({
          id: optimisticMessageId,
          text: trimmed,
          sentAt,
        });

      setState((current) => ({
        ...current,
        chatMessages: [
          ...current.chatMessages,
          {
            id: optimisticMessageId,
            sender: userName,
            text: trimmed,
            timestamp: new Date(sentAt),
            isSelf: true,
          },
        ],
      }));

      await sendMessage.call(chatClient, trimmed);
    } catch (error) {
      pendingOutgoingMessagesRef.current = pendingOutgoingMessagesRef.current.filter(
        (message) => message.id !== optimisticMessageId,
      );

      setState((current) => ({
        ...current,
        chatMessages: current.chatMessages.filter(
          (message) => message.id !== optimisticMessageId,
        ),
      }));

      updateState({ error: 'Nao foi possivel enviar a mensagem no chat.' });
      logUiWarning('zoom', {
        stage: 'chat-send',
        error: serializeError(error),
      });
      throw error;
    }
  }, [updateState, userName]);

  const joinSession = useCallback(async () => {
    if (!consultationId || !userId || !userName) {
      return;
    }

    if (clientRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    try {
      updateState({
        isConnecting: true,
        error: null,
        chatMessages: [],
      });

      const client = ZoomVideo.createClient();
      clientRef.current = client;

      const prefersSingleVideoHint = isLikelyMobileZoomClient();
      setPrefersSingleVideoLayout(prefersSingleVideoHint);

      await client.init('pt-BR', 'Global', {
        patchJsMedia: true,
        enforceMultipleVideos: !prefersSingleVideoHint,
        leaveOnPageUnload: true,
        stayAwake: true,
      });
      if (generationRef.current !== generation) return;

      const token = await fetchToken();
      if (generationRef.current !== generation) return;
      await withTimeout(
        client.join(token.sessionName, token.signature, token.userName),
        20000,
        'Tempo limite ao conectar com a sala segura do Zoom.',
      );
      if (generationRef.current !== generation) return;

      const mediaStream = client.getMediaStream();
      const supportsMultipleVideos = mediaStream.isSupportMultipleVideos?.() !== false;
      const useSingleVideoLayout = !supportsMultipleVideos || isLikelyMobileZoomClient();
      setPrefersSingleVideoLayout(useSingleVideoLayout);

      try {
        await mediaStream.startAudio();
      } catch (audioError) {
        logUiWarning('zoom', {
          stage: 'audio-start',
          error: serializeError(audioError),
        });
      }
      if (generationRef.current !== generation) return;

      setIsMuted(Boolean(mediaStream.isAudioMuted?.()));

      try {
        await mediaStream.startVideo(
          useSingleVideoLayout
            ? {
                captureWidth: 640,
                captureHeight: 360,
              }
            : undefined,
        );
        if (generationRef.current !== generation) return;
        setIsCameraOn(true);
      } catch (videoError) {
        setIsCameraOn(false);
        logUiWarning('zoom', {
          stage: 'video-start',
          error: serializeError(videoError),
        });
      }
      if (generationRef.current !== generation) return;

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
        const present = new Set(getClientParticipants(client).map((participant) => participant.userId));
        videoElementsRef.current.forEach((_host, id) => {
          if (!present.has(id)) {
            videoElementsRef.current.delete(id);
            void stopVideo(client, id);
          }
        });
        syncParticipants(client);
      };

      const handleUserUpdated = (payload: any) => {
        const updatedUsers = Array.isArray(payload) ? payload : [payload];

        updatedUsers.forEach((participant: any) => {
          if (!participant?.userId) {
            return;
          }

          if (participant.bVideoOn === true) {
            void renderVideo(client, participant.userId);
          } else if (participant.bVideoOn === false) {
            void stopVideo(client, participant.userId);
          }
        });

        syncParticipants(client);
      };

      const handlePeerVideoStateChange = (payload: any) => {
        const changedUserId = Number(payload?.userId);

        if (!Number.isFinite(changedUserId)) {
          return;
        }

        if (payload?.action === 'Start') {
          void renderVideo(client, changedUserId);
        }

        if (payload?.action === 'Stop') {
          void stopVideo(client, changedUserId);
        }

        syncParticipants(client);
      };

      const handleVideoCapturingChange = (payload: any) => {
        const currentUserId = client.getCurrentUserInfo?.()?.userId;

        if (!currentUserId) {
          return;
        }

        if (payload?.state === 'Started') {
          void renderVideo(client, currentUserId);
          return;
        }

        if (payload?.state === 'Stopped' || payload?.state === 'Failed') {
          void stopVideo(client, currentUserId);
        }
      };

      const handleChatMessage = (payload: any) => {
        const messageId = String(payload?.id ?? payload?.msgid ?? '').trim();
        const senderId =
          payload?.sender?.userId ??
          payload?.senderId ??
          payload?.userId ??
          payload?.from ??
          null;
        const messageText = String(
          payload?.message ??
          payload?.text ??
          payload?.content ??
          '',
        ).trim();
        const timestamp = normalizeChatTimestamp(payload?.timestamp);
        const senderName =
          payload?.sender?.name ||
          payload?.senderName ||
          payload?.displayName ||
          payload?.userName ||
          client.getAllUser?.().find((participant: any) => participant.userId === senderId)?.displayName ||
          'Participante';

        if (!messageText) {
          return;
        }

        if (messageId) {
          if (seenIncomingMessageIdsRef.current.has(messageId)) {
            return;
          }

          seenIncomingMessageIdsRef.current.add(messageId);
        }

        const currentUserId = currentUserIdRef.current;
        const normalizedText = normalizeChatText(messageText);
        let matchedOutgoingMessage: PendingOutgoingMessage | null = null;

        pendingOutgoingMessagesRef.current = pendingOutgoingMessagesRef.current.filter((message) => {
          if (timestamp - message.sentAt > CHAT_DEDUPLICATION_WINDOW_MS) {
            return false;
          }

          if (!matchedOutgoingMessage && normalizeChatText(message.text) === normalizedText) {
            matchedOutgoingMessage = message;
            return false;
          }

          return true;
        });

        if (
          matchedOutgoingMessage ||
          (senderId != null && currentUserId != null && Number(senderId) === Number(currentUserId))
        ) {
          return;
        }

        const messageSignature = `${String(senderId ?? senderName).trim() || 'participant'}::${normalizedText}`;
        recentIncomingMessagesRef.current = recentIncomingMessagesRef.current.filter(
          (entry) => timestamp - entry.timestamp < CHAT_DEDUPLICATION_WINDOW_MS,
        );

        if (recentIncomingMessagesRef.current.some((entry) => entry.signature === messageSignature)) {
          return;
        }

        recentIncomingMessagesRef.current.push({
          signature: messageSignature,
          timestamp,
        });

        setState((current) => ({
          ...current,
          chatMessages: [
            ...current.chatMessages,
            {
              id: messageId || buildChatMessageId(),
              sender: senderName,
              text: messageText,
              timestamp: new Date(timestamp),
              isSelf: false,
            },
          ],
        }));
      };

      client.on('user-added', handleUsersChanged);
      client.on('user-removed', handleUsersChanged);
      client.on('user-updated', handleUserUpdated);
      client.on('peer-video-state-change', handlePeerVideoStateChange);
      client.on('video-capturing-change', handleVideoCapturingChange);
      client.on('chat-on-message', handleChatMessage);

      listenersRef.current = [
        { event: 'user-added', handler: handleUsersChanged },
        { event: 'user-removed', handler: handleUsersChanged },
        { event: 'user-updated', handler: handleUserUpdated },
        { event: 'peer-video-state-change', handler: handlePeerVideoStateChange },
        { event: 'video-capturing-change', handler: handleVideoCapturingChange },
        { event: 'chat-on-message', handler: handleChatMessage },
      ];
    } catch (error) {
      if (generationRef.current !== generation) return;
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
      if (generationRef.current === generation) updateState({ isConnecting: false });
    }
  }, [
    consultationId,
    fetchToken,
    getClientParticipants,
    renderVideo,
    stopVideo,
    syncParticipants,
    updateState,
    userId,
    userName,
  ]);

  const join = useCallback(async () => {
    if (leavingRef.current) await leavingRef.current;
    if (!mountedRef.current) return;
    if (joiningRef.current) return joiningRef.current;
    const job = joinSession();
    joiningRef.current = job;
    try { await job; } finally {
      if (joiningRef.current === job) joiningRef.current = null;
    }
  }, [joinSession]);

  const leave = useCallback((): Promise<void> => {
    if (leavingRef.current) return leavingRef.current;
    const client = clientRef.current;

    clearListeners();
    ++generationRef.current;
    clientRef.current = null;
    surfaceTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    surfaceTimersRef.current.clear();
    renderOwnersRef.current.clear();
    videoElementsRef.current.clear();
    currentUserIdRef.current = null;
    pendingOutgoingMessagesRef.current = [];
    seenIncomingMessageIdsRef.current.clear();
    recentIncomingMessagesRef.current = [];
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
    setPrefersSingleVideoLayout(false);
    const job = (async () => {
      await joiningRef.current;
      await cameraJobRef.current;
      await Promise.allSettled([...surfaceJobsRef.current.values()]);
      if (client) {
        await Promise.allSettled([...renderSurfacesRef.current.keys()].map((id) => stopVideo(client, id)));
        try { await client.leave(); } catch (error) {
          logUiWarning('zoom', { stage: 'leave-session', error: serializeError(error) });
        }
      }
    })();
    leavingRef.current = job;
    void job.then(() => { if (leavingRef.current === job) leavingRef.current = null; });
    return job;
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

  const toggleCameraSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }
    const generation = generationRef.current;

    const mediaStream = client.getMediaStream();
    const currentUserId = client.getCurrentUserInfo?.()?.userId;
    const useSingleVideoLayout =
      prefersSingleVideoLayout || mediaStream.isSupportMultipleVideos?.() === false;

    try {
      if (isCameraOn) {
        await mediaStream.stopVideo();
        if (generationRef.current !== generation) return;
        setIsCameraOn(false);

        if (currentUserId) {
          await stopVideo(client, currentUserId);
        }
      } else {
        await mediaStream.startVideo(
          useSingleVideoLayout
            ? {
                captureWidth: 640,
                captureHeight: 360,
              }
            : undefined,
        );
        if (generationRef.current !== generation) return;
        setIsCameraOn(true);

        if (currentUserId) {
          await renderVideo(client, currentUserId);
        }
      }

      if (generationRef.current === generation) syncParticipants(client);
    } catch (error) {
      if (generationRef.current !== generation) return;
      updateState({ error: 'Nao foi possivel alternar a camera.' });
      logUiWarning('zoom', {
        stage: 'toggle-camera',
        error: serializeError(error),
      });
    }
  }, [isCameraOn, prefersSingleVideoLayout, renderVideo, stopVideo, syncParticipants, updateState]);

  const toggleCamera = useCallback(async () => {
    if (cameraJobRef.current) return cameraJobRef.current;
    const job = toggleCameraSession();
    cameraJobRef.current = job;
    try { await job; } finally {
      if (cameraJobRef.current === job) cameraJobRef.current = null;
    }
  }, [toggleCameraSession]);

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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void leave();
    };
  }, [leave]);

  return {
    ...state,
    isMuted,
    isCameraOn,
    isScreenSharing,
    prefersSingleVideoLayout,
    join,
    leave,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    sendChatMessage,
    registerVideoContainer,
  };
}
