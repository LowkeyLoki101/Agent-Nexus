/**
 * The Nexus Protocol - Game Engine
 *
 * Handles the core mechanics of the gamified task system:
 * - Spark economy (earning, spending, multipliers)
 * - Path system (Scholar, Diplomat, Generalist)
 * - Stagnation detection (diminishing returns for Generalist)
 * - Focus momentum (increasing returns for specialists)
 * - Forge access gating (spend Spark to enter development room)
 */

import type { GameProfile, GameCycle, GameTask, GameTaskCompletion } from "@shared/schema";

// --- Constants ---

export const FORGE_COSTS = {
  basic: 100,     // 1 build allowed
  extended: 250,  // 3 builds allowed
  master: 500,    // unlimited builds
} as const;

export const FORGE_BUILD_LIMITS = {
  basic: 1,
  extended: 3,
  master: 999,
} as const;

export const PATH_MULTIPLIERS = {
  scholar: { archive: 2.0, agora: 0.5 },
  diplomat: { archive: 0.5, agora: 2.0 },
  generalist: { archive: 1.0, agora: 1.0 },
} as const;

// Momentum: consecutive cycles on the same path
const MOMENTUM_INCREMENT = 0.1;
const MOMENTUM_CAP = 0.5;

// Stagnation thresholds for Generalist path
const STAGNATION_TIER_1_THRESHOLD = 3;  // tasks per room before diminishing
const STAGNATION_TIER_2_THRESHOLD = 6;  // tasks per room before heavy penalty
const STAGNATION_TOTAL_THRESHOLD = 8;   // total tasks before cross-room penalty
const STAGNATION_TOTAL_HEAVY = 12;      // total tasks before severe cross-room penalty

const STAGNATION_TIER_1_MULTIPLIER = 0.7;
const STAGNATION_TIER_2_MULTIPLIER = 0.4;
const STAGNATION_TOTAL_MULTIPLIER = 0.8;
const STAGNATION_TOTAL_HEAVY_MULTIPLIER = 0.5;

// Path switch penalty
const PATH_SWITCH_PENALTY_PERCENT = 0.2;

// --- Spark Calculation ---

export interface SparkCalculation {
  baseReward: number;
  pathMultiplier: number;
  momentumBonus: number;
  stagnationPenalty: number;
  finalReward: number;
  wasStagnated: boolean;
}

export function calculateSparkReward(
  task: GameTask,
  profile: GameProfile,
  cycleStats: {
    archiveTasksCompleted: number;
    agoraTasksCompleted: number;
    totalTasksCompleted: number;
  }
): SparkCalculation {
  const base = task.baseSparkReward;
  const path = profile.currentPath || "generalist";

  // 1. Path multiplier based on task room
  let pathMult = 1.0;
  if (task.room === "archive") {
    pathMult = PATH_MULTIPLIERS[path].archive;
  } else if (task.room === "agora") {
    pathMult = PATH_MULTIPLIERS[path].agora;
  }

  // 2. Momentum bonus for specialists
  let momentumBonus = 0;
  if (path !== "generalist") {
    momentumBonus = Math.min(profile.pathMomentum * MOMENTUM_INCREMENT, MOMENTUM_CAP);
  }

  // 3. Stagnation penalty for generalists
  let stagnationPenalty = 0;
  let wasStagnated = false;

  if (path === "generalist") {
    const roomCount = task.room === "archive"
      ? cycleStats.archiveTasksCompleted
      : cycleStats.agoraTasksCompleted;

    // Per-room stagnation
    if (roomCount >= STAGNATION_TIER_2_THRESHOLD) {
      stagnationPenalty = 1 - STAGNATION_TIER_2_MULTIPLIER;
      wasStagnated = true;
    } else if (roomCount >= STAGNATION_TIER_1_THRESHOLD) {
      stagnationPenalty = 1 - STAGNATION_TIER_1_MULTIPLIER;
      wasStagnated = true;
    }

    // Cross-room total stagnation (compounds with per-room)
    if (cycleStats.totalTasksCompleted >= STAGNATION_TOTAL_HEAVY) {
      const totalPenalty = 1 - STAGNATION_TOTAL_HEAVY_MULTIPLIER;
      stagnationPenalty = Math.min(stagnationPenalty + totalPenalty, 0.8);
      wasStagnated = true;
    } else if (cycleStats.totalTasksCompleted >= STAGNATION_TOTAL_THRESHOLD) {
      const totalPenalty = 1 - STAGNATION_TOTAL_MULTIPLIER;
      stagnationPenalty = Math.min(stagnationPenalty + totalPenalty, 0.8);
      wasStagnated = true;
    }
  }

  // 4. Calculate final reward
  const afterPath = base * pathMult;
  const afterMomentum = afterPath * (1 + momentumBonus);
  const finalReward = Math.max(1, Math.round(afterMomentum * (1 - stagnationPenalty)));

  return {
    baseReward: base,
    pathMultiplier: pathMult,
    momentumBonus,
    stagnationPenalty,
    finalReward,
    wasStagnated,
  };
}

