export type ContentMessage =
  | { type: 'GET_VIDEO_SPEED' }
  | { type: 'SET_VIDEO_SPEED'; speed: number };

export interface VideoSpeedResponse {
  ok: boolean;
  speed?: number;
  error?: string;
}
