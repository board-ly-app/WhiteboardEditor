import {
  type UserSummary,
} from '@/types/WebSocketProtocol';

export interface ClientSummary extends UserSummary {
  // -- color used to indicate when a user is interacting with the interface
  color: string;
  cursorPos?: {
    x: number;
    y: number;
  };
}
