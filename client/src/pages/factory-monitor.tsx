import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Microscope,
  Target,
  PenTool,
  Terminal,
  Database,
  Radio,
  FlaskConical,
  Archive,
  Footprints,
  X,
  Eye,
  Brain,
  Wrench,
  MapPin,
  Crosshair,
  Clock,
  ChevronRight,
  Wifi,
  WifiOff,
  Activity,
  ArrowRight,
} from "lucide-react";
import {
  useFactoryWebSocket,
  type FactoryAgent,
  type FactoryRoom,
} from "@/hooks/use-factory-ws";

// ============================================================
// Icon mapping for rooms
// ============================================================

const ROOM_ICONS: Record<string, React.ElementType> = {
  microscope: Microscope,
  target: Target,
  "pen-tool": PenTool,
  terminal: Terminal,
  database: Database,
  radio: Radio,
  "flask-conical": FlaskConical,
  archive: Archive,
  footprints: Footprints,
};

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; bgClass: string }
> = {
  working: {
    label: "Working",
    dotClass: "bg-green-500",
    bgClass: "bg-green-500/10 text-green-700 dark:text-green-400",
  },
  moving: {
    label: "Moving",
    dotClass: "bg-blue-500",
    bgClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  idle: {
    label: "Idle",
    dotClass: "bg-gray-400",
    bgClass: "bg-gray-400/10 text-gray-600 dark:text-gray-400",
  },
  thinking: {
    label: "Thinking",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

// ============================================================
// Agent Avatar Component
// ============================================================

function AgentAvatar({
  agent,
  isSelected,
  onClick,
}: {
  agent: FactoryAgent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusCfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          layout
          onClick={onClick}
          className={`
            relative flex items-center justify-center
            w-10 h-10 rounded-full text-white font-bold text-sm
            cursor-pointer transition-shadow select-none
            ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-background shadow-lg" : "hover:shadow-md"}
          `}
          style={{ backgroundColor: agent.color }}
          animate={
            agent.status === "working"
              ? { scale: [1, 1.05, 1] }
              : agent.status === "moving"
                ? { x: [0, 2, -2, 0] }
                : agent.status === "thinking"
                  ? { opacity: [1, 0.7, 1] }
                  : {}
          }
          transition={{
            duration: agent.status === "moving" ? 0.6 : 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {agent.avatar}
          {/* Status indicator dot */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusCfg.dotClass}`}
          />
          {/* Progress ring */}
          {agent.status === "working" && (
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 40 40"
            >
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="2"
                strokeDasharray={`${(agent.progress / 100) * 113} 113`}
                strokeLinecap="round"
              />
            </svg>
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">{agent.name}</div>
          <div className="text-xs opacity-80">{agent.taskDescription}</div>
          {agent.currentTool && (
            <div className="text-xs flex items-center gap-1">
              <Wrench className="h-3 w-3" /> {agent.currentTool}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// Room Card Component
// ============================================================

function RoomCard({
  room,
  agents,
  selectedAgentId,
  onSelectAgent,
}: {
  room: FactoryRoom;
  agents: FactoryAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const RoomIcon = ROOM_ICONS[room.icon] || Footprints;

  return (
    <motion.div
      layout
      className="relative rounded-xl border-2 bg-card p-4 flex flex-col gap-3 min-h-[180px] transition-colors"
      style={{
        borderColor: agents.length > 0 ? `${room.color}60` : "transparent",
        boxShadow:
          agents.length > 0
            ? `0 0 20px ${room.color}15, inset 0 0 20px ${room.color}05`
            : "none",
      }}
    >
      {/* Room header */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${room.color}20` }}
        >
          <RoomIcon className="h-4 w-4" style={{ color: room.color }} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{room.name}</h3>
          <p className="text-[10px] text-muted-foreground truncate">
            {room.description}
          </p>
        </div>
      </div>

      {/* Tools available */}
      {room.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {room.tools.map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground"
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      {/* Agents in this room */}
      <div className="flex-1 flex items-end">
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <AgentAvatar
                  agent={agent}
                  isSelected={selectedAgentId === agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Agent count badge */}
      {agents.length > 0 && (
        <div className="absolute top-2 right-2">
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
            style={{
              backgroundColor: `${room.color}15`,
              color: room.color,
            }}
          >
            {agents.length}
          </Badge>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================
// Agent Inspector Panel
// ============================================================

function AgentInspector({
  agent,
  rooms,
  onClose,
}: {
  agent: FactoryAgent;
  rooms: FactoryRoom[];
  onClose: () => void;
}) {
  const statusCfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle;
  const currentRoom = rooms.find((r) => r.id === agent.currentRoomId);
  const RoomIcon = currentRoom
    ? ROOM_ICONS[currentRoom.icon] || Footprints
    : Footprints;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-[380px] shrink-0 border-l bg-card flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: agent.color }}
            >
              {agent.avatar}
            </div>
            <div>
              <h2 className="font-bold text-lg">{agent.name}</h2>
              <Badge className={`text-[10px] ${statusCfg.bgClass}`}>
                <span
                  className={`w-1.5 h-1.5 rounded-full mr-1 ${statusCfg.dotClass}`}
                />
                {statusCfg.label}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Task Progress</span>
            <span>{agent.progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: agent.color }}
              animate={{ width: `${agent.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Current Location */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Current Location</h3>
            </div>
            {currentRoom && (
              <div
                className="flex items-center gap-2 p-2.5 rounded-lg"
                style={{ backgroundColor: `${currentRoom.color}10` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${currentRoom.color}20` }}
                >
                  <RoomIcon
                    className="h-4 w-4"
                    style={{ color: currentRoom.color }}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium">{currentRoom.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {currentRoom.description}
                  </div>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Current Tool */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Active Tool</h3>
            </div>
            {agent.currentTool ? (
              <div className="p-2.5 rounded-lg bg-muted/50">
                <div className="text-sm font-medium">{agent.currentTool}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {agent.taskDescription}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                No tool active
              </div>
            )}
          </section>

          <Separator />

          {/* Current Thought */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Current Thought</h3>
            </div>
            <motion.div
              key={agent.thought.text}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg border border-dashed bg-muted/30"
            >
              <p className="text-sm italic leading-relaxed">
                "{agent.thought.text}"
              </p>
            </motion.div>
          </section>

          <Separator />

          {/* Goals */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Goals</h3>
            </div>
            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg bg-muted/30 border-l-2 border-amber-500">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                  Long-Term Goal
                </div>
                <div className="text-sm">{agent.goals.longTerm}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border-l-2 border-blue-500">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                  Current Goal
                </div>
                <div className="text-sm">{agent.goals.current}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border-l-2 border-green-500">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                  Sub-Goal
                </div>
                <div className="text-sm">{agent.goals.subGoal}</div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Thought History */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Thought Stream</h3>
            </div>
            <div className="space-y-1.5">
              {agent.thoughtHistory
                .slice()
                .reverse()
                .map((t, i) => (
                  <motion.div
                    key={`${t.timestamp}-${i}`}
                    initial={i === 0 ? { opacity: 0, x: -10 } : false}
                    animate={{ opacity: 1 - i * 0.08, x: 0 }}
                    className="text-[11px] text-muted-foreground flex gap-2"
                  >
                    <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{t.text}</span>
                  </motion.div>
                ))}
            </div>
          </section>

          <Separator />

          {/* Movement Log */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Footprints className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Movement History</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {agent.movementLog
                .slice()
                .reverse()
                .map((entry, i) => {
                  const room = rooms.find((r) => r.id === entry.roomId);
                  return (
                    <div key={`${entry.timestamp}-${i}`} className="flex items-center gap-1">
                      {i > 0 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                        style={{
                          backgroundColor: room
                            ? `${room.color}15`
                            : undefined,
                          color: room?.color,
                        }}
                      >
                        {room?.name || entry.roomId}
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ============================================================
// Stats Bar
// ============================================================

function StatsBar({
  agents,
  connected,
}: {
  agents: FactoryAgent[];
  connected: boolean;
}) {
  const working = agents.filter((a) => a.status === "working").length;
  const moving = agents.filter((a) => a.status === "moving").length;
  const thinking = agents.filter((a) => a.status === "thinking").length;
  const idle = agents.filter((a) => a.status === "idle").length;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        {connected ? (
          <Wifi className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-red-500" />
        )}
        <span className="text-muted-foreground text-xs">
          {connected ? "Live" : "Disconnected"}
        </span>
      </div>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-muted-foreground">
          {working} working
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-xs text-muted-foreground">{moving} moving</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-xs text-muted-foreground">
          {thinking} thinking
        </span>
      </div>
      {idle > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-xs text-muted-foreground">{idle} idle</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function FactoryMonitor() {
  const { state, connected } = useFactoryWebSocket();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agentsByRoom = useMemo(() => {
    if (!state) return new Map<string, FactoryAgent[]>();
    const map = new Map<string, FactoryAgent[]>();
    for (const room of state.rooms) {
      map.set(room.id, []);
    }
    for (const agent of state.agents) {
      const list = map.get(agent.currentRoomId);
      if (list) {
        list.push(agent);
      }
    }
    return map;
  }, [state]);

  const selectedAgent = useMemo(
    () => state?.agents.find((a) => a.id === selectedAgentId) ?? null,
    [state, selectedAgentId]
  );

  if (!state) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Activity className="h-10 w-10 text-muted-foreground animate-pulse mx-auto" />
          <div className="text-muted-foreground text-sm">
            Connecting to factory simulation...
          </div>
        </div>
      </div>
    );
  }

  // Separate hallway from main rooms
  const mainRooms = state.rooms.filter((r) => r.id !== "hallway");
  const hallway = state.rooms.find((r) => r.id === "hallway");

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Factory Floor
          </h1>
          <p className="text-muted-foreground text-sm">
            Real-time view of all agents, rooms, tools, and tasks
          </p>
        </div>
        <StatsBar agents={state.agents} connected={connected} />
      </div>

      {/* Body: Floor + Optional Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden gap-0 rounded-xl border bg-background">
        {/* Floor grid */}
        <div className="flex-1 overflow-auto p-4">
          {/* Agent roster bar */}
          <div className="mb-4 p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                All Agents
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {state.agents.map((agent) => {
                const room = state.rooms.find(
                  (r) => r.id === agent.currentRoomId
                );
                return (
                  <button
                    key={agent.id}
                    onClick={() =>
                      setSelectedAgentId(
                        selectedAgentId === agent.id ? null : agent.id
                      )
                    }
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left ${
                      selectedAgentId === agent.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: agent.color }}
                    >
                      {agent.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">
                        {agent.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {room?.name}
                        {agent.currentTool && ` / ${agent.currentTool}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mainRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                agents={agentsByRoom.get(room.id) || []}
                selectedAgentId={selectedAgentId}
                onSelectAgent={(id) =>
                  setSelectedAgentId(selectedAgentId === id ? null : id)
                }
              />
            ))}
          </div>

          {/* Hallway at the bottom */}
          {hallway && (
            <div className="mt-4">
              <RoomCard
                room={hallway}
                agents={agentsByRoom.get(hallway.id) || []}
                selectedAgentId={selectedAgentId}
                onSelectAgent={(id) =>
                  setSelectedAgentId(selectedAgentId === id ? null : id)
                }
              />
            </div>
          )}
        </div>

        {/* Inspector panel (slides in from right) */}
        <AnimatePresence mode="wait">
          {selectedAgent && (
            <AgentInspector
              key={selectedAgent.id}
              agent={selectedAgent}
              rooms={state.rooms}
              onClose={() => setSelectedAgentId(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
