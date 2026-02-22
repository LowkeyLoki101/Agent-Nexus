import { useQuery } from "@tanstack/react-query";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Float, Text, Billboard } from "@react-three/drei";
import { useRef, useState, useMemo, useCallback, Suspense, Component, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import type { Agent } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, X, Shield, Zap, Eye, EyeOff, Maximize2, Minimize2, AlertTriangle } from "lucide-react";

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
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("WebGL Error:", error.message);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const CAPABILITY_COLORS: Record<string, string> = {
  "content-creation": "#E5A824",
  "research": "#3B82F6",
  "code-review": "#10B981",
  "architecture": "#8B5CF6",
  "testing": "#F59E0B",
  "analysis": "#EC4899",
  "writing": "#06B6D4",
  "design": "#F97316",
  "engineering": "#6366F1",
  "security": "#EF4444",
  "strategy": "#14B8A6",
  "communication": "#A855F7",
};

function getAgentColor(agent: Agent): string {
  if (!agent.capabilities || agent.capabilities.length === 0) return "#E5A824";
  const firstCap = agent.capabilities[0].toLowerCase();
  for (const [key, color] of Object.entries(CAPABILITY_COLORS)) {
    if (firstCap.includes(key)) return color;
  }
  const hash = agent.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = Object.values(CAPABILITY_COLORS);
  return colors[hash % colors.length];
}

function AgentNode({
  agent,
  position,
  onSelect,
  isSelected,
}: {
  agent: Agent;
  position: [number, number, number];
  onSelect: (agent: Agent | null) => void;
  isSelected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const color = getAgentColor(agent);
  const isActive = agent.isActive;

  useFrame((state) => {
    if (meshRef.current) {
      const scale = hovered ? 1.3 : isSelected ? 1.2 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.15 + 1;
      glowRef.current.scale.set(pulse * 1.8, pulse * 1.8, pulse * 1.8);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = isActive ? 0.15 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05 : 0.05;
    }
  });

  const initials = agent.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
      <group position={position}>
        <mesh
          ref={glowRef}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(isSelected ? null : agent);
          }}
        >
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>

        <mesh
          ref={meshRef}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(isSelected ? null : agent);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          <dodecahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isActive ? 0.4 : 0.1}
            metalness={0.7}
            roughness={0.2}
            wireframe={!isActive}
          />
        </mesh>

        {isActive && (
          <pointLight color={color} intensity={0.8} distance={4} />
        )}

        <Billboard follow lockX={false} lockY={false} lockZ={false}>
          <Text
            position={[0, 0.85, 0]}
            fontSize={0.22}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
            font={undefined}
          >
            {agent.name}
          </Text>
          <Text
            position={[0, 0.6, 0]}
            fontSize={0.12}
            color={isActive ? "#4ade80" : "#9ca3af"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#000000"
            font={undefined}
          >
            {isActive ? "● ACTIVE" : "○ INACTIVE"}
          </Text>
        </Billboard>

        {agent.capabilities && agent.capabilities.length > 0 && (
          <Billboard follow lockX={false} lockY={false} lockZ={false}>
            {agent.capabilities.slice(0, 3).map((cap, i) => {
              const angle = ((i - 1) * Math.PI) / 4;
              return (
                <Text
                  key={i}
                  position={[Math.sin(angle) * 0.9, -0.7 - i * 0.2, Math.cos(angle) * 0.1]}
                  fontSize={0.09}
                  color="#94a3b8"
                  anchorX="center"
                  anchorY="middle"
                  font={undefined}
                >
                  {cap}
                </Text>
              );
            })}
          </Billboard>
        )}
      </group>
    </Float>
  );
}

function ConnectionLines({ agents, positions }: { agents: Agent[]; positions: [number, number, number][] }) {
  const connections = useMemo(() => {
    const conns: { from: number; to: number; strength: number }[] = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const shared = (agents[i].capabilities || []).filter(
          (c) => (agents[j].capabilities || []).includes(c)
        );
        if (shared.length > 0) {
          conns.push({ from: i, to: j, strength: shared.length });
        }
      }
    }
    return conns;
  }, [agents]);

  return (
    <group>
      {connections.map((conn, idx) => {
        const from = positions[conn.from];
        const to = positions[conn.to];
        const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <primitive key={idx} object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#E5A824", transparent: true, opacity: 0.1 + conn.strength * 0.08 }))} />
        );
      })}
    </group>
  );
}

function ParticleField() {
  const particleCount = 200;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, []);

  const ref = useRef<THREE.Points>(null!);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial color="#E5A824" size={0.03} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

