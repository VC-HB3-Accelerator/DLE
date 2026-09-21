/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Self-hosted LiveKit: камера/экран редактора ↔ участник.
 */

import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack
} from 'livekit-client';
import conferenceService from '@/services/conferenceService';

const CAMERA_CAPTURE = {
  facingMode: { ideal: 'user' }
};

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

function wrapLocalVideoTrack(mediaStreamTrack) {
  if (!mediaStreamTrack) return null;
  // userProvidedTrack=true — трек наш (GUM), SDK не должен сам его «перезахватывать»
  return new LocalVideoTrack(mediaStreamTrack, undefined, true);
}

function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Захват камеры в том же клике, до сети. Иначе Chrome на телефоне
 * после await токена/комнаты блокирует getUserMedia.
 */
export async function captureConferenceCameraTrack() {
  const { videoTrack } = await captureConferenceMedia({ withAudio: false });
  if (!videoTrack) throw new Error('Camera capture failed');
  return videoTrack;
}

/**
 * Один простой запрос камеры на один жест пользователя.
 * Brave/Samsung не переносит цепочку повторных getUserMedia после первого окна
 * разрешения: повтор уже идёт без жеста и заканчивается чёрным экраном.
 */
export async function captureConferenceMedia({ withAudio = false } = {}) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const error = new Error('Camera requires HTTPS and MediaDevices support');
    error.name = 'NotSupportedError';
    throw error;
  }

  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });
  const videoMediaTrack = videoStream.getVideoTracks()[0] || null;
  if (!videoMediaTrack) {
    stopMediaStream(videoStream);
    throw new Error('Camera did not return a video track');
  }

  const videoTrack = wrapLocalVideoTrack(videoMediaTrack);
  let audioStream = null;
  if (withAudio) {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: AUDIO_CONSTRAINTS
      });
    } catch {
      // Камера важнее: отказ микрофона не должен уничтожать уже выданный видеотрек.
      audioStream = null;
    }
  }
  return { videoTrack, audioStream };
}

/** Локальный превью до входа в комнату (жест ещё жив). */
export function attachCapturedPreview(track, containerEl) {
  if (!track || !containerEl) return null;
  while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);
  const element = track.attach();
  element.playsInline = true;
  element.setAttribute('playsinline', 'true');
  element.setAttribute('webkit-playsinline', 'true');
  element.autoplay = true;
  element.muted = true;
  element.style.width = '100%';
  element.style.height = '100%';
  element.style.objectFit = 'cover';
  element.style.display = 'block';
  element.style.transform = 'scaleX(-1)';
  element.style.background = '#000';
  containerEl.appendChild(element);
  if (typeof element.play === 'function') {
    element.play().catch(() => {});
  }
  return element;
}

