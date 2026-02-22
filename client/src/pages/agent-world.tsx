import { useQuery } from "@tanstack/react-query";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, RoundedBox } from "@react-three/drei";
import { useRef, useState, useMemo, useCallback, Suspense, Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import * as THREE from "three";
import type { Agent } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, X, Shield, Zap, Maximize2, Minimize2, AlertTriangle, Activity } from "lucide-react";

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

const ROOMS: { id: string; name: string; position: [number, number, number]; size: [number, number, number]; color: string; capabilities: string[] }[] = [
  { id: "research-lab", name: "Research Lab", position: [-8, 0, -6], size: [5, 3, 5], color: "#3B82F6", capabilities: ["research", "analysis"] },
  { id: "code-workshop", name: "Code Workshop", position: [0, 0, -6], size: [5, 3, 5], color: "#10B981", capabilities: ["code-review", "engineering", "testing"] },
  { id: "design-studio", name: "Design Studio", position: [8, 0, -6], size: [5, 3, 5], color: "#F97316", capabilities: ["design", "content-creation", "writing"] },
  { id: "strategy-room", name: "Strategy Room", position: [-8, 0, 4], size: [5, 3, 5], color: "#8B5CF6", capabilities: ["strategy", "architecture"] },
  { id: "comms-center", name: "Comms Center", position: [0, 0, 4], size: [5, 3, 5], color: "#EC4899", capabilities: ["communication", "security"] },
  { id: "break-room", name: "Break Room", position: [8, 0, 4], size: [5, 3, 5], color: "#E5A824", capabilities: [] },
];

const OBJECTIVES = [
  "Analyzing data patterns",
  "Writing documentation",
  "Reviewing pull request",
  "Designing new feature",
  "Running test suite",
  "Researching best practices",
  "Drafting strategy brief",
  "Building prototype",
  "Security audit",
  "Refactoring module",
  "Creating visual assets",
  "Compiling report",
  "Brainstorming session",
  "Code optimization",
  "Architecture review",
  "Team sync meeting",
];

function pickObjectiveRoom(agent: Agent): typeof ROOMS[number] {
  const caps = (agent.capabilities || []).map(c => c.toLowerCase());
  const matching = ROOMS.filter(r => r.capabilities.some(rc => caps.some(ac => ac.includes(rc))));
  if (matching.length > 0) {
    return matching[Math.floor(Math.random() * matching.length)];
  }
  return ROOMS[Math.floor(Math.random() * ROOMS.length)];
}

interface AgentSimState {
  agentId: string;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetRoom: string;
  objective: string;
  phase: "walking" | "working" | "idle";
  phaseTimer: number;
  speed: number;
}

function FactoryFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 24]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <gridHelper args={[30, 30, "#E5A82440", "#E5A82415"]} position={[0, 0.01, 0]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, -1]} receiveShadow>
        <planeGeometry args={[4, 8]} />
        <meshStandardMaterial color="#252540" />
      </mesh>
    </group>
  );
}

