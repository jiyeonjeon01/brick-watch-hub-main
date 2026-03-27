import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, Wifi, WifiOff, Settings, Brain, Layers } from "lucide-react";
import { getDqnConfig } from "@/lib/api";

const HYPERPARAMS_KEY = "hyperparams";

interface HyperParams {
  learningRate: string;
  gamma: string;
  batchSize: string;
  replayBufferSize: string;
  epsilonStart: string;
  epsilonEnd: string;
  epsilonDecay: string;
  targetUpdateFreq: string;
  optimizer: string;
  lossFunction: string;
}

interface ConnectionSettings {
  wsUrl: string;
  autoReconnect: boolean;
  reconnectInterval: string;
  maxRetries: string;
}

const defaultParams: HyperParams = {
  learningRate: "0.00025",
  gamma: "0.99",
  batchSize: "32",
  replayBufferSize: "10000",
  epsilonStart: "1.0",
  epsilonEnd: "0.01",
  epsilonDecay: "0.9995",
  targetUpdateFreq: "1000",
  optimizer: "adam",
  lossFunction: "huber",
};

function configToParams(c: Record<string, string | number>): HyperParams {
  return {
    learningRate: String(c.learning_rate ?? defaultParams.learningRate),
    gamma: String(c.gamma ?? defaultParams.gamma),
    batchSize: String(c.batch_size ?? defaultParams.batchSize),
    replayBufferSize: String(c.replay_buffer_size ?? defaultParams.replayBufferSize),
    epsilonStart: String(c.epsilon_start ?? defaultParams.epsilonStart),
    epsilonEnd: String(c.epsilon_min ?? defaultParams.epsilonEnd),
    epsilonDecay: String(c.epsilon_decay ?? defaultParams.epsilonDecay),
    targetUpdateFreq: "1000",
    optimizer: String(c.optimizer ?? "adam"),
    lossFunction: "huber",
  };
}

function paramsToHyperparams(p: HyperParams): Record<string, string | number> {
  return {
    learning_rate: parseFloat(p.learningRate) || 0.00025,
    gamma: parseFloat(p.gamma) || 0.99,
    batch_size: parseInt(p.batchSize, 10) || 32,
    replay_buffer_size: parseInt(p.replayBufferSize, 10) || 10000,
    epsilon_start: parseFloat(p.epsilonStart) || 1,
    epsilon_min: parseFloat(p.epsilonEnd) || 0.01,
    epsilon_decay: parseFloat(p.epsilonDecay) || 0.9995,
    optimizer: p.optimizer,
    lossFunction: p.lossFunction,
  };
}

const defaultConnection: ConnectionSettings = {
  wsUrl: "ws://localhost:9900/ws/training",
  autoReconnect: true,
  reconnectInterval: "3000",
  maxRetries: "10",
};

