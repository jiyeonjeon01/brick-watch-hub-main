import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, RotateCcw, Download, Monitor, Brain, Gamepad2 } from "lucide-react";

interface PlayableSession {
  id: number;
  start_time: string;
  end_time: string | null;
  target_type: string;
  notes: string | null;
}

interface LiveViewProps {
  imgFrame: string;
  isTraining: boolean;
  mode: "training" | "play";
  playSessionId: number | null;
  playableSessions: PlayableSession[];
  onModeChange: (mode: "training" | "play") => void;
  onPlaySessionSelect: (id: number | null) => void;
  onStart: (playSessionId?: number) => void;
  onStop: () => void;
  onReset: () => void;
}

function formatSessionDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function LiveView({
  imgFrame,
  isTraining,
  mode,
  playSessionId,
  playableSessions,
  onModeChange,
  onPlaySessionSelect,
  onStart,
  onStop,
  onReset,
}: LiveViewProps) {
  const canStart = mode === "training" || (mode === "play" && playSessionId != null);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4" />
          Live Simulation
          {isTraining && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              {mode === "play" ? "Play" : "Training"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {/* 실행 모드 선택 */}
        {!isTraining && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <Label className="text-xs">실행 모드</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "training" ? "default" : "outline"}
                size="sm"
                onClick={() => onModeChange("training")}
              >
                <Brain className="mr-1 h-3 w-3" />
                새 학습
              </Button>
              <Button
                type="button"
                variant={mode === "play" ? "default" : "outline"}
                size="sm"
                onClick={() => onModeChange("play")}
              >
                <Gamepad2 className="mr-1 h-3 w-3" />
                저장된 모델로 플레이
              </Button>
            </div>
            {mode === "play" && (
              <div className="space-y-2">
                <Label className="text-xs">모델 선택 (과거 학습 세션)</Label>
                <Select
                  value={playSessionId?.toString() ?? ""}
                  onValueChange={(v) => onPlaySessionSelect(v ? +v : null)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="세션 선택..." />
                  </SelectTrigger>
                  <SelectContent>
                    {playableSessions.length === 0 ? (
                      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                        저장된 모델 없음. 먼저 &quot;새 학습&quot;으로 학습 후 Stop 하면 저장됩니다.
                      </div>
                    ) : (
                      playableSessions.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          #{s.id} — {formatSessionDate(s.start_time)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* 시뮬레이션 화면 영역 */}
        <div className="flex flex-1 items-center justify-center rounded-lg border bg-muted/30 min-h-[240px]">
          {imgFrame ? (
            <img
              src={imgFrame.startsWith("data:") ? imgFrame : `data:image/png;base64,${imgFrame}`}
              alt="Breakout simulation frame"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Monitor className="h-10 w-10" />
              <p className="text-sm">Waiting for Backend Stream...</p>
            </div>
          )}
        </div>

        {/* 컨트롤 버튼 */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onStart(mode === "play" ? playSessionId ?? undefined : undefined)} disabled={isTraining || !canStart} size="sm">
            <Play className="mr-1 h-4 w-4" />
            {mode === "play" ? "Start Play" : "Start Training"}
          </Button>
          <Button onClick={onStop} disabled={!isTraining} variant="destructive" size="sm">
            <Square className="mr-1 h-4 w-4" />
            Stop
          </Button>
          <Button onClick={onReset} variant="outline" size="sm">
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset
          </Button>
          <Button variant="secondary" size="sm">
            <Download className="mr-1 h-4 w-4" />
            Download Model
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