function Room({ room }: { room: typeof ROOMS[number] }) {
  const [px, py, pz] = room.position;
  const [sx, sy, sz] = room.size;

  return (
    <group position={[px, py + sy / 2, pz]}>
      <mesh position={[0, -sy / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[sx, sz]} />
        <meshStandardMaterial color={room.color} opacity={0.15} transparent />
      </mesh>

      <mesh position={[-sx / 2, 0, 0]}>
        <boxGeometry args={[0.1, sy, sz]} />
        <meshStandardMaterial color={room.color} opacity={0.3} transparent />
      </mesh>
      <mesh position={[sx / 2, 0, 0]}>
        <boxGeometry args={[0.1, sy, sz]} />
        <meshStandardMaterial color={room.color} opacity={0.3} transparent />
      </mesh>
      <mesh position={[0, 0, -sz / 2]}>
        <boxGeometry args={[sx, sy, 0.1]} />
        <meshStandardMaterial color={room.color} opacity={0.3} transparent />
      </mesh>
      <mesh position={[0, 0, sz / 2]}>
        <boxGeometry args={[sx * 0.3, sy, 0.1]} />
        <meshStandardMaterial color={room.color} opacity={0.3} transparent />
      </mesh>

      <Billboard position={[0, sy / 2 + 0.4, 0]}>
        <Text fontSize={0.35} color={room.color} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000" font={undefined}>
          {room.name}
        </Text>
      </Billboard>

      <pointLight position={[0, sy - 0.5, 0]} color={room.color} intensity={0.4} distance={6} />

      {room.id === "code-workshop" && (
        <>
          <RoundedBox args={[1.2, 0.6, 0.8]} position={[-1, -sy / 2 + 0.3, -1]} radius={0.05}>
            <meshStandardMaterial color="#2a2a4a" />
          </RoundedBox>
          <RoundedBox args={[0.8, 0.05, 0.5]} position={[-1, -sy / 2 + 0.65, -1.1]} radius={0.02}>
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.3} />
          </RoundedBox>
        </>
      )}
      {room.id === "research-lab" && (
        <>
          <RoundedBox args={[1.5, 0.6, 0.6]} position={[0, -sy / 2 + 0.3, -1.5]} radius={0.05}>
            <meshStandardMaterial color="#2a2a4a" />
          </RoundedBox>
          <mesh position={[0.8, -sy / 2 + 0.8, -1.5]}>
            <cylinderGeometry args={[0.1, 0.1, 0.4, 8]} />
            <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={0.5} transparent opacity={0.7} />
          </mesh>
        </>
      )}
      {room.id === "design-studio" && (
        <>
          <RoundedBox args={[1.8, 0.05, 1.2]} position={[0, -sy / 2 + 0.75, -0.5]} radius={0.02}>
            <meshStandardMaterial color="#F97316" emissive="#F97316" emissiveIntensity={0.15} />
          </RoundedBox>
          <RoundedBox args={[1.6, 0.9, 0.05]} position={[0, -sy / 2 + 0.45, -1.8]} radius={0.02}>
            <meshStandardMaterial color="#2a2a4a" />
          </RoundedBox>
        </>
      )}
      {room.id === "strategy-room" && (
        <RoundedBox args={[2.0, 0.6, 1.2]} position={[0, -sy / 2 + 0.3, 0]} radius={0.05}>
          <meshStandardMaterial color="#2a2a4a" />
        </RoundedBox>
      )}
      {room.id === "break-room" && (
        <>
          <RoundedBox args={[0.8, 0.4, 0.8]} position={[-0.8, -sy / 2 + 0.2, 0]} radius={0.05}>
            <meshStandardMaterial color="#3a3a5a" />
          </RoundedBox>
          <RoundedBox args={[0.8, 0.4, 0.8]} position={[0.8, -sy / 2 + 0.2, 0]} radius={0.05}>
            <meshStandardMaterial color="#3a3a5a" />
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

function AgentCharacter({
  agent,
  simState,
  onSelect,
  isSelected,
}: {
  agent: Agent;
  simState: AgentSimState;
  onSelect: (agent: Agent | null) => void;
  isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const bobRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const color = getAgentColor(agent);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    groupRef.current.position.copy(simState.currentPos);

    if (simState.phase === "walking") {
      bobRef.current += delta * 8;
      groupRef.current.position.y = Math.abs(Math.sin(bobRef.current)) * 0.15;

      const dir = new THREE.Vector3().subVectors(simState.targetPos, simState.currentPos);
      if (dir.length() > 0.01) {
        const angle = Math.atan2(dir.x, dir.z);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, 0.1);
      }
    } else if (simState.phase === "working") {
      bobRef.current += delta * 2;
      groupRef.current.position.y = Math.sin(bobRef.current) * 0.03;
    } else {
      bobRef.current += delta;
      groupRef.current.position.y = Math.sin(bobRef.current) * 0.02;
    }
  });

  const scale = hovered ? 1.15 : isSelected ? 1.1 : 1;

  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      <mesh
        position={[0, 0.5, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : agent); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <capsuleGeometry args={[0.2, 0.4, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={simState.phase === "working" ? 0.5 : 0.2}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 1.05, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : agent); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.4} roughness={0.4} />
      </mesh>

      {agent.isActive && (
        <pointLight position={[0, 0.8, 0]} color={color} intensity={0.3} distance={2} />
      )}

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
            selecting objective...
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

function useAgentSimulation(agents: Agent[]) {
  const simStates = useRef<Map<string, AgentSimState>>(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const existing = simStates.current;
    agents.forEach((agent, idx) => {
      if (!existing.has(agent.id)) {
        const startRoom = ROOMS[idx % ROOMS.length];
        const offset = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
        const startPos = new THREE.Vector3(...startRoom.position).add(offset);
        startPos.y = 0;
        existing.set(agent.id, {
          agentId: agent.id,
          currentPos: startPos.clone(),
          targetPos: startPos.clone(),
          targetRoom: startRoom.name,
          objective: "Getting started",
          phase: "idle",
          phaseTimer: 1 + Math.random() * 3,
          speed: 1.5 + Math.random() * 1.5,
        });
      }
    });
  }, [agents]);

  useEffect(() => {
    const interval = setInterval(() => {
      const states = simStates.current;
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
            state.phase = "working";
            state.phaseTimer = 6 + Math.random() * 12;
          } else {
            dir.normalize().multiplyScalar(state.speed * dt);
            state.currentPos.add(dir);
            state.currentPos.y = 0;
          }
        } else if (state.phase === "working") {
          if (state.phaseTimer <= 0) {
            const nextRoom = pickObjectiveRoom(agent);
            const roomCenter = new THREE.Vector3(...nextRoom.position);
            const offset = new THREE.Vector3((Math.random() - 0.5) * 2.5, 0, (Math.random() - 0.5) * 2.5);
            state.targetPos = roomCenter.add(offset);
            state.targetPos.y = 0;
            state.targetRoom = nextRoom.name;
            state.objective = OBJECTIVES[Math.floor(Math.random() * OBJECTIVES.length)];
            state.phase = "idle";
            state.phaseTimer = 0.5 + Math.random() * 1;
          }
        } else if (state.phase === "idle") {
          if (state.phaseTimer <= 0) {
            state.phase = "walking";
          }
        }
      });

      setTick(t => t + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [agents]);

  return simStates.current;
}

function Scene({
  agents,
  selectedAgent,
  onSelectAgent,
  simStates,
}: {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent | null) => void;
  simStates: Map<string, AgentSimState>;
}) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[15, 20, 10]} intensity={0.5} castShadow />
      <directionalLight position={[-10, 15, -5]} intensity={0.2} />
      <hemisphereLight color="#1a1a3e" groundColor="#0a0a1a" intensity={0.3} />

      <fog attach="fog" args={["#0a0a1a", 20, 45]} />

      <FactoryFloor />
      <FactorySign />

      {ROOMS.map(room => (
        <Room key={room.id} room={room} />
      ))}

      {agents.map((agent) => {
        const sim = simStates.get(agent.id);
        if (!sim) return null;
        return (
          <AgentCharacter
            key={agent.id}
            agent={agent}
            simState={sim}
            onSelect={onSelectAgent}
            isSelected={selectedAgent?.id === agent.id}
          />
        );
      })}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={35}
        maxPolarAngle={Math.PI * 0.45}
        minPolarAngle={Math.PI * 0.1}
        target={[0, 1, 0]}
      />
    </>
  );
}

