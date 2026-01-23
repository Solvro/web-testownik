import { Peer } from "peerjs";
import type { DataConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";

import { env } from "@/env";
import type { AnswerRecord, Question } from "@/types/quiz";

import { getDeviceFriendlyName, getDeviceType } from "../helpers/device-utils";

const PING_INTERVAL = 5000;
const PING_TIMEOUT = 15_000;

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
  question: Question;
  selectedAnswers: string[];
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
  | PongMessage;

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
  onQuestionUpdate: (q: Question, selected: string[]) => void;
  onAnswerChecked: (nextQuestion: Question | null) => void;
}

export function useQuizContinuity({
  enabled,
  quizId,
  getCurrentState,
  onInitialSync,
  onQuestionUpdate,
  onAnswerChecked,
  userId,
}: UseQuizContinuityOptions & { userId: string | null | undefined }) {
  const [peerConnections, setPeerConnections] = useState<DataConnection[]>([]);
  const [isHost, setIsHost] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const peerConnectionsRef = useRef<DataConnection[]>([]);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);

  const gracefulClose = () => {
    if (peerRef.current != null && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }
  };

  // util
  const send = (conn: DataConnection, data: PeerMessage) => {
    if (conn.open) {
      void conn.send(data);
    }
  };

  const broadcast = (data: PeerMessage) => {
    for (const c of peerConnectionsRef.current) {
      send(c, data);
    }
  };

  const broadcastExcept = (except: DataConnection, data: PeerMessage) => {
    for (const c of peerConnectionsRef.current) {
      if (c !== except) {
        send(c, data);
      }
    }
  };

  const initialSync = (conn: DataConnection) => {
    const {
      question,
      answers,
      startTime,
      wrongAnswers,
      correctAnswers,
      selectedAnswers,
    } = getCurrentState();
    if (question === null) {
      return;
    }
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
        const conn = peer.connect(peerId, {
          metadata: { device: getDeviceFriendlyName(), type: getDeviceType() },
        });
        conn.on("open", () => {
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
    if (isInitializingRef.current || !isMountedRef.current) {
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
        if (!isMountedRef.current) {
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
            if (!isMountedRef.current) {
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
    if (!enabled) {
      return;
    }
    if (userId == null) {
      return;
    }
    // Initialize ref with current state on (re)enable
    peerConnectionsRef.current = peerConnections;
    isMountedRef.current = true;

    init();

    const interval = setInterval(pingPeers, PING_INTERVAL);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      gracefulClose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    isHost,
    peerConnections,
    broadcast,
    broadcastExcept,
    sendAnswerChecked: (nextQuestion: Question | null) => {
      broadcast({ type: "answer_checked", nextQuestion });
    },
    sendQuestionUpdate: (question: Question, selectedAnswers: string[]) => {
      broadcast({ type: "question_update", question, selectedAnswers });
    },
  };
}
