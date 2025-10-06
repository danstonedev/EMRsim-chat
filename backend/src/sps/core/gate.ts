import { GateFlags, GateState } from './types';

// Legacy gate state helper retained for compatibility with existing telemetry.
// Conversation flow is never blocked, so we permanently report an unlocked state.
export const nextGateState = (_gate?: GateFlags): GateState => 'UNLOCKED';
