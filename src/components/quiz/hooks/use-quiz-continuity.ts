import { Peer } from "peerjs";
import type { DataConnection } from "peerjs";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { env } from "@/env";
import type { AnswerRecord, Question, QuizSession } from "@/types/quiz";

import { getDeviceFriendlyName, getDeviceType } from "../helpers/device-utils";

const PING_INTERVAL = 5000;
const PING_TIMEOUT = 15_000;
const DISCONNECT_SESSION_STORAGE_KEY_PREFIX = "quiz-continuity-disconnected";
const DISCONNECT_SESSION_STORAGE_EVENT = "quiz-continuity-disconnect-change";

const TURN_USERNAME = env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_CREDENTIAL = env.NEXT_PUBLIC_TURN_CREDENTIAL;

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(Boolean(TURN_USERNAME) && Boolean(TURN_CREDENTIAL)
      ? [
          {
            urls: "turn:eu-central.turnix.io:3478?transport=udp",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
          {
            urls: "turn:eu-central.turnix.io:3478?transport=tcp",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
          {
            urls: "turns:eu-central.turnix.io:443?transport=udp",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
          {
            urls: "turns:eu-central.turnix.io:443?transport=tcp",
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
};

interface InitialSyncMessage {
  type: "initial_sync";
  startTime: number;
  correctAnswersCount: number;
  wrongAnswersCount: number;
  answers: AnswerRecord[];
  studyTime: number;
}
interface QuestionUpdateMessage {
  type: "question_update";
  question: Question | null;
  selectedAnswers: string[];
}
interface ResetProgressMessage {
  type: "reset_progress";
  session: QuizSession;
}
interface AnswerCheckedMessage {
  type: "answer_checked";
  nextQuestion: Question | null;
}
interface PingMessage {
  type: "ping";
}
interface PongMessage {
  type: "pong";
}

export type PeerMessage =
  | InitialSyncMessage
  | QuestionUpdateMessage
  | AnswerCheckedMessage
  | PingMessage
  | PongMessage
  | ResetProgressMessage;

interface UseQuizContinuityOptions {
  enabled: boolean;
  quizId: string;
  getCurrentState: () => {
    question: Question | null;
    answers: AnswerRecord[];
    startTime: number;
    wrongAnswers: number;
    correctAnswers: number;
    selectedAnswers: string[];
  };
  onInitialSync: (d: {
    startTime: number;
    correctAnswersCount: number;
    wrongAnswersCount: number;
    answers?: AnswerRecord[];
    studyTime?: number;
  }) => void;
  onQuestionUpdate: (q: Question | null, selected: string[]) => void;
  onAnswerChecked: (nextQuestion: Question | null) => void;
  onResetProgress: (session: QuizSession) => void;
}

const subscribeToDisconnectPreference = (
  onStoreChange: () => void,
): (() => void) => {
  window.addEventListener(DISCONNECT_SESSION_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener(DISCONNECT_SESSION_STORAGE_EVENT, onStoreChange);
  };
};

const emitDisconnectPreferenceChange = () => {
  window.dispatchEvent(new Event(DISCONNECT_SESSION_STORAGE_EVENT));
};

const getStoredDisconnectPreference = (storageKey: string | null): boolean =>
  storageKey == null ? false : sessionStorage.getItem(storageKey) === "true";

export function useQuizContinuity({
  enabled,
  quizId,
  getCurrentState,
  onInitialSync,
  onQuestionUpdate,
  onAnswerChecked,
  onResetProgress,
  userId,
}: UseQuizContinuityOptions & { userId: string | null | undefined }) {
  const [peerConnections, setPeerConnections] = useState<DataConnection[]>([]);
  const [isHost, setIsHost] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const peerConnectionsRef = useRef<DataConnection[]>([]);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isDisconnectedRef = useRef(false);
  const isShuttingDownRef = useRef(false);
  const disconnectStorageKey =
    userId == null
      ? null
      : `${DISCONNECT_SESSION_STORAGE_KEY_PREFIX}:${quizId}:${userId}`;
  const isDisconnected = useSyncExternalStore(
    subscribeToDisconnectPreference,
    () => getStoredDisconnectPreference(disconnectStorageKey),
    () => false,
  );

  const gracefulClose = () => {
    isShuttingDownRef.current = true;
    for (const conn of peerConnectionsRef.current) {
      conn.close();
    }
    peerConnectionsRef.current = [];
    setPeerConnections([]);
    setIsHost(false);
    isInitializingRef.current = false;
    if (peerRef.current != null && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }
    peerRef.current = null;
    setTimeout(() => {
      isShuttingDownRef.current = false;
    }, 0);
  };

  // util
  const send = (conn: DataConnection, data: PeerMessage) => {
    if (!isDisconnectedRef.current && conn.open) {
      void conn.send(data);
    }
  };

  const broadcast = (data: PeerMessage) => {
    if (isDisconnectedRef.current) {
      return;
    }
    for (const c of peerConnectionsRef.current) {
      send(c, data);
    }
  };

  const broadcastExcept = (except: DataConnection, data: PeerMessage) => {
    if (isDisconnectedRef.current) {
      return;
    }
    for (const c of peerConnectionsRef.current) {
      if (c !== except) {
        send(c, data);
      }
    }
  };

  const initialSync = (conn: DataConnection) => {
    if (isDisconnectedRef.current) {
      return;
    }
    const {
      question,
      answers,
      startTime,
      wrongAnswers,
      correctAnswers,
      selectedAnswers,
    } = getCurrentState();

    send(conn, {
      type: "initial_sync",
      startTime,
      correctAnswersCount: correctAnswers,
      wrongAnswersCount: wrongAnswers,
      answers,
      studyTime: 0,
    });
    send(conn, { type: "question_update", question, selectedAnswers });
  };

  const connectToPeer = async (peer: Peer, peerId: string) => {
    return new Promise<DataConnection>((resolve, reject) => {
      function doConnect() {
        if (isDisconnectedRef.current) {
          reject(new Error("Continuity is disconnected for this quiz."));
          return;
        }
        const conn = peer.connect(peerId, {
          metadata: { device: getDeviceFriendlyName(), type: getDeviceType() },
        });
        conn.on("open", () => {
          if (isDisconnectedRef.current) {
            conn.close();
            reject(new Error("Continuity is disconnected for this quiz."));
            return;
          }
          setPeerConnections((p) => {
            const next = [...p, conn];
            peerConnectionsRef.current = next;
            return next;
          });
          resolve(conn);
        });
        conn.on("error", reject);
      }
      if (peer.open) {
        doConnect();
      } else {
        peer.once("open", doConnect);
        peer.once("error", reject);
      }
    });
  };

  const handleClientData = (data: PeerMessage) => {
    if (isDisconnectedRef.current) {
      return;
    }
    switch (data.type) {
      case "initial_sync": {
        onInitialSync({
          startTime: data.startTime,
          correctAnswersCount: data.correctAnswersCount,
          wrongAnswersCount: data.wrongAnswersCount,
          answers: data.answers,
          studyTime: data.studyTime,
        });
        break;
      }
      case "question_update": {
        onQuestionUpdate(data.question, data.selectedAnswers);
        break;
      }
      case "answer_checked": {
        onAnswerChecked(data.nextQuestion);
        break;
      }
      case "reset_progress": {
        onResetProgress(data.session);
        break;
      }
      case "ping": {
        if (peerConnectionsRef.current.length > 0) {
          send(peerConnectionsRef.current[0], { type: "pong" });
        }
        break;
      }
      case "pong": {
        // ignore
        break;
      }
      default: {
        break;
      }
    }
  };

  const handleHostData = (conn: DataConnection, data: PeerMessage) => {
    if (isDisconnectedRef.current) {
      return;
    }
    switch (data.type) {
      case "question_update": {
        onQuestionUpdate(data.question, data.selectedAnswers);
        broadcastExcept(conn, data);
        break;
      }
      case "answer_checked": {
        onAnswerChecked(data.nextQuestion);
        broadcastExcept(conn, data);
        break;
      }
      case "reset_progress": {
        onResetProgress(data.session);
        broadcastExcept(conn, data);
        break;
      }
      case "ping": {
        send(conn, { type: "pong" });
        break;
      }
      case "initial_sync":
      case "pong": {
        // ignore
        break;
      }
      default: {
        break;
      }
    }
  };

  function init() {
    if (
      isDisconnectedRef.current ||
      isInitializingRef.current ||
      !isMountedRef.current
    ) {
      return;
    }
    isInitializingRef.current = true;
    gracefulClose();

    if (userId == null) {
      isInitializingRef.current = false;
      return;
    }
    const baseId = `${quizId}_${userId}`.replaceAll("/", "");
    try {
      const hostPeer = new Peer(baseId, { config: RTC_CONFIG });
      hostPeer.on("open", () => {
        if (isDisconnectedRef.current || !isMountedRef.current) {
          hostPeer.destroy();
          return;
        }
        peerRef.current = hostPeer;
        setIsHost(true);
        isInitializingRef.current = false;
      });
      hostPeer.on("connection", handleHostConnection);
      hostPeer.on("error", (error: unknown) => {
        const peerError = error as { type?: string };
        if (peerError.type === "unavailable-id") {
          const clientPeer = new Peer({ config: RTC_CONFIG });
          clientPeer.on("open", () => {
            if (isDisconnectedRef.current || !isMountedRef.current) {
              clientPeer.destroy();
              return;
            }
            peerRef.current = clientPeer;
            setIsHost(false);
            connectToPeer(clientPeer, baseId)
              .then((conn) => {
                if (!isMountedRef.current) {
                  conn.close();
                  return;
                }
                conn.on("data", (d) => {
                  handleClientData(d as PeerMessage);
                });
                isInitializingRef.current = false;
              })
              .catch(() => {
                isInitializingRef.current = false;
              });
          });
          clientPeer.on("connection", (c) =>
            c.on("data", (d) => {
              handleClientData(d as PeerMessage);
            }),
          );
        } else {
          isInitializingRef.current = false;
        }
      });
    } catch {
      isInitializingRef.current = false;
    }
  }

  function handleClose(conn: DataConnection) {
    setPeerConnections((p) => {
      const next = p.filter((c) => c.open && c.peer !== conn.peer);
      peerConnectionsRef.current = next;
      return next;
    });
    if (
      isDisconnectedRef.current ||
      isShuttingDownRef.current ||
      !isMountedRef.current
    ) {
      return;
    }
    if (!isHost && peerRef.current != null && !peerRef.current.destroyed) {
      connectToPeer(peerRef.current, conn.peer)
        .then((c) => {
          c.on("data", (d) => {
            handleClientData(d as PeerMessage);
          });
        })
        .catch(() => {
          init();
        });
    } else {
      init();
    }
  }

  function handleHostConnection(conn: DataConnection) {
    if (isDisconnectedRef.current) {
      conn.close();
      return;
    }
    setPeerConnections((p) => {
      const next = [...p, conn];
      peerConnectionsRef.current = next;
      return next;
    });
    conn.on("open", () => {
      initialSync(conn);
    });
    conn.on("data", (d) => {
      handleHostData(conn, d as PeerMessage);
    });
    conn.on("close", () => {
      handleClose(conn);
    });
  }

  const pingPeers = () => {
    if (isDisconnectedRef.current) {
      return;
    }
    for (const conn of peerConnectionsRef.current) {
      if (!conn.open) {
        continue;
      }
      send(conn, { type: "ping" });
      const timeout = setTimeout(() => {
        conn.close();
      }, PING_TIMEOUT);
      conn.on("data", (d) => {
        if ((d as PeerMessage).type === "pong") {
          clearTimeout(timeout);
        }
      });
    }
  };

  useEffect(() => {
    isDisconnectedRef.current = isDisconnected;
  }, [isDisconnected]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || userId == null || isDisconnected) {
      return () => {
        isMountedRef.current = false;
        gracefulClose();
      };
    }

    // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-live-state-to-parent
    init();

    const interval = setInterval(pingPeers, PING_INTERVAL);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      gracefulClose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, isDisconnected]);

  return {
    isDisconnected,
    isHost,
    peerConnections,
    broadcast,
    broadcastExcept,
    disconnect: () => {
      if (disconnectStorageKey != null) {
        sessionStorage.setItem(disconnectStorageKey, "true");
      }
      isDisconnectedRef.current = true;
      emitDisconnectPreferenceChange();
      gracefulClose();
    },
    reconnect: () => {
      if (disconnectStorageKey != null) {
        sessionStorage.removeItem(disconnectStorageKey);
      }
      isDisconnectedRef.current = false;
      emitDisconnectPreferenceChange();
    },
    sendAnswerChecked: (nextQuestion: Question | null) => {
      broadcast({ type: "answer_checked", nextQuestion });
    },
    sendQuestionUpdate: (
      question: Question | null,
      selectedAnswers: string[],
    ) => {
      broadcast({ type: "question_update", question, selectedAnswers });
    },
    sendResetProgress: (session: QuizSession) => {
      broadcast({ type: "reset_progress", session });
    },
  };
}
