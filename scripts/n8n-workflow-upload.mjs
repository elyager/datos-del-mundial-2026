#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const defaultEnvPath = path.join(rootDir, ".env");

const workflowPayloadFields = [
  "name",
  "nodes",
  "connections",
  "settings",
  "staticData",
  "pinData",
];

const workflowManagedFields = [
  "id",
  "versionId",
  "meta",
  "tags",
  "createdAt",
  "updatedAt",
  "shared",
  "ownedBy",
  "homeProject",
  "scopes",
  "usedCredentials",
  "triggerCount",
];

const allowedWorkflowSettings = new Set([
  "saveExecutionProgress",
  "saveManualExecutions",
  "saveDataErrorExecution",
  "saveDataSuccessExecution",
  "executionTimeout",
  "errorWorkflow",
  "timezone",
  "executionOrder",
  "callerPolicy",
  "callerIds",
  "timeSavedPerExecution",
  "redactionPolicy",
  "availableInMCP",
  "customTelemetryTags",
]);

function printUsage() {
  console.log(`Usage:
  node scripts/n8n-workflow-upload.mjs create --file <workflow.json> [--dry-run]
  node scripts/n8n-workflow-upload.mjs update --id <workflow-id> --file <workflow.json> [--dry-run]

Options:
  --file <path>          Local n8n workflow JSON file.
  --id <workflow-id>     n8n workflow ID to update.
  --base-url <url>       Override N8N_BASE_URL.
  --api-key-env <name>   Environment variable name containing the n8n API key. Defaults to N8N_API_KEY.
  --dry-run              Validate and print the planned API calls without uploading.
  --help                 Show this help.

Environment:
  N8N_API_KEY            n8n public API key. Sent as X-N8N-API-KEY.
  N8N_BASE_URL           n8n instance URL or API root. Examples:
                         https://example.app.n8n.cloud
                         https://example.app.n8n.cloud/api/v1`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = {
    command,
    apiKeyEnv: "N8N_API_KEY",
    baseUrl: null,
    dryRun: false,
    file: null,
    id: null,
    help: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    switch (arg) {
      case "--file":
        args.file = rest[++index];
        break;
      case "--id":
        args.id = rest[++index];
        break;
      case "--base-url":
        args.baseUrl = rest[++index];
        break;
      case "--api-key-env":
        args.apiKeyEnv = rest[++index];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function readLocalEnv(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    values[key] = parseEnvValue(rawValue);
  }
  return values;
}

function getEnvValue(name, localEnv) {
  return process.env[name] ?? localEnv[name];
}

function normalizeApiRoot(baseUrl) {
  if (!baseUrl) {
    throw new Error("Missing N8N_BASE_URL. Set it in .env or pass --base-url.");
  }

  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);
  if (url.pathname.endsWith("/api/v1")) {
    return url.toString().replace(/\/+$/, "");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/v1`;
  return url.toString().replace(/\/+$/, "");
}

function endpointUrl(apiRoot, endpointPath) {
  return new URL(endpointPath.replace(/^\/+/, ""), `${apiRoot}/`).toString();
}

async function readWorkflow(filePath) {
  if (!filePath) {
    throw new Error("Missing --file <workflow.json>.");
  }

  const absolutePath = path.resolve(rootDir, filePath);
  let text;
  try {
    text = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Workflow file not found: ${filePath}`);
    }
    throw error;
  }

  try {
    return {
      workflow: JSON.parse(text),
      absolutePath,
    };
  } catch (error) {
    throw new Error(`Invalid workflow JSON in ${filePath}: ${error.message}`);
  }
}

function normalizeWorkflowSettings(settings) {
  if (settings === undefined || settings === null) {
    return {
      settings: {},
      strippedSettingsFields: [],
    };
  }
  if (typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Workflow settings must be an object when present.");
  }

  const normalized = {};
  const strippedSettingsFields = [];
  for (const [key, value] of Object.entries(settings)) {
    if (allowedWorkflowSettings.has(key)) {
      normalized[key] = value;
    } else {
      strippedSettingsFields.push(key);
    }
  }

  return {
    settings: normalized,
    strippedSettingsFields,
  };
}

function normalizeWorkflowPayload(workflow) {
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error("Workflow JSON must be an object.");
  }
  if (typeof workflow.name !== "string" || !workflow.name.trim()) {
    throw new Error("Workflow JSON must include a non-empty name.");
  }
  if (!Array.isArray(workflow.nodes)) {
    throw new Error("Workflow JSON must include a nodes array.");
  }
  if (!workflow.connections || typeof workflow.connections !== "object" || Array.isArray(workflow.connections)) {
    throw new Error("Workflow JSON must include a connections object.");
  }

  const { settings, strippedSettingsFields } = normalizeWorkflowSettings(workflow.settings);
  const payload = {};
  for (const field of workflowPayloadFields) {
    if (field === "settings") {
      payload.settings = settings;
    } else if (workflow[field] !== undefined) {
      payload[field] = workflow[field];
    }
  }

  return {
    payload,
    strippedSettingsFields,
  };
}

