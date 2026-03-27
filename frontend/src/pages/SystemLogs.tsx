import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Terminal, AlertTriangle, Info, XCircle, Clock, Loader2 } from "lucide-react";
import { getSystemLogs, getSessions } from "@/lib/api";

type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

interface LogRow {
  id: number;
  session_id: number;
  step: number;
  episode: number;
  reward: number;
  loss: number;
  epsilon: number;
  created_at: string;
}

function deriveLevel(row: LogRow): LogLevel {
  if (row.loss > 1.5 || (row.reward < -2 && row.loss > 0.5)) return "ERROR";
  if (row.loss > 0.5 || row.reward < 0) return "WARN";
  return "INFO";
}

function rowToLogEntry(row: LogRow): LogEntry {
  const level = deriveLevel(row);
  const msg = `Step ${row.step} | Episode ${row.episode} | Reward ${row.reward.toFixed(2)} | Loss ${row.loss.toFixed(4)} | ε ${row.epsilon.toFixed(3)}`;
  let timeStr = "";
  try {
    timeStr = new Date(row.created_at).toLocaleTimeString("ko-KR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    timeStr = row.created_at;
  }
  return {
    id: row.id,
    timestamp: timeStr,
    level,
    source: `Session #${row.session_id}`,
    message: msg,
  };
}

const levelConfig: Record<LogLevel, { icon: typeof Info; badgeClass: string }> = {
  INFO: { icon: Info, badgeClass: "bg-primary/10 text-primary border-primary/20" },
  WARN: { icon: AlertTriangle, badgeClass: "bg-accent text-accent-foreground border-accent" },
  ERROR: { icon: XCircle, badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
};

const timeRanges = [
  { label: "All", value: "all" },
  { label: "Last 5 min", value: "5" },
  { label: "Last 15 min", value: "15" },
  { label: "Last 1 hour", value: "60" },
];

function formatSessionLabel(s: { id: number; start_time: string }) {
  try {
    const d = new Date(s.start_time);
    return `#${s.id} — ${d.toLocaleString("ko-KR")}`;
  } catch {
    return `#${s.id}`;
  }
}

const SystemLogs = () => {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | LogLevel>("ALL");
  const [timeRange, setTimeRange] = useState("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [sessions, setSessions] = useState<{ id: number; start_time: string }[]>([]);
  const [rawLogs, setRawLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions().then((list) => setSessions(list)).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const sid = sessionFilter === "all" ? undefined : +sessionFilter;
    getSystemLogs(sid)
      .then(setRawLogs)
      .catch(() => setRawLogs([]))
      .finally(() => setLoading(false));
  }, [sessionFilter]);

  const logs = useMemo(() => rawLogs.map(rowToLogEntry), [rawLogs]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return logs.filter((log) => {
      if (levelFilter !== "ALL" && log.level !== levelFilter) return false;
      if (timeRange !== "all" && rawLogs.length > 0) {
        const row = rawLogs.find((r) => r.id === log.id);
        if (row?.created_at) {
          const t = new Date(row.created_at).getTime();
          if (now - t > parseInt(timeRange) * 60 * 1000) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          log.message.toLowerCase().includes(q) ||
          log.source.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, rawLogs, search, levelFilter, timeRange]);

  const counts = useMemo(
    () => ({
      INFO: logs.filter((l) => l.level === "INFO").length,
      WARN: logs.filter((l) => l.level === "WARN").length,
      ERROR: logs.filter((l) => l.level === "ERROR").length,
    }),
    [logs]
  );

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Logs</h1>
        <p className="text-sm text-muted-foreground">실제 학습 로그 (training_logs 기반)</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {(["INFO", "WARN", "ERROR"] as LogLevel[]).map((level) => {
          const cfg = levelConfig[level];
          const Icon = cfg.icon;
          return (
            <Card
              key={level}
              className={`cursor-pointer transition-shadow hover:shadow-md ${levelFilter === level ? "ring-2 ring-ring" : ""}`}
              onClick={() => setLevelFilter(levelFilter === level ? "ALL" : level)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{level}</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{counts[level]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 필터 바 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">세션</p>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="세션" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {formatSessionLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as "ALL" | LogLevel)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Levels</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Clock className="mr-1 h-4 w-4" />
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              {timeRanges.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setLevelFilter("ALL");
              setTimeRange("all");
            }}
          >
            Clear
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} logs</span>
        </CardContent>
      </Card>

      {/* 로그 목록 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            Log Stream
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Terminal className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">로그 없음</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dashboard에서 학습을 실행하면 여기에 로그가 쌓입니다.
                  </p>
                </div>
              ) : (
                filtered.map((log) => {
                  const cfg = levelConfig[log.level];
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors"
                    >
                      <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground w-[70px]">
                        {log.timestamp}
                      </span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] px-1.5 py-0 ${cfg.badgeClass}`}
                      >
                        {log.level}
                      </Badge>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground w-[85px]">
                        [{log.source}]
                      </span>
                      <span className="font-mono text-xs text-foreground break-all">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemLogs;
