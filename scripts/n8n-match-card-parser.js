const DATA_BASE_URL = "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/data/worldcup-2026";
const ASSET_BASE_URL = "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images";
const N8N_HELPERS = typeof this !== "undefined" && this.helpers ? this.helpers : null;

const PEOPLE = {
  manuel: {
    name: "Manuel",
    url: `${ASSET_BASE_URL}/people/manuel.png`,
  },
  nikito: {
    name: "Nikito",
    url: `${ASSET_BASE_URL}/people/nikito.png`,
  },
  yager: {
    name: "Yager",
    url: `${ASSET_BASE_URL}/people/yager.jpeg`,
  },
  noe: {
    name: "Noe",
    url: `${ASSET_BASE_URL}/people/noe.png`,
  },
  nico: {
    name: "Nico",
    url: `${ASSET_BASE_URL}/people/nico.png`,
  },
  oto: {
    name: "Oto",
    url: `${ASSET_BASE_URL}/people/oto.png`,
  },
  nere: {
    name: "Nere",
    url: `${ASSET_BASE_URL}/people/nere.jpeg`,
  },
  cotty: {
    name: "Cotty",
    url: `${ASSET_BASE_URL}/people/cotty.png`,
  },
  oswaldo: {
    name: "Oswaldo",
    url: `${ASSET_BASE_URL}/people/oswaldo.png`,
  },
  nikol: {
    name: "Nikol",
    url: `${ASSET_BASE_URL}/people/nikol.png`,
  },
  vero: {
    name: "Vero",
    url: `${ASSET_BASE_URL}/people/vero.png`,
  },
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function removeFlags(value) {
  return String(value ?? "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripParenthetical(value) {
  return String(value ?? "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(path) {
  const url = `${DATA_BASE_URL}/${path}`;

  if (N8N_HELPERS?.httpRequest) {
    return N8N_HELPERS.httpRequest({
      method: "GET",
      url,
      json: true,
    });
  }

  throw new Error("this.helpers.httpRequest is not available. Run this script in an n8n Code node.");
}

function splitVersus(line, label) {
  const parts = removeFlags(line).split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`Expected ${label} line to contain exactly one "vs": ${line}`);
  }
  return parts;
}

function buildTeamIndex(teams) {
  const index = new Map();

  for (const team of Object.values(teams)) {
    const names = [
      team.fifaCode,
      team.name,
      team.spanishName,
      team.flagIcon,
      ...(team.aliases ?? []),
    ];

    for (const name of names) {
      const key = normalizeText(name);
      if (key) {
        index.set(key, team);
      }
    }
  }

  return index;
}

function findTeam(teamText, teamIndex) {
  const key = normalizeText(teamText);
  const exactTeam = teamIndex.get(key);
  if (exactTeam) {
    return exactTeam;
  }

  for (const [candidate, team] of teamIndex.entries()) {
    if (candidate && (key.includes(candidate) || candidate.includes(key))) {
      return team;
    }
  }

  throw new Error(`Unknown team: ${teamText}`);
}

function findPerson(personText) {
  const key = normalizeText(personText);
  const person = PEOPLE[key];
  if (!person) {
    throw new Error(`Unknown person: ${personText}. Add it to the PEOPLE map in this Code node.`);
  }
  return {
    name: removeFlags(personText),
    url: person.url,
  };
}

function findStadium(venueLine, stadiums) {
  const cleanVenueLine = removeFlags(venueLine);
  const venueName = cleanVenueLine.split(",")[0]?.trim();
  const normalizedVenueName = normalizeText(venueName);
  const normalizedVenueLine = normalizeText(cleanVenueLine);

  for (const stadium of Object.values(stadiums)) {
    const normalizedName = normalizeText(stadium.name);
    const normalizedCity = normalizeText(stadium.city);

    if (
      normalizedVenueName === normalizedName ||
      normalizedVenueLine.includes(normalizedName) ||
      (normalizedVenueLine.includes(normalizedName) && normalizedVenueLine.includes(normalizedCity))
    ) {
      return stadium;
    }
  }

  for (const stadium of Object.values(stadiums)) {
    const normalizedCity = normalizeText(stadium.city);
    if (normalizedCity && normalizedVenueLine.includes(normalizedCity)) {
      return stadium;
    }
  }

  throw new Error(`Unknown stadium: ${venueLine}`);
}

function parseMatchCardText(text, teams, jerseys, stadiums) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    throw new Error("Expected $json.text to contain 3 non-empty lines: teams, people, and venue.");
  }

  const [team1Text, team2Text] = splitVersus(lines[0], "teams");
  const [person1Text, person2Text] = splitVersus(lines[1], "people");
  const venueLine = lines.slice(2).join(" ");

  const teamIndex = buildTeamIndex(teams);
  const team1 = findTeam(team1Text, teamIndex);
  const team2 = findTeam(team2Text, teamIndex);
  const person1 = findPerson(person1Text);
  const person2 = findPerson(person2Text);
  const stadium = findStadium(venueLine, stadiums);

  const team1Jersey = jerseys[team1.fifaCode];
  const team2Jersey = jerseys[team2.fifaCode];
  if (!team1Jersey?.shirtUrl) {
    throw new Error(`Missing jersey URL for ${team1.spanishName} (${team1.fifaCode})`);
  }
  if (!team2Jersey?.shirtUrl) {
    throw new Error(`Missing jersey URL for ${team2.spanishName} (${team2.fifaCode})`);
  }

  return {
    team1: team1.spanishName,
    team2: team2.spanishName,
    person1Name: person1.name,
    person2Name: person2.name,
    venue: stadium.name,
    location: stripParenthetical(stadium.city),
    person1Url: person1.url,
    person2Url: person2.url,
    team1ShirtUrl: team1Jersey.shirtUrl,
    team2ShirtUrl: team2Jersey.shirtUrl,
    templateUrl: stadium.imageUrl,
  };
}

function getInputText(item) {
  const json = item?.json;
  const candidates = [
    json?.text,
    json?.body?.text,
    json?.body?.message,
    json?.body?.content,
    json?.message,
    json?.content,
    typeof json?.body === "string" ? json.body : null,
  ];

  const text = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (text) {
    return text;
  }

  const availableFields = json && typeof json === "object" ? Object.keys(json).join(", ") : typeof json;
  throw new Error(
    `Expected input text in $json.text, $json.body.text, or a string $json.body. Available top-level fields: ${availableFields || "none"}.`,
  );
}

const [teams, jerseys, stadiums] = await Promise.all([
  fetchJson("teams.json"),
  fetchJson("team-jerseys.json"),
  fetchJson("stadiums.json"),
]);

const inputItems = typeof $input !== "undefined" ? $input.all() : [{ json: $json }];

return inputItems.map((item) => {
  const text = getInputText(item);

  return {
    json: parseMatchCardText(text, teams, jerseys, stadiums),
  };
});
