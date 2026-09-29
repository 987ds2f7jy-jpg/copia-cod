import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useZoomSession } from './useZoomSession';
import ZoomVideoStage from '@/components/teleconsulta/ZoomVideoStage';

const sdk = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@zoom/videosdk', () => ({ default: sdk, VideoQuality: { Video_180P: 1, Video_360P: 2 } }));
vi.mock('@/client-api/teleconsulta', () => ({ requestZoomToken: vi.fn(async () => ({ sessionName: 'synthetic', signature: 'mock', userName: 'test' })) }));
vi.mock('@/lib/observability', () => ({ logUiWarning: vi.fn(), serializeError: () => 'mock-error' }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function makeClient() {
  const users = [{ userId: 1, displayName: 'self', bVideoOn: true }, { userId: 2, displayName: 'remote', bVideoOn: true }];
  const listeners = new Map<string, (payload: unknown) => void>();
  const stream = {
    isSupportMultipleVideos: () => true,
    startAudio: vi.fn(async () => undefined), startVideo: vi.fn(async () => { users[0].bVideoOn = true; }),
    stopVideo: vi.fn(async () => { users[0].bVideoOn = false; }),
    attachVideo: vi.fn(async (_id: number, _quality: number, player?: HTMLElement) => player ?? document.createElement('video-player')),
    detachVideo: vi.fn(async (_id: number, element: HTMLElement) => element),
    renderVideo: vi.fn(async () => ''), stopRenderVideo: vi.fn(async () => ''),
    isRenderSelfViewWithVideoElement: () => false,
  };
  return { users, listeners, stream, init: vi.fn(async () => undefined), join: vi.fn(async () => undefined), leave: vi.fn(async () => undefined),
    getMediaStream: () => stream, getAllUser: () => users, getCurrentUserInfo: () => users[0],
    getChatClient: () => ({ sendToAll: async () => undefined }),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => listeners.set(event, handler)),
    off: vi.fn((event: string) => listeners.delete(event)),
    emit: (event: string, payload: unknown) => listeners.get(event)?.(payload),
  };
}
let api: ReturnType<typeof useZoomSession>;
let client: ReturnType<typeof makeClient>;
function Harness({ tick = 0, stage = true }) {
  api = useZoomSession({ consultationId: 'synthetic', participantRole: 'professional', userId: 'test', userName: 'test' });
  return <div data-tick={tick}>{stage && <ZoomVideoStage {...api} />}</div>;
}
async function start(stage = true) {
  const view = render(<Harness stage={stage} />);
  await act(async () => { await api.join(); });
  return view;
}
function host() { const node = document.createElement('div'); document.body.append(node); return node; }
beforeEach(() => {
  client = makeClient(); sdk.createClient.mockReset().mockReturnValue(client);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
});
afterEach(async () => { await act(async () => { cleanup(); }); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('real Zoom hook and stage lifecycle', () => {
  it('preserves both surfaces through parent and chat updates', async () => {
    const view = await start();
    const surfaces = [...view.container.querySelectorAll('video-player')];
    expect(surfaces).toHaveLength(2);
    client.stream.attachVideo.mockClear(); client.stream.detachVideo.mockClear();
    for (let tick = 1; tick <= 3; tick++) {
      await act(async () => { view.rerender(<Harness tick={tick} />); await api.sendChatMessage(`test ${tick}`); });
      await act(async () => { client.emit('chat-on-message', { id: tick, senderId: 2, message: `reply ${tick}` }); });
    }
    expect(client.stream.detachVideo).not.toHaveBeenCalled();
    expect(client.stream.attachVideo).not.toHaveBeenCalled();
    expect([...view.container.querySelectorAll('video-player')]).toEqual(surfaces);
    expect(client.leave).not.toHaveBeenCalled(); expect(client.stream.stopVideo).not.toHaveBeenCalled();
  });
  it('waits for old cleanup before reattaching the same host', async () => {
    await start(false); const node = host();
    await act(async () => { api.registerVideoContainer(2, node); });
    const gate = deferred<HTMLElement>();
    const old = node.querySelector('video-player')! as HTMLElement;
    client.stream.detachVideo.mockImplementationOnce(() => gate.promise);
    await act(async () => { api.registerVideoContainer(2, null); api.registerVideoContainer(2, node); });
    await act(async () => { gate.resolve(old); });
    expect(client.stream.attachVideo).toHaveBeenCalledTimes(2);
    expect(node.querySelector('video-player')).not.toBeNull();
  });
  it.each([false, true])('coalesces overlapping attach requests (reverse=%s)', async (reverse) => {
    await start(false); const node = host(); const first = deferred<HTMLElement>(); const second = deferred<HTMLElement>();
    client.stream.attachVideo.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    await act(async () => { api.registerVideoContainer(2, node); client.emit('peer-video-state-change', { userId: 2, action: 'Start' }); });
    expect(client.stream.attachVideo).toHaveBeenCalledTimes(1);
    const a = document.createElement('video-player'); const b = document.createElement('video-player');
    await act(async () => { if (reverse) { second.resolve(b); first.resolve(a); } else { first.resolve(a); second.resolve(b); } });
    expect(node.querySelectorAll('video-player')).toHaveLength(1);
    expect(client.stream.attachVideo).toHaveBeenCalledTimes(1);
  });
  it('distinguishes omitted camera state from explicit false', async () => {
    await start(false); const node = host();
    await act(async () => { api.registerVideoContainer(2, node); });
    await act(async () => { client.emit('user-updated', [{ userId: 2, displayName: 'changed' }]); });
    expect(client.stream.detachVideo).not.toHaveBeenCalled();
    await act(async () => { client.users[1].bVideoOn = false; client.emit('user-updated', [{ userId: 2, bVideoOn: false }]); });
    expect(client.stream.detachVideo).toHaveBeenCalledTimes(1);
    expect(node.querySelector('video-player')).toBeNull();
  });
  it('drains pending attach before leaving and starting the next session', async () => {
    await start(false); const oldHost = host(); const gate = deferred<HTMLElement>();
    client.stream.attachVideo.mockImplementationOnce(() => gate.promise);
    await act(async () => { api.registerVideoContainer(2, oldHost); });
    const oldClient = client; const next = makeClient(); sdk.createClient.mockReturnValue(next);
    let leaving!: Promise<void>; let joining!: Promise<void>;
    await act(async () => { leaving = api.leave(); joining = api.join(); });
    const stale = document.createElement('video-player');
    await act(async () => { gate.resolve(stale); await leaving; await joining; });
    const newHost = host();
    await act(async () => { api.registerVideoContainer(2, newHost); });
    expect(stale.isConnected).toBe(false);
    expect(newHost.querySelector('video-player')).not.toBeNull();
    expect(oldClient.listeners.size).toBe(0); expect(next.listeners.size).toBe(6);
    expect(api.isConnected).toBe(true);
  });
  it('replaces a host during pending attach without appending the stale result', async () => {
    await start(false); const oldHost = host(); const newHost = host(); const gate = deferred<HTMLElement>();
    client.stream.attachVideo.mockImplementationOnce(() => gate.promise);
    await act(async () => { api.registerVideoContainer(2, oldHost); });
    const append = vi.spyOn(oldHost.querySelector('video-player-container')!, 'appendChild');
    await act(async () => { api.registerVideoContainer(2, newHost); });
    const stale = document.createElement('video-player');
    await act(async () => { gate.resolve(stale); });
    expect(append).not.toHaveBeenCalled();
    expect(oldHost.childElementCount).toBe(0);
    expect(newHost.querySelectorAll('video-player')).toHaveLength(1);
    expect(client.stream.detachVideo).toHaveBeenCalledWith(2, stale);
  });
  it('does not erase another participant when React reuses a host', async () => {
    await start(false); const node = host();
    await act(async () => { api.registerVideoContainer(2, node); });
    const old = node.querySelector('video-player')! as HTMLElement; const gate = deferred<HTMLElement>();
    client.stream.detachVideo.mockImplementationOnce(() => gate.promise);
    await act(async () => { api.registerVideoContainer(2, null); api.registerVideoContainer(1, node); });
    const self = node.querySelectorAll('video-player')[1];
    await act(async () => { gate.resolve(old); });
    expect(node.querySelector('video-player')).toBe(self);
  });
  it('keeps local and remote camera operations independent', async () => {
    const view = await start(); const remote = view.container.querySelector('video-player');
    await act(async () => { await api.toggleCamera(); });
    expect(client.stream.detachVideo.mock.calls.map(([id]) => id)).toEqual([1]);
    expect(remote?.isConnected).toBe(true);
    await act(async () => { await api.toggleCamera(); });
    expect(view.container.querySelectorAll('video-player')).toHaveLength(2);
    await act(async () => { client.users[1].bVideoOn = false; client.emit('peer-video-state-change', { userId: 2, action: 'Stop' }); });
    expect(view.container.querySelectorAll('video-player')).toHaveLength(1);
    expect(client.stream.stopVideo).toHaveBeenCalledTimes(1);
  });
  it('recovers after both attachment paths reject', async () => {
    await start(false); const node = host();
    client.stream.attachVideo.mockRejectedValueOnce(new Error('primary')).mockRejectedValueOnce(new Error('fallback'));
    await act(async () => { api.registerVideoContainer(2, node); });
    expect(node.childElementCount).toBe(0);
    await act(async () => { client.emit('peer-video-state-change', { userId: 2, action: 'Start' }); });
    expect(node.querySelectorAll('video-player')).toHaveLength(1);
  });
  it('cleans up departed participants and accepts their return', async () => {
    await start(false); const node = host();
    await act(async () => { api.registerVideoContainer(2, node); });
    const remote = client.users.pop()!;
    await act(async () => { client.emit('user-removed', [{ userId: 2 }]); });
    expect(node.childElementCount).toBe(0);
    await act(async () => { client.users.push(remote); client.emit('user-added', [remote]); api.registerVideoContainer(2, node); });
    expect(node.querySelectorAll('video-player')).toHaveLength(1);
    await act(async () => { await api.leave(); });
    expect(client.listeners.size).toBe(0); expect(node.childElementCount).toBe(0);
    expect(client.stream.detachVideo.mock.calls.every(([, element]) => element instanceof HTMLElement)).toBe(true);
  });
  it.each([false, true])('preserves legacy rendering and awaits cleanup (video=%s)', async (video) => {
    client.stream.isSupportMultipleVideos = () => false;
    client.stream.isRenderSelfViewWithVideoElement = () => video;
    await start(false); const node = host();
    await act(async () => { api.registerVideoContainer(1, node); });
    expect(node.querySelector(video ? 'video' : 'canvas')).not.toBeNull();
    const gate = deferred<string>(); client.stream.stopRenderVideo.mockImplementationOnce(() => gate.promise);
    await act(async () => { api.registerVideoContainer(1, null); api.registerVideoContainer(1, node); });
    expect(client.stream.renderVideo).toHaveBeenCalledTimes(1);
    await act(async () => { gate.resolve(''); });
    expect(client.stream.renderVideo).toHaveBeenCalledTimes(2);
    expect(node.querySelectorAll(video ? 'video' : 'canvas')).toHaveLength(1);
  });
  it('cancels layout retries on leave', async () => {
    vi.useFakeTimers();
    try {
      await start(false); const node = host(); Object.defineProperty(node, 'clientWidth', { value: 0 });
      await act(async () => { api.registerVideoContainer(2, node); });
      expect(vi.getTimerCount()).toBe(1);
      await act(async () => { await api.leave(); });
      expect(vi.getTimerCount()).toBe(0);
      expect(client.stream.attachVideo).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('does not complete an obsolete join or duplicate event listeners', async () => {
    const gate = deferred<void>(); client.init.mockImplementationOnce(() => gate.promise);
    render(<Harness stage={false} />); let joining!: Promise<void>; let leaving!: Promise<void>;
    await act(async () => { joining = api.join(); });
    await act(async () => { leaving = api.leave(); });
    await act(async () => { gate.resolve(); await joining; await leaving; });
    expect(client.join).not.toHaveBeenCalled(); expect(client.listeners.size).toBe(0);
    await act(async () => { await Promise.all([api.join(), api.join()]); });
    expect(client.join).toHaveBeenCalledTimes(1); expect(client.listeners.size).toBe(6);
  });
  it('cancels a queued resume when the component unmounts', async () => {
    const view = await start(false); const gate = deferred<void>(); client.leave.mockImplementationOnce(() => gate.promise);
    let leaving!: Promise<void>; let joining!: Promise<void>;
    await act(async () => { leaving = api.leave(); joining = api.join(); });
    view.unmount();
    await act(async () => { gate.resolve(); await leaving; await joining; });
    expect(sdk.createClient).toHaveBeenCalledTimes(1);
    expect(client.listeners.size).toBe(0);
  });
  it('drains a pending camera toggle before session reuse', async () => {
    await start(false); const gate = deferred<void>(); client.stream.stopVideo.mockImplementationOnce(() => gate.promise);
    let toggling!: Promise<void>; let leaving!: Promise<void>;
    await act(async () => { toggling = api.toggleCamera(); });
    await act(async () => { leaving = api.leave(); });
    expect(client.leave).not.toHaveBeenCalled();
    await act(async () => { gate.resolve(); await toggling; await leaving; });
    expect(api.participants).toHaveLength(0); expect(api.isConnected).toBe(false);
  });
  it('disconnects the legacy resize observer', async () => {
    const disconnect = vi.fn(); const observe = vi.fn();
    vi.stubGlobal('ResizeObserver', class { disconnect = disconnect; observe = observe; });
    client.stream.isSupportMultipleVideos = () => false;
    await start(false); const node = host();
    await act(async () => { api.registerVideoContainer(2, node); });
    expect(observe).toHaveBeenCalledTimes(1);
    await act(async () => { await api.leave(); });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])('keeps participants independent when completion order reverses (%s)', async (reverse) => {
    await start(false); const one = host(); const two = host();
    const first = deferred<HTMLElement>(); const second = deferred<HTMLElement>();
    client.stream.attachVideo.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    await act(async () => { api.registerVideoContainer(1, one); api.registerVideoContainer(2, two); });
    const a = document.createElement('video-player'); const b = document.createElement('video-player');
    await act(async () => { if (reverse) second.resolve(b); else first.resolve(a); });
    await act(async () => { if (reverse) first.resolve(a); else second.resolve(b); });
    expect(one.querySelector('video-player')).toBe(a); expect(two.querySelector('video-player')).toBe(b);
  });
  it('keeps the full registration callback chain stable after capability detection', async () => {
    client.stream.isSupportMultipleVideos = () => false;
    const view = render(<Harness />); const register = api.registerVideoContainer;
    await act(async () => { await api.join(); });
    const surfaces = [...view.container.querySelectorAll('canvas')];
    expect(surfaces).toHaveLength(2); expect(api.registerVideoContainer).toBe(register);
    await act(async () => { await api.sendChatMessage('synthetic'); });
    expect([...view.container.querySelectorAll('canvas')]).toEqual(surfaces);
    expect(client.stream.stopRenderVideo).not.toHaveBeenCalled();
  });
  it('disposes an attach completed after an explicit camera off', async () => {
    await start(false); const node = host(); const gate = deferred<HTMLElement>();
    client.stream.attachVideo.mockImplementationOnce(() => gate.promise);
    await act(async () => { api.registerVideoContainer(2, node); });
    await act(async () => { client.users[1].bVideoOn = false; client.emit('user-updated', [{ userId: 2, bVideoOn: false }]); });
    const stale = document.createElement('video-player');
    await act(async () => { gate.resolve(stale); });
    expect(node.childElementCount).toBe(0);
    expect(client.stream.detachVideo).toHaveBeenCalledWith(2, stale);
  });
  it('works under StrictMode without duplicate listeners', async () => {
    const view = render(<React.StrictMode><Harness /></React.StrictMode>);
    await act(async () => { await api.join(); });
    expect(client.listeners.size).toBe(6);
    expect(view.container.querySelectorAll('video-player')).toHaveLength(2);
    await act(async () => { view.unmount(); });
    expect(client.listeners.size).toBe(0);
  });
});
