const signals = [
  {
    title: "Divcon Positioning",
    date: "Through 2025",
    text: "Divcon presents as an Irving, TX mission-critical controls provider with large installed footprint claims across North America.",
  },
  {
    title: "Rockwell Partnership",
    date: "Nov 4, 2024",
    text: "Divcon announced Rockwell Best-in-Class Partner status focused on reliability, redundancy, and efficiency for data-center environments.",
  },
  {
    title: "CyrusOne + Calpine DFW10",
    date: "Jul 2025",
    text: "Bosque County campus announced under construction with 190 MW agreement and Q4 2026 expected operation target.",
  },
  {
    title: "Google Texas Expansion",
    date: "Nov 2025",
    text: "Google announced substantial Texas investment expansion, supporting a sustained hyperscale growth signal.",
  },
];

const decisionNodes = [
  {
    id: "owner",
    label: "Owner Technical Team",
    influence: "Very High",
    message: "We reduce cooling uptime risk with a spec-ready valve package and responsive engineering support.",
    ask: "Share standards, approved vendor pathway, and reliability criteria for current phase.",
  },
  {
    id: "mep",
    label: "MEP / Design Engineer",
    influence: "Very High",
    message: "We provide transparent technical submittals, actuator compatibility, and maintainability clarity.",
    ask: "Review basis-of-design assumptions and identify entry points for approved-equal language.",
  },
  {
    id: "controls",
    label: "Controls Integrator",
    influence: "Medium-High",
    message: "We align valve behavior with sequence-of-operations, telemetry, and failover requirements.",
    ask: "Validate integration constraints and escalation risk before procurement freeze.",
  },
  {
    id: "mechanical",
    label: "Mechanical Contractor",
    influence: "Very High",
    message: "We lower execution risk via package clarity, lead-time transparency, and rapid support.",
    ask: "Confirm packaging strategy, bid timing, and approval path for alternatives.",
  },
];

const planPhases = [
  {
    title: "Days 1-30",
    tasks: [
      "Verify site identity and project participants.",
      "Map owner, MEP, controls, mechanical contacts.",
      "Build top-10 target account sheet with confidence rating.",
    ],
  },
  {
    title: "Days 31-60",
    tasks: [
      "Run technical outreach sequence: owner/MEP/controls first.",
      "Deliver core proof package and close data gaps.",
      "Position approved-equal path before bid lock.",
    ],
  },
  {
    title: "Days 61-90",
    tasks: [
      "Track spec status weekly by account tier.",
      "Escalate blocked opportunities to leadership review.",
      "Publish repeatable pursuit playbook for Texas pipeline.",
    ],
  },
];

const videoChapters = [
  { label: "00:05 - Framing the Problem", seconds: 5 },
  { label: "01:00 - Data Center Stack", seconds: 60 },
  { label: "02:30 - Spec Strategy", seconds: 150 },
  { label: "04:00 - AI Playbook", seconds: 240 },
];

const audioChapters = [
  { label: "00:00 - Thesis", seconds: 0 },
  { label: "03:20 - Buyer Map", seconds: 200 },
  { label: "08:00 - Controls Path", seconds: 480 },
  { label: "13:30 - 90-Day Execution", seconds: 810 },
];

const reviewSteps = [
  {
    title: "1) Open With Verified Signal",
    body: "Start by grounding the room in verified public signals before discussing account strategy.",
    targetId: "signalsSection",
    actionLabel: "Jump Video to Data Center Stack",
    action: () => jumpMedia("strategyVideo", 60),
  },
  {
    title: "2) Explain Decision-Chain Advantage",
    body: "Walk owner, MEP, controls, and mechanical influence to show why upstream work drives margin.",
    targetId: "chainSection",
    actionLabel: "Focus Controls Node",
    action: () => setDecisionDetail("controls"),
  },
  {
    title: "3) Prioritize Accounts",
    body: "Use the weighted score to rank where pursuit resources get assigned this week.",
    targetId: "scoreSection",
    actionLabel: "Jump Audio to Buyer Map",
    action: () => jumpMedia("strategyAudio", 200),
  },
  {
    title: "4) Commit to 90-Day Cadence",
    body: "Assign owners for each phase and run weekly leadership review on spec-position movement.",
    targetId: "planSection",
    actionLabel: "Jump Audio to Execution",
    action: () => jumpMedia("strategyAudio", 810),
  },
  {
    title: "5) Close With Risk Discipline",
    body: "Repeat the guardrail: verify project identity before allocating major pursuit resources.",
    targetId: "riskSection",
    actionLabel: "Jump Video to Spec Strategy",
    action: () => jumpMedia("strategyVideo", 150),
  },
];

const scoreEntries = [];
let currentReviewStep = 0;

function jumpMedia(elementId, seconds) {
  const media = document.getElementById(elementId);
  if (!media) return;
  media.currentTime = seconds;
  media.play().catch(() => {});
}

function createChapterButtons(containerId, mediaId, chapters) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  chapters.forEach((chapter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-btn";
    button.textContent = chapter.label;
    button.addEventListener("click", () => jumpMedia(mediaId, chapter.seconds));
    container.appendChild(button);
  });
}

function renderSignals() {
  const container = document.getElementById("signals");
  container.innerHTML = "";
  for (const item of signals) {
    const card = document.createElement("article");
    card.className = "signal-card";
    card.innerHTML = `<small>${item.date}</small><h3>${item.title}</h3><p>${item.text}</p>`;
    container.appendChild(card);
  }
}

