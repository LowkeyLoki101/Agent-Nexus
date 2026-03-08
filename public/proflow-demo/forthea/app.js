const signals = [
  {
    title: "Forthea Market Position",
    date: "2024-Present",
    text: "Forthea is a Houston-based performance digital marketing agency specializing in SEO, PPC, web design, and conversion optimization. Recognized as a Google Premier Partner and Inc. 5000 company with a strong mid-market B2B and B2C client base.",
  },
  {
    title: "Houston Digital Economy Growth",
    date: "2025-2026",
    text: "Houston's digital advertising market has grown 18% YoY, driven by energy sector digital transformation, healthcare system expansion, and a surge in e-commerce adoption across Texas metro areas.",
  },
  {
    title: "AI-Driven Marketing Disruption",
    date: "Q1 2026",
    text: "Agencies integrating AI-powered campaign optimization, predictive analytics, and automated content generation are capturing 2.3x more enterprise RFPs than traditional service providers.",
  },
  {
    title: "Mid-Market Growth Opportunity",
    date: "2025-2026",
    text: "Companies with $10M-$500M revenue are increasing digital marketing spend by 24% annually, seeking full-service agency partners over point solutions. Forthea's sweet spot aligns directly with this demand curve.",
  },
  {
    title: "Competitive Landscape Shift",
    date: "Through 2026",
    text: "National agencies are pulling back from sub-$50K/month accounts, creating a strategic opening for regional leaders like Forthea to capture displaced enterprise accounts with localized service delivery.",
  },
  {
    title: "Performance Marketing ROI Pressure",
    date: "Q4 2025",
    text: "CFOs now require documented ROAS proof within 90 days. Agencies that can demonstrate attribution clarity and revenue impact are winning retention rates 40% above industry average.",
  },
];

const decisionNodes = [
  {
    id: "cmo",
    label: "CMO / VP Marketing",
    influence: "Very High",
    message: "We deliver measurable pipeline growth through integrated SEO, paid media, and conversion optimization with full-funnel attribution.",
    ask: "Share current marketing KPIs, budget allocation, and growth targets for the next 12 months.",
  },
  {
    id: "director",
    label: "Director of Digital",
    influence: "Very High",
    message: "We augment your team with specialized execution capacity across paid, organic, and CRO without the overhead of full-time hires.",
    ask: "Walk us through your current tech stack, campaign structure, and pain points in reporting/attribution.",
  },
  {
    id: "cfo",
    label: "CFO / Finance",
    influence: "High",
    message: "We provide transparent reporting with clear revenue attribution so every marketing dollar has documented ROI.",
    ask: "What ROAS threshold or CAC target makes continued investment a clear decision for the leadership team?",
  },
  {
    id: "procurement",
    label: "Procurement / Agency Selection Committee",
    influence: "Medium-High",
    message: "We offer flexible engagement models, clear SOWs, and performance-based pricing structures that reduce vendor risk.",
    ask: "What are the evaluation criteria, timeline, and competitive review process for agency selection?",
  },
  {
    id: "sales",
    label: "VP Sales / Revenue",
    influence: "High",
    message: "We generate qualified leads that convert — our campaigns are built around your sales process, not just impressions.",
    ask: "What does a qualified lead look like for your team, and what's the current lead-to-close rate from digital channels?",
  },
];

const planPhases = [
  {
    title: "Days 1-30: Audit & Discovery",
    tasks: [
      "Complete comprehensive digital audit (SEO, PPC, analytics, CRO).",
      "Map competitive landscape and identify share-of-voice gaps.",
      "Document current tech stack and integration requirements.",
      "Establish baseline KPIs and build attribution framework.",
      "Deliver strategic roadmap with prioritized quick wins.",
    ],
  },
  {
    title: "Days 31-60: Campaign Architecture",
    tasks: [
      "Launch restructured paid media campaigns with proper audience segmentation.",
      "Deploy technical SEO fixes and content strategy for priority keywords.",
      "Implement conversion rate optimization tests on top landing pages.",
      "Set up automated reporting dashboards with revenue attribution.",
      "Begin outbound thought leadership content cadence.",
    ],
  },
  {
    title: "Days 61-90: Optimize & Scale",
    tasks: [
      "Analyze first full cycle of campaign data and optimize bids/budgets.",
      "Scale winning ad creative and landing page variants.",
      "Present 90-day performance review with documented ROI.",
      "Propose Phase 2 expansion into new channels or markets.",
      "Establish monthly leadership review cadence for ongoing alignment.",
    ],
  },
];

const reviewSteps = [
  {
    title: "1) Ground in Market Reality",
    body: "Start by presenting verified market signals — Houston's digital growth, the AI disruption curve, and the mid-market opportunity that aligns with Forthea's positioning.",
    targetId: "signalsSection",
  },
  {
    title: "2) Map the Decision Chain",
    body: "Walk through each stakeholder in the buying process. Show how the message adapts from CMO (pipeline growth) to CFO (ROI proof) to Procurement (risk reduction).",
    targetId: "chainSection",
  },
  {
    title: "3) Prioritize Target Accounts",
    body: "Use the weighted scoring model to rank which prospects deserve immediate pursuit resources based on budget fit, digital maturity, growth intent, and timeline.",
    targetId: "scoreSection",
  },
  {
    title: "4) Commit to 90-Day Execution",
    body: "Walk through each phase: Audit & Discovery, Campaign Architecture, Optimize & Scale. Assign ownership and establish weekly check-in cadence.",
    targetId: "planSection",
  },
  {
    title: "5) Close With Risk Discipline",
    body: "Review the guardrails. Emphasize: no vanity metrics, no channel expansion before proving core performance, and always document ROI before requesting budget increases.",
    targetId: "riskSection",
  },
];

const scoreEntries = [];
let currentReviewStep = 0;

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
  if (score >= 17) return { name: "Tier 1", className: "t1", action: "Pursue immediately with full proposal team" };
  if (score >= 13) return { name: "Tier 2", className: "t2", action: "Develop relationship and schedule discovery call" };
  return { name: "Tier 3", className: "t3", action: "Nurture with content until buying signals strengthen" };
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

    const values = ["budgetFit", "digitalMaturity", "growthIntent", "decisionTimeline"]
      .map((id) => Number(document.getElementById(id).value) || 0);

    const weighted = values[0] * 1.35 + values[1] * 1.2 + values[2] * 1.3 + values[3] * 1.15;
    const score = Math.round(weighted);

    const existing = scoreEntries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.score = score;
    } else {
      scoreEntries.push({ name, score });
    }

    renderScores();
    form.reset();
    document.getElementById("budgetFit").value = "3";
    document.getElementById("digitalMaturity").value = "3";
    document.getElementById("growthIntent").value = "3";
    document.getElementById("decisionTimeline").value = "3";
  });
}

function taskKey(phaseIndex, taskIndex) {
  return `proflow_forthea_task_${phaseIndex}_${taskIndex}`;
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
  `;

  highlightSection(step.targetId);

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
setupReviewMode();
