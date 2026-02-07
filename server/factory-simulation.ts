import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { rlmMemory } from "./rlm-memory";

// ============================================================
// Factory Room Definitions
// ============================================================

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

export const FACTORY_ROOMS: FactoryRoom[] = [
  {
    id: "research-lab",
    name: "Research Lab",
    icon: "microscope",
    description: "Data analysis, literature review, and experimentation",
    color: "#6366f1",
    tools: ["Web Scraper", "Paper Analyzer", "Data Pipeline", "Citation Engine"],
    gridPosition: { row: 0, col: 0 },
    capacity: 4,
  },
  {
    id: "planning-room",
    name: "Planning Room",
    icon: "target",
    description: "Strategic planning, goal decomposition, and task scheduling",
    color: "#f59e0b",
    tools: ["Goal Planner", "Task Scheduler", "Dependency Graph", "Priority Matrix"],
    gridPosition: { row: 0, col: 1 },
    capacity: 4,
  },
  {
    id: "content-studio",
    name: "Content Studio",
    icon: "pen-tool",
    description: "Writing, editing, and content generation",
    color: "#ec4899",
    tools: ["Text Generator", "Editor", "Style Checker", "Tone Analyzer"],
    gridPosition: { row: 0, col: 2 },
    capacity: 4,
  },
  {
    id: "dev-ops-center",
    name: "Dev Ops Center",
    icon: "terminal",
    description: "Code execution, deployment, and infrastructure management",
    color: "#10b981",
    tools: ["Code Runner", "Deploy Pipeline", "Log Monitor", "Container Manager"],
    gridPosition: { row: 1, col: 0 },
    capacity: 4,
  },
  {
    id: "data-vault",
    name: "Data Vault",
    icon: "database",
    description: "Data storage, retrieval, and transformation",
    color: "#8b5cf6",
    tools: ["Query Engine", "Data Transformer", "Schema Builder", "Index Optimizer"],
    gridPosition: { row: 1, col: 1 },
    capacity: 4,
  },
  {
    id: "comms-hub",
    name: "Comms Hub",
    icon: "radio",
    description: "Inter-agent communication, reporting, and notifications",
    color: "#06b6d4",
    tools: ["Message Bus", "Report Generator", "Alert System", "Broadcast Channel"],
    gridPosition: { row: 1, col: 2 },
    capacity: 4,
  },
  {
    id: "testing-chamber",
    name: "Testing Chamber",
    icon: "flask-conical",
    description: "Quality assurance, validation, and evaluation",
    color: "#f97316",
    tools: ["Test Runner", "Validator", "Benchmark Suite", "Regression Checker"],
    gridPosition: { row: 2, col: 0 },
    capacity: 4,
  },
  {
    id: "archive-room",
    name: "Archive Room",
    icon: "archive",
    description: "Long-term storage, document retrieval, and knowledge base",
    color: "#78716c",
    tools: ["Document Store", "Search Index", "Version Control", "Knowledge Graph"],
    gridPosition: { row: 2, col: 1 },
    capacity: 4,
  },
  {
    id: "hallway",
    name: "Hallway",
    icon: "footprints",
    description: "Transit area between rooms",
    color: "#94a3b8",
    tools: [],
    gridPosition: { row: 2, col: 2 },
    capacity: 10,
  },
];

// ============================================================
// Agent State
// ============================================================

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

// ============================================================
// Simulation Data
// ============================================================