const SettingsPage = () => {
  const [params, setParams] = useState<HyperParams>(defaultParams);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(HYPERPARAMS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, string | number>;
        setParams(configToParams(parsed));
      } catch {
        /* ignore */
      }
    } else {
      getDqnConfig()
        .then((c) => {
          if (Object.keys(c).length > 0) setParams(configToParams(c));
        })
        .catch(() => {});
    }
    setLoaded(true);
  }, []);
  const [conn, setConn] = useState<ConnectionSettings>({
    ...defaultConnection,
    wsUrl:
      (typeof window !== "undefined" && localStorage.getItem("wsUrl")) ||
      defaultConnection.wsUrl,
  });
  const [wsConnected, setWsConnected] = useState(false);

  const updateParam = (key: keyof HyperParams, value: string) =>
    setParams((p) => ({ ...p, [key]: value }));

  const updateConn = (key: keyof ConnectionSettings, value: string | boolean) => {
    setConn((c) => {
      const next = { ...c, [key]: value };
      if (key === "wsUrl" && typeof value === "string") {
        localStorage.setItem("wsUrl", value);
      }
      return next;
    });
  };

  const handleSaveParams = () => {
    const hp = paramsToHyperparams(params);
    localStorage.setItem(HYPERPARAMS_KEY, JSON.stringify(hp));
    toast({ title: "Settings Saved", description: "다음 학습 시 이 설정이 적용됩니다." });
  };

  const handleResetParams = () => {
    setParams(defaultParams);
    localStorage.removeItem(HYPERPARAMS_KEY);
    toast({ title: "Reset", description: "기본값으로 초기화되었습니다." });
  };

  const handleTestConnection = () => {
    toast({ title: "Connection Test", description: `${conn.wsUrl} 연결 테스트 중...` });
    setWsConnected(false);
    const ws = new WebSocket(conn.wsUrl);
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        setWsConnected(false);
        toast({
          title: "Connection Failed",
          description: "백엔드 서버에 연결할 수 없습니다. (timeout)",
          variant: "destructive",
        });
      }
    }, 5000);
    ws.onopen = () => {
      clearTimeout(timeout);
      setWsConnected(true);
      toast({ title: "Connected", description: "백엔드 WebSocket 연결 성공!" });
      ws.close();
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      setWsConnected(false);
      toast({
        title: "Connection Failed",
        description: "백엔드 서버에 연결할 수 없습니다.",
        variant: "destructive",
      });
      ws.close();
    };
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">학습 파라미터 및 연결 설정</p>
      </div>

      {/* 하이퍼파라미터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Hyperparameters
          </CardTitle>
          <CardDescription>DQN 에이전트 학습 파라미터를 설정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Learning Rate & Gamma */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lr">Learning Rate (α)</Label>
              <Input id="lr" type="number" step="0.00001" min="0" value={params.learningRate} onChange={(e) => updateParam("learningRate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gamma">Discount Factor (γ)</Label>
              <Input id="gamma" type="number" step="0.01" min="0" max="1" value={params.gamma} onChange={(e) => updateParam("gamma", e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Batch & Replay */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="batch">Batch Size</Label>
              <Select value={params.batchSize} onValueChange={(v) => updateParam("batchSize", v)}>
                <SelectTrigger id="batch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["16", "32", "64", "128", "256"].map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replay">Replay Buffer Size</Label>
              <Input id="replay" type="number" step="10000" min="1000" value={params.replayBufferSize} onChange={(e) => updateParam("replayBufferSize", e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Epsilon */}
          <p className="text-sm font-medium text-foreground">ε-greedy Exploration</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="epsStart">ε Start</Label>
              <Input id="epsStart" type="number" step="0.1" min="0" max="1" value={params.epsilonStart} onChange={(e) => updateParam("epsilonStart", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epsEnd">ε End</Label>
              <Input id="epsEnd" type="number" step="0.01" min="0" max="1" value={params.epsilonEnd} onChange={(e) => updateParam("epsilonEnd", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epsDecay">ε Decay</Label>
              <Input id="epsDecay" type="number" step="0.001" min="0" value={params.epsilonDecay} onChange={(e) => updateParam("epsilonDecay", e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Target Update & Optimizer */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetUpdate">Target Network Update (steps)</Label>
              <Input id="targetUpdate" type="number" step="100" min="100" value={params.targetUpdateFreq} onChange={(e) => updateParam("targetUpdateFreq", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="optimizer">Optimizer</Label>
              <Select value={params.optimizer} onValueChange={(v) => updateParam("optimizer", v)}>
                <SelectTrigger id="optimizer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adam">Adam</SelectItem>
                  <SelectItem value="rmsprop">RMSProp</SelectItem>
                  <SelectItem value="sgd">SGD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loss">Loss Function</Label>
              <Select value={params.lossFunction} onValueChange={(v) => updateParam("lossFunction", v)}>
                <SelectTrigger id="loss"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="huber">Huber Loss</SelectItem>
                  <SelectItem value="mse">MSE</SelectItem>
                  <SelectItem value="smooth_l1">Smooth L1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveParams}>
              <Save className="mr-1 h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={handleResetParams}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WebSocket 연결 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            WebSocket Connection
            <Badge variant={wsConnected ? "default" : "secondary"} className="ml-auto text-xs">
              {wsConnected ? (
                <><Wifi className="mr-1 h-3 w-3" /> Connected</>
              ) : (
                <><WifiOff className="mr-1 h-3 w-3" /> Disconnected</>
              )}
            </Badge>
          </CardTitle>
          <CardDescription>백엔드 서버 연결을 설정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="wsUrl">WebSocket URL</Label>
            <Input id="wsUrl" value={conn.wsUrl} onChange={(e) => updateConn("wsUrl", e.target.value)} placeholder="ws://localhost:9900/ws/training" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Reconnect</Label>
              <p className="text-xs text-muted-foreground">연결이 끊어지면 자동으로 재연결합니다</p>
            </div>
            <Switch checked={conn.autoReconnect} onCheckedChange={(v) => updateConn("autoReconnect", v)} />
          </div>

          {conn.autoReconnect && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="interval">Reconnect Interval (ms)</Label>
                <Input id="interval" type="number" step="1000" min="1000" value={conn.reconnectInterval} onChange={(e) => updateConn("reconnectInterval", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retries">Max Retries</Label>
                <Input id="retries" type="number" min="1" value={conn.maxRetries} onChange={(e) => updateConn("maxRetries", e.target.value)} />
              </div>
            </div>
          )}

          <Button variant="outline" onClick={handleTestConnection}>
            <Wifi className="mr-1 h-4 w-4" />
            Test Connection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
