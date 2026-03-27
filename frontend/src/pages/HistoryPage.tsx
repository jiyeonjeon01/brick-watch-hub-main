import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSessions, getHistory } from "@/lib/api";
import { TrainingCharts } from "@/components/dashboard/TrainingCharts";
import type { ChartDataPoint } from "@/types/breakout";
import { History, Loader2 } from "lucide-react";

interface Session {
  id: number;
  start_time: string;
  end_time: string | null;
  target_type: string;
  notes: string | null;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = async (sessionId: number) => {
    setSelectedId(sessionId);
    setLoadingHistory(true);
    try {
      const logs = await getHistory(sessionId);
      setChartData(
        logs.map((l) => ({
          episode: l.episode,
          reward: l.reward,
          loss: l.loss,
        }))
      );
    } catch {
      setChartData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ko-KR");
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <h1 className="text-2xl font-bold text-foreground">Training History</h1>
      <p className="text-sm text-muted-foreground">
        과거 학습 세션을 선택하면 해당 세션의 Reward/Loss 차트를 Review 모드로 볼 수 있습니다.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Past Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                저장된 세션이 없습니다. Dashboard에서 학습을 실행하면 여기에 기록됩니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Button
                      variant={selectedId === s.id ? "secondary" : "ghost"}
                      className="w-full justify-start text-left"
                      onClick={() => loadHistory(s.id)}
                    >
                      <span className="truncate">
                        #{s.id} — {formatDate(s.start_time)}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {selectedId && (
            <p className="text-sm text-muted-foreground">
              Review: Session #{selectedId}
            </p>
          )}
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length > 0 ? (
            <TrainingCharts data={chartData} />
          ) : selectedId ? (
            <p className="py-8 text-sm text-muted-foreground">
              이 세션에 저장된 로그가 없습니다.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