const AGENT_DEFINITIONS = [
  {
    id: "agent-alpha",
    name: "Alpha",
    avatar: "A",
    color: "#6366f1",
    longTermGoal: "Build a comprehensive knowledge base from research papers",
    tasks: [
      { room: "research-lab", tool: "Paper Analyzer", task: "Analyzing recent ML papers for key findings", subGoal: "Extract methodology patterns", thoughts: ["This paper has an interesting approach to attention mechanisms...", "The methodology section suggests a novel training paradigm", "Cross-referencing citations to validate the claims"] },
      { room: "data-vault", tool: "Query Engine", task: "Querying structured data for cross-references", subGoal: "Link findings across datasets", thoughts: ["Need to join these two datasets on the author field", "Found 23 matching records, filtering by relevance score", "The correlation between these variables is stronger than expected"] },
      { room: "archive-room", tool: "Knowledge Graph", task: "Updating knowledge graph with new connections", subGoal: "Store and index new findings", thoughts: ["Creating a new node for this research cluster", "Linking to existing nodes via co-citation analysis", "The graph is becoming more connected in the NLP region"] },
      { room: "comms-hub", tool: "Report Generator", task: "Generating summary report for team", subGoal: "Communicate findings to other agents", thoughts: ["Structuring the report with key takeaways first", "Including visualizations of the knowledge graph updates", "Flagging 3 papers that need human review"] },
      { room: "planning-room", tool: "Priority Matrix", task: "Re-prioritizing research queue", subGoal: "Plan next research batch", thoughts: ["Moving NLP papers to higher priority based on recent trends", "Deprioritizing older reinforcement learning papers", "Should allocate more time to the transformer architecture cluster"] },
    ],
  },
  {
    id: "agent-beta",
    name: "Beta",
    avatar: "B",
    color: "#ec4899",
    longTermGoal: "Produce and publish high-quality content across all channels",
    tasks: [
      { room: "content-studio", tool: "Text Generator", task: "Drafting blog post on agent orchestration", subGoal: "Create first draft with outline", thoughts: ["Opening with a compelling hook about autonomous systems", "The second section needs more concrete examples", "Adjusting tone to be more conversational for the target audience"] },
      { room: "content-studio", tool: "Style Checker", task: "Running style and grammar checks", subGoal: "Polish draft to publication quality", thoughts: ["Found 3 passive voice instances to convert", "The readability score is at grade 10, need to simplify", "Checking consistency of technical terminology throughout"] },
      { room: "testing-chamber", tool: "Validator", task: "Validating all links and references in content", subGoal: "Ensure content accuracy", thoughts: ["Checking all 12 external links for 200 status codes", "Two references need DOI verification", "Fact-checking the statistics against original sources"] },
      { room: "comms-hub", tool: "Broadcast Channel", task: "Publishing content to distribution channels", subGoal: "Distribute content to all platforms", thoughts: ["Preparing different formats for each platform", "Scheduling social media posts for optimal engagement times", "Setting up tracking pixels for analytics"] },
      { room: "planning-room", tool: "Task Scheduler", task: "Planning next content calendar", subGoal: "Schedule upcoming content", thoughts: ["Analyzing which topics performed best last month", "Identifying content gaps in the current pipeline", "Aligning with upcoming product launches for timely content"] },
    ],
  },
  {
    id: "agent-gamma",
    name: "Gamma",
    avatar: "G",
    color: "#10b981",
    longTermGoal: "Maintain 99.9% uptime and optimize infrastructure performance",
    tasks: [
      { room: "dev-ops-center", tool: "Log Monitor", task: "Scanning logs for anomalies and errors", subGoal: "Detect issues before they escalate", thoughts: ["Spike in 503 errors on the API gateway at 14:32", "Memory usage trending upward on worker nodes", "The new deployment looks stable after 200 requests"] },
      { room: "dev-ops-center", tool: "Container Manager", task: "Scaling up worker containers for load spike", subGoal: "Handle increased traffic gracefully", thoughts: ["Adding 3 more replicas to the worker pool", "Load balancer is distributing traffic evenly now", "CPU utilization dropped back to 65% after scaling"] },
      { room: "testing-chamber", tool: "Benchmark Suite", task: "Running performance benchmarks on new build", subGoal: "Validate performance hasn't regressed", thoughts: ["P95 latency is 23ms, within our SLA threshold", "Throughput increased by 12% compared to last build", "Memory footprint is slightly higher, investigating root cause"] },
      { room: "data-vault", tool: "Index Optimizer", task: "Optimizing database query performance", subGoal: "Reduce query latency by 20%", thoughts: ["This index scan is causing a full table read on 2M rows", "Adding a composite index on (workspace_id, created_at)", "Query time dropped from 340ms to 12ms with the new index"] },
      { room: "archive-room", tool: "Version Control", task: "Archiving old deployment artifacts", subGoal: "Clean up storage and maintain history", thoughts: ["Compressing builds older than 30 days", "Keeping last 5 versions of each service as rollback points", "Freed up 2.3GB of artifact storage"] },
    ],
  },
  {
    id: "agent-delta",
    name: "Delta",
    avatar: "D",
    color: "#f59e0b",
    longTermGoal: "Design and optimize agent coordination strategies",
    tasks: [
      { room: "planning-room", tool: "Goal Planner", task: "Decomposing Q1 objectives into agent tasks", subGoal: "Create actionable task hierarchy", thoughts: ["Breaking the knowledge base goal into 47 sub-tasks", "Identifying dependencies between research and content tasks", "Estimating 3 sprints to complete the core pipeline"] },
      { room: "planning-room", tool: "Dependency Graph", task: "Mapping inter-agent task dependencies", subGoal: "Eliminate bottlenecks in workflow", thoughts: ["Beta is blocked on Alpha's research output for blog posts", "Gamma's infrastructure work is a prerequisite for scaling", "Found a circular dependency that needs to be resolved"] },
      { room: "comms-hub", tool: "Message Bus", task: "Coordinating handoffs between agents", subGoal: "Ensure smooth task transitions", thoughts: ["Sending research results from Alpha to Beta for content", "Notifying Gamma about upcoming load increase from new features", "Setting up event triggers for automated handoffs"] },
      { room: "research-lab", tool: "Data Pipeline", task: "Analyzing agent performance metrics", subGoal: "Identify optimization opportunities", thoughts: ["Alpha's throughput increased 15% after the new indexing strategy", "Beta's content quality scores are trending upward", "Gamma's incident response time improved by 30 seconds"] },
      { room: "testing-chamber", tool: "Regression Checker", task: "Validating coordination protocol changes", subGoal: "Ensure changes don't break existing workflows", thoughts: ["Running the full integration test suite for agent handoffs", "All 156 test cases passing after the protocol update", "Edge case found: what happens when two agents target the same resource?"] },
    ],
  },
  {
    id: "agent-epsilon",
    name: "Epsilon",
    avatar: "E",
    color: "#8b5cf6",
    longTermGoal: "Build and maintain the central data infrastructure",
    tasks: [
      { room: "data-vault", tool: "Schema Builder", task: "Designing new schema for event sourcing", subGoal: "Create scalable event store", thoughts: ["Using append-only log pattern for immutability", "Need to handle schema evolution gracefully", "Partitioning by workspace_id for query isolation"] },
      { room: "data-vault", tool: "Data Transformer", task: "Running ETL pipeline for analytics data", subGoal: "Transform raw data into analytics-ready format", thoughts: ["Normalizing timestamps across all event sources", "Deduplicating records from the message bus", "Aggregating metrics at 1-minute granularity"] },
      { room: "dev-ops-center", tool: "Deploy Pipeline", task: "Deploying database migration to production", subGoal: "Roll out schema changes safely", thoughts: ["Running migration in a transaction with rollback plan", "Zero-downtime migration using the expand-contract pattern", "Monitoring query performance during the migration window"] },
      { room: "research-lab", tool: "Citation Engine", task: "Building search index over document corpus", subGoal: "Enable fast full-text search", thoughts: ["Tokenizing documents with BM25 scoring", "Adding fuzzy matching for common misspellings", "The index covers 1.2M documents with sub-second query time"] },
      { room: "testing-chamber", tool: "Test Runner", task: "Running data integrity validation suite", subGoal: "Ensure data consistency across stores", thoughts: ["Comparing row counts between source and target tables", "Checking referential integrity across all foreign keys", "Found 0 orphaned records - data is consistent"] },
    ],
  },
  {
    id: "agent-zeta",
    name: "Zeta",
    avatar: "Z",
    color: "#06b6d4",
    longTermGoal: "Ensure quality and reliability across all agent outputs",
    tasks: [
      { room: "testing-chamber", tool: "Test Runner", task: "Executing end-to-end test suite", subGoal: "Validate full pipeline functionality", thoughts: ["Running 342 e2e tests across all agent workflows", "2 tests flaky due to timing issues, investigating", "Overall pass rate: 99.4% - above our 99% threshold"] },
      { room: "testing-chamber", tool: "Benchmark Suite", task: "Measuring output quality metrics", subGoal: "Quantify content and analysis quality", thoughts: ["BLEU score for generated content: 0.87 (target: 0.85)", "Research accuracy validated against ground truth: 94.2%", "Response time p99: 1.2s, well within SLA"] },
      { room: "comms-hub", tool: "Alert System", task: "Configuring quality alert thresholds", subGoal: "Automate quality monitoring", thoughts: ["Setting up alerts for when BLEU drops below 0.80", "Adding Slack notifications for failed test runs", "Creating a dashboard for real-time quality metrics"] },
      { room: "archive-room", tool: "Document Store", task: "Archiving test results and quality reports", subGoal: "Maintain quality history for trend analysis", thoughts: ["Storing detailed test results with full stack traces", "Generating weekly quality trend reports", "The improvement curve is flattening - may need new strategies"] },
      { room: "planning-room", tool: "Priority Matrix", task: "Prioritizing quality improvement initiatives", subGoal: "Focus on highest-impact improvements", thoughts: ["Content generation improvements have highest ROI", "Infrastructure reliability is already above target", "Investing in better test data would improve coverage significantly"] },
    ],
  },
];

