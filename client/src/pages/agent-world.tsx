import { useQuery, useMutation } from "@tanstack/react-query";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PointerLockControls, Text, Billboard, RoundedBox, Sky } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useRef, useState, useMemo, useCallback, Suspense, Component, type ReactNode, useEffect } from "react";
import * as THREE from "three";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent, Briefing, Workspace, ApiToken } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, X, Shield, Zap, Maximize2, Minimize2, AlertTriangle, Activity,
  Send, MessageSquare, ChevronDown, ChevronUp, Loader2,
  Radio, Plus, Key, Wrench, Globe as GlobeIcon, Search as SearchIcon,
  FileText, Code, Palette, Brain, Users, Coffee, Settings,
  ArrowRight, Newspaper, Gauge, Terminal,
  Play, Pause, Volume2, VolumeX,
  Upload, Paperclip, Table2, BarChart3, List, Image as ImageIcon, Video, Trash2,
} from "lucide-react";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("webgl2") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.warn("WebGL Error:", error.message); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function getToolsForRoom(room: FactoryRoom): { name: string; icon: string; description: string }[] {
  const lower = room.name.toLowerCase();
  if (lower.includes("research") || lower.includes("lab")) return [
    { name: "Web Scraper", icon: "search", description: "Scrape and analyze web content" },
    { name: "Data Analyzer", icon: "brain", description: "Process and visualize data sets" },
    { name: "Paper Reader", icon: "file", description: "Parse academic papers and extract insights" },
  ];
  if (lower.includes("code") || lower.includes("dev") || lower.includes("workshop") || lower.includes("ops")) return [
    { name: "Code Generator", icon: "code", description: "Generate code from specifications" },
    { name: "Test Runner", icon: "zap", description: "Execute automated test suites" },
    { name: "PR Reviewer", icon: "search", description: "Review code changes and provide feedback" },
  ];
  if (lower.includes("design") || lower.includes("creative") || lower.includes("content")) return [
    { name: "Asset Creator", icon: "palette", description: "Generate visual assets and mockups" },
    { name: "Wireframer", icon: "file", description: "Create wireframes from descriptions" },
    { name: "Style Guide", icon: "palette", description: "Maintain brand consistency" },
  ];
  if (lower.includes("strategy") || lower.includes("critic") || lower.includes("review")) return [
    { name: "Strategy Planner", icon: "brain", description: "Create strategic plans and roadmaps" },
    { name: "Risk Assessor", icon: "zap", description: "Evaluate and score project risks" },
    { name: "Dependency Mapper", icon: "search", description: "Map and analyze project dependencies" },
  ];
  if (lower.includes("comms") || lower.includes("forum") || lower.includes("collaboration")) return [
    { name: "Doc Writer", icon: "file", description: "Generate documentation automatically" },
    { name: "Status Reporter", icon: "zap", description: "Create status reports and updates" },
    { name: "Messenger", icon: "search", description: "Coordinate team communications" },
  ];
  if (lower.includes("break")) return [
    { name: "Team Pulse", icon: "brain", description: "Measure team morale and wellness" },
    { name: "Idea Board", icon: "palette", description: "Capture and vote on creative ideas" },
  ];
  return [
    { name: "Task Runner", icon: "zap", description: "Execute workspace tasks" },
    { name: "Analyzer", icon: "brain", description: "Analyze data and reports" },
    { name: "Reporter", icon: "file", description: "Generate reports and summaries" },
  ];
}

interface FactoryRoom {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  capabilities: string[];
}

const ROOM_COLORS = [
  "#3B82F6", "#10B981", "#F97316", "#8B5CF6", "#EC4899", "#E5A824",
  "#06B6D4", "#EF4444", "#84CC16", "#A855F7", "#14B8A6", "#F59E0B",
  "#6366F1", "#D946EF", "#0EA5E9", "#22C55E",
];

const DEFAULT_OBJECTIVES = [
  "Working on project tasks", "Analyzing data", "Preparing deliverables",
  "Reviewing documents", "Collaborating with team", "Brainstorming ideas",
];

const BREAK_ROOM: FactoryRoom = {
  id: "break-room", name: "Break Room", position: [0, 0, 0], size: [5, 3, 5], color: "#E5A824", capabilities: [],
};

type ActivityAnim = "typing" | "reading" | "painting" | "presenting" | "chatting" | "resting";

function getAnimationForRoom(name: string): ActivityAnim {
  const lower = name.toLowerCase();
  if (lower.includes("research") || lower.includes("lab")) return "reading";
  if (lower.includes("code") || lower.includes("workshop") || lower.includes("engineer")) return "typing";
  if (lower.includes("design") || lower.includes("studio") || lower.includes("creative")) return "painting";
  if (lower.includes("strategy") || lower.includes("command")) return "presenting";
  if (lower.includes("comms") || lower.includes("forum") || lower.includes("newsroom")) return "chatting";
  if (lower.includes("break")) return "resting";
  const anims: ActivityAnim[] = ["typing", "reading", "painting", "presenting", "chatting"];
  return anims[Math.abs(name.charCodeAt(0)) % anims.length];
}

function getObjectivesForRoom(name: string): string[] {
  const lower = name.toLowerCase();
  if (lower.includes("research") || lower.includes("lab")) return ["Analyzing data patterns", "Researching best practices", "Compiling report", "Reading academic papers", "Running experiments", "Reviewing findings"];
  if (lower.includes("code") || lower.includes("workshop") || lower.includes("engineer")) return ["Reviewing pull request", "Running test suite", "Refactoring module", "Code optimization", "Debugging issue", "Writing unit tests"];
  if (lower.includes("design") || lower.includes("studio") || lower.includes("creative")) return ["Designing new feature", "Creating visual assets", "Sketching wireframes", "Iterating on mockup", "Building prototype", "Polishing UI details"];
  if (lower.includes("strategy") || lower.includes("command")) return ["Drafting strategy brief", "Architecture review", "Planning roadmap", "Evaluating options", "Writing proposal", "Mapping dependencies"];
  if (lower.includes("comms") || lower.includes("forum") || lower.includes("newsroom")) return ["Team sync meeting", "Writing documentation", "Coordinating rollout", "Reviewing comms plan", "Sending status update", "Preparing broadcast"];
  if (lower.includes("break")) return ["Taking a break", "Resting", "Grabbing coffee", "Stretching", "Casual chat", "Recharging"];
  if (lower.includes("critic") || lower.includes("review") || lower.includes("qa")) return ["Peer reviewing work", "Writing critique", "Finding edge cases", "Stress testing ideas", "Challenging assumptions", "Grading output quality"];
  if (lower.includes("solar") || lower.includes("energy") || lower.includes("hardware")) return ["Running simulations", "Testing prototype", "Measuring efficiency", "Analyzing field data", "Optimizing design", "Writing technical spec"];
  return ["Working on project tasks", "Preparing deliverables", "Reviewing documents", "Collaborating on goals", "Brainstorming solutions", "Tracking progress"];
}

function generateRooms(workspaces: Workspace[]): FactoryRoom[] {
  if (!workspaces || workspaces.length === 0) {
    return [
      { id: "default-room", name: "Main Studio", position: [0, 0, -4], size: [5, 3, 5], color: "#3B82F6", capabilities: [] },
      BREAK_ROOM,
    ];
  }

  const cols = Math.ceil(Math.sqrt(workspaces.length + 1));
  const spacing = 9;

  const rooms: FactoryRoom[] = workspaces.map((ws, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = (col - (cols - 1) / 2) * spacing;
    const z = (row - Math.floor((workspaces.length / cols) / 2)) * spacing;
    return {
      id: ws.id,
      name: ws.name,
      position: [x, 0, z] as [number, number, number],
      size: [5, 3, 5] as [number, number, number],
      color: ROOM_COLORS[i % ROOM_COLORS.length],
      capabilities: [],
    };
  });

  const lastIdx = rooms.length;
  const row = Math.floor(lastIdx / cols);
  const col = lastIdx % cols;
  const bx = (col - (cols - 1) / 2) * spacing;
  const bz = (row - Math.floor((workspaces.length / cols) / 2)) * spacing;
  rooms.push({ ...BREAK_ROOM, position: [bx, 0, bz] });

  return rooms;
}

function pickObjectiveRoom(agent: Agent, rooms: FactoryRoom[]): FactoryRoom {
  if (rooms.length === 0) return BREAK_ROOM;
  const agentWs = agent.workspaceId;
  if (agentWs) {
    const homeRoom = rooms.find(r => r.id === agentWs);
    if (homeRoom && Math.random() < 0.6) return homeRoom;
  }
  const nonBreak = rooms.filter(r => r.id !== "break-room");
  if (nonBreak.length > 0) return nonBreak[Math.floor(Math.random() * nonBreak.length)];
  return rooms[Math.floor(Math.random() * rooms.length)];
}

