import { useState, useEffect, useCallback, useRef } from "react";
import type { BreakoutState, ChartDataPoint } from "@/types/breakout";
import { startSession, endSession } from "@/lib/api";

const DEFAULT_WS_URL = "ws://localhost:9900/ws/training";

function getWsUrl(): string {
  if (typeof window === "undefined") return DEFAULT_WS_URL;
  return localStorage.getItem("wsUrl") || DEFAULT_WS_URL;
}

const initialState: BreakoutState = {
  episode: 0,
  score: 0,
  highScore: 0,
  steps: 0,
  reward: 0,
  loss: 0,
  imgFrame: "",
  logs: ["[System] Dashboard initialized. Connect & Start Training to stream Breakout."],
  isTraining: false,
};

export function useBreakoutData() {
  const [state, setState] = useState<BreakoutState>(initialState);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const playSessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.isTraining) return;

    let ws: WebSocket | null = null;
    const playSessionId = playSessionIdRef.current;

    const connect = async () => {
      let wsUrl = getWsUrl();

      if (playSessionId != null) {
        // 플레이 모드: 저장된 모델로 게임
        wsUrl += wsUrl.includes("?") ? `&mode=play&session_id=${playSessionId}` : `?mode=play&session_id=${playSessionId}`;
        sessionIdRef.current = null;
      } else {
        // 학습 모드: 새 세션 생성 (Settings에서 저장한 hyperparams 전달)
        try {
          const hp = typeof window !== "undefined" ? localStorage.getItem("hyperparams") : null;
          const hyperparams = hp ? (JSON.parse(hp) as Record<string, string | number>) : undefined;
          const { session_id } = await startSession(hyperparams);
          sessionIdRef.current = session_id;
          wsUrl += wsUrl.includes("?") ? `&session_id=${session_id}` : `?session_id=${session_id}`;
        } catch {
          sessionIdRef.current = null;
        }
      }

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, playSessionId != null ? "[WebSocket] Play mode. Loaded saved model." : "[WebSocket] Connected. Logs saved to DB."],
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Partial<BreakoutState> & { logs?: string[] };
          setState((prev) => ({
            ...prev,
            imgFrame: data.imgFrame ?? prev.imgFrame,
            episode: data.episode ?? prev.episode,
            score: data.score ?? prev.score,
            steps: data.steps ?? prev.steps,
            reward: data.reward ?? prev.reward,
            loss: data.loss ?? prev.loss,
            highScore: Math.max(
              prev.highScore,
              typeof data.score === "number" ? data.score : prev.score
            ),
            logs: data.logs
              ? [...prev.logs, ...data.logs].slice(-200)
              : prev.logs,
          }));

          if (
            typeof data.reward === "number" &&
            typeof data.loss === "number"
          ) {
            setChartData((prev) =>
              [
                ...prev,
                {
                  episode: data.episode ?? prev.length,
                  reward: data.reward!,
                  loss: data.loss!,
                },
              ].slice(-100)
            );
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, "[WebSocket] Connection error. Is backend on port 9900?"],
        }));
      };

      ws.onclose = () => {
        wsRef.current = null;
        setState((prev) => ({ ...prev, isTraining: false }));
        const sid = sessionIdRef.current;
        if (sid != null && playSessionId == null) {
          endSession(sid).catch(() => {});
        }
        sessionIdRef.current = null;
        playSessionIdRef.current = null;
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [state.isTraining]);

  const startTraining = useCallback((playSessionId?: number) => {
    playSessionIdRef.current = playSessionId ?? null;
    setState((prev) => ({
      ...prev,
      isTraining: true,
      logs: [...prev.logs, playSessionId != null ? "[System] Loading saved model for play..." : "[System] Training started..."],
    }));
  }, []);

  const stopTraining = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isTraining: false,
      logs: [...prev.logs, "[System] Training stopped."],
    }));
  }, []);

  const resetTraining = useCallback(() => {
    setState({ ...initialState, logs: ["[System] Training reset. Ready to start."] });
    setChartData([]);
  }, []);

  return { state, chartData, startTraining, stopTraining, resetTraining };
}
