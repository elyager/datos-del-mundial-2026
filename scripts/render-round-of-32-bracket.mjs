#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(root, 'round-of-32-bracket.json');
const outputPath = process.argv[2] || path.join(root, 'assets/images/round-of-32-bracket-players-v2.svg');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const W = 2800;
const H = 1600;
const cardW = 370;
const cardH = 138;
const startY = 230;
const gapY = 175;
const leftX = [30, 455, 790, 1090];
const rightX = [W - 30 - cardW, W - 455 - 270, W - 790 - 240, W - 1090 - 210];
const roundW = [cardW, 270, 240, 210];
const finalX = 1290;
const finalW = 220;

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const fmtDate = (date) => {
  const [, month, day] = date.split('-');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[Number(month) - 1]} ${Number(day)}`;
};

const matchMeta = (match) => {
  if (match.status !== 'final') return `M${match.matchNumber}  •  ${fmtDate(match.date)}  •  ${match.time}`;
  const penalties = match.result.penalties ? `  •  PENS ${match.result.penalties}` : '';
  return `M${match.matchNumber}  •  FINAL  •  ${match.result.score}${penalties}`;
};

const teamRow = ({ team, x, y, width, eliminated = false, compact = false }) => {
  if (!team) {
    return `<text class="tbd" x="${x + 16}" y="${y}">TBD</text>`;
  }
  const fontClass = compact ? 'team compact' : 'team';
  const playerX = x + width - 17;
  const underlineWidth = Math.max(34, team.player.length * (compact ? 9 : 10));
  const mark = eliminated
    ? `<text class="eliminated" x="${x + 20 + Math.min(team.name.length, 22) * (compact ? 9 : 11)}" y="${y}">×</text>`
    : '';
  return [
    `<text class="${fontClass}" x="${x + 16}" y="${y}">${esc(team.name)}</text>`,
    mark,
    `<text class="player" text-anchor="end" x="${playerX}" y="${y}">${esc(team.player)}</text>`,
    `<line x1="${playerX - underlineWidth}" y1="${y + 8}" x2="${playerX}" y2="${y + 8}" stroke="${esc(team.playerColor)}" stroke-width="6" stroke-linecap="round"/>`,
  ].join('');
};

const matchCard = (match, x, centerY, side) => {
  const y = centerY - cardH / 2;
  const loserCode = match.status === 'final'
    ? match.teams.find((team) => team.code !== match.result.winner)?.code
    : null;
  const team1 = teamRow({ team: match.teams[0], x, y: y + 76, width: cardW, eliminated: match.teams[0].code === loserCode, compact: match.teams[0].name.length > 20 });
  const team2 = teamRow({ team: match.teams[1], x, y: y + 116, width: cardW, eliminated: match.teams[1].code === loserCode, compact: match.teams[1].name.length > 20 });
  return `<g class="match ${match.status}">
    <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="14"/>
    <text class="meta" x="${side === 'left' ? x + 16 : x + cardW - 16}" y="${y + 28}" text-anchor="${side === 'left' ? 'start' : 'end'}">${esc(matchMeta(match))}</text>
    <line class="divider" x1="${x + 14}" y1="${y + 42}" x2="${x + cardW - 14}" y2="${y + 42}"/>
    ${team1}${team2}
  </g>`;
};

const advancingTeam = (match) => match.status === 'final'
  ? match.teams.find((team) => team.code === match.result.winner)
  : null;

const advanceCard = (teams, x, centerY, width, label) => {
  const height = 114;
  const y = centerY - height / 2;
  return `<g class="advance">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12"/>
    <text class="advance-label" x="${x + 14}" y="${y + 24}">${esc(label)}</text>
    ${teamRow({ team: teams[0], x, y: y + 62, width, compact: true })}
    ${teamRow({ team: teams[1], x, y: y + 96, width, compact: true })}
  </g>`;
};

const connector = (fromX, y1, y2, toX, side) => {
  const midX = side === 'left' ? fromX + 24 : fromX - 24;
  const targetY = (y1 + y2) / 2;
  return `<path class="connector" d="M ${fromX} ${y1} H ${midX} V ${y2} M ${fromX} ${y2} H ${midX} M ${midX} ${targetY} H ${toX}"/>`;
};

const sides = {
  left: data.matches.filter((match) => match.bracket.side === 'left').sort((a, b) => a.bracket.position - b.bracket.position),
  right: data.matches.filter((match) => match.bracket.side === 'right').sort((a, b) => a.bracket.position - b.bracket.position),
};
const r32Y = Array.from({ length: 8 }, (_, i) => startY + i * gapY);
const r16Y = Array.from({ length: 4 }, (_, i) => (r32Y[i * 2] + r32Y[i * 2 + 1]) / 2);
const qfY = Array.from({ length: 2 }, (_, i) => (r16Y[i * 2] + r16Y[i * 2 + 1]) / 2);
const sfY = [(qfY[0] + qfY[1]) / 2];

const content = [];
for (const side of ['left', 'right']) {
  const matches = sides[side];
  const xs = side === 'left' ? leftX : rightX;
  const edge = (round, x) => side === 'left' ? x + roundW[round] : x;
  const target = (round, x) => side === 'left' ? x : x + roundW[round];

  matches.forEach((match, i) => content.push(matchCard(match, xs[0], r32Y[i], side)));
  for (let i = 0; i < 4; i += 1) {
    content.push(advanceCard([advancingTeam(matches[i * 2]), advancingTeam(matches[i * 2 + 1])], xs[1], r16Y[i], roundW[1], `ROUND OF 16 • ${matches[i * 2].bracket.nextMatchNumber}`));
    content.push(connector(edge(0, xs[0]), r32Y[i * 2], r32Y[i * 2 + 1], target(1, xs[1]), side));
  }
  for (let i = 0; i < 2; i += 1) {
    content.push(advanceCard([null, null], xs[2], qfY[i], roundW[2], 'QUARTERFINAL'));
    content.push(connector(edge(1, xs[1]), r16Y[i * 2], r16Y[i * 2 + 1], target(2, xs[2]), side));
  }
  content.push(advanceCard([null, null], xs[3], sfY[0], roundW[3], 'SEMIFINAL'));
  content.push(connector(edge(2, xs[2]), qfY[0], qfY[1], target(3, xs[3]), side));
}

const finalCenterY = sfY[0];
content.push(`<path class="connector" d="M ${leftX[3] + roundW[3]} ${finalCenterY} H ${finalX} M ${rightX[3]} ${finalCenterY} H ${finalX + finalW}"/>`);
content.push(`<g class="final">
  <rect x="${finalX}" y="${finalCenterY - 100}" width="${finalW}" height="200" rx="20"/>
  <text class="final-label" text-anchor="middle" x="${finalX + finalW / 2}" y="${finalCenterY - 45}">FINAL</text>
  <line x1="${finalX + 45}" y1="${finalCenterY - 20}" x2="${finalX + finalW - 45}" y2="${finalCenterY - 20}"/>
  <text class="champion" text-anchor="middle" x="${finalX + finalW / 2}" y="${finalCenterY + 43}">CHAMPION</text>
  <text class="tbd" text-anchor="middle" x="${finalX + finalW / 2}" y="${finalCenterY + 76}">TBD</text>
