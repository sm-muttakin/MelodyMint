import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, API_BASE_URL } from "./client";
import { useApp } from "./AppContext";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const { currentUser, showToast } = useApp();

  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [shuffle, setShuffleState] = useState(false);
  const [loop, setLoopState] = useState(false);

  const audioRef = useRef(null);
  const loggedSecRef = useRef(0);
  const lastLogFlushRef = useRef(0);

  const currentSong = queue[queueIndex] || null;
  const hasAudio = Boolean(currentSong?.audio_url);

  // Create the underlying <audio> element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setElapsed(audio.currentTime);
      loggedSecRef.current = audio.currentTime - lastLogFlushRef.current;
      if (loggedSecRef.current >= 10) {
        flushListening(Math.floor(loggedSecRef.current));
        lastLogFlushRef.current = audio.currentTime;
      }
    };
    const onEnded = () => handleTrackEnd();

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load this user's playback settings whenever the active user changes
  useEffect(() => {
    if (!currentUser) return;
    api
      .getPlaybackSettings()
      .then((s) => {
        setVolumeState(s.volume);
        setShuffleState(s.shuffle);
        setLoopState(s.loop);
        if (audioRef.current) audioRef.current.volume = s.volume / 100;
      })
      .catch(() => {});
  }, [currentUser]);

  // Whenever the current song changes, point the <audio> element at it
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    lastLogFlushRef.current = 0;
    loggedSecRef.current = 0;
    setElapsed(0);

    if (currentSong.audio_url) {
      audio.src = `${API_BASE_URL}${currentSong.audio_url}`;
      audio.loop = loop && queue.length === 1;
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    } else {
      audio.removeAttribute("src");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.song_id]);

  // Fallback simulated clock for songs uploaded without an audio file
  // (keeps the demo usable even before real files are attached)
  useEffect(() => {
    if (!isPlaying || !currentSong || hasAudio) return;
    const tick = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        loggedSecRef.current += 1;
        if (loggedSecRef.current >= 10) {
          flushListening(loggedSecRef.current);
          loggedSecRef.current = 0;
        }
        if (next >= currentSong.duration_sec) {
          handleTrackEnd();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentSong, hasAudio]);

  const flushListening = async (sec) => {
    if (!currentSong || sec <= 0 || !currentUser) return;
    try {
      await api.logListening({ song_id: currentSong.song_id, listened_sec: sec });
    } catch (_) {
      /* silent — don't interrupt playback for a logging failure */
    }
  };

  const flushRemainder = () => {
    if (hasAudio) {
      const remainder = Math.floor(loggedSecRef.current);
      if (remainder > 0) flushListening(remainder);
      loggedSecRef.current = 0;
    } else {
      if (loggedSecRef.current > 0) flushListening(loggedSecRef.current);
      loggedSecRef.current = 0;
    }
  };

  const handleTrackEnd = () => {
    flushRemainder();
    if (loop && queue.length > 1) {
      // loop the whole queue: fall through to goNext
    } else if (loop) {
      // loop a single track
      if (audioRef.current && hasAudio) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } else {
        setElapsed(0);
      }
      return;
    }
    goNext();
  };

  const playQueue = (songs, startIndex = 0) => {
    flushRemainder();
    setQueue(songs);
    setQueueIndex(startIndex);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!currentSong) return;
    const audio = audioRef.current;
    if (hasAudio && audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(() => {});
      }
    }
    setIsPlaying((p) => !p);
  };

  const pickNextIndex = (dir) => {
    if (queue.length === 0) return 0;
    if (shuffle) {
      if (queue.length === 1) return 0;
      let idx;
      do {
        idx = Math.floor(Math.random() * queue.length);
      } while (idx === queueIndex);
      return idx;
    }
    const next = queueIndex + dir;
    if (next < 0) return queue.length - 1;
    if (next >= queue.length) return 0;
    return next;
  };

  const goNext = () => {
    flushRemainder();
    if (queue.length === 0) return;
    setQueueIndex(pickNextIndex(1));
    setIsPlaying(true);
  };

  const goPrev = () => {
    flushRemainder();
    if (queue.length === 0) return;
    if (elapsed > 3) {
      if (audioRef.current && hasAudio) audioRef.current.currentTime = 0;
      setElapsed(0);
      return;
    }
    setQueueIndex(pickNextIndex(-1));
    setIsPlaying(true);
  };

  const seek = (sec) => {
    if (audioRef.current && hasAudio) {
      audioRef.current.currentTime = sec;
    }
    setElapsed(sec);
  };

  const persistSettings = async (patch) => {
    if (!currentUser) return;
    try {
      await api.updatePlaybackSettings(patch);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const setVolume = (v) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
    persistSettings({ volume: v });
  };

  const toggleShuffle = () => {
    const next = !shuffle;
    setShuffleState(next);
    persistSettings({ shuffle: next });
  };

  const toggleLoop = () => {
    const next = !loop;
    setLoopState(next);
    persistSettings({ loop: next });
  };

  return (
    <PlayerContext.Provider
      value={{
        queue,
        queueIndex,
        currentSong,
        isPlaying,
        elapsed,
        volume,
        shuffle,
        loop,
        hasAudio,
        playQueue,
        togglePlay,
        goNext,
        goPrev,
        seek,
        setVolume,
        toggleShuffle,
        toggleLoop,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