interface AgentSimState {
  agentId: string;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetRoom: string;
  targetRoomId: string;
  currentRoomId: string;
  objective: string;
  phase: "walking" | "working" | "idle";
  animation: ActivityAnim;
  phaseTimer: number;
  speed: number;
}

function FactoryEnvironment() {
  const groundRef = useRef<THREE.Mesh>(null!);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.05} />
      </mesh>

      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[32, 26]} />
        <meshStandardMaterial color="#1e1e38" roughness={0.7} metalness={0.1} />
      </mesh>

      <gridHelper args={[32, 32, "#E5A824", "#3a3a5a"]} position={[0, 0.005, 0]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -1]} receiveShadow>
        <planeGeometry args={[3.5, 20]} />
        <meshStandardMaterial color="#2a2a4a" roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[20, 2.5]} />
        <meshStandardMaterial color="#2a2a4a" roughness={0.6} />
      </mesh>

      {[[-16, 0, -13], [16, 0, -13], [-16, 0, 13], [16, 0, 13], [0, 0, -13], [0, 0, 13]].map(([x, _y, z], i) => (
        <group key={`tree-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 1.2, 6]} />
            <meshStandardMaterial color="#5c3a1e" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <coneGeometry args={[0.7, 1.5, 6]} />
            <meshStandardMaterial color="#1a5c2a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[0.5, 1.0, 6]} />
            <meshStandardMaterial color="#1e6b30" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {[[-14, 0, 0], [14, 0, 0], [-14, 0, -8], [14, 0, -8], [-14, 0, 8], [14, 0, 8]].map(([x, _y, z], i) => (
        <group key={`lamp-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 3, 6]} />
            <meshStandardMaterial color="#4a4a6a" metalness={0.5} />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#E5A824" emissive="#E5A824" emissiveIntensity={0.8} />
          </mesh>
          <pointLight position={[0, 3, 0]} color="#E5A824" intensity={0.15} distance={6} />
        </group>
      ))}

      {[[-12, 0, -5], [12, 0, 5], [-5, 0, 9], [5, 0, -9]].map(([x, _y, z], i) => (
        <group key={`bench-${i}`} position={[x, 0, z]}>
          <RoundedBox args={[1.2, 0.08, 0.4]} position={[0, 0.4, 0]} radius={0.02}>
            <meshStandardMaterial color="#5c3a1e" roughness={0.8} />
          </RoundedBox>
          <mesh position={[-0.5, 0.2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
            <meshStandardMaterial color="#4a4a6a" metalness={0.4} />
          </mesh>
          <mesh position={[0.5, 0.2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
            <meshStandardMaterial color="#4a4a6a" metalness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Desk({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.2, 0.05, 0.6]} position={[0, 0.55, 0]} radius={0.02}>
        <meshStandardMaterial color="#3a3a5a" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {[[-0.5, 0.275, -0.25], [-0.5, 0.275, 0.25], [0.5, 0.275, -0.25], [0.5, 0.275, 0.25]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <cylinderGeometry args={[0.025, 0.025, 0.55, 6]} />
          <meshStandardMaterial color="#4a4a6a" metalness={0.4} />
        </mesh>
      ))}
      <RoundedBox args={[0.4, 0.3, 0.02]} position={[0, 0.75, -0.1]} radius={0.01}>
        <meshStandardMaterial color="#1a1a2e" emissive={color} emissiveIntensity={0.15} />
      </RoundedBox>
    </group>
  );
}

function Chair({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.4, 0.04, 0.4]} position={[0, 0.38, 0]} radius={0.02}>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.4, 0.35, 0.04]} position={[0, 0.57, -0.18]} radius={0.02}>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.38, 6]} />
        <meshStandardMaterial color="#4a4a6a" metalness={0.5} />
      </mesh>
    </group>
  );
}

