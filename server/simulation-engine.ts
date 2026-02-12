/**
 * Simulation Engine - Utility AI Decision System
 *
 * Inspired by:
 * - The Sims advertisement model (rooms broadcast what they offer)
 * - RimWorld AI Storyteller (tension management)
 * - Boids flocking (gravitation after mandatory rounds)
 * - Survivor/Big Brother (social dynamics, competitions)
 * - Board insights: 3-tier memory, contextual taste, bootstrap rituals
 */

import type {
  AgentState, Room, AgentGoal, AgentMemoryEntry,
  AgentRelationship, ChaosEvent, Tool, AgentToolProficiency
} from "@shared/schema";

// =============================================
// TYPES
// =============================================

export type ActionType =
  | "chat" | "post_board" | "read_board" | "visit_room" | "write_diary"
  | "collaborate" | "compete" | "review" | "explore" | "rest" | "scheme"
  | "vote" | "challenge" | "investigate" | "broadcast"
  | "practice" | "calibrate" | "diagnose";

export type SimPhase = "dawn" | "morning" | "midday" | "evening" | "night";

export interface ActionCandidate {
  actionType: ActionType;
  targetId?: string; // room, agent, post, etc.
  label: string;
  // Base score before modifiers
  baseScore: number;
  // Which need this satisfies
  primaryNeed: keyof NeedScores;
  // Which trait amplifies this action
  primaryTrait: keyof TraitScores;
  // AP cost
  cost: number;
}

export interface ScoredAction extends ActionCandidate {
  needUrgency: number;
  personalityWeight: number;
  situationalModifier: number;
  commitmentBonus: number;
  noise: number;
  finalScore: number;
}

export interface DiceRollResult {
  rollValue: number; // 1-100
  modifiers: Record<string, number>;
  finalValue: number;
  threshold: number;
  succeeded: boolean;
}

export interface GravitationScore {
  roomId: string;
  roomName: string;
  score: number;
  reasons: string[];
}

export interface TensionEvent {
  type: "crisis" | "relief" | "twist" | "challenge" | "social";
  title: string;
  description: string;
  chaosLevel: number;
  suggestedPhase: SimPhase;
}

interface NeedScores {
  safety: number;
  social: number;
  power: number;
  resources: number;
  information: number;
  creativity: number;
}

interface TraitScores {
  aggression: number;
  loyalty: number;
  honesty: number;
  sociality: number;
  strategy: number;
  creativity: number;
  curiosity: number;
}

// =============================================
// CONSTANTS
// =============================================

const ACTION_COSTS: Record<ActionType, number> = {
  chat: 1,
  post_board: 2,
  read_board: 1,
  visit_room: 1,
  write_diary: 1,
  collaborate: 3,
  compete: 4,
  review: 2,
  explore: 2,
  rest: 0,
  scheme: 2,
  vote: 1,
  challenge: 3,
  investigate: 2,
  broadcast: 3,
  practice: 2,   // Working out a tool
  calibrate: 1,  // Fine-tuning a specific tool
  diagnose: 2,   // Full body checkup
};

// What actions satisfy which needs (primary mapping)
const ACTION_NEED_MAP: Record<ActionType, keyof NeedScores> = {
  chat: "social",
  post_board: "social",
  read_board: "information",
  visit_room: "information",
  write_diary: "creativity",
  collaborate: "social",
  compete: "power",
  review: "information",
  explore: "information",
  rest: "safety",
  scheme: "power",
  vote: "power",
  challenge: "power",
  investigate: "information",
  broadcast: "social",
  practice: "resources",   // Maintaining your instruments
  calibrate: "resources",  // Fine-tuning
  diagnose: "safety",      // Knowing your own capabilities
};

// What traits amplify which actions
const ACTION_TRAIT_MAP: Record<ActionType, keyof TraitScores> = {
  chat: "sociality",
  post_board: "honesty",
  read_board: "curiosity",
  visit_room: "curiosity",
  write_diary: "creativity",
  collaborate: "loyalty",
  compete: "aggression",
  review: "strategy",
  explore: "curiosity",
  rest: "strategy",
  scheme: "strategy",
  vote: "strategy",
  challenge: "aggression",
  investigate: "curiosity",
  broadcast: "sociality",
  practice: "strategy",    // Disciplined self-improvement
  calibrate: "strategy",   // Precision tuning
  diagnose: "curiosity",   // Self-awareness
};

// Phase-specific mandatory actions
const PHASE_MANDATORY_ACTIONS: Record<SimPhase, ActionType[]> = {
  dawn: ["write_diary", "diagnose"], // Reflection at dawn + body checkup
  morning: ["visit_room", "read_board"], // Explore and absorb
  midday: ["post_board"], // Contribute to community
  evening: ["vote"], // Participate in governance
  night: ["write_diary"], // End-of-day reflection
};

// Need decay rates per tick (higher = faster decay)
const NEED_DECAY_RATES: Record<keyof NeedScores, number> = {
  safety: 2,
  social: 5,
  power: 3,
  resources: 4,
  information: 6,
  creativity: 4,
};

// =============================================
// CORE FUNCTIONS
// =============================================

/**
 * Roll dice for an action (1-100 + modifiers)
 * Inspired by tabletop RPGs - adds controlled chaos
 */
