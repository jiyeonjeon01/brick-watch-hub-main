/** Backend API base URL (port 9900) */
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:9900";

export async function startSession(hyperparams?: Record<string, string | number>): Promise<{ session_id: number }> {
  const body = hyperparams ? { hyperparams } : {};
  const res = await fetch(`${API_BASE}/start-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to start session");
  return res.json();
}

export async function endSession(sessionId: number): Promise<void> {
  await fetch(`${API_BASE}/end-session/${sessionId}`, {
    method: "POST",
  });
}

export async function getSessions(): Promise<
  { id: number; start_time: string; end_time: string | null; target_type: string; notes: string | null }[]
> {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function getHistory(
  sessionId: number
): Promise<{ step: number; episode: number; reward: number; loss: number; epsilon: number }[]> {
  const res = await fetch(`${API_BASE}/history/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

/** 시스템 로그 (training_logs, 세션 필터 가능) */
export async function getSystemLogs(sessionId?: number): Promise<
  { id: number; session_id: number; step: number; episode: number; reward: number; loss: number; epsilon: number; created_at: string }[]
> {
  const url = sessionId
    ? `${API_BASE}/logs?session_id=${sessionId}`
    : `${API_BASE}/logs`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

/** DQN 하이퍼파라미터 (실제 에이전트 설정) */
export async function getDqnConfig(): Promise<
  Record<string, string | number>
> {
  const res = await fetch(`${API_BASE}/config/dqn`);
  if (!res.ok) return {};
  return res.json();
}

/** 저장된 모델이 있는 세션 (플레이 모드용) */
export async function getPlayableSessions(): Promise<
  { id: number; start_time: string; end_time: string | null; target_type: string; notes: string | null }[]
> {
  const res = await fetch(`${API_BASE}/playable-sessions`);
  if (!res.ok) return [];
  return res.json();
}