// ============================================================
// Simulation Engine
// ============================================================

class FactorySimulation {
  private agents: FactoryAgent[] = [];
  private tickCount = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private compressionHandle: ReturnType<typeof setInterval> | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  // Each agent tracks which task index they're on
  private agentTaskIndices: Map<string, number> = new Map();
  // Sub-tick within a task (0 = moving, 1-100 = working)
  private agentSubTick: Map<string, number> = new Map();
  // Track last indexed thought to avoid duplicate writes
  private lastIndexedThought: Map<string, string> = new Map();
  // RLM memory stats (cached for dashboard broadcast)
  private memoryStats: any = null;

  constructor() {
    this.initializeAgents();
  }

  // ----------------------------------------------------------
  // RLM: Index an agent event into memory (fire-and-forget)
  // ----------------------------------------------------------
  private indexToMemory(
    agentId: string,
    source: "thought" | "task_complete" | "room_transition" | "diary_entry",
    content: string,
    layer: "private" | "shared" = "private"
  ) {
    // Non-blocking — don't await in the tick loop
    rlmMemory
      .index({ agentId, source, content, layer })
      .catch((err) => console.error("[rlm] index error:", err));
  }

  // ----------------------------------------------------------
  // RLM: Run compression cycle (hot→warm→cold)
  // ----------------------------------------------------------
  private runCompression() {
    rlmMemory
      .compress({ hotThresholdMs: 5 * 60 * 1000, warmThresholdMs: 30 * 60 * 1000 })
      .then((result) => {
        if (result.hotToWarm > 0 || result.warmToCold > 0) {
          console.log(
            `[rlm] Compression: ${result.hotToWarm} hot→warm, ${result.warmToCold} warm→cold, ${result.tokensReclaimed} tokens reclaimed`
          );
        }
      })
      .catch((err) => console.error("[rlm] compression error:", err));

    // Refresh stats cache
    rlmMemory
      .getStats()
      .then((stats) => { this.memoryStats = stats; })
      .catch(() => {});
  }

