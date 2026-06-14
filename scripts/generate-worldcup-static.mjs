import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "data", "worldcup-2026");

const upstream = {
  owner: "openfootball",
  repo: "worldcup.json",
  directoryUrl: "https://github.com/openfootball/worldcup.json/tree/master/2026",
  commit: "8f0f877f99a2b702dfdcce06357de9570dbf1fd6",
};

const rawBase = `https://raw.githubusercontent.com/${upstream.owner}/${upstream.repo}/${upstream.commit}/2026`;
const rawMasterBase = `https://raw.githubusercontent.com/${upstream.owner}/${upstream.repo}/master/2026`;

const upstreamFiles = {
  teams: `${rawBase}/worldcup.teams.json`,
  groups: `${rawBase}/worldcup.groups.json`,
  stadiums: `${rawBase}/worldcup.stadiums.json`,
  matches: `${rawBase}/worldcup.json`,
  squads: `${rawBase}/worldcup.squads.json`,
  qualifyingPlayoffs: `${rawBase}/worldcup.quali_playoffs.json`,
};

const upstreamMasterFiles = {
  teams: `${rawMasterBase}/worldcup.teams.json`,
  groups: `${rawMasterBase}/worldcup.groups.json`,
  stadiums: `${rawMasterBase}/worldcup.stadiums.json`,
  matches: `${rawMasterBase}/worldcup.json`,
  squads: `${rawMasterBase}/worldcup.squads.json`,
  qualifyingPlayoffs: `${rawMasterBase}/worldcup.quali_playoffs.json`,
};

const notificationLocales = [
  {
    id: "guadalajara_michoacan",
    label: "Guadalajara/Michoacan",
    timezone: "America/Mexico_City",
    emoji: "🍓",
  },
  {
    id: "sonora",
    label: "Sonora",
    timezone: "America/Hermosillo",
    emoji: "🥩",
  },
];

const countryNameByCode = {
  ca: "Canadá",
  mx: "México",
  us: "Estados Unidos",
};

const countryFlagByCode = {
  ca: "🇨🇦",
  mx: "🇲🇽",
  us: "🇺🇸",
};

const spanishNameByCode = {
  ARG: "Argentina",
  SEN: "Senegal",
  HAI: "Haití",
  BIH: "Bosnia y Herzegovina",
  BRA: "Brasil",
  RSA: "Sudáfrica",
  NOR: "Noruega",
  KOR: "Corea del Sur",
  FRA: "Francia",
  PAN: "Panamá",
  URU: "Uruguay",
  IRQ: "Irak",
  BEL: "Bélgica",
  IRN: "Irán",
  COD: "RD del Congo",
  SWE: "Suecia",
  ESP: "España",
  KSA: "Arabia Saudita",
  ALG: "Argelia",
  COL: "Colombia",
  POR: "Portugal",
  PAR: "Paraguay",
  MAR: "Marruecos",
  UZB: "Uzbekistán",
  GER: "Alemania",
  JPN: "Japón",
  CPV: "Cabo Verde",
  CZE: "República Checa",
  ENG: "Inglaterra",
  QAT: "Qatar",
  TUN: "Túnez",
  CRO: "Croacia",
  USA: "Estados Unidos",
  CIV: "Costa de Marfil",
  AUT: "Austria",
  NZL: "Nueva Zelanda",
  NED: "Países Bajos",
  AUS: "Australia",
  CUW: "Curazao",
  EGY: "Egipto",
  CAN: "Canadá",
  GHA: "Ghana",
  SCO: "Escocia",
  SUI: "Suiza",
  MEX: "México",
  TUR: "Turquía",
  ECU: "Ecuador",
  JOR: "Jordania",
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseMatchDateTime(date, time) {
  const match = time.match(/^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})$/);
  assert(match, `Invalid match time format: ${date} ${time}`);

  const [, hourRaw, minuteRaw, offsetRaw] = match;
  const [year, month, day] = date.split("-").map(Number);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const offsetHours = Number(offsetRaw);
  const timestamp = Date.UTC(year, month - 1, day, hour - offsetHours, minute);

  return new Date(timestamp);
}

function formatInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function buildCronExpression(date) {
  return `${date.getUTCSeconds()} ${date.getUTCMinutes()} ${date.getUTCHours()} ${date.getUTCDate()} ${date.getUTCMonth() + 1} *`;
}

