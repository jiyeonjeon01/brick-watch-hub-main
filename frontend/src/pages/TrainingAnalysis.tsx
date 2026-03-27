import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Brain, Zap, Target, Layers, Loader2 } from "lucide-react";
import { getSessions, getHistory, getDqnConfig } from "@/lib/api";

interface LogRow {
  step: number;
  episode: number;
  reward: number;
  loss: number;
  epsilon: number;
}

interface SessionItem {
  id: number;
  start_time: string;
  end_time: string | null;
  target_type: string;
  notes: string | null;
}

/** 로그를 에피소드 단위로 집계 */
function aggregateByEpisode(logs: LogRow[]) {
  const byEpisode = new Map<number, { rewards: number[]; losses: number[]; epsilons: number[] }>();
  for (const log of logs) {
    const ep = log.episode;
    if (!byEpisode.has(ep)) byEpisode.set(ep, { rewards: [], losses: [], epsilons: [] });
    const row = byEpisode.get(ep)!;
    row.rewards.push(log.reward);
    row.losses.push(log.loss);
    row.epsilons.push(log.epsilon);
  }

  const episodes = Array.from(byEpisode.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ep, data]) => ({
      episode: ep,
      reward: +data.rewards.reduce((a, b) => a + b, 0).toFixed(2),
      loss: +(
        data.losses.reduce((a, b) => a + b, 0) / data.losses.length
      ).toFixed(4),
      epsilon: data.epsilons[data.epsilons.length - 1] ?? 0,
    }));

  let cum = 0;
  return episodes.map((d, i) => {
    cum += d.reward;
    return {
      ...d,
      avgReward: +(cum / (i + 1)).toFixed(2),
    };
  });
}

const rewardConfig: ChartConfig = {
  reward: { label: "Reward", color: "hsl(var(--primary))" },
  avgReward: { label: "Avg Reward (MA)", color: "hsl(var(--destructive))" },
};

const epsilonConfig: ChartConfig = {
  epsilon: { label: "Epsilon (ε)", color: "hsl(280 70% 55%)" },
};

const lossConfig: ChartConfig = {
  loss: { label: "Loss", color: "hsl(var(--destructive))" },
};

const HYPERPARAM_LABELS: Record<string, string> = {
  algorithm: "Algorithm",
  learning_rate: "Learning Rate (α)",
  gamma: "Discount Factor (γ)",
  epsilon_start: "Epsilon Start (ε)",
  epsilon_min: "Epsilon End",
  epsilon_decay: "Epsilon Decay",
  batch_size: "Batch Size",
  replay_buffer_size: "Replay Buffer Size",
  optimizer: "Optimizer",
  network: "Network",
};

function formatSessionLabel(s: SessionItem) {
  try {
    const d = new Date(s.start_time);
    return `#${s.id} — ${d.toLocaleString("ko-KR")}`;
  } catch {
    return `#${s.id}`;
  }
}

const TrainingAnalysis = () => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [dqnConfig, setDqnConfig] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    getSessions()
      .then((list) => {
        setSessions(list);
        if (list.length > 0 && !selectedSessionId) {
          setSelectedSessionId(String(list[0].id));
        }
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getDqnConfig().then(setDqnConfig);
  }, []);

  useEffect(() => {
    const id = selectedSessionId ? +selectedSessionId : 0;
    if (!id) {
      setLogs([]);
      return;
    }
    setLoadingHistory(true);
    getHistory(id)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoadingHistory(false));
  }, [selectedSessionId]);

  const data = useMemo(() => aggregateByEpisode(logs), [logs]);

  const { latest, prev, stats } = useMemo(() => {
    if (data.length === 0)
      return {
        latest: { reward: 0, avgReward: 0, epsilon: 0, loss: 0 },
        prev: { reward: 0, avgReward: 0 },
        stats: { maxReward: 0, minReward: 0, avgReward: 0, rewardTrend: false },
      };
    const l = data[data.length - 1];
    const p = data[data.length - 2] ?? l;
    const rewards = data.map((d) => d.reward);
    return {
      latest: l,
      prev: p,
      stats: {
        maxReward: Math.max(...rewards),
        minReward: Math.min(...rewards),
        avgReward: +(rewards.reduce((a, b) => a + b, 0) / rewards.length).toFixed(1),
        rewardTrend: l.avgReward > p.avgReward,
      },
    };
  }, [data]);

  const selectedSession = sessions.find((s) => String(s.id) === selectedSessionId);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Training Analysis</h1>
          <p className="text-sm text-muted-foreground">실제 학습 데이터 기반 에피소드별 상세 분석</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">분석할 세션</Label>
          <Select value={selectedSessionId} onValueChange={setSelectedSessionId} disabled={loading}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="세션 선택..." />
            </SelectTrigger>
            <SelectContent>
              {sessions.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {loading ? "로딩 중..." : "저장된 세션 없음 (Dashboard에서 학습 실행)"}
                </div>
              ) : (
                sessions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {formatSessionLabel(s)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingHistory ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">데이터 없음</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedSessionId
                ? "이 세션에 저장된 로그가 없습니다."
                : "세션을 선택하거나 Dashboard에서 학습을 실행하세요."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 요약 통계 카드 */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Reward</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{stats.maxReward}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  {stats.rewardTrend ? (
                    <TrendingUp className="h-5 w-5 text-primary" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Reward</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{stats.avgReward}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Episodes</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{data.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current ε</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{latest.epsilon.toFixed(3)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 보상 추이 차트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Episode Reward Trend</CardTitle>
              <CardDescription>에피소드별 보상 및 누적 평균</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={rewardConfig} className="h-[250px] w-full">
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="reward" stroke="var(--color-reward)" fill="var(--color-reward)" fillOpacity={0.1} strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="avgReward" stroke="var(--color-avgReward)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Epsilon & Loss 차트 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Epsilon Decay (ε-greedy)</CardTitle>
                <CardDescription>탐험 → 활용 전환 곡선</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={epsilonConfig} className="h-[180px] w-full">
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="epsilon" stroke="var(--color-epsilon)" fill="var(--color-epsilon)" fillOpacity={0.15} strokeWidth={2} dot={false} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Training Loss</CardTitle>
                <CardDescription>에피소드별 평균 Loss</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={lossConfig} className="h-[180px] w-full">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="loss" stroke="var(--color-loss)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* 하이퍼파라미터 테이블 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" />
                Hyperparameters
              </CardTitle>
              <CardDescription>현재 DQN 에이전트 설정</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(dqnConfig).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-4">
                        백엔드에서 로드 중...
                      </TableCell>
                    </TableRow>
                  ) : (
                  Object.entries(dqnConfig).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        {HYPERPARAM_LABELS[key] ?? key}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {typeof value === "number" && value >= 1000
                            ? value.toLocaleString()
                            : String(value)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TrainingAnalysis;
