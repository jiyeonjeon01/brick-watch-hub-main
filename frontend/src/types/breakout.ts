export interface BreakoutState {
  episode: number;
  score: number;
  highScore: number;
  steps: number;
  reward: number;
  loss: number;
  imgFrame: string; // Base64 이미지 데이터
  logs: string[];
  isTraining: boolean;
}

export interface ChartDataPoint {
  episode: number;
  reward: number;
  loss: number;
}