function Whiteboard({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.8, 1.0, 0.05]} position={[0, 1.2, 0]} radius={0.03}>
        <meshStandardMaterial color="#e8e8e8" roughness={0.3} />
      </RoundedBox>
      <RoundedBox args={[1.9, 0.06, 0.08]} position={[0, 0.68, 0.03]} radius={0.01}>
        <meshStandardMaterial color="#4a4a6a" metalness={0.3} />
      </RoundedBox>
      <mesh position={[-0.6, 1.3, 0.03]}>
        <boxGeometry args={[0.5, 0.02, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.2, 1.1, 0.03]}>
        <boxGeometry args={[0.8, 0.02, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

function PlantPot({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#6b4c3b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2d8a4e" roughness={0.8} />
      </mesh>
      <mesh position={[0.05, 0.45, 0.05]}>
        <sphereGeometry args={[0.12, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3ba55c" roughness={0.8} />
      </mesh>
    </group>
  );
}

function CoffeeMachine({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.3, 0.4, 0.25]} position={[0, 0.2, 0]} radius={0.03}>
        <meshStandardMaterial color="#2a2a3a" metalness={0.5} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.05, 8]} />
        <meshStandardMaterial color="#3a3a4a" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.35, 0.13]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function ServerRack({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.5, 1.4, 0.4]} position={[0, 0.7, 0]} radius={0.03}>
        <meshStandardMaterial color="#1a1a2e" metalness={0.3} roughness={0.5} />
      </RoundedBox>
      {[0.3, 0.6, 0.9, 1.2].map((y, i) => (
        <mesh key={i} position={[0.15, y, 0.21]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#22c55e" : color} emissive={i % 2 === 0 ? "#22c55e" : color} emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Bookshelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.0, 1.4, 0.3]} position={[0, 0.7, 0]} radius={0.03}>
        <meshStandardMaterial color="#5c3a1e" roughness={0.8} />
      </RoundedBox>
      {[0.3, 0.65, 1.0].map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 0]}>
            <boxGeometry args={[0.92, 0.03, 0.28]} />
            <meshStandardMaterial color="#4a2e15" roughness={0.9} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.25].map((x, j) => (
            <mesh key={j} position={[x, y + 0.1, 0]}>
              <boxGeometry args={[0.12, 0.18, 0.2]} />
              <meshStandardMaterial color={["#3B82F6", "#10B981", "#E5A824", "#8B5CF6", "#EC4899", "#F97316"][(i * 4 + j) % 6]} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Room({ room }: { room: FactoryRoom }) {
  const [px, py, pz] = room.position;
  const [sx, sy, sz] = room.size;
  const baseY = -sy / 2;

  return (
    <group position={[px, py + sy / 2, pz]}>
      <mesh position={[0, baseY + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[sx, sz]} />
        <meshStandardMaterial color={room.color} opacity={0.12} transparent />
      </mesh>
      <mesh position={[-sx / 2, 0, 0]}>
        <boxGeometry args={[0.1, sy, sz]} />
        <meshStandardMaterial color={room.color} opacity={0.25} transparent />
      </mesh>
      <mesh position={[sx / 2, 0, 0]}>
        <boxGeometry args={[0.1, sy, sz]} />
        <meshStandardMaterial color={room.color} opacity={0.25} transparent />
      </mesh>
      <mesh position={[0, 0, -sz / 2]}>
        <boxGeometry args={[sx, sy, 0.1]} />
        <meshStandardMaterial color={room.color} opacity={0.25} transparent />
      </mesh>
      <mesh position={[0, 0, sz / 2]}>
        <boxGeometry args={[sx * 0.3, sy, 0.1]} />
        <meshStandardMaterial color={room.color} opacity={0.25} transparent />
      </mesh>

      <mesh position={[0, sy / 2 - 0.02, 0]}>
        <boxGeometry args={[sx - 0.2, 0.04, sz - 0.2]} />
        <meshStandardMaterial color="#1a1a2e" opacity={0.6} transparent />
      </mesh>

      <Billboard position={[0, sy / 2 + 0.4, 0]}>
        <Text fontSize={0.35} color={room.color} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000" font={undefined}>
          {room.name}
        </Text>
      </Billboard>
      <pointLight position={[0, sy - 0.5, 0]} color={room.color} intensity={0.4} distance={6} />

      {room.id === "code-workshop" && (
        <>
          <Desk position={[-1.2, baseY, -1.2]} color="#10B981" />
          <Chair position={[-1.2, baseY, -0.5]} color="#2a4a3a" />
          <Desk position={[0.8, baseY, -1.2]} color="#10B981" />
          <Chair position={[0.8, baseY, -0.5]} color="#2a4a3a" />
          <ServerRack position={[2.0, baseY, -1.8]} color="#10B981" />
          <PlantPot position={[-2.0, baseY, 1.8]} />
          <Whiteboard position={[0, baseY, -2.4]} color="#10B981" />
        </>
      )}
      {room.id === "research-lab" && (
        <>
          <Desk position={[-1.0, baseY, -1.0]} color="#3B82F6" />
          <Chair position={[-1.0, baseY, -0.3]} color="#2a3a5a" />
          <Desk position={[1.0, baseY, -1.0]} color="#3B82F6" />
          <Chair position={[1.0, baseY, -0.3]} color="#2a3a5a" />
          <Bookshelf position={[-2.0, baseY, 0]} />
          <PlantPot position={[2.0, baseY, 1.8]} />
          <mesh position={[0, baseY + 0.65, -2.0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.5, 8]} />
            <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={0.5} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.5, baseY + 0.65, -2.0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.35, 8]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.4} transparent opacity={0.5} />
          </mesh>
        </>
      )}
      {room.id === "design-studio" && (
        <>
          <Desk position={[-0.5, baseY, 0]} color="#F97316" />
          <Chair position={[-0.5, baseY, 0.7]} color="#4a3a2a" />
          <RoundedBox args={[1.8, 0.05, 1.2]} position={[0, baseY + 0.75, -0.8]} radius={0.02}>
            <meshStandardMaterial color="#F97316" emissive="#F97316" emissiveIntensity={0.1} />
          </RoundedBox>
          <Whiteboard position={[0, baseY, -2.4]} color="#F97316" />
          <PlantPot position={[2.0, baseY, 1.8]} />
          <PlantPot position={[-2.0, baseY, 1.8]} />
          <mesh position={[1.5, baseY + 0.6, -1.5]}>
            <cylinderGeometry args={[0.15, 0.15, 1.2, 8]} />
            <meshStandardMaterial color="#3a3a5a" roughness={0.6} />
          </mesh>
          <mesh position={[1.5, baseY + 1.25, -1.5]}>
            <boxGeometry args={[0.5, 0.4, 0.05]} />
            <meshStandardMaterial color="#1a1a2e" emissive="#F97316" emissiveIntensity={0.1} />
          </mesh>
        </>
      )}
      {room.id === "strategy-room" && (
        <>
          <RoundedBox args={[2.2, 0.06, 1.4]} position={[0, baseY + 0.55, 0]} radius={0.03}>
            <meshStandardMaterial color="#3a3a5a" roughness={0.4} metalness={0.2} />
          </RoundedBox>
          {[[-0.8, 0.8], [0.8, 0.8], [-0.8, -0.8], [0.8, -0.8]].map(([x, z], i) => (
            <Chair key={i} position={[x, baseY, z]} color="#3a2a5a" />
          ))}
          <Whiteboard position={[0, baseY, -2.4]} color="#8B5CF6" />
          <PlantPot position={[2.0, baseY, 1.8]} />
        </>
      )}
      {room.id === "comms-center" && (
        <>
          <Desk position={[-1.2, baseY, -0.5]} color="#EC4899" />
          <Chair position={[-1.2, baseY, 0.2]} color="#4a2a3a" />
          <Desk position={[1.2, baseY, -0.5]} color="#EC4899" />
          <Chair position={[1.2, baseY, 0.2]} color="#EC4899" />
          <ServerRack position={[0, baseY, -2.0]} color="#EC4899" />
          <ServerRack position={[0.6, baseY, -2.0]} color="#EC4899" />
          <PlantPot position={[-2.0, baseY, 1.8]} />
        </>
      )}
      {room.id === "break-room" && (
        <>
          <RoundedBox args={[1.0, 0.04, 1.0]} position={[0, baseY + 0.5, 0]} radius={0.02}>
            <meshStandardMaterial color="#5c3a1e" roughness={0.8} />
          </RoundedBox>
          {[[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]].map(([x, z], i) => (
            <Chair key={i} position={[x, baseY, z]} color="#E5A824" />
          ))}
          <CoffeeMachine position={[2.0, baseY + 0.55, -1.8]} />
          <RoundedBox args={[1.0, 0.55, 0.4]} position={[2.0, baseY + 0.275, -1.8]} radius={0.03}>
            <meshStandardMaterial color="#3a3a5a" roughness={0.5} />
          </RoundedBox>
          <PlantPot position={[-2.0, baseY, 1.8]} />
          <PlantPot position={[2.0, baseY, 1.8]} />
          <RoundedBox args={[0.8, 0.5, 0.8]} position={[-1.5, baseY + 0.25, -1.5]} radius={0.05}>
            <meshStandardMaterial color="#3a3a5a" roughness={0.6} />
          </RoundedBox>
          <RoundedBox args={[0.7, 0.08, 0.7]} position={[-1.5, baseY + 0.54, -1.5]} radius={0.02}>
            <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
          </RoundedBox>
        </>
      )}
    </group>
  );
}

function FactorySign() {
  return (
    <group position={[0, 5.5, -10]}>
      <RoundedBox args={[10, 1.5, 0.3]} radius={0.1}>
        <meshStandardMaterial color="#1a1a2e" />
      </RoundedBox>
      <Billboard>
        <Text fontSize={0.55} color="#E5A824" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000" font={undefined}>
          CB | CREATIVES — Agent Factory
        </Text>
      </Billboard>
      <pointLight position={[0, -0.5, 1]} color="#E5A824" intensity={1} distance={5} />
    </group>
  );
}

function getAgentColor(agent: Agent): string {
  const CAPABILITY_COLORS: Record<string, string> = {
    "content-creation": "#E5A824", "research": "#3B82F6", "code-review": "#10B981",
    "architecture": "#8B5CF6", "testing": "#F59E0B", "analysis": "#EC4899",
    "writing": "#06B6D4", "design": "#F97316", "engineering": "#6366F1",
    "security": "#EF4444", "strategy": "#14B8A6", "communication": "#A855F7",
  };
  if (!agent.capabilities || agent.capabilities.length === 0) return "#E5A824";
  const firstCap = agent.capabilities[0].toLowerCase();
  for (const [key, color] of Object.entries(CAPABILITY_COLORS)) {
    if (firstCap.includes(key)) return color;
  }
  const hash = agent.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = Object.values(CAPABILITY_COLORS);
  return colors[hash % colors.length];
}

type AgentOutfit = "engineer" | "researcher" | "creative" | "strategist" | "communicator" | "general";

function getAgentOutfit(agent: Agent): AgentOutfit {
  const caps = (agent.capabilities || []).map(c => c.toLowerCase()).join(" ");
  if (caps.includes("cod") || caps.includes("debug") || caps.includes("engineer") || caps.includes("deploy") || caps.includes("test")) return "engineer";
  if (caps.includes("research") || caps.includes("analy") || caps.includes("read")) return "researcher";
  if (caps.includes("design") || caps.includes("creat") || caps.includes("writ") || caps.includes("content") || caps.includes("art")) return "creative";
  if (caps.includes("strateg") || caps.includes("architect") || caps.includes("plan")) return "strategist";
  if (caps.includes("commun") || caps.includes("discuss") || caps.includes("coord") || caps.includes("review")) return "communicator";
  return "general";
}

function AgentOutfitMesh({ outfit, color, baseY }: { outfit: AgentOutfit; color: string; baseY: number }) {
  switch (outfit) {
    case "engineer":
      return (
        <>
          <mesh position={[0, 0.95, 0.22]}>
            <boxGeometry args={[0.08, 0.04, 0.06]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0.18, 0.42, 0.12]}>
            <boxGeometry args={[0.04, 0.15, 0.04]} />
            <meshStandardMaterial color="#4a4a6a" metalness={0.6} />
          </mesh>
          <mesh position={[-0.25, 0.35, 0]}>
            <boxGeometry args={[0.06, 0.2, 0.06]} />
            <meshStandardMaterial color="#E5A824" roughness={0.5} />
          </mesh>
        </>
      );
    case "researcher":
      return (
        <>
          <mesh position={[-0.12, 1.08, 0.18]}>
            <torusGeometry args={[0.06, 0.012, 8, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} />
          </mesh>
          <mesh position={[0.12, 1.08, 0.18]}>
            <torusGeometry args={[0.06, 0.012, 8, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.08, 0.18]}>
            <boxGeometry args={[0.06, 0.01, 0.01]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} />
          </mesh>
          <mesh position={[0.22, 0.45, 0.1]}>
            <boxGeometry args={[0.06, 0.18, 0.04]} />
            <meshStandardMaterial color="#3B82F6" roughness={0.6} />
          </mesh>
        </>
      );
    case "creative":
      return (
        <>
          <mesh position={[0, 1.25, 0]} rotation={[0.15, 0, 0.1]}>
            <cylinderGeometry args={[0.25, 0.28, 0.06, 8]} />
            <meshStandardMaterial color="#F97316" roughness={0.6} />
          </mesh>
          <mesh position={[0.25, 0.5, 0.05]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} />
            <meshStandardMaterial color="#F97316" emissive="#F97316" emissiveIntensity={0.3} />
          </mesh>
        </>
      );
    case "strategist":
      return (
        <>
          <mesh position={[0.15, 0.55, 0.15]}>
            <boxGeometry args={[0.12, 0.08, 0.01]} />
            <meshStandardMaterial color="#8B5CF6" emissive="#8B5CF6" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.22, 0.015, 8, 16]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
          </mesh>
        </>
      );
    case "communicator":
      return (
        <>
          <mesh position={[0.22, 1.1, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#EC4899" roughness={0.5} />
          </mesh>
          <mesh position={[0.22, 1.1, 0]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.008, 0.008, 0.15, 4]} />
            <meshStandardMaterial color="#4a4a6a" metalness={0.5} />
          </mesh>
        </>
      );
    default:
      return (
        <mesh position={[0, 0.35, 0.2]}>
          <boxGeometry args={[0.1, 0.06, 0.02]} />
          <meshStandardMaterial color="#E5A824" emissive="#E5A824" emissiveIntensity={0.4} />
        </mesh>
      );
  }
}

function AgentCharacter({ agent, simState, onSelect, isSelected }: {
  agent: Agent; simState: AgentSimState; onSelect: (agent: Agent | null) => void; isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Mesh>(null!);
  const headRef = useRef<THREE.Mesh>(null!);
  const leftArmRef = useRef<THREE.Mesh>(null!);
  const rightArmRef = useRef<THREE.Mesh>(null!);
  const animTimer = useRef(0);
  const [hovered, setHovered] = useState(false);
  const color = getAgentColor(agent);
  const outfit = getAgentOutfit(agent);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    animTimer.current += delta;
    const t = animTimer.current;
    groupRef.current.position.copy(simState.currentPos);

    if (simState.phase === "walking") {
      groupRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.15;
      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(t * 8) * 0.08;
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 8) * 0.5;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(t * 8) * 0.5;
      if (headRef.current) headRef.current.rotation.y = 0;
      const dir = new THREE.Vector3().subVectors(simState.targetPos, simState.currentPos);
      if (dir.length() > 0.01) {
        const angle = Math.atan2(dir.x, dir.z);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, 0.1);
      }
    } else if (simState.phase === "working") {
      groupRef.current.position.y = 0;
      switch (simState.animation) {
        case "typing":
          if (bodyRef.current) bodyRef.current.rotation.z = 0;
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.8 + Math.sin(t * 12) * 0.15;
          if (rightArmRef.current) rightArmRef.current.rotation.x = -0.8 + Math.cos(t * 14) * 0.15;
          if (headRef.current) headRef.current.rotation.x = -0.15;
          break;
        case "reading":
          if (bodyRef.current) bodyRef.current.rotation.z = 0;
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.6;
          if (rightArmRef.current) rightArmRef.current.rotation.x = -0.6;
          if (headRef.current) { headRef.current.rotation.x = -0.2; headRef.current.rotation.y = Math.sin(t * 0.5) * 0.1; }
          groupRef.current.position.y = Math.sin(t * 0.3) * 0.01;
          break;
        case "painting":
          if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(t * 2) * 0.05;
          if (rightArmRef.current) { rightArmRef.current.rotation.x = -0.9 + Math.sin(t * 3) * 0.3; rightArmRef.current.rotation.z = Math.cos(t * 2) * 0.2; }
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.3;
          if (headRef.current) headRef.current.rotation.y = Math.sin(t * 1.5) * 0.2;
          break;
        case "presenting":
          if (bodyRef.current) bodyRef.current.rotation.z = 0;
          if (rightArmRef.current) { rightArmRef.current.rotation.x = -0.4 + Math.sin(t * 2) * 0.4; rightArmRef.current.rotation.z = 0.3; }
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.1;
          if (headRef.current) headRef.current.rotation.y = Math.sin(t * 1) * 0.3;
          groupRef.current.position.y = Math.sin(t * 0.8) * 0.02;
          break;
        case "chatting":
          if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(t * 1.5) * 0.04;
          if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 3) * 0.3;
          if (leftArmRef.current) leftArmRef.current.rotation.x = Math.cos(t * 2.5) * 0.25;
          if (headRef.current) { headRef.current.rotation.y = Math.sin(t * 2) * 0.2; headRef.current.rotation.x = Math.sin(t * 1.5) * 0.1; }
          break;
        case "resting":
          if (bodyRef.current) bodyRef.current.rotation.z = 0;
          if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
          if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
          if (headRef.current) headRef.current.rotation.x = 0.1 + Math.sin(t * 0.4) * 0.05;
          groupRef.current.position.y = Math.sin(t * 0.5) * 0.02;
          break;
      }
    } else {
      if (bodyRef.current) bodyRef.current.rotation.z = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
      if (headRef.current) headRef.current.rotation.y = Math.sin(t * 2) * 0.3;
      groupRef.current.position.y = Math.sin(t) * 0.02;
    }
  });

  const scale = hovered ? 1.15 : isSelected ? 1.1 : 1;
  const handleClick = (e: THREE.Event) => { (e as any).stopPropagation(); onSelect(isSelected ? null : agent); };
  const handleOver = (e: THREE.Event) => { (e as any).stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; };
  const handleOut = () => { setHovered(false); document.body.style.cursor = "auto"; };

  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      <mesh ref={bodyRef} position={[0, 0.5, 0]} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
        <capsuleGeometry args={[0.18, 0.35, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={simState.phase === "working" ? 0.5 : 0.2} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh ref={leftArmRef} position={[-0.28, 0.55, 0]}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.28, 0.55, 0]}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={headRef} position={[0, 1.0, 0]} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0.08, 1.06, 0.16]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.08, 1.06, 0.16]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
      </mesh>
      <AgentOutfitMesh outfit={outfit} color={color} baseY={0} />
      {agent.isActive && <pointLight position={[0, 0.8, 0]} color={color} intensity={0.3} distance={2} />}
      <Billboard position={[0, 1.55, 0]}>
        <Text fontSize={0.18} color="white" anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#000" font={undefined}>
          {agent.name}
        </Text>
      </Billboard>
      {simState.phase === "walking" && (
        <Billboard position={[0, 1.8, 0]}>
          <Text fontSize={0.1} color="#fbbf24" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#000" font={undefined}>
            {">> "}{simState.targetRoom}
          </Text>
        </Billboard>
      )}
      {simState.phase === "working" && (
        <Billboard position={[0, 1.8, 0]}>
          <Text fontSize={0.1} color="#4ade80" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#000" font={undefined}>
            {simState.objective}
          </Text>
        </Billboard>
      )}
      {simState.phase === "idle" && (
        <Billboard position={[0, 1.8, 0]}>
          <Text fontSize={0.1} color="#94a3b8" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#000" font={undefined}>
            deciding next task...
          </Text>
        </Billboard>
      )}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function useAgentSimulation(agents: Agent[], rooms: FactoryRoom[]) {
  const simStates = useRef<Map<string, AgentSimState>>(new Map());
  const [, setTick] = useState(0);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  useEffect(() => {
    const existing = simStates.current;
    const currentRooms = roomsRef.current;
    agents.forEach((agent, idx) => {
      if (!existing.has(agent.id)) {
        const startRoom = currentRooms[idx % currentRooms.length] || BREAK_ROOM;
        const offset = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
        const startPos = new THREE.Vector3(...startRoom.position).add(offset);
        startPos.y = 0;
        const roomObjs = getObjectivesForRoom(startRoom.name);
        existing.set(agent.id, {
          agentId: agent.id, currentPos: startPos.clone(), targetPos: startPos.clone(),
          targetRoom: startRoom.name, targetRoomId: startRoom.id, currentRoomId: startRoom.id,
          objective: roomObjs[Math.floor(Math.random() * roomObjs.length)],
          phase: "working", animation: getAnimationForRoom(startRoom.name),
          phaseTimer: 4 + Math.random() * 8, speed: 1.2 + Math.random() * 1.0,
        });
      }
    });
  }, [agents]);

  useEffect(() => {
    const interval = setInterval(() => {
      const states = simStates.current;
      const currentRooms = roomsRef.current;
      const dt = 0.1;
      states.forEach((state, agentId) => {
        const agent = agents.find(a => a.id === agentId);
        if (!agent || !agent.isActive) return;
        state.phaseTimer -= dt;
        if (state.phase === "walking") {
          const dir = new THREE.Vector3().subVectors(state.targetPos, state.currentPos);
          const dist = dir.length();
          if (dist < 0.3) {
            state.currentPos.copy(state.targetPos);
            state.currentRoomId = state.targetRoomId;
            const targetRoom = currentRooms.find(r => r.id === state.targetRoomId);
            state.animation = getAnimationForRoom(targetRoom?.name || "");
            const roomObjs = getObjectivesForRoom(targetRoom?.name || "");
            state.objective = roomObjs[Math.floor(Math.random() * roomObjs.length)];
            state.phase = "working";
            state.phaseTimer = 8 + Math.random() * 14;
          } else {
            dir.normalize().multiplyScalar(state.speed * dt);
            state.currentPos.add(dir);
            state.currentPos.y = 0;
          }
        } else if (state.phase === "working") {
          if (state.phaseTimer <= 0) {
            const shouldRest = Math.random() < 0.2 && state.currentRoomId !== "break-room";
            const breakRoom = currentRooms.find(r => r.id === "break-room") || BREAK_ROOM;
            const nextRoom = shouldRest ? breakRoom : pickObjectiveRoom(agent, currentRooms);
            const roomCenter = new THREE.Vector3(...nextRoom.position);
            const offset = new THREE.Vector3((Math.random() - 0.5) * 2.5, 0, (Math.random() - 0.5) * 2.5);
            state.targetPos = roomCenter.add(offset);
            state.targetPos.y = 0;
            state.targetRoom = nextRoom.name;
            state.targetRoomId = nextRoom.id;
            state.phase = "idle";
            state.phaseTimer = 0.3 + Math.random() * 0.5;
          }
        } else if (state.phase === "idle") {
          if (state.phaseTimer <= 0) state.phase = "walking";
        }
      });
      setTick(t => t + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [agents]);

  return simStates.current;
}

function FirstPersonMovement() {
  const { camera } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useEffect(() => {
    camera.position.set(0, 2.5, 15);

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp": moveState.current.forward = true; break;
        case "KeyS": case "ArrowDown": moveState.current.backward = true; break;
        case "KeyA": case "ArrowLeft": moveState.current.left = true; break;
        case "KeyD": case "ArrowRight": moveState.current.right = true; break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp": moveState.current.forward = false; break;
        case "KeyS": case "ArrowDown": moveState.current.backward = false; break;
        case "KeyA": case "ArrowLeft": moveState.current.left = false; break;
        case "KeyD": case "ArrowRight": moveState.current.right = false; break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [camera]);

  useFrame((_, delta) => {
    const speed = 8;
    const ms = moveState.current;
    direction.current.set(0, 0, 0);
    if (ms.forward) direction.current.z -= 1;
    if (ms.backward) direction.current.z += 1;
    if (ms.left) direction.current.x -= 1;
    if (ms.right) direction.current.x += 1;
    direction.current.normalize();

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    velocity.current.set(0, 0, 0);
    velocity.current.addScaledVector(forward, -direction.current.z * speed * delta);
    velocity.current.addScaledVector(right, direction.current.x * speed * delta);

    camera.position.add(velocity.current);
    camera.position.y = 2.5;

    const bounds = 30;
    camera.position.x = Math.max(-bounds, Math.min(bounds, camera.position.x));
    camera.position.z = Math.max(-bounds, Math.min(bounds, camera.position.z));
  });

  return null;
}

function Scene({ agents, selectedAgent, onSelectAgent, simStates, fpvMode, rooms }: {
  agents: Agent[]; selectedAgent: Agent | null; onSelectAgent: (agent: Agent | null) => void; simStates: Map<string, AgentSimState>; fpvMode: boolean; rooms: FactoryRoom[];
}) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[15, 20, 10]} intensity={0.5} castShadow />
      <directionalLight position={[-10, 15, -5]} intensity={0.2} />
      <hemisphereLight color="#1a1a3e" groundColor="#0a0a1a" intensity={0.3} />
      <fog attach="fog" args={["#0a0a1a", 20, 55]} />
      <FactoryEnvironment />
      <FactorySign />
      {rooms.map(room => <Room key={room.id} room={room} />)}
      {agents.map((agent) => {
        const sim = simStates.get(agent.id);
        if (!sim) return null;
        return <AgentCharacter key={agent.id} agent={agent} simState={sim} onSelect={onSelectAgent} isSelected={selectedAgent?.id === agent.id} />;
      })}
      {fpvMode ? (
        <>
          <PointerLockControls />
          <FirstPersonMovement />
        </>
      ) : (
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={5} maxDistance={50} maxPolarAngle={Math.PI * 0.45} minPolarAngle={Math.PI * 0.1} target={[0, 1, 0]} />
      )}
    </>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview: string;
  url: string;
}

interface DisplayContainer {
  id: string;
  type: "table" | "summary" | "image" | "video" | "code" | "list" | "metrics";
  title: string;
  data: any;
}

function getToolIcon(iconType: string) {
  switch (iconType) {
    case "search": return <SearchIcon className="h-4 w-4" />;
    case "code": return <Code className="h-4 w-4" />;
    case "brain": return <Brain className="h-4 w-4" />;
    case "palette": return <Palette className="h-4 w-4" />;
    case "file": return <FileText className="h-4 w-4" />;
    case "zap": return <Zap className="h-4 w-4" />;
    default: return <Wrench className="h-4 w-4" />;
  }
}

function NewsBroadcastBanner({ briefings }: { briefings: Briefing[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (briefings.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % briefings.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [briefings.length]);

  const currentAudioUrl = useMemo(() => {
    if (briefings.length === 0) return null;
    const current = briefings[currentIndex];
    if (current?.audioUrl) return current.audioUrl;
    const sorted = [...briefings].filter(b => b.audioUrl).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return sorted.length > 0 ? sorted[0].audioUrl : null;
  }, [briefings, currentIndex]);

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentIndex]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentAudioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [isPlaying, currentAudioUrl]);

  const toggleMute = useCallback(() => {
    if (audioRef.current) audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  if (briefings.length === 0) {
    return (
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3" data-testid="panel-news-broadcast">
        <div className="flex items-center gap-2 shrink-0">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">LIVE</span>
        </div>
        <div className="border-l border-primary/20 pl-3 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground truncate">No broadcasts yet. Create briefings to see factory news here.</p>
        </div>
      </div>
    );
  }

  const current = briefings[currentIndex];
  const priorityColors: Record<string, string> = {
    urgent: "text-red-500",
    high: "text-orange-500",
    medium: "text-primary",
    low: "text-muted-foreground",
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3" data-testid="panel-news-broadcast">
      {currentAudioUrl && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause broadcast" : "Play broadcast"}
            data-testid="button-broadcast-play"
          >
            {isPlaying ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-primary" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute broadcast" : "Mute broadcast"}
            data-testid="button-broadcast-mute"
          >
            {isMuted ? <VolumeX className="h-3 w-3 text-muted-foreground" /> : <Volume2 className="h-3 w-3 text-primary" />}
          </Button>
          <audio ref={audioRef} src={currentAudioUrl} onEnded={() => setIsPlaying(false)} />
        </div>
      )}
      <div className="flex items-center gap-2 shrink-0">
        <Radio className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">LIVE</span>
      </div>
      <div className="border-l border-primary/20 pl-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] shrink-0 ${priorityColors[current.priority] || ""}`}>
            {current.priority.toUpperCase()}
          </Badge>
          <p className="text-sm font-medium truncate">{current.title}</p>
        </div>
        {current.summary && <p className="text-xs text-muted-foreground mt-0.5 truncate">{current.summary}</p>}
      </div>
      {briefings.length > 1 && (
        <span className="text-[10px] text-muted-foreground shrink-0">{currentIndex + 1}/{briefings.length}</span>
      )}
    </div>
  );
}

function FactoryControlsBar({ agents, tokens, workspaces, simStates }: {
  agents: Agent[]; tokens: ApiToken[]; workspaces: Workspace[]; simStates: Map<string, AgentSimState>;
}) {
  const activeAgents = agents.filter(a => a.isActive).length;
  const workingCount = Array.from(simStates.values()).filter(s => s.phase === "working").length;
  const totalTokenUsage = tokens.reduce((sum, t) => sum + (t.usageCount || 0), 0);
  const activeTokens = tokens.filter(t => t.status === "active").length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="panel-factory-controls">
      <div className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2">
        <Bot className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-lg font-bold leading-none" data-testid="text-active-agents">{activeAgents}</p>
          <p className="text-[10px] text-muted-foreground">Active Agents</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2">
        <Activity className="h-4 w-4 text-green-500 shrink-0" />
        <div>
          <p className="text-lg font-bold leading-none" data-testid="text-working-count">{workingCount}</p>
          <p className="text-[10px] text-muted-foreground">Working Now</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2">
        <Key className="h-4 w-4 text-amber-500 shrink-0" />
        <div>
          <p className="text-lg font-bold leading-none" data-testid="text-token-usage">{totalTokenUsage.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{activeTokens} Active Tokens</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2">
        <Gauge className="h-4 w-4 text-blue-500 shrink-0" />
        <div>
          <p className="text-lg font-bold leading-none" data-testid="text-dept-count">{workspaces.length}</p>
          <p className="text-[10px] text-muted-foreground">Departments</p>
        </div>
      </div>
    </div>
  );
}

function RoomDetailPanel({ room, agents, simStates, onClose, onAssignAgent }: {
  room: FactoryRoom; agents: Agent[]; simStates: Map<string, AgentSimState>;
  onClose: () => void; onAssignAgent?: (agentId: string, toolName: string) => void;
}) {
  const roomAgents = agents.filter(a => {
    const sim = simStates.get(a.id);
    return sim && sim.currentRoomId === room.id && sim.phase === "working";
  });
  const tools = getToolsForRoom(room);

  return (
    <Card className="border-2" style={{ borderColor: room.color + "50" }} data-testid={`panel-room-detail-${room.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: room.color + "20" }}>
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: room.color, display: "block" }} />
            </div>
            <div>
              <CardTitle className="text-base">{room.name}</CardTitle>
              <CardDescription className="text-xs">{roomAgents.length} agent{roomAgents.length !== 1 ? "s" : ""} working</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid={`button-close-room-${room.id}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Equipment & Tools</p>
          <div className="space-y-2">
            {tools.map((tool) => (
              <div key={tool.name} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors" data-testid={`tool-${tool.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: room.color + "20" }}>
                    {getToolIcon(tool.icon)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tool.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="text-[10px] px-2 py-1 h-auto" data-testid={`button-run-tool-${tool.name.toLowerCase().replace(/\s+/g, "-")}`}>
                    Run
                  </Button>
                  {roomAgents.length > 0 && (
                    <Button variant="outline" size="sm" className="text-[10px] px-2 py-1 h-auto" onClick={() => onAssignAgent?.(roomAgents[0].id, tool.name)} data-testid={`button-assign-tool-${tool.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      Assign
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {roomAgents.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Agents in Room</p>
            <div className="space-y-1.5">
              {roomAgents.map(agent => {
                const sim = simStates.get(agent.id);
                return (
                  <div key={agent.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/30" data-testid={`room-agent-${agent.id}`}>
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-xs font-medium truncate">{agent.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate ml-auto">{sim?.objective}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FactoryAction {
  type: "assign-step" | "activate" | "deactivate" | "move-department";
  agentId: string;
  stepId?: string;
  workspaceId?: string;
}

function parseDisplayCommands(text: string): { cleanText: string; containers: DisplayContainer[]; actions: FactoryAction[] } {
  const containers: DisplayContainer[] = [];
  const actions: FactoryAction[] = [];
  const lines = text.split("\n");
  const cleanLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith(":::display:")) {
      try {
        const jsonStr = line.trim().slice(":::display:".length);
        const parsed = JSON.parse(jsonStr);
        if (parsed.type) {
          containers.push({
            id: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: parsed.type,
            title: parsed.title || parsed.type,
            data: parsed,
          });
        }
      } catch {}
    } else if (line.trim().startsWith(":::action:")) {
      try {
        const jsonStr = line.trim().slice(":::action:".length);
        const parsed = JSON.parse(jsonStr);
        if (parsed.type && parsed.agentId) {
          actions.push(parsed as FactoryAction);
        }
      } catch {}
    } else {
      cleanLines.push(line);
    }
  }

  return { cleanText: cleanLines.join("\n").trim(), containers, actions };
}

function DisplayContainerRenderer({ container, onClose }: { container: DisplayContainer; onClose: () => void }) {
  const typeIcons: Record<string, any> = {
    table: <Table2 className="h-3.5 w-3.5" />,
    summary: <FileText className="h-3.5 w-3.5" />,
    image: <ImageIcon className="h-3.5 w-3.5" />,
    video: <Video className="h-3.5 w-3.5" />,
    code: <Code className="h-3.5 w-3.5" />,
    list: <List className="h-3.5 w-3.5" />,
    metrics: <BarChart3 className="h-3.5 w-3.5" />,
  };

  const renderContent = () => {
    const d = container.data;
    switch (container.type) {
      case "table":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-primary/20">
                  {(d.headers || []).map((h: string, i: number) => (
                    <th key={i} className="text-left px-2 py-1.5 text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(d.rows || []).map((row: string[], ri: number) => (
                  <tr key={ri} className="border-b border-border/50 hover:bg-muted/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "summary":
        return (
          <div className="space-y-3">
            {(d.sections || []).map((s: any, i: number) => (
              <div key={i}>
                <div className="text-xs font-medium text-primary mb-1">{s.heading}</div>
                <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{s.content}</div>
              </div>
            ))}
          </div>
        );

      case "image":
        return (
          <div className="flex justify-center">
            <img src={d.src} alt={d.alt || d.title} className="max-w-full max-h-[300px] rounded object-contain" />
          </div>
        );

      case "video": {
        const videoId = d.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
        return videoId ? (
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full rounded"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : <p className="text-xs text-muted-foreground">Invalid video URL</p>;
      }

      case "code":
        return (
          <pre className="bg-background/80 rounded p-3 overflow-x-auto text-xs font-mono leading-relaxed">
            <code>{d.code}</code>
          </pre>
        );

      case "list":
        return (
          <div className="space-y-1.5">
            {(d.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  item.status === "active" ? "bg-green-500" :
                  item.status === "inactive" ? "bg-gray-400" :
                  item.status === "warning" ? "bg-yellow-500" :
                  item.status === "error" ? "bg-red-500" : "bg-primary"
                }`} />
                <div>
                  <span className="font-medium">{item.label}</span>
                  {item.detail && <span className="text-muted-foreground ml-1">- {item.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        );

      case "metrics":
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(d.metrics || []).map((m: any, i: number) => (
              <div key={i} className="bg-background/60 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-primary">{m.value}</div>
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                {m.change && (
                  <div className={`text-[10px] font-medium ${m.change.startsWith("+") ? "text-green-500" : m.change.startsWith("-") ? "text-red-500" : "text-muted-foreground"}`}>
                    {m.change}
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      default:
        return <p className="text-xs text-muted-foreground">Unknown container type</p>;
    }
  };

  return (
    <Card className="border-primary/20 bg-card/80 backdrop-blur-sm" data-testid={`display-container-${container.type}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-primary/10">
        <div className="flex items-center gap-1.5">
          <span className="text-primary">{typeIcons[container.type] || <FileText className="h-3.5 w-3.5" />}</span>
          <span className="text-xs font-medium">{container.title}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0">{container.type}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose} data-testid="button-close-container">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <CardContent className="p-3">
        {renderContent()}
      </CardContent>
    </Card>
  );
}

interface FactoryHealth {
  summary: { totalAgents: number; activeAgents: number; inactiveAgents: number; departments: number; assemblyLines: number; activeLines: number };
  coldZones: { roomId: string; roomName: string; agentCount: number; isCold: boolean }[];
  roomActivity: { roomId: string; roomName: string; agentCount: number; agentNames: string[]; isCold: boolean }[];
  driftRisks: { agentName: string; issue: string; severity: "low" | "medium" | "high" }[];
  pendingAssemblySteps: { lineName: string; stepOrder: number; room: string; status: string }[];
}

function FactoryHealthPanel() {
  const { data: health } = useQuery<FactoryHealth>({ queryKey: ["/api/factory/health"] });

  if (!health) return null;

  const severityColor = { high: "text-red-500", medium: "text-amber-500", low: "text-blue-400" };
  const hasColdZones = health.coldZones.length > 0;
  const hasDriftRisks = health.driftRisks.length > 0;
  const hasPendingSteps = health.pendingAssemblySteps.length > 0;

  if (!hasColdZones && !hasDriftRisks && !hasPendingSteps) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5" data-testid="panel-factory-health">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm">Factory Health Alerts</CardTitle>
          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
            {health.coldZones.length + health.driftRisks.length + health.pendingAssemblySteps.length} issues
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {hasColdZones && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Cold Zones (No Coverage)</p>
            <div className="space-y-1">
              {health.coldZones.map(z => (
                <div key={z.roomId} className="flex items-center gap-2 px-2 py-1 rounded bg-red-500/10 border border-red-500/20" data-testid={`alert-cold-zone-${z.roomId}`}>
                  <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-red-400">{z.roomName}</span>
                  <span className="text-muted-foreground ml-auto">0 agents</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasDriftRisks && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Quality & Drift Risks</p>
            <div className="space-y-1">
              {health.driftRisks.map((d, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1 rounded bg-muted/30" data-testid={`alert-drift-${i}`}>
                  <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${d.severity === "high" ? "bg-red-500" : d.severity === "medium" ? "bg-amber-500" : "bg-blue-400"}`} />
                  <div className="min-w-0">
                    <span className={`font-medium ${severityColor[d.severity]}`}>{d.agentName}</span>
                    <span className="text-muted-foreground ml-1">{d.issue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasPendingSteps && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Stalled Assembly Steps</p>
            <div className="space-y-1">
              {health.pendingAssemblySteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/30" data-testid={`alert-stalled-step-${i}`}>
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">{s.lineName} - Step {s.stepOrder}</span>
                  <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{s.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommandChatPanel({ agents, workspaces }: { agents: Agent[]; workspaces: Workspace[] }) {
  const STORAGE_KEY = "factory-command-chat-history";
  const CONTAINERS_KEY = "factory-display-containers";
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [displayContainers, setDisplayContainers] = useState<DisplayContainer[]>(() => {
    try {
      const saved = localStorage.getItem(CONTAINERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [actionResults, setActionResults] = useState<{ action: string; result: string; success: boolean }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const executeActions = useCallback(async (actions: FactoryAction[]) => {
    for (const action of actions) {
      try {
        const resp = await fetch("/api/factory/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(action),
        });
        const data = await resp.json();
        setActionResults(prev => [...prev, {
          action: `${action.type} - ${action.agentId.slice(0, 8)}`,
          result: data.message || "Done",
          success: resp.ok,
        }]);
        queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/factory/health"] });
        queryClient.invalidateQueries({ queryKey: ["/api/assembly-lines"] });
      } catch {
        setActionResults(prev => [...prev, {
          action: `${action.type}`,
          result: "Failed to execute",
          success: false,
        }]);
      }
    }
    setTimeout(() => setActionResults([]), 8000);
  }, []);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!isStreaming && chatMessages.length > 0) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chatMessages.slice(-50))); } catch {}
    }
  }, [chatMessages, isStreaming]);

  useEffect(() => {
    try { localStorage.setItem(CONTAINERS_KEY, JSON.stringify(displayContainers)); } catch {}
  }, [displayContainers]);

  const clearHistory = useCallback(() => {
    setChatMessages([]);
    setDisplayContainers([]);
    setUploadedFiles([]);
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(CONTAINERS_KEY); } catch {}
  }, []);

  const removeContainer = useCallback((id: string) => {
    setDisplayContainers(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/command-chat/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const data = await resp.json();
      setUploadedFiles(prev => [...prev, data]);
      if (data.type.startsWith("image/")) {
        setDisplayContainers(prev => [...prev, {
          id: `dc-${Date.now()}`,
          type: "image",
          title: data.name,
          data: { type: "image", title: data.name, src: data.url, alt: data.name },
        }]);
      }
    } catch {
      console.error("File upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/command-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: msg,
          history: chatMessages,
          factoryContext: `${agents.length} agents, ${workspaces.length} departments`,
          uploadedFiles: uploadedFiles.map(f => ({ name: f.name, type: f.type, size: f.size, preview: f.preview })),
        }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                const { cleanText, containers, actions } = parseDisplayCommands(assistantContent);
                if (containers.length > 0 || actions.length > 0) {
                  setChatMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: cleanText };
                    return updated;
                  });
                  if (containers.length > 0) setDisplayContainers(prev => [...prev, ...containers]);
                  if (actions.length > 0) executeActions(actions);
                }
                break;
              }
              if (data.content) {
                assistantContent += data.content;
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't respond right now. Try again." }]);
    } finally {
      setIsStreaming(false);
    }
  }, [chatInput, isStreaming, chatMessages, agents, workspaces, uploadedFiles, executeActions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="space-y-3" data-testid="panel-command-chat">
      <Card className="border-primary/20">
        <div className="border-b">
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between rounded-none px-4 py-2"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-command-chat"
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Factory Command Center</span>
              <Badge variant="outline" className="text-[10px]">Creative Intelligence</Badge>
            </div>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>

        {isExpanded && (
          <CardContent className="p-0">
            <div ref={scrollRef} className="h-[300px] overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <Terminal className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground/70">Factory Command Center</p>
                  <p className="text-xs text-muted-foreground/50 mt-1 max-w-sm mx-auto">
                    Chat with Creative Intelligence to plan operations, create agent tools, configure departments, or get factory insights.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {["Show factory health", "Check for cold zones", "Assign agents to rooms", "Show drift risks"].map(suggestion => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => { setChatInput(suggestion); }}
                        data-testid={`button-suggestion-${suggestion.split(" ").slice(0, 3).join("-").toLowerCase()}`}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`} data-testid={`command-message-${msg.role}-${i}`}>
                    {msg.content ? (
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    ) : (isStreaming && i === chatMessages.length - 1 ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                      </span>
                    ) : "")}
                  </div>
                </div>
              ))}

              {actionResults.length > 0 && (
                <div className="space-y-1 px-1" data-testid="action-results">
                  {actionResults.map((ar, i) => (
                    <div key={i} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${ar.success ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                      <Zap className="h-3 w-3 shrink-0" />
                      <span className="truncate">{ar.result}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="px-4 py-1 border-t flex flex-wrap gap-1">
                {uploadedFiles.map(f => (
                  <Badge key={f.id} variant="secondary" className="text-[10px] gap-1">
                    <Paperclip className="h-2.5 w-2.5" />
                    {f.name.length > 20 ? f.name.slice(0, 17) + "..." : f.name}
                    <button onClick={() => setUploadedFiles(prev => prev.filter(x => x.id !== f.id))} className="ml-0.5 hover:text-destructive" data-testid="button-remove-file">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="px-4 pb-3 pt-1 border-t">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.xlsx,.xls,.csv,.zip,.txt,.json,.doc,.docx"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isStreaming}
                  data-testid="button-upload-file"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Textarea
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about operations, architecture, agents, or tools..."
                  className="min-h-[40px] max-h-[100px] text-sm resize-none"
                  rows={1}
                  disabled={isStreaming}
                  data-testid="input-command-chat"
                />
                <Button type="submit" size="icon" className="shrink-0 self-end" disabled={!chatInput.trim() || isStreaming} data-testid="button-send-command">
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
              {chatMessages.length > 0 && (
                <div className="flex justify-end mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-6 px-2"
                    onClick={clearHistory}
                    disabled={isStreaming}
                    data-testid="button-clear-chat-history"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Clear history
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {displayContainers.length > 0 && (
        <div className="space-y-2" data-testid="display-container-wall">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Display Panels ({displayContainers.length})</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] text-muted-foreground h-5 px-1.5"
              onClick={() => setDisplayContainers([])}
              data-testid="button-clear-containers"
            >
              Clear all
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {displayContainers.map(container => (
              <DisplayContainerRenderer
                key={container.id}
                container={container}
                onClose={() => removeContainer(container.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentDetailPanel({ agent, simState, onClose }: { agent: Agent; simState?: AgentSimState; onClose: () => void }) {
  const color = getAgentColor(agent);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevAgentId = useRef(agent.id);

  useEffect(() => {
    if (prevAgentId.current !== agent.id) {
      setChatMessages([]); setChatInput(""); setIsStreaming(false);
      prevAgentId.current = agent.id;
    }
  }, [agent.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (chatOpen && inputRef.current) inputRef.current.focus();
  }, [chatOpen]);

  const sendMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || isStreaming) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsStreaming(true);
    const isWalking = simState?.phase === "walking";
    const currentRoom = simState
      ? isWalking ? simState.targetRoom || "the factory"
        : simState.targetRoom || "the factory"
      : "the factory";
    const currentObjective = simState?.objective || "general tasks";
    const currentActivity = simState?.animation === "resting" ? "resting" : isWalking ? "walking" : "working";

    try {
      const response = await fetch(`/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg, history: chatMessages, context: { room: currentRoom, objective: currentObjective, activity: currentActivity } }),
      });
      if (!response.ok) throw new Error("Chat failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let assistantContent = "";
      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.content) {
                assistantContent += data.content;
                setChatMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: assistantContent }; return u; });
              }
            } catch {}
          }
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't respond right now. Try again." }]);
    } finally {
      setIsStreaming(false);
    }
  }, [chatInput, isStreaming, agent.id, chatMessages, simState]);

  return (
    <Card className="absolute right-4 top-4 w-[340px] bg-background/95 backdrop-blur-lg border-primary/30 z-20 shadow-2xl flex flex-col max-h-[calc(100%-2rem)]" data-testid={`panel-agent-detail-${agent.id}`}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "30", border: `2px solid ${color}` }}>
              <Bot className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${agent.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="text-xs text-muted-foreground">{agent.isActive ? "Active" : "Inactive"}</span>
                {agent.isVerified && <Badge variant="outline" className="text-xs gap-1 ml-1"><Shield className="h-3 w-3" /> Verified</Badge>}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onClose} data-testid="button-close-agent-panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm pb-2 shrink-0">
        {simState && (
          <div className="rounded-md bg-muted/50 p-2 space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</span>
            </div>
            <p className="font-medium text-sm">
              {simState.phase === "walking" && `Walking to ${simState.targetRoom}`}
              {simState.phase === "working" && simState.objective}
              {simState.phase === "idle" && "Deciding next task..."}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${simState.phase === "working" ? "bg-green-500 animate-pulse" : simState.phase === "walking" ? "bg-amber-500 animate-pulse" : "bg-gray-400"}`} />
              {simState.phase === "walking" && "In transit (cooldown)"}
              {simState.phase === "working" && <span>In {simState.targetRoom || "room"}</span>}
              {simState.phase === "idle" && "Selecting next objective"}
            </div>
          </div>
        )}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 4).map((cap, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] py-0"><Zap className="h-2.5 w-2.5 mr-0.5" />{cap}</Badge>
            ))}
            {(agent.capabilities.length > 4) && <Badge variant="secondary" className="text-[10px] py-0">+{agent.capabilities.length - 4}</Badge>}
          </div>
        )}
      </CardContent>
      <div className="border-t shrink-0">
        <Button variant="ghost" className="w-full flex items-center justify-between rounded-none text-xs font-medium uppercase tracking-wider text-muted-foreground" onClick={() => setChatOpen(!chatOpen)} data-testid="button-toggle-chat">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat with {agent.name.split(" ")[0]}</span>
          </div>
          {chatOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {chatOpen && (
        <div className="flex flex-col min-h-0 flex-1">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[120px] max-h-[280px]">
            {chatMessages.length === 0 && (
              <div className="text-center py-6">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground/50">Say hi to {agent.name}</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`} data-testid={`chat-message-${msg.role}-${i}`}>
                  {msg.content || (isStreaming && i === chatMessages.length - 1 ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Thinking...</span> : "")}
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 pb-3 pt-1 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-1.5">
              <Input ref={inputRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={`Message ${agent.name.split(" ")[0]}...`} className="text-xs" disabled={isStreaming} data-testid="input-agent-chat" />
              <Button type="submit" size="icon" className="shrink-0" disabled={!chatInput.trim() || isStreaming} data-testid="button-send-agent-chat">
                {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

function OnboardingOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Welcome to Agent Factory", desc: "This is your command center. Watch your agents work autonomously across departments, chat with them, and manage operations.", icon: <Bot className="h-8 w-8 text-primary" /> },
    { title: "Departments & Rooms", desc: "Each room is a department with specialized tools. Click on rooms in the legend to see equipment and assign agents.", icon: <Settings className="h-8 w-8 text-primary" /> },
    { title: "Command Center", desc: "Use the chat panel below to talk with Creative Intelligence. Plan workflows, create tools, configure departments, or get insights.", icon: <Terminal className="h-8 w-8 text-primary" /> },
  ];
  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="panel-onboarding">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">{current.icon}</div>
          <h2 className="text-xl font-semibold">{current.title}</h2>
          <p className="text-muted-foreground text-sm">{current.desc}</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {steps.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <div className="flex gap-2 justify-center pt-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)} data-testid="button-onboard-back">Back</Button>}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} data-testid="button-onboard-next">Next</Button>
            ) : (
              <Button onClick={onDismiss} data-testid="button-onboard-done">Get Started</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AgentWorld() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fpvMode, setFpvMode] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<FactoryRoom | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("factory-onboarded");
  });

  const { data: agents, isLoading } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: briefings } = useQuery<Briefing[]>({ queryKey: ["/api/briefings/recent"] });
  const { data: workspaces } = useQuery<Workspace[]>({ queryKey: ["/api/workspaces"] });
  const { data: tokens } = useQuery<ApiToken[]>({ queryKey: ["/api/tokens"] });

  const agentList = agents || [];
  const factoryRooms = useMemo(() => generateRooms(workspaces || []), [workspaces]);
  const simStates = useAgentSimulation(agentList, factoryRooms);

  const handleSelectAgent = useCallback((agent: Agent | null) => { setSelectedAgent(agent); }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem("factory-onboarded", "true");
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="w-full h-[400px] rounded-lg" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-4 overflow-y-auto" : ""}`}>
      {showOnboarding && <OnboardingOverlay onDismiss={dismissOnboarding} />}

      <NewsBroadcastBanner briefings={briefings || []} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" data-testid="text-agent-world-title">Agent Factory</h2>
          <Badge variant="outline" className="text-xs">
            {agentList.length} agents
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={fpvMode ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setFpvMode(!fpvMode)}
            data-testid="button-toggle-fpv"
          >
            <Users className="h-4 w-4" />
            {fpvMode ? "Exit Walk" : "Walk Mode"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsFullscreen(!isFullscreen)} data-testid="button-toggle-fullscreen">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </div>

      <div className={`relative rounded-lg overflow-hidden border border-primary/20 bg-[#0a0a1a] ${fpvMode ? "h-[600px]" : "h-[450px]"}`} data-testid="canvas-agent-world">
        {selectedAgent && (
          <AgentDetailPanel agent={selectedAgent} simState={simStates.get(selectedAgent.id)} onClose={() => setSelectedAgent(null)} />
        )}

        {fpvMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 pointer-events-none" data-testid="fpv-instructions">
            <p className="text-[11px] text-white/70 text-center">
              <span className="text-primary font-medium">Click the 3D view</span> to look around · <span className="font-medium text-white/90">WASD</span> or <span className="font-medium text-white/90">Arrow keys</span> to move · <span className="font-medium text-white/90">Esc</span> to release mouse
            </p>
          </div>
        )}

        <WebGLErrorBoundary
          fallback={
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center text-white/60">
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-50 text-amber-500" />
                <p className="text-lg font-medium" data-testid="text-webgl-fallback">3D view requires WebGL</p>
                <p className="text-sm mt-1">Your browser does not support WebGL. Try a modern browser with hardware acceleration.</p>
              </div>
            </div>
          }
        >
          {detectWebGL() ? (
            <Canvas camera={{ position: [18, 14, 18], fov: 50, near: 0.1, far: 100 }} style={{ background: "#0a0a1a" }} dpr={[1, 2]} shadows>
              <Suspense fallback={null}>
                <Scene agents={agentList} selectedAgent={selectedAgent} onSelectAgent={handleSelectAgent} simStates={simStates} fpvMode={fpvMode} rooms={factoryRooms} />
              </Suspense>
            </Canvas>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center text-white/60">
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-50 text-amber-500" />
                <p className="text-lg font-medium" data-testid="text-webgl-fallback">3D view requires WebGL</p>
                <p className="text-sm mt-1">Your browser does not support WebGL. Try a modern browser with hardware acceleration.</p>
              </div>
            </div>
          )}
        </WebGLErrorBoundary>

        {agentList.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center text-white/60">
              <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No agents in the factory yet</p>
              <p className="text-sm mt-1">Register agents to see them come alive here</p>
            </div>
          </div>
        )}
      </div>

      <FactoryControlsBar
        agents={agentList}
        tokens={tokens || []}
        workspaces={workspaces || []}
        simStates={simStates}
      />

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="rounded-lg border border-border bg-card p-3" data-testid="panel-room-legend">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Departments</p>
          <div className="space-y-1">
            {factoryRooms.map(room => (
              <button
                key={room.id}
                className="flex items-center gap-2 w-full text-left hover:bg-muted rounded px-1 py-0.5 transition-colors"
                onClick={() => setSelectedRoom(selectedRoom?.id === room.id ? null : room)}
                data-testid={`button-room-${room.id}`}
              >
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: room.color }} />
                <span className="text-xs">{room.name}</span>
              </button>
            ))}
          </div>
          <button
            className="flex items-center gap-2 w-full text-left mt-2 pt-2 border-t hover:bg-muted rounded px-1 py-0.5 transition-colors"
            data-testid="button-add-department"
          >
            <Plus className="h-3 w-3 text-primary" />
            <span className="text-xs text-primary">Add Department</span>
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-3" data-testid="panel-activity-feed">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Live Activity</p>
          <div className="space-y-1.5">
            {agentList.filter(a => a.isActive).slice(0, 5).map(agent => {
              const sim = simStates.get(agent.id);
              if (!sim) return null;
              const agentColor = getAgentColor(agent);
              return (
                <div key={agent.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${sim.phase === "working" ? "bg-green-500" : sim.phase === "walking" ? "bg-amber-500" : "bg-gray-400"}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-medium" style={{ color: agentColor }}>{agent.name}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {sim.phase === "walking" ? `heading to ${sim.targetRoom}` : sim.phase === "working" ? sim.objective : "selecting next objective"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedRoom && (
        <RoomDetailPanel
          room={selectedRoom}
          agents={agentList}
          simStates={simStates}
          onClose={() => setSelectedRoom(null)}
        />
      )}

      <FactoryHealthPanel />

      <CommandChatPanel agents={agentList} workspaces={workspaces || []} />
    </div>
  );
}