function AgentDetailPanel({ agent, simState, onClose }: { agent: Agent; simState?: AgentSimState; onClose: () => void }) {
  const color = getAgentColor(agent);
  return (
    <Card className="absolute right-4 top-4 w-80 bg-background/90 backdrop-blur-lg border-primary/30 z-20 shadow-2xl" data-testid={`panel-agent-detail-${agent.id}`}>
      <CardHeader className="pb-3">
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
                {agent.isVerified && (
                  <Badge variant="outline" className="text-xs gap-1 ml-1"><Shield className="h-3 w-3" /> Verified</Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onClose} data-testid="button-close-agent-panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {simState && (
          <div className="rounded-md bg-muted/50 p-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Status</span>
            </div>
            <p className="font-medium">
              {simState.phase === "walking" && `Walking to ${simState.targetRoom}`}
              {simState.phase === "working" && `Working: ${simState.objective}`}
              {simState.phase === "idle" && "Thinking about next task..."}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${
                simState.phase === "working" ? "bg-green-500 animate-pulse" :
                simState.phase === "walking" ? "bg-amber-500 animate-pulse" : "bg-gray-400"
              }`} />
              {simState.phase === "walking" && "In transit (cooldown)"}
              {simState.phase === "working" && "Actively working"}
              {simState.phase === "idle" && "Selecting next objective"}
            </div>
          </div>
        )}
        {agent.description && <p className="text-muted-foreground">{agent.description}</p>}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wider">Capabilities</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.capabilities.map((cap, i) => (
                <Badge key={i} variant="secondary" className="text-xs"><Zap className="h-3 w-3 mr-1" />{cap}</Badge>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Created {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "recently"}
        </div>
      </CardContent>
    </Card>
  );
}

function RoomLegend({ rooms }: { rooms: typeof ROOMS }) {
  return (
    <div className="absolute left-4 bottom-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3 max-w-[220px]" data-testid="panel-room-legend">
      <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">Factory Rooms</p>
      <div className="space-y-1.5">
        {rooms.map(room => (
          <div key={room.id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: room.color }} />
            <span className="text-xs text-white/70">{room.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ agents, simStates }: { agents: Agent[]; simStates: Map<string, AgentSimState> }) {
  const activities = useMemo(() => {
    const acts: { agent: string; text: string; color: string; phase: string }[] = [];
    agents.forEach(agent => {
      const sim = simStates.get(agent.id);
      if (!sim || !agent.isActive) return;
      const color = getAgentColor(agent);
      if (sim.phase === "walking") {
        acts.push({ agent: agent.name, text: `heading to ${sim.targetRoom}`, color, phase: "walking" });
      } else if (sim.phase === "working") {
        acts.push({ agent: agent.name, text: sim.objective, color, phase: "working" });
      } else if (sim.phase === "idle") {
        acts.push({ agent: agent.name, text: "selecting next objective", color, phase: "idle" });
      }
    });
    return acts.slice(0, 5);
  }, [agents, simStates]);

  if (activities.length === 0) return null;

  return (
    <div className="absolute right-4 bottom-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3 max-w-[260px]" data-testid="panel-activity-feed">
      <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">Live Activity</p>
      <div className="space-y-1.5">
        {activities.map((act, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${act.phase === "working" ? "bg-green-500" : act.phase === "walking" ? "bg-amber-500" : "bg-gray-400"}`} />
            <div className="min-w-0">
              <span className="text-xs font-medium" style={{ color: act.color }}>{act.agent}</span>
              <span className="text-xs text-white/50 ml-1">{act.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentWorld() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: agents, isLoading } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const agentList = agents || [];
  const simStates = useAgentSimulation(agentList);

  const handleSelectAgent = useCallback((agent: Agent | null) => { setSelectedAgent(agent); }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-agent-world-title">Agent Factory</h1>
          <p className="text-muted-foreground">Loading factory...</p>
        </div>
        <Skeleton className="w-full h-[600px] rounded-lg" />
      </div>
    );
  }

  const activeCount = agentList.filter(a => a.isActive).length;
  const workingCount = Array.from(simStates.values()).filter(s => s.phase === "working").length;

  return (
    <div className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-4" : ""}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-agent-world-title">Agent Factory</h1>
          <p className="text-muted-foreground text-sm">
            {agentList.length} agents · {activeCount} active · {workingCount} working
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsFullscreen(!isFullscreen)} data-testid="button-toggle-fullscreen">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
        </div>
      </div>

      <div
        className={`relative rounded-lg overflow-hidden border border-primary/20 bg-[#0a0a1a] ${isFullscreen ? "h-[calc(100vh-80px)]" : "h-[600px]"}`}
        data-testid="canvas-agent-world"
      >
        {selectedAgent && (
          <AgentDetailPanel
            agent={selectedAgent}
            simState={simStates.get(selectedAgent.id)}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        <RoomLegend rooms={ROOMS} />
        <ActivityFeed agents={agentList} simStates={simStates} />

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
                <Scene agents={agentList} selectedAgent={selectedAgent} onSelectAgent={handleSelectAgent} simStates={simStates} />
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
    </div>
  );
}