export function createConferenceLivekitController(options = {}) {
  const { onStatus, onError, onRemoteVideo, remoteContainerEl, localContainerEl } = options;

  let room = null;
  let connected = false;
  let remoteAudioMuted = false;
  let remoteVideoElement = null;
  let remoteVideoTrack = null;
  const remoteAudioElements = new Set();
  const playbackUnlocks = new Map();

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

  function forgetPlaybackUnlock(element) {
    const unlock = playbackUnlocks.get(element);
    if (!unlock) return;
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('touchstart', unlock);
    playbackUnlocks.delete(element);
  }

  function playMediaElement(element) {
    if (typeof element?.play !== 'function') return;
    element.play()
      .then(() => forgetPlaybackUnlock(element))
      .catch(() => {
        if (!playbackUnlocks.has(element)) {
          const unlock = () => {
            element.play()
              .then(() => forgetPlaybackUnlock(element))
              .catch(() => {});
          };
          playbackUnlocks.set(element, unlock);
          document.addEventListener('pointerdown', unlock, { passive: true });
          document.addEventListener('touchstart', unlock, { passive: true });
        }
        // Браузер сам снимет блокировку на следующем жесте пользователя.
      });
  }

  function attachTrack(track, container, { mirror = false, fit = 'cover' } = {}) {
    if (!container || !track) return null;
    const element = track.attach();
    element.playsInline = true;
    element.setAttribute('playsinline', 'true');
    element.setAttribute('webkit-playsinline', 'true');
    element.autoplay = true;
    // Видео-элемент всегда muted: звук идёт отдельными audio-attach.
    // Иначе Chrome Android блокирует play() без жеста → чёрный экран.
    element.muted = track.kind === Track.Kind.Video;
    if (track.kind === Track.Kind.Video) {
      element.style.width = '100%';
      element.style.height = '100%';
      element.style.minHeight = '160px';
      element.style.maxHeight = 'none';
      element.style.objectFit = fit;
      element.style.borderRadius = '6px';
      element.style.background = '#000';
      element.style.display = 'block';
      if (mirror) element.style.transform = 'scaleX(-1)';
    }
    container.appendChild(element);
    element.addEventListener('loadedmetadata', () => playMediaElement(element), { once: true });
    element.addEventListener('canplay', () => playMediaElement(element), { once: true });
    playMediaElement(element);
    return element;
  }

  function isScreenSource(publication) {
    return publication?.source === Track.Source.ScreenShare
      || publication?.source === Track.Source.ScreenShareAudio;
  }

  /** Держим подписку на чужое видео включённой (adaptiveStream мог выключить). */
  function ensureRemoteVideoEnabled() {
    if (!room) return;
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (pub.kind !== Track.Kind.Video) return;
        try {
          if (pub.isAvailable && !pub.isSubscribed && typeof pub.setSubscribed === 'function') {
            pub.setSubscribed(true);
          }
          if (pub.isSubscribed && typeof pub.setEnabled === 'function' && pub.isEnabled === false) {
            pub.setEnabled(true);
          }
        } catch {
          /* ignore */
        }
      });
    });
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
    if (track) {
      ensureRemoteVideoEnabled();
      if (remoteVideoTrack !== track || !remoteVideoElement?.isConnected) {
        if (remoteVideoTrack && remoteVideoElement) {
          forgetPlaybackUnlock(remoteVideoElement);
          remoteVideoTrack.detach(remoteVideoElement);
        }
        clearContainer(container);
        remoteVideoTrack = track;
        remoteVideoElement = attachTrack(track, container, {
          mirror: false,
          fit: screenTrack ? 'contain' : 'cover'
        });
      } else {
        playMediaElement(remoteVideoElement);
      }
      setRemoteVideoPresent(true);
    } else {
      if (remoteVideoTrack && remoteVideoElement) {
        forgetPlaybackUnlock(remoteVideoElement);
        remoteVideoTrack.detach(remoteVideoElement);
      }
      remoteVideoTrack = null;
      remoteVideoElement = null;
      clearContainer(container);
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
      const element = track.attach();
      element.autoplay = true;
      element.muted = remoteAudioMuted;
      element.style.display = 'none';
      document.body.appendChild(element);
      remoteAudioElements.add(element);
      if (typeof element.play === 'function') {
        element.play().catch(() => {});
      }
      return;
    }
    if (track.kind === Track.Kind.Video) {
      ensureRemoteVideoEnabled();
      refreshRemoteVideo();
    }
  }

  function handleTrackUnsubscribed(track) {
    track.detach().forEach((el) => {
      remoteAudioElements.delete(el);
      el.remove();
    });
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
      // adaptiveStream на Android глушит чужое видео (trackSetting disabled:true),
      // когда плитка ещё без размера / под плейсхолдером — чёрный экран у гостя.
      adaptiveStream: false,
      // Для двух участников важнее стабильный единственный поток, чем экономия слоёв.
      dynacast: false,
      videoCaptureDefaults: CAMERA_CAPTURE
    });

    room
      .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished)
      .on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished)
      .on(RoomEvent.TrackPublished, () => {
        ensureRemoteVideoEnabled();
        refreshRemoteVideo();
      })
      .on(RoomEvent.TrackMuted, refreshRemoteVideo)
      .on(RoomEvent.TrackUnmuted, refreshRemoteVideo)
      .on(RoomEvent.TrackStreamStateChanged, refreshRemoteVideo)
      .on(RoomEvent.Reconnected, refreshRemoteVideo)
      .on(RoomEvent.MediaDevicesError, (error) => {
        onError?.(error);
      })
      .on(RoomEvent.ParticipantConnected, () => {
        ensureRemoteVideoEnabled();
        refreshRemoteVideo();
      })
      .on(RoomEvent.Disconnected, () => {
        connected = false;
        setRemoteVideoPresent(false);
        setStatus('disconnected');
      });

    await room.connect(data.url, data.token, { autoSubscribe: true });
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
    // После layout на телефоне — ещё раз прикрепить и включить подписку
    requestAnimationFrame(() => {
      ensureRemoteVideoEnabled();
      refreshRemoteVideo();
    });
    setTimeout(() => {
      ensureRemoteVideoEnabled();
      refreshRemoteVideo();
    }, 400);

    return room;
  }

  async function unpublishCamera() {
    const existing = room?.localParticipant?.getTrackPublication(Track.Source.Camera);
    if (existing?.track) {
      await room.localParticipant.unpublishTrack(existing.track);
      try {
        existing.track.stop();
      } catch {
        /* ignore */
      }
    }
  }

  async function publishCameraTrack(localTrack) {
    if (!room) throw new Error('Not connected');
    if (!localTrack) throw new Error('No camera track');
    const media = localTrack.mediaStreamTrack;
    if (!media || media.readyState !== 'live') {
      throw new Error('Camera track ended before publish');
    }
    await unpublishCamera();
    const pub = await room.localParticipant.publishTrack(localTrack, {
      source: Track.Source.Camera
    });
    const localEl = localContainerEl?.();
    const track = pub?.track || localTrack
      || room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (localEl && track) {
      clearContainer(localEl);
      attachTrack(track, localEl, { mirror: true, fit: 'cover' });
    } else {
      refreshLocalPreview();
    }
    return pub;
  }

  async function setCameraEnabled(enabled, capturedTrack = null) {
    if (!room) throw new Error('Not connected');
    if (!enabled) {
      await room.localParticipant.setCameraEnabled(false);
      refreshLocalPreview();
      return;
    }
    if (capturedTrack) {
      await publishCameraTrack(capturedTrack);
      return;
    }
    const pub = await room.localParticipant.setCameraEnabled(true, CAMERA_CAPTURE);
    const localEl = localContainerEl?.();
    if (localEl) {
      clearContainer(localEl);
      const track = pub?.track
        || room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (track) attachTrack(track, localEl, { mirror: true, fit: 'cover' });
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

  async function publishMicrophoneTrack(mediaStreamTrack) {
    if (!room) throw new Error('Not connected');
    if (!mediaStreamTrack) throw new Error('No microphone track');
    const existing = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (existing?.track) {
      await room.localParticipant.unpublishTrack(existing.track, true);
    }
    return room.localParticipant.publishTrack(mediaStreamTrack, {
      source: Track.Source.Microphone
    });
  }

  function setRemoteAudioMuted(muted) {
    remoteAudioMuted = Boolean(muted);
    remoteAudioElements.forEach((element) => {
      element.muted = remoteAudioMuted;
    });
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
    remoteAudioElements.forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });
    remoteAudioElements.clear();
    if (remoteVideoTrack && remoteVideoElement) {
      forgetPlaybackUnlock(remoteVideoElement);
      remoteVideoTrack.detach(remoteVideoElement);
    }
    playbackUnlocks.forEach((unlock) => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('touchstart', unlock);
    });
    playbackUnlocks.clear();
    remoteVideoTrack = null;
    remoteVideoElement = null;
    clearContainer(remoteContainerEl?.());
    clearContainer(localContainerEl?.());
    setRemoteVideoPresent(false);
    setStatus('disconnected');
  }

  return {
    connect,
    disconnect,
    setCameraEnabled,
    publishCameraTrack,
    setMicrophoneEnabled,
    publishMicrophoneTrack,
    setRemoteAudioMuted,
    setScreenEnabled,
    get connected() {
      return connected;
    },
    get room() {
      return room;
    }
  };
}
