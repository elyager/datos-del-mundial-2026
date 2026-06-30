const DATA_BASE_URL =
  "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/data/worldcup-2026";
const SUBMISSION_URL =
  "https://workflows.loboyosa.com/webhook/worldcup-custom-instructions";
const MAX_INSTRUCTION_LENGTH = 500;
const KNOCKOUT_ROUNDS = new Set([
  "round of 32",
  "round of 16",
  "quarter final",
  "semi final",
  "match for third place",
  "final",
]);

const state = {
  step: 1,
  people: {},
  teams: {},
  matches: [],
  currentMatches: [],
  selectedPersonKey: null,
  selectedTeamCode: "*",
};

const elements = {
  loading: document.querySelector("#loading-state"),
  loadError: document.querySelector("#load-error"),
  retryLoad: document.querySelector("#retry-load"),
  panels: [...document.querySelectorAll("[data-step-panel]")],
  indicators: [...document.querySelectorAll("[data-step-indicator]")],
  peopleList: document.querySelector("#people-list"),
  personContinue: document.querySelector("#person-continue"),
  selectedPersonSummary: document.querySelector("#selected-person-summary"),
  teamStepTitle: document.querySelector("#team-step-title"),
  teamsList: document.querySelector("#teams-list"),
  teamContinue: document.querySelector("#team-continue"),
  backButtons: [...document.querySelectorAll("[data-back-to]")],
  selectionSummary: document.querySelector("#selection-summary"),
  form: document.querySelector("#instruction-form"),
  instruction: document.querySelector("#instruction"),
  characterCount: document.querySelector("#character-count"),
  formError: document.querySelector("#form-error"),
  submit: document.querySelector("#submit-instruction"),
  success: document.querySelector("#success-state"),
  addAnother: document.querySelector("#add-another"),
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}

async function loadData() {
  elements.loading.hidden = false;
  elements.loadError.hidden = true;
  elements.panels.forEach((panel) => {
    panel.hidden = true;
  });

  try {
    const notificationData = await fetchJson(`${DATA_BASE_URL}/notification-data.json`);
    const currentData = await fetchJson(
      notificationData.dynamicSources.upstream.currentRawFiles.matches,
    ).catch(() => ({ matches: [] }));

    state.people = notificationData.people ?? {};
    state.teams = notificationData.teams ?? {};
    state.matches = notificationData.matches ?? [];
    state.currentMatches = currentData.matches ?? [];

    renderPeople();
    setStep(1);
    elements.loading.hidden = true;
  } catch (error) {
    console.error("Could not load World Cup data", error);
    elements.loading.hidden = true;
    elements.loadError.hidden = false;
  }
}

function setStep(step) {
  state.step = step;
  elements.panels.forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== step;
  });
  elements.indicators.forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("is-current", indicatorStep === step);
    indicator.classList.toggle("is-complete", indicatorStep < step);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createCheck() {
  const check = document.createElement("span");
  check.className = "option-check";
  check.setAttribute("aria-hidden", "true");
  check.textContent = "✓";
  return check;
}

function renderPeople() {
  elements.peopleList.replaceChildren();

  const entries = Object.entries(state.people).sort(([, first], [, second]) =>
    first.name.localeCompare(second.name, "es"),
  );

  for (const [personKey, person] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "person-option";
    button.dataset.personKey = personKey;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");

    const image = document.createElement("img");
    image.src = person.imageUrl;
    image.alt = "";
    image.width = 52;
    image.height = 52;

    const name = document.createElement("strong");
    name.textContent = person.name;

    button.append(image, name, createCheck());
    button.addEventListener("click", () => selectPerson(personKey));
    elements.peopleList.append(button);
  }
}