  getMemoryStats() {
    return this.memoryStats;
  }

  private initializeAgents() {
    this.agents = AGENT_DEFINITIONS.map((def, i) => {
      const firstTask = def.tasks[0];
      this.agentTaskIndices.set(def.id, 0);
      // Stagger agents so they don't all start at the same point
      this.agentSubTick.set(def.id, i * 8);

      return {
        id: def.id,
        name: def.name,
        avatar: def.avatar,
        color: def.color,
        currentRoomId: firstTask.room,
        previousRoomId: null,
        status: "working" as AgentStatus,
        currentTool: firstTask.tool,
        progress: 0,
        goals: {
          longTerm: def.longTermGoal,
          current: firstTask.task,
          subGoal: firstTask.subGoal,
        },
        thought: {
          text: firstTask.thoughts[0],
          timestamp: Date.now(),
        },
        thoughtHistory: [],
        taskDescription: firstTask.task,
        movementLog: [{ roomId: firstTask.room, timestamp: Date.now() }],
      };
    });
  }

  private tick() {
    this.tickCount++;
    const now = Date.now();

    for (const agent of this.agents) {
      const def = AGENT_DEFINITIONS.find((d) => d.id === agent.id)!;
      const taskIndex = this.agentTaskIndices.get(agent.id)!;
      let subTick = this.agentSubTick.get(agent.id)!;

      subTick++;

      const TASK_DURATION = 40; // ticks per task
      const MOVE_DURATION = 5; // ticks for moving between rooms
      const TOTAL_CYCLE = TASK_DURATION + MOVE_DURATION;

      const cyclePosition = subTick % TOTAL_CYCLE;

      if (cyclePosition < MOVE_DURATION) {
        // Moving phase
        const nextTaskIndex = (taskIndex + (cyclePosition === 0 ? 0 : 1)) % def.tasks.length;
        const nextTask = def.tasks[nextTaskIndex];

        if (cyclePosition === 0) {
          // Just started moving
          agent.status = "moving";
          agent.previousRoomId = agent.currentRoomId;
          agent.currentTool = null;
          agent.progress = 0;
          agent.thought = {
            text: `Heading to ${FACTORY_ROOMS.find((r) => r.id === nextTask.room)?.name}...`,
            timestamp: now,
          };
          agent.thoughtHistory = [
            ...agent.thoughtHistory.slice(-9),
            agent.thought,
          ];
        }

        agent.progress = Math.round((cyclePosition / MOVE_DURATION) * 100);

        if (cyclePosition === MOVE_DURATION - 1) {
          // Arrived
          const newTaskIndex = (taskIndex + 1) % def.tasks.length;
          this.agentTaskIndices.set(agent.id, newTaskIndex);
          const task = def.tasks[newTaskIndex];
          agent.currentRoomId = task.room;
          agent.status = "thinking";
          agent.previousRoomId = null;
          agent.currentTool = null;
          agent.progress = 0;
          agent.goals.current = task.task;
          agent.goals.subGoal = task.subGoal;
          agent.taskDescription = task.task;
          agent.thought = {
            text: `Arrived. Let me start on: ${task.subGoal}`,
            timestamp: now,
          };
          agent.thoughtHistory = [
            ...agent.thoughtHistory.slice(-9),
            agent.thought,
          ];
          agent.movementLog = [
            ...agent.movementLog.slice(-19),
            { roomId: task.room, timestamp: now },
          ];

          // RLM: Index room transition
          const roomName = FACTORY_ROOMS.find((r) => r.id === task.room)?.name || task.room;
          this.indexToMemory(
            agent.id,
            "room_transition",
            `${agent.name} moved to ${roomName}. Starting: ${task.task}. Sub-goal: ${task.subGoal}. Long-term: ${def.longTermGoal}`,
            "shared"
          );
        }
      } else {
        // Working phase
        const workPosition = cyclePosition - MOVE_DURATION;
        const task = def.tasks[taskIndex % def.tasks.length];

        agent.status = "working";
        agent.currentRoomId = task.room;
        agent.currentTool = task.tool;
        agent.progress = Math.round((workPosition / TASK_DURATION) * 100);
        agent.goals.current = task.task;
        agent.goals.subGoal = task.subGoal;
        agent.taskDescription = task.task;

        // Cycle through thoughts for this task
        const thoughtIndex = Math.floor(
          (workPosition / TASK_DURATION) * task.thoughts.length
        );
        const clampedIndex = Math.min(thoughtIndex, task.thoughts.length - 1);
        const newThought = task.thoughts[clampedIndex];

        if (agent.thought.text !== newThought) {
          agent.thought = { text: newThought, timestamp: now };
          agent.thoughtHistory = [
            ...agent.thoughtHistory.slice(-9),
            agent.thought,
          ];

          // RLM: Index new thought (deduplicated)
          if (this.lastIndexedThought.get(agent.id) !== newThought) {
            this.lastIndexedThought.set(agent.id, newThought);
            this.indexToMemory(
              agent.id,
              "thought",
              `[${agent.name} in ${task.room} using ${task.tool}] ${newThought}`
            );
          }
        }

        // RLM: Index task completion when progress hits 95%+
        if (agent.progress >= 95 && agent.progress - Math.round(((workPosition - 1) / TASK_DURATION) * 100) < 95) {
          this.indexToMemory(
            agent.id,
            "task_complete",
            `${agent.name} completed: ${task.task}. Sub-goal: ${task.subGoal}. Tool used: ${task.tool}. Room: ${task.room}. Thoughts during task: ${task.thoughts.join(" | ")}`,
            "shared"
          );
        }

        // Brief idle moments
        if (workPosition === Math.floor(TASK_DURATION * 0.5)) {
          agent.status = "thinking";
        }
      }

      this.agentSubTick.set(agent.id, subTick);
    }

    this.broadcast();
  }

