export interface SceneData {
  title: string;
  visual: string;
  narration: string;
  completed: boolean;
  updatedAt: number;
}

export interface AppState {
  scenes: Record<string, SceneData>;
}