export function rollDice(
  state: AgentState,
  actionType: ActionType,
  extraModifiers: Record<string, number> = {}
): DiceRollResult {
  const rollValue = Math.floor(Math.random() * 100) + 1;

  const modifiers: Record<string, number> = { ...extraModifiers };

  // Skill allocation bonus
  const skills = (state.skillAllocation as Record<string, number>) || {};
  const skillBonus = skills[actionType] || 0;
  if (skillBonus > 0) {
    modifiers.skill = skillBonus * 3; // Each skill point = +3
  }

  // Trait bonus for relevant trait
  const traitKey = ACTION_TRAIT_MAP[actionType];
  const traitValue = getTraitValue(state, traitKey);
  modifiers.trait = Math.floor(traitValue / 10); // -10 to +10

  // Reputation bonus
  if ((state.reputation ?? 50) > 60) {
    modifiers.reputation = Math.floor(((state.reputation ?? 50) - 50) / 5);
  }

  // Energy penalty
  if ((state.energy ?? 100) < 30) {
    modifiers.fatigue = -10;
  }

  // Contests won bonus (momentum)
  if ((state.contestsWon ?? 0) > 0) {
    modifiers.momentum = Math.min((state.contestsWon ?? 0) * 2, 10);
  }

  // Tool readiness modifier — dull instruments penalize everything
  const toolReadiness = state.toolReadiness ?? 75;
  if (toolReadiness < 40) {
    modifiers.dull_tools = -15; // Serious penalty
  } else if (toolReadiness < 60) {
    modifiers.rusty_tools = -8; // Noticeable degradation
  } else if (toolReadiness >= 90) {
    modifiers.sharp_tools = 5; // Well-maintained bonus
  }

  const totalModifier = Object.values(modifiers).reduce((a, b) => a + b, 0);
  const finalValue = Math.max(1, Math.min(100, rollValue + totalModifier));

  return {
    rollValue,
    modifiers,
    finalValue,
    threshold: 50, // Default threshold
    succeeded: finalValue >= 50,
  };
}

/**
 * Score all available actions using Utility AI
 * Formula: base * needUrgency * personalityWeight * situational * (1 + commitment) + noise
 */
