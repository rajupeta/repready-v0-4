export interface SSEEvent {
  type: 'transcript' | 'coaching_prompt' | 'session_complete' | 'heartbeat';
  data: Record<string, unknown>;
}
