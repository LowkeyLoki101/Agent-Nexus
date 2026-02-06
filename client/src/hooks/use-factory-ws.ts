import { useState, useEffect, useRef, useCallback } from "react";

export interface FactoryRoom {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  tools: string[];
  gridPosition: { row: number; col: number };
  capacity: number;
}

export type AgentStatus = "working" | "moving" | "idle" | "thinking";

export interface AgentGoal {
  longTerm: string;
  current: string;
  subGoal: string;
}

export interface AgentThought {
  text: string;
  timestamp: number;
}

export interface FactoryAgent {
  id: string;
  name: string;
  avatar: string;
  color: string;
  currentRoomId: string;
  previousRoomId: string | null;
  status: AgentStatus;
  currentTool: string | null;
  progress: number;
  goals: AgentGoal;
  thought: AgentThought;
  thoughtHistory: AgentThought[];
  taskDescription: string;
  movementLog: { roomId: string; timestamp: number }[];
}

export interface FactoryState {
  rooms: FactoryRoom[];
  agents: FactoryAgent[];
  tickCount: number;
  timestamp: number;
}

export function useFactoryWebSocket() {
  const [state, setState] = useState<FactoryState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/factory`);

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "factory-update") {
          setState(msg.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect after 2 seconds
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { state, connected };
}