function buildTeamLookups(teams) {
  const byName = new Map();

  for (const team of teams) {
    const names = [team.name, team.name_normalised, spanishNameByCode[team.fifa_code]].filter(Boolean);
    for (const name of names) {
      byName.set(name, team.fifa_code);
    }
  }

  return byName;
}

function invertAssignments(assignments, teamCodeByName) {
  const assignmentByCode = {};
  const missingAssignments = [];

  for (const [owner, countryNames] of Object.entries(assignments)) {
    for (const countryName of countryNames) {
      const code = teamCodeByName.get(countryName);
      if (!code) {
        missingAssignments.push(`${owner}: ${countryName}`);
        continue;
      }
      assignmentByCode[code] = owner;
    }
  }

  assert(
    missingAssignments.length === 0,
    `Unmapped assignment names:\n${missingAssignments.join("\n")}`,
  );

  return assignmentByCode;
}

function normalizeTeams(teams, assignmentByCode) {
  return Object.fromEntries(
    teams
      .map((team) => [
        team.fifa_code,
        {
          fifaCode: team.fifa_code,
          name: team.name,
          spanishName: spanishNameByCode[team.fifa_code],
          aliases: [team.name_normalised].filter(Boolean),
          group: team.group,
          continent: team.continent,
          confed: team.confed,
          flagIcon: team.flag_icon,
          flagUnicode: team.flag_unicode,
          assignmentOwner: assignmentByCode[team.fifa_code],
        },
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function normalizeGroups(groupsData, teamCodeByName) {
  return Object.fromEntries(
    groupsData.groups.map((group) => {
      const letter = group.name.replace(/^Group\s+/, "");
      const teams = group.teams.map((teamName) => {
        const code = teamCodeByName.get(teamName);
        assert(code, `Group ${group.name} has unmapped team ${teamName}`);
        return code;
      });

      return [
        letter,
        {
          id: letter,
          name: group.name,
          teams,
        },
      ];
    }),
  );
}

function normalizeStadiums(stadiumsData) {
  return Object.fromEntries(
    stadiumsData.stadiums.map((stadium) => {
      const id = slugify(stadium.city);
      return [
        id,
        {
          id,
          city: stadium.city,
          timezone: stadium.timezone,
          countryCode: stadium.cc,
          name: stadium.name,
          capacity: stadium.capacity,
          coords: stadium.coords,
        },
      ];
    }),
  );
}

function normalizeParticipant(value, teamCodeByName) {
  const teamCode = teamCodeByName.get(value);
  if (teamCode) {
    return {
      type: "team",
      code: teamCode,
      name: value,
    };
  }

  return {
    type: "slot",
    value,
  };
}

function normalizeMatches(matchesData, stadiums, teamCodeByName) {
  return matchesData.matches.map((match, index) => {
    const id = `M${String(index + 1).padStart(3, "0")}`;
    const stadiumId = slugify(match.ground);

    assert(stadiums[stadiumId], `Match ${id} has unmapped venue ${match.ground}`);

    const normalized = {
      id,
      upstreamNum: match.num,
      round: match.round,
      date: match.date,
      time: match.time,
      venueId: stadiumId,
      group: match.group ? match.group.replace(/^Group\s+/, "") : undefined,
      participants: [
        normalizeParticipant(match.team1, teamCodeByName),
        normalizeParticipant(match.team2, teamCodeByName),
      ],
    };

    return Object.fromEntries(
      Object.entries(normalized).filter(([, value]) => value !== undefined),
    );
  });
}

function validateOutput({ teams, groups, stadiums, matches, assignments }) {
  assert(Object.keys(teams).length === 48, "Expected 48 teams");
  assert(Object.keys(groups).length === 12, "Expected 12 groups");
  assert(Object.keys(stadiums).length === 16, "Expected 16 stadiums");
  assert(matches.length === 104, "Expected 104 matches");

  const assignedTeamCount = Object.values(assignments).flat().length;
  const teamsWithOwners = Object.values(teams).filter((team) => team.assignmentOwner).length;
  assert(teamsWithOwners === assignedTeamCount, "Not every assigned team has an owner");

  for (const [groupId, group] of Object.entries(groups)) {
    assert(group.teams.length === 4, `Group ${groupId} does not have 4 teams`);
    for (const code of group.teams) {
      assert(teams[code], `Group ${groupId} references unknown team ${code}`);
    }
  }

  for (const match of matches) {
    assert(stadiums[match.venueId], `Match ${match.id} references unknown venue ${match.venueId}`);
    assert(!("score" in match), `Match ${match.id} contains score`);
    assert(!("goals1" in match), `Match ${match.id} contains goals1`);
    assert(!("goals2" in match), `Match ${match.id} contains goals2`);

    if (match.group) {
      for (const participant of match.participants) {
        assert(
          participant.type === "team" && teams[participant.code],
          `Group-stage match ${match.id} has unresolved participant ${JSON.stringify(participant)}`,
        );
      }
    } else {
      for (const participant of match.participants) {
        assert(
          participant.type === "slot",
          `Knockout match ${match.id} resolved ${JSON.stringify(participant)} instead of keeping a slot`,
        );
      }
    }
  }
}

function buildDynamicSources() {
  return {
    upstream: {
      directoryUrl: upstream.directoryUrl,
      commit: upstream.commit,
      snapshotRawFiles: upstreamFiles,
      currentRawFiles: upstreamMasterFiles,
    },
    policy: {
      dynamicValuesAreNotCachedLocally: true,
      generatedStaticSnapshotUsesPinnedCommit: true,
      refreshChecksShouldUseMasterDirectory: upstream.directoryUrl,
    },
    dynamicFieldPaths: {
      "worldcup.json": [
        "matches[].score",
        "matches[].score.ft",
        "matches[].score.ht",
        "matches[].score.et",
        "matches[].score.p",
        "matches[].goals1",
        "matches[].goals1[].name",
        "matches[].goals1[].minute",
        "matches[].goals1[].penalty",
        "matches[].goals1[].owngoal",
        "matches[].goals2",
        "matches[].goals2[].name",
        "matches[].goals2[].minute",
        "matches[].goals2[].penalty",
        "matches[].goals2[].owngoal",
        "matches[knockout].team1 resolved team",
        "matches[knockout].team2 resolved team",
      ],
      "worldcup.squads.json": [
        "[].players",
        "[].players[].number",
        "[].players[].pos",
        "[].players[].name",
        "[].players[].date_of_birth",
      ],
      "worldcup.quali_playoffs.json": [
        "matches[].score",
        "matches[].goals1",
        "matches[].goals2",
      ],
    },
    staticFilesGeneratedLocally: [
      "teams.json",
      "groups.json",
      "stadiums.json",
      "matches.json",
      "notification-data.json",
    ],
  };
}

function buildNotificationParticipant(participant, teams) {
  if (participant.type === "slot") {
    return {
      type: "slot",
      value: participant.value,
      displayName: participant.value,
      assignmentOwner: null,
      flagEmoji: null,
    };
  }

  const team = teams[participant.code];
  assert(team, `Match references unknown team ${participant.code}`);

  return {
    type: "team",
    code: team.fifaCode,
    name: team.name,
    spanishName: team.spanishName,
    displayName: team.spanishName,
    flagEmoji: team.flagIcon,
    assignmentOwner: team.assignmentOwner,
  };
}

function buildNotificationData({ teams, groups, stadiums, matches, dynamicSources }) {
  const notificationMatches = matches.map((match) => {
    const kickoff = parseMatchDateTime(match.date, match.time);
    const alertAt = new Date(kickoff.getTime() - 10 * 60 * 1000);
    const localTimes = Object.fromEntries(
      notificationLocales.map((locale) => [
        locale.id,
        {
          label: locale.label,
          emoji: locale.emoji,
          timezone: locale.timezone,
          ...formatInTimeZone(kickoff, locale.timezone),
        },
      ]),
    );

    return {
      ...match,
      kickoffUtc: kickoff.toISOString(),
      alertAtUtc: alertAt.toISOString(),
      alertCronUtc: buildCronExpression(alertAt),
      venue: stadiums[match.venueId],
      participants: match.participants.map((participant) => buildNotificationParticipant(participant, teams)),
      localTimes,
    };
  });

  return {
    name: "World Cup 2026 Match Alerts",
    generatedAt: new Date().toISOString(),
    source: {
      staticSnapshotCommit: upstream.commit,
      scheduleSourceUrl: upstreamFiles.matches,
    },
    notificationLocales,
    dynamicSources,
    teams,
    groups,
    stadiums: Object.fromEntries(
      Object.entries(stadiums).map(([id, stadium]) => [
        id,
        {
          ...stadium,
          countryName: countryNameByCode[stadium.countryCode] ?? stadium.countryCode.toUpperCase(),
          countryFlag: countryFlagByCode[stadium.countryCode] ?? null,
          location: `${stadium.city}, ${countryNameByCode[stadium.countryCode] ?? stadium.countryCode.toUpperCase()}`,
        },
      ]),
    ),
    matches: notificationMatches,
  };
}

function validateNotificationData(notificationData) {
  const cronExpressions = new Set();

  for (const team of Object.values(notificationData.teams)) {
    assert(team.flagIcon, `Team ${team.fifaCode} is missing flagIcon`);
    assert(team.assignmentOwner, `Team ${team.fifaCode} is missing assignmentOwner`);
  }

  for (const match of notificationData.matches) {
    assert(match.kickoffUtc, `Match ${match.id} is missing kickoffUtc`);
    assert(match.alertAtUtc, `Match ${match.id} is missing alertAtUtc`);
    assert(match.alertCronUtc, `Match ${match.id} is missing alertCronUtc`);
    assert(match.venue && notificationData.stadiums[match.venueId], `Match ${match.id} is missing venue`);
    assert(!("randomFact" in match.venue), `Match ${match.id} includes randomFact`);

    cronExpressions.add(match.alertCronUtc);

    for (const locale of notificationLocales) {
      const localTime = match.localTimes[locale.id];
      assert(localTime?.date && localTime?.time, `Match ${match.id} is missing ${locale.id} local time`);
      assert(localTime.emoji === locale.emoji, `Match ${match.id} has wrong ${locale.id} emoji`);
    }

    for (const participant of match.participants) {
      if (participant.type === "team") {
        assert(participant.flagEmoji, `Match ${match.id} team ${participant.code} is missing flagEmoji`);
        assert(participant.assignmentOwner, `Match ${match.id} team ${participant.code} is missing assignmentOwner`);
      }
    }
  }

  return cronExpressions;
}

async function main() {
  const [assignmentsRaw, teamsData, groupsData, stadiumsData, matchesData] = await Promise.all([
    readFile(path.join(rootDir, "equipos-asignados.json"), "utf8").then(JSON.parse),
    fetchJson(upstreamFiles.teams),
    fetchJson(upstreamFiles.groups),
    fetchJson(upstreamFiles.stadiums),
    fetchJson(upstreamFiles.matches),
  ]);

  const teamCodeByName = buildTeamLookups(teamsData);
  const assignmentByCode = invertAssignments(assignmentsRaw, teamCodeByName);
  const teams = normalizeTeams(teamsData, assignmentByCode);
  const groups = normalizeGroups(groupsData, teamCodeByName);
  const stadiums = normalizeStadiums(stadiumsData);
  const matches = normalizeMatches(matchesData, stadiums, teamCodeByName);
  const dynamicSources = buildDynamicSources();
  const notificationData = buildNotificationData({ teams, groups, stadiums, matches, dynamicSources });
  const cronExpressions = validateNotificationData(notificationData);

  validateOutput({
    teams,
    groups,
    stadiums,
    matches,
    assignments: assignmentsRaw,
  });

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "teams.json"), stableStringify(teams)),
    writeFile(path.join(outputDir, "groups.json"), stableStringify(groups)),
    writeFile(path.join(outputDir, "stadiums.json"), stableStringify(stadiums)),
    writeFile(path.join(outputDir, "matches.json"), stableStringify(matches)),
    writeFile(path.join(outputDir, "dynamic-sources.json"), stableStringify(dynamicSources)),
    writeFile(path.join(outputDir, "notification-data.json"), stableStringify(notificationData)),
  ]);

  console.log("Generated static World Cup 2026 data:");
  console.log(`- ${Object.keys(teams).length} teams`);
  console.log(`- ${Object.keys(groups).length} groups`);
  console.log(`- ${Object.keys(stadiums).length} stadiums`);
  console.log(`- ${matches.length} matches`);
  console.log(`- ${cronExpressions.size} alert cron schedules`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