function selectPerson(personKey) {
  state.selectedPersonKey = personKey;
  state.selectedTeamCode = "*";
  elements.personContinue.disabled = false;

  elements.peopleList.querySelectorAll(".person-option").forEach((button) => {
    const selected = button.dataset.personKey === personKey;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function getActiveTeamCodes(personName) {
  const teamCodeByName = new Map();
  for (const team of Object.values(state.teams)) {
    for (const name of [team.name, team.spanishName, ...(team.aliases ?? [])]) {
      teamCodeByName.set(normalize(name), team.fifaCode);
    }
  }

  const activeTeamCodes = new Set();
  for (const match of state.currentMatches) {
    if (!KNOCKOUT_ROUNDS.has(normalize(match.round))) continue;

    const teamCodes = [match.team1, match.team2].map((name) =>
      teamCodeByName.get(normalize(name)),
    );

    if (match.score == null) {
      teamCodes.filter(Boolean).forEach((code) => activeTeamCodes.add(code));
      continue;
    }

    const decisiveScore = [match.score.p, match.score.et, match.score.ft].find(
      (score) => Array.isArray(score) && score.length === 2 && score[0] !== score[1],
    );
    if (!decisiveScore) continue;

    const winnerIndex = decisiveScore[0] > decisiveScore[1] ? 0 : 1;
    if (teamCodes[winnerIndex]) activeTeamCodes.add(teamCodes[winnerIndex]);
  }

  const assignedCodes = Object.values(state.teams)
    .filter((team) => normalize(team.assignmentOwner) === normalize(personName))
    .map((team) => team.fifaCode);

  return assignedCodes.filter((code) => activeTeamCodes.has(code));
}

function renderTeams() {
  const person = state.people[state.selectedPersonKey];
  const activeTeamCodes = getActiveTeamCodes(person.name);

  elements.selectedPersonSummary.replaceChildren();
  const image = document.createElement("img");
  image.src = person.imageUrl;
  image.alt = "";
  const name = document.createElement("span");
  name.textContent = person.name;
  elements.selectedPersonSummary.append(image, name);
  elements.teamStepTitle.textContent = `Elige una selección de ${person.name}`;
  elements.teamsList.replaceChildren();

  elements.teamsList.append(
    createTeamOption({
      code: "*",
      name: "Todas las selecciones",
      description: `Aplicar a cualquier selección asignada a ${person.name}`,
      selected: true,
      isAll: true,
    }),
  );

  for (const code of activeTeamCodes) {
    const team = state.teams[code];
    elements.teamsList.append(
      createTeamOption({
        code,
        name: team.spanishName,
        flag: team.flagIcon,
        selected: false,
      }),
    );
  }
}

function createTeamOption({ code, name, description, flag, selected, isAll = false }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `team-option${isAll ? " is-all" : ""}${selected ? " is-selected" : ""}`;
  button.dataset.teamCode = code;
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(selected));

  if (flag) {
    const flagElement = document.createElement("span");
    flagElement.className = "team-flag";
    flagElement.setAttribute("aria-hidden", "true");
    flagElement.textContent = flag;
    button.append(flagElement);
  }

  const copy = document.createElement("span");
  copy.className = "team-copy";
  const title = document.createElement("strong");
  title.textContent = name;
  copy.append(title);
  if (description) {
    const detail = document.createElement("small");
    detail.textContent = description;
    copy.append(detail);
  }

  button.append(copy, createCheck());
  button.addEventListener("click", () => selectTeam(code));
  return button;
}

function selectTeam(teamCode) {
  state.selectedTeamCode = teamCode;
  elements.teamsList.querySelectorAll(".team-option").forEach((button) => {
    const selected = button.dataset.teamCode === teamCode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function renderInstructionStep() {
  const person = state.people[state.selectedPersonKey];
  const teamName =
    state.selectedTeamCode === "*"
      ? "Todas las selecciones"
      : state.teams[state.selectedTeamCode].spanishName;
  elements.selectionSummary.textContent = `${person.name} + ${teamName}`;
  elements.form.hidden = false;
  elements.success.hidden = true;
  elements.formError.hidden = true;
  elements.instruction.focus();
}

function updateInstructionState() {
  const length = elements.instruction.value.length;
  elements.characterCount.value = `${length} / ${MAX_INSTRUCTION_LENGTH}`;
  elements.submit.disabled = elements.instruction.value.trim().length === 0;
}

async function submitInstruction(event) {
  event.preventDefault();
  const instruction = elements.instruction.value.trim();
  if (!instruction || instruction.length > MAX_INSTRUCTION_LENGTH) return;

  elements.submit.disabled = true;
  elements.submit.textContent = "Agregando…";
  elements.formError.hidden = true;

  try {
    const response = await fetch(SUBMISSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personKey: state.selectedPersonKey,
        teamCode: state.selectedTeamCode,
        instruction,
        website: document.querySelector("#website").value,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "No fue posible guardar la instrucción.");
    }

    elements.form.hidden = true;
    elements.success.hidden = false;
  } catch (error) {
    elements.formError.textContent = error.message;
    elements.formError.hidden = false;
  } finally {
    elements.submit.textContent = "Agregar instrucción";
    elements.submit.disabled = elements.instruction.value.trim().length === 0;
  }
}

function resetForm() {
  state.selectedPersonKey = null;
  state.selectedTeamCode = "*";
  elements.instruction.value = "";
  document.querySelector("#website").value = "";
  elements.personContinue.disabled = true;
  updateInstructionState();
  renderPeople();
  setStep(1);
}

elements.retryLoad.addEventListener("click", loadData);
elements.personContinue.addEventListener("click", () => {
  renderTeams();
  setStep(2);
});
elements.teamContinue.addEventListener("click", () => {
  renderInstructionStep();
  setStep(3);
});
elements.backButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(Number(button.dataset.backTo)));
});
elements.instruction.addEventListener("input", updateInstructionState);
elements.form.addEventListener("submit", submitInstruction);
elements.addAnother.addEventListener("click", resetForm);

updateInstructionState();
loadData();