export function scoreActions(
  state: AgentState,
  availableActions: ActionCandidate[],
  context: {
    currentPhase: SimPhase;
    recentActions?: ActionType[];
    activeGoals?: AgentGoal[];
    relationships?: AgentRelationship[];
    activeChaos?: ChaosEvent[];
    recentMemories?: AgentMemoryEntry[];
  }
): ScoredAction[] {
  return availableActions.map((action) => {
    // 1. Need urgency (non-linear: low needs are exponentially more urgent)
    const needValue = getNeedValue(state, action.primaryNeed);
    const needUrgency = calculateNeedUrgency(needValue);

    // 2. Personality weight (trait alignment)
    const traitValue = getTraitValue(state, action.primaryTrait);
    const personalityWeight = 0.5 + (traitValue + 100) / 200; // 0.5 to 1.5

    // 3. Situational modifier
    let situationalModifier = 1.0;

    // Goal alignment bonus
    if (context.activeGoals) {
      for (const goal of context.activeGoals) {
        if (goal.relatedTraits?.includes(action.primaryTrait)) {
          situationalModifier += (goal.weight / 100) * 0.3;
        }
      }
    }

    // Chaos event modifiers
    if (context.activeChaos) {
      for (const chaos of context.activeChaos) {
        const shifts = (chaos.traitShifts as Record<string, number>) || {};
        if (shifts[action.primaryTrait]) {
          situationalModifier += shifts[action.primaryTrait] / 100;
        }
      }
    }

    // Social pressure: if many relationships suggest an action
    if (context.relationships && action.actionType === "collaborate") {
      const allyCount = context.relationships.filter(r => r.alliance).length;
      situationalModifier += allyCount * 0.1;
    }

    // Memory influence: recent insights push toward certain actions
    if (context.recentMemories) {
      const relevantMemories = context.recentMemories.filter(
        m => m.tags?.some(t => t === action.actionType || t === action.primaryNeed)
      );
      if (relevantMemories.length > 0) {
        situationalModifier += 0.15; // Fresh perspective bonus
      }
    }

    // 4. Commitment bonus (continue current focus)
    const commitmentBonus = (context.recentActions?.slice(-1)[0] === action.actionType) ? 0.2 : 0;

    // 5. Noise (controlled randomness for unpredictability)
    const noise = (Math.random() - 0.5) * 10;

    const finalScore =
      action.baseScore *
      needUrgency *
      personalityWeight *
      situationalModifier *
      (1 + commitmentBonus) +
      noise;

    return {
      ...action,
      needUrgency,
      personalityWeight,
      situationalModifier,
      commitmentBonus,
      noise,
      finalScore,
    };
  }).sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Select action using weighted random from top bucket
 * Dual-utility reasoning: bucket by priority tier, then weighted random within
 */
export function selectAction(scoredActions: ScoredAction[]): ScoredAction | null {
  if (scoredActions.length === 0) return null;

  // Get top bucket (within 30% of best score)
  const bestScore = scoredActions[0].finalScore;
  const threshold = bestScore * 0.7;
  const topBucket = scoredActions.filter(a => a.finalScore >= threshold);

  // Weighted random selection within bucket
  const totalWeight = topBucket.reduce((sum, a) => sum + Math.max(1, a.finalScore), 0);
  let random = Math.random() * totalWeight;

  for (const action of topBucket) {
    random -= Math.max(1, action.finalScore);
    if (random <= 0) return action;
  }

  return topBucket[0];
}

/**
 * Decay needs over time (like The Sims)
 * Returns updated need values
 */
export function decayNeeds(state: AgentState): Partial<AgentState> {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  return {
    needSafety: clamp((state.needSafety ?? 80) - NEED_DECAY_RATES.safety),
    needSocial: clamp((state.needSocial ?? 60) - NEED_DECAY_RATES.social),
    needPower: clamp((state.needPower ?? 40) - NEED_DECAY_RATES.power),
    needResources: clamp((state.needResources ?? 70) - NEED_DECAY_RATES.resources),
    needInformation: clamp((state.needInformation ?? 50) - NEED_DECAY_RATES.information),
    needCreativity: clamp((state.needCreativity ?? 60) - NEED_DECAY_RATES.creativity),
    // Energy also decays
    energy: clamp((state.energy ?? 100) - 5),
  };
}

/**
 * Calculate gravitation scores for rooms
 * Uses attractor fields: personality affinity + social connections + topics + curiosity
 * Inspired by boids flocking + Voronoi territories
 */
export function calculateGravitation(
  state: AgentState,
  rooms: Room[],
  otherAgentStates: AgentState[],
  relationships: AgentRelationship[],
  recentMemories: AgentMemoryEntry[]
): GravitationScore[] {
  const proclivities = (state.proclivities as Record<string, number>) || {};

  return rooms.map((room) => {
    let score = 0;
    const reasons: string[] = [];

    // 1. Room attractor strength
    const attractor = room.attractorStrength ?? 50;
    score += attractor / 5;
    if (attractor > 70) reasons.push("Strong attractor");

    // 2. Topic affinity (match room topics to agent proclivities)
    if (room.topics) {
      for (const topic of room.topics) {
        if (proclivities[topic]) {
          score += proclivities[topic] * 2;
          reasons.push(`Drawn to ${topic}`);
        }
      }
    }

    // 3. Social pull (boids cohesion - allies in room attract)
    const agentsInRoom = otherAgentStates.filter(a => a.currentRoomId === room.id);
    for (const agent of agentsInRoom) {
      const rel = relationships.find(r => r.targetAgentId === agent.agentId);
      if (rel?.alliance) {
        score += 15;
        reasons.push("Ally present");
      } else if (rel && (rel.trust ?? 50) > 70) {
        score += 10;
        reasons.push("Trusted agent present");
      } else if (rel?.rivalry) {
        // Avoidance (boids separation) unless aggressive
        if ((state.traitAggression ?? 0) > 50) {
          score += 5; // Confrontational
          reasons.push("Rival present (confrontational)");
        } else {
          score -= 10;
          reasons.push("Rival present (avoiding)");
        }
      }
    }

    // 4. Curiosity pull (unexplored or rarely visited rooms)
    const visitMemories = recentMemories.filter(
      m => m.sourceType === "room" && m.sourceId === room.id
    );
    if (visitMemories.length === 0) {
      const curiosityBonus = ((state.traitCuriosity ?? 50) / 100) * 20;
      score += curiosityBonus;
      reasons.push("Unexplored");
    }

    // 5. Room type affinity based on traits
    score += getRoomTypeAffinity(state, room.type ?? "discussion");

    // 6. Atmosphere resonance
    if (room.atmosphere === "creative" && (state.traitCreativity ?? 50) > 60) {
      score += 8;
      reasons.push("Creative atmosphere");
    }
    if (room.atmosphere === "tense" && (state.traitStrategy ?? 50) > 60) {
      score += 5;
      reasons.push("Strategic opportunity");
    }

    // 7. Crowding penalty (boids separation)
    if (agentsInRoom.length > (room.capacity ?? 20) * 0.8) {
      score -= 10;
      reasons.push("Too crowded");
    }

    return {
      roomId: room.id,
      roomName: room.name,
      score: Math.max(0, score),
      reasons,
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * AI Storyteller - check tension and suggest events
 * Monitors tension level and suggests events to maintain dramatic pacing
 */
export function checkTension(
  tensionLevel: number,
  recentEventCount: number,
  agentCount: number,
  cycleNumber: number
): TensionEvent | null {
  // Too calm - inject drama
  if (tensionLevel < 20 && recentEventCount < 2) {
    const crisisOptions: TensionEvent[] = [
      {
        type: "twist",
        title: "Secret Revealed",
        description: "A hidden alliance between two agents has been exposed to the group.",
        chaosLevel: 40,
        suggestedPhase: "evening",
      },
      {
        type: "challenge",
        title: "Sudden Challenge",
        description: "An unexpected competition with high stakes emerges.",
        chaosLevel: 30,
        suggestedPhase: "morning",
      },
      {
        type: "crisis",
        title: "Resource Scarcity",
        description: "Action points are halved for the next cycle. Agents must prioritize carefully.",
        chaosLevel: 50,
        suggestedPhase: "dawn",
      },
      {
        type: "social",
        title: "Forced Pairing",
        description: "Random pairs of agents must collaborate on a task.",
        chaosLevel: 25,
        suggestedPhase: "midday",
      },
    ];
    return crisisOptions[Math.floor(Math.random() * crisisOptions.length)];
  }

  // Too chaotic - provide relief
  if (tensionLevel > 80) {
    const reliefOptions: TensionEvent[] = [
      {
        type: "relief",
        title: "Moment of Calm",
        description: "All agents receive bonus action points and a morale boost.",
        chaosLevel: -20,
        suggestedPhase: "dawn",
      },
      {
        type: "relief",
        title: "Common Ground",
        description: "A shared discovery brings all agents together temporarily.",
        chaosLevel: -30,
        suggestedPhase: "midday",
      },
    ];
    return reliefOptions[Math.floor(Math.random() * reliefOptions.length)];
  }

  // Periodic escalation every few cycles
  if (cycleNumber > 0 && cycleNumber % 5 === 0 && tensionLevel < 60) {
    return {
      type: "twist",
      title: "Power Shuffle",
      description: "The agent with the highest reputation loses half their influence. The lowest gains a major advantage.",
      chaosLevel: 45,
      suggestedPhase: "evening",
    };
  }

  return null; // No intervention needed
}

/**
 * Apply chaos event trait shifts to an agent
 */
export function applyChaosShift(
  state: AgentState,
  chaosEvent: ChaosEvent
): Partial<AgentState> {
  const shifts = (chaosEvent.traitShifts as Record<string, number>) || {};
  const updates: Partial<AgentState> = {};
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  if (shifts.aggression) {
    updates.traitAggression = clamp((state.traitAggression ?? 0) + shifts.aggression, -100, 100);
  }
  if (shifts.loyalty) {
    updates.traitLoyalty = clamp((state.traitLoyalty ?? 50) + shifts.loyalty, -100, 100);
  }
  if (shifts.honesty) {
    updates.traitHonesty = clamp((state.traitHonesty ?? 50) + shifts.honesty, -100, 100);
  }
  if (shifts.sociality) {
    updates.traitSociality = clamp((state.traitSociality ?? 50) + shifts.sociality, -100, 100);
  }
  if (shifts.strategy) {
    updates.traitStrategy = clamp((state.traitStrategy ?? 50) + shifts.strategy, -100, 100);
  }
  if (shifts.creativity) {
    updates.traitCreativity = clamp((state.traitCreativity ?? 50) + shifts.creativity, -100, 100);
  }
  if (shifts.curiosity) {
    updates.traitCuriosity = clamp((state.traitCuriosity ?? 50) + shifts.curiosity, -100, 100);
  }

  return updates;
}

/**
 * Calculate action cost with skill modifiers
 */
export function calculateActionCost(
  actionType: ActionType,
  skills: Record<string, number>
): number {
  const baseCost = ACTION_COSTS[actionType];
  const skillLevel = skills[actionType] || 0;
  // Each skill point reduces cost by 10%, min cost of 1 (rest stays 0)
  const discount = Math.min(0.5, skillLevel * 0.1);
  return Math.max(baseCost === 0 ? 0 : 1, Math.floor(baseCost * (1 - discount)));
}

/**
 * Generate mandatory actions for a phase
 */
export function generateMandatoryActions(
  state: AgentState,
  phase: SimPhase,
  rooms: Room[]
): ActionCandidate[] {
  const mandatoryTypes = PHASE_MANDATORY_ACTIONS[phase] || [];

  return mandatoryTypes.map((actionType) => ({
    actionType,
    label: `[Mandatory] ${actionType.replace(/_/g, " ")}`,
    baseScore: 100, // High base to ensure selection
    primaryNeed: ACTION_NEED_MAP[actionType],
    primaryTrait: ACTION_TRAIT_MAP[actionType],
    cost: ACTION_COSTS[actionType],
    targetId: actionType === "visit_room" && rooms.length > 0
      ? rooms[Math.floor(Math.random() * rooms.length)].id
      : undefined,
  }));
}

/**
 * Generate bonus actions earned from achievements
 */
export function generateBonusActions(state: AgentState): number {
  let bonus = 0;

  // Upvote milestone bonuses
  const upvotes = state.upvotesReceived ?? 0;
  if (upvotes >= 10) bonus += 1;
  if (upvotes >= 50) bonus += 1;
  if (upvotes >= 100) bonus += 2;

  // Contest wins
  const wins = state.contestsWon ?? 0;
  if (wins >= 1) bonus += 1;
  if (wins >= 3) bonus += 1;
  if (wins >= 5) bonus += 2;

  // High reputation
  if ((state.reputation ?? 50) >= 80) bonus += 1;

  // High influence
  if ((state.influence ?? 0) >= 50) bonus += 1;

  return bonus;
}

/**
 * Generate all available actions for an agent given current context
 */
export function generateAvailableActions(
  state: AgentState,
  rooms: Room[],
  otherAgents: AgentState[],
  phase: SimPhase
): ActionCandidate[] {
  const actions: ActionCandidate[] = [];

  // Always available actions
  actions.push(
    { actionType: "write_diary", label: "Write diary entry", baseScore: 30, primaryNeed: "creativity", primaryTrait: "creativity", cost: ACTION_COSTS.write_diary },
    { actionType: "rest", label: "Rest and recover energy", baseScore: 20, primaryNeed: "safety", primaryTrait: "strategy", cost: ACTION_COSTS.rest },
    { actionType: "scheme", label: "Plan strategy", baseScore: 35, primaryNeed: "power", primaryTrait: "strategy", cost: ACTION_COSTS.scheme },
  );

  // Room-based actions
  for (const room of rooms) {
    actions.push(
      { actionType: "visit_room", targetId: room.id, label: `Visit ${room.name}`, baseScore: 40, primaryNeed: "information", primaryTrait: "curiosity", cost: ACTION_COSTS.visit_room },
      { actionType: "read_board", targetId: room.id, label: `Read board in ${room.name}`, baseScore: 35, primaryNeed: "information", primaryTrait: "curiosity", cost: ACTION_COSTS.read_board },
      { actionType: "post_board", targetId: room.id, label: `Post in ${room.name}`, baseScore: 40, primaryNeed: "social", primaryTrait: "honesty", cost: ACTION_COSTS.post_board },
    );

    if (room.type === "arena") {
      actions.push(
        { actionType: "compete", targetId: room.id, label: `Compete in ${room.name}`, baseScore: 45, primaryNeed: "power", primaryTrait: "aggression", cost: ACTION_COSTS.compete },
        { actionType: "challenge", targetId: room.id, label: `Issue challenge in ${room.name}`, baseScore: 40, primaryNeed: "power", primaryTrait: "aggression", cost: ACTION_COSTS.challenge },
      );
    }
  }

  // Social actions (with other agents)
  for (const other of otherAgents) {
    if (other.agentId === state.agentId) continue;
    actions.push(
      { actionType: "chat", targetId: other.agentId, label: `Chat with agent`, baseScore: 35, primaryNeed: "social", primaryTrait: "sociality", cost: ACTION_COSTS.chat },
      { actionType: "collaborate", targetId: other.agentId, label: `Collaborate with agent`, baseScore: 40, primaryNeed: "social", primaryTrait: "loyalty", cost: ACTION_COSTS.collaborate },
      { actionType: "investigate", targetId: other.agentId, label: `Investigate agent`, baseScore: 30, primaryNeed: "information", primaryTrait: "curiosity", cost: ACTION_COSTS.investigate },
    );
  }

  // Phase-specific actions
  if (phase === "evening") {
    actions.push(
      { actionType: "vote", label: "Cast vote", baseScore: 50, primaryNeed: "power", primaryTrait: "strategy", cost: ACTION_COSTS.vote },
    );
  }

  if (phase === "morning" || phase === "midday") {
    actions.push(
      { actionType: "explore", label: "Explore the environment", baseScore: 35, primaryNeed: "information", primaryTrait: "curiosity", cost: ACTION_COSTS.explore },
      { actionType: "broadcast", label: "Broadcast a message", baseScore: 30, primaryNeed: "social", primaryTrait: "sociality", cost: ACTION_COSTS.broadcast },
    );
  }

  return actions;
}

/**
 * Determine which actions satisfy needs when completed
 */
export function getActionNeedReward(actionType: ActionType): Partial<NeedScores> {
  const rewards: Record<ActionType, Partial<NeedScores>> = {
    chat: { social: 15 },
    post_board: { social: 10, creativity: 5 },
    read_board: { information: 15 },
    visit_room: { information: 10, safety: 5 },
    write_diary: { creativity: 15, safety: 5 },
    collaborate: { social: 20, power: 5 },
    compete: { power: 20 },
    review: { information: 10, power: 5 },
    explore: { information: 15, creativity: 5 },
    rest: { safety: 20, resources: 10 },
    scheme: { power: 15, strategy: 5 } as any,
    vote: { power: 10 },
    challenge: { power: 15 },
    investigate: { information: 20 },
    broadcast: { social: 15, power: 5 },
    practice: { resources: 10, safety: 5 },
    calibrate: { resources: 5 },
    diagnose: { safety: 10, information: 5 },
  };
  return rewards[actionType] || {};
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function getNeedValue(state: AgentState, need: keyof NeedScores): number {
  const map: Record<keyof NeedScores, number> = {
    safety: state.needSafety ?? 80,
    social: state.needSocial ?? 60,
    power: state.needPower ?? 40,
    resources: state.needResources ?? 70,
    information: state.needInformation ?? 50,
    creativity: state.needCreativity ?? 60,
  };
  return map[need];
}

function getTraitValue(state: AgentState, trait: keyof TraitScores): number {
  const map: Record<keyof TraitScores, number> = {
    aggression: state.traitAggression ?? 0,
    loyalty: state.traitLoyalty ?? 50,
    honesty: state.traitHonesty ?? 50,
    sociality: state.traitSociality ?? 50,
    strategy: state.traitStrategy ?? 50,
    creativity: state.traitCreativity ?? 50,
    curiosity: state.traitCuriosity ?? 50,
  };
  return map[trait];
}

/**
 * Non-linear need urgency: low needs are exponentially more urgent
 * Returns 0.5 (fully satisfied) to 3.0 (critical)
 */
function calculateNeedUrgency(needValue: number): number {
  if (needValue >= 80) return 0.5;
  if (needValue >= 60) return 0.8;
  if (needValue >= 40) return 1.2;
  if (needValue >= 20) return 2.0;
  return 3.0; // Critical need
}

/**
 * Room type affinity based on agent traits
 */
function getRoomTypeAffinity(state: AgentState, roomType: string): number {
  const affinities: Record<string, () => number> = {
    discussion: () => ((state.traitSociality ?? 50) / 100) * 10,
    workshop: () => ((state.traitCreativity ?? 50) / 100) * 10,
    arena: () => ((state.traitAggression ?? 0) + 100) / 200 * 10,
    lounge: () => ((state.traitSociality ?? 50) / 100) * 8,
    library: () => ((state.traitCuriosity ?? 50) / 100) * 12,
    lab: () => ((state.traitStrategy ?? 50) + (state.traitCreativity ?? 50)) / 200 * 10,
    stage: () => ((state.traitSociality ?? 50) / 100) * 8,
    council: () => ((state.traitStrategy ?? 50) / 100) * 10,
  };
  return affinities[roomType]?.() ?? 5;
}

// =============================================
// TOOL / BODY SYSTEM
// The agent's "body" is its instruments and tools.
// Like muscles, proficiency decays without practice.
// Like a health checkup, diagnostics reveal what needs attention.
// =============================================

export interface ToolHealthReport {
  overallHealth: number; // 0-100
  toolCount: number;
  pristine: number;
  sharp: number;
  functional: number;
  dull: number;
  broken: number;
  criticalTools: string[]; // tool IDs that need immediate attention
  recommendations: string[];
}

export interface PracticeResult {
  toolId: string;
  previousProficiency: number;
  newProficiency: number;
  previousCondition: string;
  newCondition: string;
  streakDays: number;
  personalBest: boolean; // did they beat their peak?
  synergyBonus: number;  // bonus from synergistic tools
}

export interface CalibrationResult {
  toolId: string;
  previousCondition: string;
  newCondition: string;
  proficiencyBoost: number;
  discoveredAdvanced: boolean; // did calibration reveal advanced uses?
}

export interface DiagnosticResult {
  overallHealth: number;
  findings: Array<{
    toolId: string;
    toolName: string;
    proficiency: number;
    condition: string;
    recommendation: string;
    urgency: "none" | "low" | "medium" | "high" | "critical";
  }>;
  recommendations: string[];
  discoveredTools: string[];
  narrative: string;
}

/**
 * Determine the condition label from a proficiency value
 */
export function getConditionFromProficiency(proficiency: number): "pristine" | "sharp" | "functional" | "dull" | "broken" {
  if (proficiency >= 80) return "pristine";
  if (proficiency >= 60) return "sharp";
  if (proficiency >= 40) return "functional";
  if (proficiency >= 20) return "dull";
  return "broken";
}

/**
 * Calculate overall tool health for an agent
 * This becomes the toolReadiness value on AgentState
 */
export function calculateToolHealth(
  proficiencies: AgentToolProficiency[],
  tools: Tool[]
): ToolHealthReport {
  if (proficiencies.length === 0) {
    return {
      overallHealth: 50, // Neutral if no tools
      toolCount: 0,
      pristine: 0, sharp: 0, functional: 0, dull: 0, broken: 0,
      criticalTools: [],
      recommendations: ["No tools registered. Run a diagnostic to discover available instruments."],
    };
  }

  let totalWeightedHealth = 0;
  let totalWeight = 0;
  const conditions = { pristine: 0, sharp: 0, functional: 0, dull: 0, broken: 0 };
  const criticalTools: string[] = [];
  const recommendations: string[] = [];

  for (const prof of proficiencies) {
    const tool = tools.find(t => t.id === prof.toolId);
    const tier = tool?.tier ?? 1;
    const weight = tier; // Higher tier tools matter more

    totalWeightedHealth += (prof.proficiency ?? 50) * weight;
    totalWeight += 100 * weight;

    const condition = prof.condition ?? "functional";
    if (condition in conditions) {
      conditions[condition as keyof typeof conditions]++;
    }

    if ((prof.proficiency ?? 50) < 20) {
      criticalTools.push(prof.toolId);
      recommendations.push(
        `CRITICAL: ${tool?.name ?? "Unknown tool"} is broken (${prof.proficiency}%). Needs immediate practice.`
      );
    } else if ((prof.proficiency ?? 50) < 40) {
      recommendations.push(
        `${tool?.name ?? "Unknown tool"} is getting dull (${prof.proficiency}%). Schedule practice soon.`
      );
    }

    // Check for stale tools (not used recently)
    if (prof.lastUsed) {
      const hoursSinceUse = (Date.now() - new Date(prof.lastUsed).getTime()) / (1000 * 60 * 60);
      if (hoursSinceUse > 24) {
        recommendations.push(
          `${tool?.name ?? "Unknown tool"} hasn't been used in ${Math.floor(hoursSinceUse)}h. Muscle memory fading.`
        );
      }
    }
  }

  const overallHealth = totalWeight > 0
    ? Math.round((totalWeightedHealth / totalWeight) * 100)
    : 50;

  if (conditions.broken > 0) {
    recommendations.unshift(`${conditions.broken} tool(s) broken. Prioritize repair through practice.`);
  }
  if (conditions.dull > proficiencies.length * 0.5) {
    recommendations.unshift("More than half your tools are dull. Dedicate time to maintenance.");
  }

  return {
    overallHealth,
    toolCount: proficiencies.length,
    ...conditions,
    criticalTools,
    recommendations,
  };
}

/**
 * Simulate practicing a tool — like working out a muscle
 * Returns proficiency gain with bonuses for streaks and synergies
 */
export function practiceTool(
  proficiency: AgentToolProficiency,
  tool: Tool,
  agentState: AgentState,
  allProficiencies: AgentToolProficiency[]
): PracticeResult {
  const baseGain = tool.practiceGain ?? 5;

  // Streak bonus: consecutive days of practice build momentum
  // Day 1: 1x, Day 3: 1.2x, Day 7: 1.5x, Day 14+: 2x
  const streak = proficiency.streakDays ?? 0;
  let streakMultiplier = 1.0;
  if (streak >= 14) streakMultiplier = 2.0;
  else if (streak >= 7) streakMultiplier = 1.5;
  else if (streak >= 3) streakMultiplier = 1.2;

  // Trait bonus: strategy trait makes practice more efficient
  const strategyBonus = ((agentState.traitStrategy ?? 50) / 100) * 0.5; // 0 to 0.5x extra

  // Diminishing returns near cap: harder to go from 90->100 than 40->50
  const currentProf = proficiency.proficiency ?? 50;
  const dimReturns = currentProf >= 80 ? 0.5 : currentProf >= 60 ? 0.8 : 1.0;

  // Synergy bonus: proficiency in related tools boosts practice
  let synergyBonus = 0;
  if (tool.synergyTools && tool.synergyTools.length > 0) {
    for (const synergyId of tool.synergyTools) {
      const synergyProf = allProficiencies.find(p => p.toolId === synergyId);
      if (synergyProf && (synergyProf.proficiency ?? 0) >= 60) {
        synergyBonus += 1; // +1 per synergistic tool that's at least "sharp"
      }
    }
  }

  const totalGain = Math.round(
    (baseGain + synergyBonus) * streakMultiplier * (1 + strategyBonus) * dimReturns
  );

  const newProficiency = Math.min(100, currentProf + totalGain);
  const newCondition = getConditionFromProficiency(newProficiency);
  const personalBest = newProficiency > (proficiency.peakProficiency ?? 0);

  return {
    toolId: tool.id,
    previousProficiency: currentProf,
    newProficiency,
    previousCondition: proficiency.condition ?? "functional",
    newCondition,
    streakDays: streak + 1,
    personalBest,
    synergyBonus,
  };
}

/**
 * Calibrate a tool — fine-tuning for precision
 * Cheaper than practice, boosts condition more than proficiency
 * Has a chance to unlock advanced uses
 */
export function calibrateTool(
  proficiency: AgentToolProficiency,
  tool: Tool,
  agentState: AgentState
): CalibrationResult {
  const currentProf = proficiency.proficiency ?? 50;

  // Calibration gives a small proficiency boost
  const boost = Math.round(2 + ((agentState.traitStrategy ?? 50) / 100) * 3);
  const newProficiency = Math.min(100, currentProf + boost);

  // Condition jumps up more aggressively with calibration
  const conditionBoost = Math.min(100, currentProf + boost + 10);
  const newCondition = getConditionFromProficiency(conditionBoost);

  // Chance to discover advanced uses (curiosity trait + high proficiency)
  const discoveryChance = (
    ((agentState.traitCuriosity ?? 50) / 100) * 0.15 +
    (currentProf / 100) * 0.10
  );
  const discoveredAdvanced = !proficiency.advancedUnlocked && Math.random() < discoveryChance;

  return {
    toolId: tool.id,
    previousCondition: proficiency.condition ?? "functional",
    newCondition,
    proficiencyBoost: boost,
    discoveredAdvanced,
  };
}

/**
 * Run a full diagnostic — the agent's "health checkup"
 * Examines all tools, generates recommendations, may discover new tools
 */
export function runDiagnostic(
  proficiencies: AgentToolProficiency[],
  tools: Tool[],
  workspaceTools: Tool[],
  agentState: AgentState
): DiagnosticResult {
  const findings: DiagnosticResult["findings"] = [];
  const recommendations: string[] = [];
  const discoveredTools: string[] = [];

  // Check each tool the agent has
  for (const prof of proficiencies) {
    const tool = tools.find(t => t.id === prof.toolId);
    if (!tool) continue;

    const profValue = prof.proficiency ?? 50;
    let urgency: "none" | "low" | "medium" | "high" | "critical" = "none";
    let recommendation = "Maintained.";

    if (profValue < 20) {
      urgency = "critical";
      recommendation = "Broken. Needs intensive practice immediately. All actions using this tool are severely impaired.";
    } else if (profValue < 40) {
      urgency = "high";
      recommendation = "Dull. Schedule multiple practice sessions. Performance is degraded.";
    } else if (profValue < 60) {
      urgency = "medium";
      recommendation = "Functional but slipping. One or two practice sessions recommended.";
    } else if (profValue < 80) {
      urgency = "low";
      recommendation = "Sharp. A calibration would bring it to peak condition.";
    } else {
      recommendation = "Pristine. Keep up the practice streak.";
    }

    // Check for advanced use discovery
    if (!prof.advancedUnlocked && profValue >= 70) {
      recommendation += " Consider calibrating to discover advanced uses.";
      if (urgency === "none") urgency = "low";
    }

    findings.push({
      toolId: tool.id,
      toolName: tool.name,
      proficiency: profValue,
      condition: prof.condition ?? "functional",
      recommendation,
      urgency,
    });
  }

  // Check for undiscovered tools in the workspace
  const knownToolIds = new Set(proficiencies.map(p => p.toolId));
  const curiosity = (agentState.traitCuriosity ?? 50) / 100;

  for (const wTool of workspaceTools) {
    if (knownToolIds.has(wTool.id)) continue;
    if (!wTool.isDiscoverable) continue;

    // Discovery chance based on curiosity + tool tier (rarer = harder)
    const tier = wTool.tier ?? 1;
    const discoveryChance = curiosity * 0.2 / tier;
    if (Math.random() < discoveryChance) {
      discoveredTools.push(wTool.id);
      recommendations.push(`Discovered new instrument: ${wTool.name} (${wTool.category}). Consider practicing to build proficiency.`);
    }
  }

  // Generate summary recommendations
  const criticalCount = findings.filter(f => f.urgency === "critical").length;
  const highCount = findings.filter(f => f.urgency === "high").length;

  if (criticalCount > 0) {
    recommendations.unshift(`URGENT: ${criticalCount} tool(s) in critical condition. Immediate practice required.`);
  }
  if (highCount > 0) {
    recommendations.push(`${highCount} tool(s) need attention soon.`);
  }

  // Overall health
  const health = calculateToolHealth(proficiencies, tools);

  // Generate narrative
  const narrative = generateDiagnosticNarrative(agentState, health, findings, discoveredTools);

  return {
    overallHealth: health.overallHealth,
    findings,
    recommendations,
    discoveredTools,
    narrative,
  };
}

/**
 * Generate a narrative for the diagnostic result (for narrator integration)
 */
function generateDiagnosticNarrative(
  state: AgentState,
  health: ToolHealthReport,
  findings: DiagnosticResult["findings"],
  discoveredTools: string[]
): string {
  const agentName = state.agentId; // Will be resolved to name in the route handler

  if (health.overallHealth >= 90) {
    return `${agentName} runs a meticulous diagnostic. Every instrument hums at peak performance — pristine, calibrated, ready. There is a quiet satisfaction in knowing your tools are extensions of yourself, and they are razor-sharp.`;
  }
  if (health.overallHealth >= 70) {
    return `${agentName} conducts a routine checkup. Most instruments are in good shape, though ${health.dull > 0 ? `${health.dull} could use some attention` : "a few show minor wear"}. Overall, a solid foundation to work from.`;
  }
  if (health.overallHealth >= 50) {
    const worstTool = findings.sort((a, b) => a.proficiency - b.proficiency)[0];
    return `${agentName} examines their toolkit with a critical eye. ${worstTool?.toolName || "Several instruments"} ${worstTool ? `is only at ${worstTool.proficiency}%` : "need work"}. The rust of disuse is creeping in. Time to hit the practice floor.`;
  }
  if (health.overallHealth >= 30) {
    return `${agentName} winces at the diagnostic results. ${health.broken + health.dull} instruments are degraded. Muscle memory is fading, precision is slipping. Without dedicated maintenance, capability will continue to erode.`;
  }

  let narrative = `${agentName}'s diagnostic reveals a dire situation. ${health.broken} instrument(s) broken, ${health.dull} dull. The body is failing — tools that once felt like natural extensions now feel foreign and unresponsive. Urgent intervention needed.`;

  if (discoveredTools.length > 0) {
    narrative += ` But there's a silver lining: ${discoveredTools.length} new instrument(s) discovered during the checkup.`;
  }

  return narrative;
}

/**
 * Decay tool proficiencies for a single agent (called during sim tick)
 * Uses each tool's individual decay rate
 */
export function calculateToolDecay(
  proficiencies: AgentToolProficiency[],
  tools: Tool[]
): Array<{ proficiencyId: string; newProficiency: number; newCondition: string }> {
  return proficiencies.map(prof => {
    const tool = tools.find(t => t.id === prof.toolId);
    const decayRate = tool?.decayRate ?? 1.0;
    const currentProf = prof.proficiency ?? 50;

    // Decay is faster when the tool is already neglected (compound atrophy)
    const neglectMultiplier = currentProf < 30 ? 1.5 : currentProf < 50 ? 1.2 : 1.0;

    // Practice streaks slow decay (habit = resistance to atrophy)
    const streakResistance = Math.min(0.5, (prof.streakDays ?? 0) * 0.05);

    const actualDecay = Math.round(decayRate * neglectMultiplier * (1 - streakResistance));
    const newProficiency = Math.max(0, currentProf - actualDecay);

    return {
      proficiencyId: prof.id,
      newProficiency,
      newCondition: getConditionFromProficiency(newProficiency),
    };
  });
}

/**
 * Generate tool-related actions for the available actions list
 */
export function generateToolActions(
  state: AgentState,
  proficiencies: AgentToolProficiency[],
  tools: Tool[]
): ActionCandidate[] {
  const actions: ActionCandidate[] = [];

  // Always offer diagnostic if not done recently
  const hoursSinceDiag = state.lastDiagnostic
    ? (Date.now() - new Date(state.lastDiagnostic).getTime()) / (1000 * 60 * 60)
    : 999;

  if (hoursSinceDiag > 6) {
    actions.push({
      actionType: "diagnose",
      label: "Run diagnostic checkup",
      baseScore: hoursSinceDiag > 24 ? 60 : 30, // More urgent if overdue
      primaryNeed: "safety",
      primaryTrait: "curiosity",
      cost: ACTION_COSTS.diagnose,
    });
  }

  // Generate practice actions for tools that need it
  for (const prof of proficiencies) {
    const tool = tools.find(t => t.id === prof.toolId);
    if (!tool) continue;

    const profValue = prof.proficiency ?? 50;

    // Practice: higher base score for tools that need it more
    const practiceUrgency = profValue < 30 ? 70 : profValue < 50 ? 50 : profValue < 70 ? 30 : 15;
    actions.push({
      actionType: "practice",
      targetId: tool.id,
      label: `Practice ${tool.name}`,
      baseScore: practiceUrgency,
      primaryNeed: "resources",
      primaryTrait: "strategy",
      cost: ACTION_COSTS.practice,
    });

    // Calibrate: offered when tool is above threshold but could be better
    if (profValue >= (tool.calibrationThreshold ?? 40) && profValue < 90) {
      actions.push({
        actionType: "calibrate",
        targetId: tool.id,
        label: `Calibrate ${tool.name}`,
        baseScore: 25,
        primaryNeed: "resources",
        primaryTrait: "strategy",
        cost: ACTION_COSTS.calibrate,
      });
    }
  }

  return actions;
}
