import * as form141 from "./form-141/index.js";

const workflows = new Map([
  [form141.manifest.id, form141]
]);

export function listWorkflows() {
  return [...workflows.values()].map(({ manifest }) => manifest);
}

export function getWorkflow(id) {
  const workflow = workflows.get(id);
  if (!workflow) throw new Error(`Unknown workflow: ${id}`);
  return workflow;
}