function renderDecisionChain() {
  const chain = document.getElementById("chain");
  chain.innerHTML = "";
  for (const node of decisionNodes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = node.label;
    btn.addEventListener("click", () => setDecisionDetail(node.id));
    btn.dataset.id = node.id;
    chain.appendChild(btn);
  }
  setDecisionDetail(decisionNodes[0].id);
}

function setDecisionDetail(id) {
  const node = decisionNodes.find((entry) => entry.id === id);
  if (!node) return;

  const detail = document.getElementById("chainDetail");
  detail.innerHTML = `
    <h3>${node.label}</h3>
    <p><strong>Influence:</strong> ${node.influence}</p>
    <p><strong>Message:</strong> ${node.message}</p>
    <p><strong>Ask:</strong> ${node.ask}</p>
  `;

  for (const button of document.querySelectorAll("#chain button")) {
    button.classList.toggle("active", button.dataset.id === id);
  }
}

function tierFromScore(score) {
  if (score >= 17) return { name: "Tier 1", className: "t1", action: "Pursue now with leadership visibility" };
  if (score >= 13) return { name: "Tier 2", className: "t2", action: "Develop in parallel with main targets" };
  return { name: "Tier 3", className: "t3", action: "Monitor until influence path improves" };
}

function renderScores() {
  const rows = document.getElementById("scoreRows");
  rows.innerHTML = "";
  const sorted = [...scoreEntries].sort((a, b) => b.score - a.score);

  for (const entry of sorted) {
    const tier = tierFromScore(entry.score);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.score}</td>
      <td><span class="badge ${tier.className}">${tier.name}</span></td>
      <td>${tier.action}</td>
    `;
    rows.appendChild(tr);
  }
}

function setupScoreForm() {
  const form = document.getElementById("scoreForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("accountName").value.trim();
    if (!name) return;

    const values = ["specAccess", "controlsAlignment", "mechanicalStrength", "validationConfidence"]
      .map((id) => Number(document.getElementById(id).value) || 0);

    const weighted = values[0] * 1.35 + values[1] * 1.2 + values[2] * 1.15 + values[3] * 1.3;
    const score = Math.round(weighted);

    const existing = scoreEntries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.score = score;
    } else {
      scoreEntries.push({ name, score });
    }

    renderScores();
    form.reset();
    document.getElementById("specAccess").value = "3";
    document.getElementById("controlsAlignment").value = "3";
    document.getElementById("mechanicalStrength").value = "3";
    document.getElementById("validationConfidence").value = "3";
  });
}

function taskKey(phaseIndex, taskIndex) {
  return `proflow_v2_task_${phaseIndex}_${taskIndex}`;
}

function renderPlanBoard() {
  const board = document.getElementById("planBoard");
  board.innerHTML = "";

  planPhases.forEach((phase, pIndex) => {
    const col = document.createElement("div");
    col.className = "plan-col";

    const title = document.createElement("h3");
    title.textContent = phase.title;
    col.appendChild(title);

    phase.tasks.forEach((taskText, tIndex) => {
      const key = taskKey(pIndex, tIndex);
      const row = document.createElement("label");
      row.className = "task";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = localStorage.getItem(key) === "1";

      const text = document.createElement("span");
      text.textContent = taskText;

      row.classList.toggle("done", input.checked);

      input.addEventListener("change", () => {
        localStorage.setItem(key, input.checked ? "1" : "0");
        row.classList.toggle("done", input.checked);
      });

      row.append(input, text);
      col.appendChild(row);
    });

    board.appendChild(col);
  });
}

function highlightSection(id) {
  const section = document.getElementById(id);
  if (!section) return;

  for (const panel of document.querySelectorAll("main .panel")) {
    panel.classList.remove("focused-panel");
  }

  section.classList.add("focused-panel");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReviewStep() {
  const card = document.getElementById("reviewCard");
  const step = reviewSteps[currentReviewStep];
  const total = reviewSteps.length;

  card.innerHTML = `
    <p class="review-index">Step ${currentReviewStep + 1} of ${total}</p>
    <h3>${step.title}</h3>
    <p>${step.body}</p>
    <button id="reviewAction" type="button">${step.actionLabel}</button>
  `;

  highlightSection(step.targetId);

  const actionButton = document.getElementById("reviewAction");
  actionButton.addEventListener("click", () => step.action());

  const nextButton = document.getElementById("reviewNext");
  nextButton.textContent = currentReviewStep === total - 1 ? "Finish Review" : "Next Step";
}

function setupReviewMode() {
  const next = document.getElementById("reviewNext");
  const reset = document.getElementById("reviewReset");

  next.addEventListener("click", () => {
    if (currentReviewStep < reviewSteps.length - 1) {
      currentReviewStep += 1;
      renderReviewStep();
    } else {
      currentReviewStep = 0;
      renderReviewStep();
    }
  });

  reset.addEventListener("click", () => {
    currentReviewStep = 0;
    renderReviewStep();
  });

  renderReviewStep();
}

renderSignals();
renderDecisionChain();
setupScoreForm();
renderScores();
renderPlanBoard();
createChapterButtons("videoChapters", "strategyVideo", videoChapters);
createChapterButtons("audioChapters", "strategyAudio", audioChapters);
setupReviewMode();
