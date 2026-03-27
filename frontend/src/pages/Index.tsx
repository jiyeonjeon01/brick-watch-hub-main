import { useState, useEffect } from "react";
import { useBreakoutData } from "@/hooks/useBreakoutData";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { LiveView } from "@/components/dashboard/LiveView";
import { TrainingCharts } from "@/components/dashboard/TrainingCharts";
import { ConsoleLog } from "@/components/dashboard/ConsoleLog";
import { getPlayableSessions } from "@/lib/api";

const Index = () => {
  const { state, chartData, startTraining, stopTraining, resetTraining } = useBreakoutData();
  const [mode, setMode] = useState<"training" | "play">("training");
  const [playSessionId, setPlaySessionId] = useState<number | null>(null);
  const [playableSessions, setPlayableSessions] = useState<{ id: number; start_time: string; end_time: string | null; target_type: string; notes: string | null }[]>([]);

  useEffect(() => {
    if (mode === "play") {
      getPlayableSessions().then(setPlayableSessions);
    }
  }, [mode]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      {/* 상단 통계 카드 */}
      <MetricCards
        episode={state.episode}
        score={state.score}
        highScore={state.highScore}
        steps={state.steps}
      />

      {/* 중앙: 시뮬레이션 + 차트 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LiveView
          imgFrame={state.imgFrame}
          isTraining={state.isTraining}
          mode={mode}
          playSessionId={playSessionId}
          playableSessions={playableSessions}
          onModeChange={setMode}
          onPlaySessionSelect={setPlaySessionId}
          onStart={startTraining}
          onStop={stopTraining}
          onReset={resetTraining}
        />
        <TrainingCharts data={chartData} />
      </div>

      {/* 하단 콘솔 */}
      <ConsoleLog logs={state.logs} />
    </div>
  );
};

export default Index;