function workflowSummary(workflow, payload, strippedFields, strippedSettingsFields) {
  return {
    name: workflow.name,
    localId: workflow.id ?? null,
    active: typeof workflow.active === "boolean" ? workflow.active : null,
    nodes: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
    payloadFields: Object.keys(payload),
    strippedFields,
    strippedSettingsFields,
  };
}

function redactor(secret) {
  return (value) => {
    let text = String(value ?? "");
    if (secret) {
      text = text.split(secret).join("[redacted]");
    }
    return text;
  };
}

async function requestJson({ apiRoot, apiKey, method, endpoint, body }) {
  const url = endpointUrl(apiRoot, endpoint);
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    "X-N8N-API-KEY": apiKey,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const redact = redactor(apiKey);
    const responseText = redact(text).slice(0, 4000);
    throw new Error(
      `n8n API request failed: ${method} ${url} returned ${response.status} ${response.statusText}${
        responseText ? `\nResponse: ${responseText}` : ""
      }`,
    );
  }

  return data;
}

async function syncActiveState({ apiRoot, apiKey, workflowId, active }) {
  if (typeof active !== "boolean") {
    return null;
  }

  const action = active ? "activate" : "deactivate";
  await requestJson({
    apiRoot,
    apiKey,
    method: "POST",
    endpoint: `/workflows/${encodeURIComponent(workflowId)}/${action}`,
  });
  return action;
}

function printDryRun({
  command,
  filePath,
  apiRoot,
  workflowId,
  workflow,
  payload,
  strippedFields,
  strippedSettingsFields,
}) {
  const summary = workflowSummary(workflow, payload, strippedFields, strippedSettingsFields);
  const workflowEndpoint = command === "create" ? "/workflows" : `/workflows/${workflowId}`;
  console.log("Dry run: no n8n API requests were sent.");
  console.log(`Workflow file: ${filePath}`);
  console.log(`Workflow API call: ${command === "create" ? "POST" : "PUT"} ${endpointUrl(apiRoot, workflowEndpoint)}`);
  if (typeof workflow.active === "boolean") {
    const action = workflow.active ? "activate" : "deactivate";
    const activeEndpoint =
      command === "create"
        ? `${apiRoot}/workflows/<created-workflow-id>/${action}`
        : endpointUrl(apiRoot, `/workflows/${workflowId}/${action}`);
    console.log(`Active state call: POST ${activeEndpoint}`);
  }
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) {
    printUsage();
    return;
  }
  if (!["create", "update"].includes(args.command)) {
    throw new Error("Command must be either create or update.");
  }
  if (args.command === "update" && !args.id) {
    throw new Error("Missing --id <workflow-id> for update.");
  }
  if (!args.apiKeyEnv) {
    throw new Error("--api-key-env requires a variable name.");
  }

  const localEnv = await readLocalEnv(defaultEnvPath);
  const apiKey = getEnvValue(args.apiKeyEnv, localEnv);
  if (!apiKey) {
    throw new Error(`Missing ${args.apiKeyEnv}. Set it in .env or the process environment.`);
  }

  const apiRoot = normalizeApiRoot(args.baseUrl ?? getEnvValue("N8N_BASE_URL", localEnv));
  const { workflow, absolutePath } = await readWorkflow(args.file);
  const { payload, strippedSettingsFields } = normalizeWorkflowPayload(workflow);
  const strippedFields = workflowManagedFields.filter((field) => workflow[field] !== undefined);

  if (args.dryRun) {
    printDryRun({
      command: args.command,
      filePath: absolutePath,
      apiRoot,
      workflowId: args.id,
      workflow,
      payload,
      strippedFields,
      strippedSettingsFields,
    });
    return;
  }

  let result;
  if (args.command === "create") {
    result = await requestJson({
      apiRoot,
      apiKey,
      method: "POST",
      endpoint: "/workflows",
      body: payload,
    });
  } else {
    result = await requestJson({
      apiRoot,
      apiKey,
      method: "PUT",
      endpoint: `/workflows/${encodeURIComponent(args.id)}`,
      body: payload,
    });
  }

  const workflowId = args.command === "create" ? result?.id : args.id;
  if (!workflowId) {
    throw new Error("n8n response did not include a workflow id.");
  }

  const activeAction = await syncActiveState({
    apiRoot,
    apiKey,
    workflowId,
    active: workflow.active,
  });

  console.log(`${args.command === "create" ? "Created" : "Updated"} workflow ${workflowId}: ${workflow.name}`);
  if (activeAction) {
    console.log(`Synced active state: ${activeAction}`);
  }
}

main().catch((error) => {
  fail(error.message);
});