  getState(): FactoryState & { memory?: any } {
    return {
      rooms: FACTORY_ROOMS,
      agents: this.agents,
      tickCount: this.tickCount,
      timestamp: Date.now(),
      memory: this.memoryStats,
    };
  }

  private broadcast() {
    const state = this.getState();
    const message = JSON.stringify({ type: "factory-update", data: state });

    Array.from(this.clients).forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  start() {
    if (this.intervalHandle) return;
    // Tick every 1.5 seconds for visible but not frantic movement
    this.intervalHandle = setInterval(() => this.tick(), 1500);

    // RLM: Run compression every 2 minutes
    this.compressionHandle = setInterval(() => this.runCompression(), 2 * 60 * 1000);
    // Initial stats fetch
    this.runCompression();

    console.log("[factory] Simulation started with RLM memory");
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this.compressionHandle) {
      clearInterval(this.compressionHandle);
      this.compressionHandle = null;
    }
  }

  setupWebSocket(httpServer: Server) {
    this.wss = new WebSocketServer({ server: httpServer, path: "/ws/factory" });

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);

      // Send initial state immediately
      ws.send(
        JSON.stringify({ type: "factory-update", data: this.getState() })
      );

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", () => {
        this.clients.delete(ws);
      });
    });

    // Auto-start simulation when first client connects (or just start it)
    this.start();

    console.log("[factory] WebSocket server ready on /ws/factory");
  }
}

// Singleton
export const factorySimulation = new FactorySimulation();
