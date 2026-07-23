/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Self-hosted LiveKit: камера/экран редактора ↔ участник.
 */

import { Room, RoomEvent, Track } from 'livekit-client';
import conferenceService from '@/services/conferenceService';

export function createConferenceLivekitController(options = {}) {
  const { onStatus, onError, onRemoteVideo, remoteContainerEl, localContainerEl } = options;

  let room = null;
  let connected = false;

  function setStatus(status) {
    onStatus?.(status);
  }

  function setRemoteVideoPresent(present) {
    onRemoteVideo?.(Boolean(present));
  }

  function clearContainer(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function attachTrack(track, container, { mirror = false, fit = 'cover' } = {}) {
    if (!container || !track) return null;
    const element = track.attach();
    element.playsInline = true;
    element.autoplay = true;
    element.muted = track.kind === Track.Kind.Video && mirror;
    if (track.kind === Track.Kind.Video) {
      element.style.width = '100%';
      element.style.height = '100%';
      element.style.maxHeight = 'none';
      element.style.objectFit = fit;
      element.style.borderRadius = '6px';
      element.style.background = '#000';
      element.style.display = 'block';
      if (mirror) element.style.transform = 'scaleX(-1)';
    }
    container.appendChild(element);
    // браузеры иногда блокируют play без user gesture — пробуем явно
    if (typeof element.play === 'function') {
      element.play().catch(() => {});
    }
    return element;
  }

  function isScreenSource(publication) {
    return publication?.source === Track.Source.ScreenShare
      || publication?.source === Track.Source.ScreenShareAudio;
  }

  /** Предпочитаем screen share камере в remote-плитке. */
  function refreshRemoteVideo() {
    const container = remoteContainerEl?.() || null;
    if (!container || !room) return;

    let screenTrack = null;
    let cameraTrack = null;

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (!pub.isSubscribed || !pub.track || pub.track.kind !== Track.Kind.Video) return;
        if (isScreenSource(pub)) screenTrack = pub.track;
        else if (pub.source === Track.Source.Camera) cameraTrack = pub.track;
        else if (!cameraTrack) cameraTrack = pub.track;
      });
    });

    const track = screenTrack || cameraTrack;
    clearContainer(container);
    if (track) {
      attachTrack(track, container, {
        mirror: false,
        fit: screenTrack ? 'contain' : 'cover'
      });
      setRemoteVideoPresent(true);
    } else {
      setRemoteVideoPresent(false);
    }
  }

  function refreshLocalPreview({ preferScreen = false } = {}) {
    const localEl = localContainerEl?.() || null;
    if (!localEl || !room) return;

    const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);

    clearContainer(localEl);

    if (preferScreen || screenPub?.track) {
      if (screenPub?.track) {
        attachTrack(screenPub.track, localEl, { mirror: false, fit: 'contain' });
        return;
      }
    }
    if (cameraPub?.track) {
      attachTrack(cameraPub.track, localEl, { mirror: true, fit: 'cover' });
    }
  }

  function handleTrackSubscribed(track, publication) {
    if (track.kind === Track.Kind.Audio) {
      const container = remoteContainerEl?.() || null;
      attachTrack(track, container);
      return;
    }
    if (track.kind === Track.Kind.Video) {
      refreshRemoteVideo();
    }
  }

  function handleTrackUnsubscribed(track) {
    track.detach().forEach((el) => el.remove());
    if (track.kind === Track.Kind.Video) {
      refreshRemoteVideo();
    }
  }

  function handleLocalTrackPublished(publication) {
    if (publication?.source === Track.Source.ScreenShare || publication?.source === Track.Source.Camera) {
      refreshLocalPreview({ preferScreen: publication.source === Track.Source.ScreenShare });
    }
  }

  function handleLocalTrackUnpublished(publication) {
    if (publication?.source === Track.Source.ScreenShare || publication?.source === Track.Source.Camera) {
      refreshLocalPreview();
    }
  }

  async function connect(conferenceId) {
    if (connected && room) return room;
    setStatus('connecting');

    const data = await conferenceService.getLivekitToken(conferenceId);
    if (!data?.token || !data?.url) {
      throw new Error('LiveKit token missing');
    }

    room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    room
      .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished)
      .on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished)
      .on(RoomEvent.Disconnected, () => {
        connected = false;
        setRemoteVideoPresent(false);
        setStatus('disconnected');
      });

    await room.connect(data.url, data.token);
    connected = true;
    setStatus('connected');

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (pub.isSubscribed && pub.track) {
          handleTrackSubscribed(pub.track, pub);
        }
      });
    });
    refreshRemoteVideo();

    return room;
  }

  async function setCameraEnabled(enabled) {
    if (!room) throw new Error('Not connected');
    const pub = await room.localParticipant.setCameraEnabled(Boolean(enabled));
    if (enabled) {
      const localEl = localContainerEl?.();
      if (localEl) {
        clearContainer(localEl);
        const track = pub?.track
          || room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
        if (track) attachTrack(track, localEl, { mirror: true, fit: 'cover' });
      }
    } else {
      refreshLocalPreview();
    }
  }

  /**
   * Микрофон комнаты LiveKit — отдельно от OpenAI Realtime.
   * Coach голосом идёт через PTT→STT, не через этот трек.
   */
  async function setMicrophoneEnabled(enabled) {
    if (!room) throw new Error('Not connected');
    await room.localParticipant.setMicrophoneEnabled(Boolean(enabled));
  }

  async function setScreenEnabled(enabled) {
    if (!room) throw new Error('Not connected');
    const pub = await room.localParticipant.setScreenShareEnabled(Boolean(enabled));
    const localEl = localContainerEl?.();
    if (!localEl) return;

    if (enabled) {
      clearContainer(localEl);
      const track = pub?.track
        || room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
      if (track) {
        attachTrack(track, localEl, { mirror: false, fit: 'contain' });
      } else {
        // трек может появиться чуть позже через LocalTrackPublished
        refreshLocalPreview({ preferScreen: true });
      }
    } else {
      refreshLocalPreview();
    }
  }

  async function disconnect() {
    try {
      await room?.disconnect();
    } catch {
      /* ignore */
    }
    room = null;
    connected = false;
    clearContainer(remoteContainerEl?.());
    clearContainer(localContainerEl?.());
    setRemoteVideoPresent(false);
    setStatus('disconnected');
  }

  return {
    connect,
    disconnect,
    setCameraEnabled,
    setMicrophoneEnabled,
    setScreenEnabled,
    get connected() {
      return connected;
    },
    get room() {
      return room;
    }
  };
}