</g>`);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="titleAccent" x1="0" x2="1"><stop stop-color="#32C5FF"/><stop offset=".5" stop-color="#B8F34A"/><stop offset="1" stop-color="#FF5FA2"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>
  <style>
    text { font-family: Inter, Arial, Helvetica, sans-serif; fill: #f7f8fa; }
    .title { font-size: 56px; font-weight: 900; letter-spacing: 3px; }
    .subtitle { font-size: 18px; fill: #aeb5c0; letter-spacing: 1.8px; }
    .round-title { font-size: 19px; font-weight: 800; fill: #cfd4dc; letter-spacing: 1.4px; }
    .match rect { fill: #101216; stroke: #505661; stroke-width: 2; filter: url(#shadow); }
    .match.final rect { stroke: #f2c94c; }
    .meta { font-size: 15px; font-weight: 800; fill: #aeb5c0; letter-spacing: .7px; }
    .divider { stroke: #343943; stroke-width: 1; }
    .team { font-size: 21px; font-weight: 750; }
    .team.compact { font-size: 18px; }
    .player { font-size: 19px; font-weight: 850; }
    .eliminated { font-size: 34px; font-weight: 900; fill: #ff3b3b; }
    .connector { fill: none; stroke: #747c88; stroke-width: 3; stroke-linejoin: round; }
    .advance rect { fill: #0e1014; stroke: #424853; stroke-width: 2; }
    .advance-label { font-size: 13px; font-weight: 800; fill: #848c98; letter-spacing: .8px; }
    .tbd { font-size: 17px; font-weight: 750; fill: #59616d; }
    .final rect { fill: #12151a; stroke: #e9edf2; stroke-width: 3; filter: url(#shadow); }
    .final line { stroke: #e9edf2; stroke-width: 3; }
    .final-label { font-size: 38px; font-weight: 950; letter-spacing: 2px; }
    .champion { font-size: 28px; font-weight: 900; fill: #f2c94c; letter-spacing: 1px; }
    .legend { font-size: 16px; fill: #9ba3af; }
  </style>
  <rect width="${W}" height="${H}" fill="#000"/>
  <rect x="30" y="22" width="${W - 60}" height="7" rx="3.5" fill="url(#titleAccent)"/>
  <text class="title" text-anchor="middle" x="${W / 2}" y="86">WORLD CUP 2026 — ROUND OF 32</text>
  <text class="subtitle" text-anchor="middle" x="${W / 2}" y="119">PLAYER OWNERSHIP BRACKET  •  UPDATED ${esc(data.asOf.replace('T', ' ').replace('Z', ' UTC'))}</text>
  <text class="round-title" text-anchor="middle" x="${leftX[0] + cardW / 2}" y="158">ROUND OF 32</text>
  <text class="round-title" text-anchor="middle" x="${leftX[1] + roundW[1] / 2}" y="158">ROUND OF 16</text>
  <text class="round-title" text-anchor="middle" x="${leftX[2] + roundW[2] / 2}" y="158">QUARTERFINALS</text>
  <text class="round-title" text-anchor="middle" x="${leftX[3] + roundW[3] / 2}" y="158">SEMIFINAL</text>
  <text class="round-title" text-anchor="middle" x="${rightX[3] + roundW[3] / 2}" y="158">SEMIFINAL</text>
  <text class="round-title" text-anchor="middle" x="${rightX[2] + roundW[2] / 2}" y="158">QUARTERFINALS</text>
  <text class="round-title" text-anchor="middle" x="${rightX[1] + roundW[1] / 2}" y="158">ROUND OF 16</text>
  <text class="round-title" text-anchor="middle" x="${rightX[0] + cardW / 2}" y="158">ROUND OF 32</text>
  ${content.join('\n  ')}
  <g transform="translate(${W / 2 - 260} 1556)">
    <text class="legend" x="0" y="0">PLAYER NAME</text><line x1="0" y1="9" x2="112" y2="9" stroke="#32C5FF" stroke-width="5" stroke-linecap="round"/>
    <text class="legend" x="164" y="0">underline = player color</text>
    <text class="eliminated" x="390" y="7">×</text><text class="legend" x="422" y="0">eliminated team</text>
  </g>
</svg>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, svg);
console.log(outputPath);