function GridFloor() {
  return (
    <group position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <gridHelper args={[40, 40, "#E5A824", "#1a1a2e"]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0a1a" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function Scene({
  agents,
  selectedAgent,
  onSelectAgent,
  showConnections,
}: {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent | null) => void;
  showConnections: boolean;
}) {
  const positions = useMemo<[number, number, number][]>(() => {
    const count = agents.length;
    if (count === 0) return [];
    
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    return agents.map((_, i) => {
      const theta = 2 * Math.PI * i / goldenRatio;
      const radius = 2 + Math.sqrt(i) * 1.5;
      const y = (i % 3 - 1) * 1.5 + Math.sin(i * 0.7) * 0.5;
      return [
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius,
      ] as [number, number, number];
    });
  }, [agents]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 10, 5]} intensity={0.3} />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#E5A824" />

      <Stars radius={50} depth={50} count={3000} factor={3} saturation={0.5} fade speed={0.5} />
      <ParticleField />
      <GridFloor />

      {showConnections && <ConnectionLines agents={agents} positions={positions} />}

      {agents.map((agent, i) => (
        <AgentNode
          key={agent.id}
          agent={agent}
          position={positions[i]}
          onSelect={onSelectAgent}
          isSelected={selectedAgent?.id === agent.id}
        />
      ))}

      <OrbitControls
        makeDefault
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={25}
        maxPolarAngle={Math.PI * 0.85}
      />
    </>
  );
}

function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const color = getAgentColor(agent);
  return (
    <Card
      className="absolute right-4 top-4 w-80 bg-background/90 backdrop-blur-lg border-primary/30 z-20 shadow-2xl"
      data-testid={`panel-agent-detail-${agent.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + "30", border: `2px solid ${color}` }}
            >
              <Bot className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`h-2 w-2 rounded-full ${agent.isActive ? "bg-green-500" : "bg-gray-400"}`}
                />
                <span className="text-xs text-muted-foreground">
                  {agent.isActive ? "Active" : "Inactive"}
                </span>
                {agent.isVerified && (
                  <Badge variant="outline" className="text-xs gap-1 ml-1">
                    <Shield className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7"
            onClick={onClose}
            data-testid="button-close-agent-panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {agent.description && (
          <p className="text-muted-foreground">{agent.description}</p>
        )}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wider">
              Capabilities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agent.capabilities.map((cap, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {cap}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Created{" "}
          {agent.createdAt
            ? new Date(agent.createdAt).toLocaleDateString()
            : "recently"}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentWorld() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showConnections, setShowConnections] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const handleSelectAgent = useCallback((agent: Agent | null) => {
    setSelectedAgent(agent);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-agent-world-title">
            Agent World
          </h1>
          <p className="text-muted-foreground">Loading 3D visualization...</p>
        </div>
        <Skeleton className="w-full h-[600px] rounded-lg" />
      </div>
    );
  }

  const agentList = agents || [];
  const activeCount = agentList.filter((a) => a.isActive).length;

  return (
    <div className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-4" : ""}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            data-testid="text-agent-world-title"
          >
            Agent World
          </h1>
          <p className="text-muted-foreground text-sm">
            3D visualization of {agentList.length} agents ({activeCount} active)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowConnections(!showConnections)}
            data-testid="button-toggle-connections"
          >
            {showConnections ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            {showConnections ? "Hide" : "Show"} Links
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsFullscreen(!isFullscreen)}
            data-testid="button-toggle-fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div
        className={`relative rounded-lg overflow-hidden border border-primary/20 bg-[#0a0a1a] ${
          isFullscreen ? "h-[calc(100vh-80px)]" : "h-[600px]"
        }`}
        data-testid="canvas-agent-world"
      >
        {selectedAgent && (
          <AgentDetailPanel
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        <div className="absolute left-4 bottom-4 z-10 flex flex-wrap gap-2 max-w-[300px]">
          {agentList.slice(0, 6).map((agent) => {
            const color = getAgentColor(agent);
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
                  selectedAgent?.id === agent.id
                    ? "bg-primary/20 ring-1 ring-primary"
                    : "bg-black/50 hover:bg-black/70"
                }`}
                style={{ borderLeft: `3px solid ${color}` }}
                data-testid={`button-select-agent-${agent.id}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    agent.isActive ? "bg-green-500" : "bg-gray-500"
                  }`}
                />
                <span className="text-white/80 truncate max-w-[100px]">
                  {agent.name}
                </span>
              </button>
            );
          })}
        </div>

        <WebGLErrorBoundary
          fallback={
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center text-white/60">
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-50 text-amber-500" />
                <p className="text-lg font-medium" data-testid="text-webgl-fallback">3D view requires WebGL</p>
                <p className="text-sm mt-1">Your browser does not support WebGL. Try using a modern browser with hardware acceleration enabled.</p>
              </div>
            </div>
          }
        >
          {detectWebGL() ? (
            <Canvas
              camera={{ position: [8, 4, 8], fov: 60, near: 0.1, far: 100 }}
              style={{ background: "transparent" }}
              dpr={[1, 2]}
            >
              <Suspense fallback={null}>
                <Scene
                  agents={agentList}
                  selectedAgent={selectedAgent}
                  onSelectAgent={handleSelectAgent}
                  showConnections={showConnections}
                />
              </Suspense>
            </Canvas>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center text-white/60">
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-50 text-amber-500" />
                <p className="text-lg font-medium" data-testid="text-webgl-fallback">3D view requires WebGL</p>
                <p className="text-sm mt-1">Your browser does not support WebGL. Try using a modern browser with hardware acceleration enabled.</p>
              </div>
            </div>
          )}
        </WebGLErrorBoundary>

        {agentList.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center text-white/60">
              <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No agents in the world yet</p>
              <p className="text-sm mt-1">Register agents to see them appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