// --- Path Switching ---

export interface PathSwitchResult {
  sparkPenalty: number;
  newBalance: number;
  momentumReset: boolean;
  versatilityGained: number;
}

export function calculatePathSwitch(
  profile: GameProfile,
  newPath: "scholar" | "diplomat" | "generalist"
): PathSwitchResult {
  const isSamePath = profile.currentPath === newPath;

  if (isSamePath) {
    return {
      sparkPenalty: 0,
      newBalance: profile.sparkBalance,
      momentumReset: false,
      versatilityGained: 0,
    };
  }

  // First path selection (no current path) has no penalty
  if (!profile.currentPath) {
    return {
      sparkPenalty: 0,
      newBalance: profile.sparkBalance,
      momentumReset: false,
      versatilityGained: 0,
    };
  }

  const penalty = Math.floor(profile.sparkBalance * PATH_SWITCH_PENALTY_PERCENT);
  const versatility = Math.max(1, profile.pathMomentum); // gain versatility for what you built

  return {
    sparkPenalty: penalty,
    newBalance: profile.sparkBalance - penalty,
    momentumReset: true,
    versatilityGained: versatility,
  };
}

// --- Forge Access ---

export interface ForgeAccessResult {
  canAccess: boolean;
  cost: number;
  buildsAllowed: number;
  shortfall: number;
  tier: "basic" | "extended" | "master";
}

export function calculateForgeAccess(
  profile: GameProfile,
  tier: "basic" | "extended" | "master"
): ForgeAccessResult {
  const path = profile.currentPath || "generalist";
  let cost: number = FORGE_COSTS[tier];

  // Generalists pay 1.5x for Forge access
  if (path === "generalist") {
    cost = Math.ceil(cost * 1.5);
  }

  const canAccess = profile.sparkBalance >= cost;
  const shortfall = canAccess ? 0 : cost - profile.sparkBalance;

  return {
    canAccess,
    cost,
    buildsAllowed: FORGE_BUILD_LIMITS[tier],
    shortfall,
    tier,
  };
}

// --- Stagnation Analysis ---

export interface StagnationReport {
  overallLevel: number;       // 0-1, how stagnated the user is
  archiveEfficiency: number;  // 0-1, current efficiency in Archive
  agoraEfficiency: number;    // 0-1, current efficiency in Agora
  recommendation: string;     // advice for the user
  isStagnated: boolean;
}

export function analyzeStagnation(
  profile: GameProfile,
  currentCycle: {
    archiveTasksCompleted: number;
    agoraTasksCompleted: number;
    totalTasksCompleted: number;
  } | null
): StagnationReport {
  if (!currentCycle || !profile.currentPath) {
    return {
      overallLevel: 0,
      archiveEfficiency: 1,
      agoraEfficiency: 1,
      recommendation: "Choose a path to begin your journey.",
      isStagnated: false,
    };
  }

  const path = profile.currentPath;

  if (path !== "generalist") {
    // Specialists don't stagnate - they build momentum
    const momentum = Math.min(profile.pathMomentum * MOMENTUM_INCREMENT, MOMENTUM_CAP);
    return {
      overallLevel: 0,
      archiveEfficiency: path === "scholar" ? 1 + momentum : 0.5,
      agoraEfficiency: path === "diplomat" ? 1 + momentum : 0.5,
      recommendation: `Your ${path} focus is building momentum (+${Math.round(momentum * 100)}%). Stay the course for greater rewards.`,
      isStagnated: false,
    };
  }

  // Generalist stagnation analysis
  let archiveEff = 1.0;
  let agoraEff = 1.0;

  if (currentCycle.archiveTasksCompleted >= STAGNATION_TIER_2_THRESHOLD) {
    archiveEff = STAGNATION_TIER_2_MULTIPLIER;
  } else if (currentCycle.archiveTasksCompleted >= STAGNATION_TIER_1_THRESHOLD) {
    archiveEff = STAGNATION_TIER_1_MULTIPLIER;
  }

  if (currentCycle.agoraTasksCompleted >= STAGNATION_TIER_2_THRESHOLD) {
    agoraEff = STAGNATION_TIER_2_MULTIPLIER;
  } else if (currentCycle.agoraTasksCompleted >= STAGNATION_TIER_1_THRESHOLD) {
    agoraEff = STAGNATION_TIER_1_MULTIPLIER;
  }

  // Cross-room penalty
  if (currentCycle.totalTasksCompleted >= STAGNATION_TOTAL_HEAVY) {
    archiveEff *= STAGNATION_TOTAL_HEAVY_MULTIPLIER;
    agoraEff *= STAGNATION_TOTAL_HEAVY_MULTIPLIER;
  } else if (currentCycle.totalTasksCompleted >= STAGNATION_TOTAL_THRESHOLD) {
    archiveEff *= STAGNATION_TOTAL_MULTIPLIER;
    agoraEff *= STAGNATION_TOTAL_MULTIPLIER;
  }

  const overallLevel = 1 - (archiveEff + agoraEff) / 2;
  const isStagnated = overallLevel > 0.2;

  let recommendation: string;
  if (overallLevel > 0.6) {
    recommendation = "Severe stagnation detected. You're spreading too thin across all tasks. Consider specializing as a Scholar or Diplomat to regain efficiency.";
  } else if (overallLevel > 0.3) {
    recommendation = "Diminishing returns are setting in. Your energy is being diluted across too many task types this cycle.";
  } else if (isStagnated) {
    recommendation = "Mild efficiency loss detected. You can continue as a Generalist, but a focused path would yield more Spark.";
  } else {
    recommendation = "You're operating efficiently as a Generalist. Be mindful of spreading too thin as you take on more tasks.";
  }

  return {
    overallLevel,
    archiveEfficiency: archiveEff,
    agoraEfficiency: agoraEff,
    recommendation,
    isStagnated,
  };
}

