import { Card, CardContent } from "@/components/ui/card";
import { Hash, Target, Trophy, Footprints } from "lucide-react";

interface MetricCardsProps {
  episode: number;
  score: number;
  highScore: number;
  steps: number;
}

const metrics = [
  { key: "episode" as const, label: "Episode", icon: Hash },
  { key: "score" as const, label: "Current Score", icon: Target },
  { key: "highScore" as const, label: "High Score", icon: Trophy },
  { key: "steps" as const, label: "Steps", icon: Footprints },
];

export function MetricCards({ episode, score, highScore, steps }: MetricCardsProps) {
  const values = { episode, score, highScore, steps };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map(({ key, label, icon: Icon }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {values[key].toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
