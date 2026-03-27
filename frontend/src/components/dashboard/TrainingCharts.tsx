import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import type { ChartDataPoint } from "@/types/breakout";

interface TrainingChartsProps {
  data: ChartDataPoint[];
}

const rewardConfig: ChartConfig = {
  reward: { label: "Reward", color: "hsl(var(--primary))" },
};

const lossConfig: ChartConfig = {
  loss: { label: "Loss", color: "hsl(var(--destructive))" },
};

export function TrainingCharts({ data }: TrainingChartsProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reward per Episode</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={rewardConfig} className="h-[140px] w-full">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="reward"
                stroke="var(--color-reward)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Loss per Episode</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lossConfig} className="h-[140px] w-full">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="episode" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="loss"
                stroke="var(--color-loss)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