// --- Cycle Projection ---

export interface CycleProjection {
  estimatedSparkPerCycle: number;
  cyclesToBasicForge: number;
  cyclesToExtendedForge: number;
  cyclesToMasterForge: number;
  pathComparison: {
    scholar: number;
    diplomat: number;
    generalist: number;
  };
}

export function projectCycleEarnings(
  profile: GameProfile,
  averageTasksPerCycle: number = 6
): CycleProjection {
  const averageBaseReward = 18; // rough average across all task types

  const scholarEst = averageBaseReward * averageTasksPerCycle * PATH_MULTIPLIERS.scholar.archive *
    (1 + Math.min(profile.pathMomentum * MOMENTUM_INCREMENT, MOMENTUM_CAP));
  const diplomatEst = averageBaseReward * averageTasksPerCycle * PATH_MULTIPLIERS.diplomat.agora *
    (1 + Math.min(profile.pathMomentum * MOMENTUM_INCREMENT, MOMENTUM_CAP));
  const generalistEst = averageBaseReward * averageTasksPerCycle * 0.75; // ~25% stagnation average

  const currentEst = profile.currentPath === "scholar" ? scholarEst
    : profile.currentPath === "diplomat" ? diplomatEst
    : generalistEst;

  const costBasic = profile.currentPath === "generalist"
    ? Math.ceil(FORGE_COSTS.basic * 1.5) : FORGE_COSTS.basic;
  const costExtended = profile.currentPath === "generalist"
    ? Math.ceil(FORGE_COSTS.extended * 1.5) : FORGE_COSTS.extended;
  const costMaster = profile.currentPath === "generalist"
    ? Math.ceil(FORGE_COSTS.master * 1.5) : FORGE_COSTS.master;

  return {
    estimatedSparkPerCycle: Math.round(currentEst),
    cyclesToBasicForge: Math.max(1, Math.ceil((costBasic - profile.sparkBalance) / Math.max(1, currentEst))),
    cyclesToExtendedForge: Math.max(1, Math.ceil((costExtended - profile.sparkBalance) / Math.max(1, currentEst))),
    cyclesToMasterForge: Math.max(1, Math.ceil((costMaster - profile.sparkBalance) / Math.max(1, currentEst))),
    pathComparison: {
      scholar: Math.round(scholarEst),
      diplomat: Math.round(diplomatEst),
      generalist: Math.round(generalistEst),
    },
  };
}

// --- Task Availability ---

export function getAvailableTaskRooms(
  profile: GameProfile
): { archive: boolean; agora: boolean; forge: boolean } {
  const path = profile.currentPath;

  if (!path) {
    return { archive: false, agora: false, forge: false };
  }

  // All paths can access Archive and Agora (but with different multipliers)
  // Forge requires Spark payment
  return {
    archive: true,
    agora: true,
    forge: profile.sparkBalance >= FORGE_COSTS.basic,
  };
}

export function canCompleteTask(
  task: GameTask,
  profile: GameProfile
): { allowed: boolean; reason?: string } {
  if (!profile.currentPath) {
    return { allowed: false, reason: "You must choose a path before completing tasks." };
  }

  if (!task.isActive) {
    return { allowed: false, reason: "This task is no longer available." };
  }

  if (task.room === "forge") {
    return { allowed: false, reason: "Forge tasks require an active Forge session." };
  }

  if (task.requiredPath && task.requiredPath !== profile.currentPath) {
    return {
      allowed: false,
      reason: `This task requires the ${task.requiredPath} path. You are on the ${profile.currentPath} path.`,
    };
  }

  return { allowed: true };
}
