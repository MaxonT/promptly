function asJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function compileSpecToPrompt(spec) {
  const blocks = [];

  const projectGoal =
    spec.project_goal ||
    (spec.objectives && spec.objectives.summary) ||
    "Build the project as defined in the spec in a deterministic, file-complete way.";

  blocks.push({
    role: "system",
    label: "System Role",
    content:
      "You are an AI coding assistant. Follow the project spec strictly. " +
      "Be deterministic, avoid randomness, and always output complete, self-consistent code."
  });

  blocks.push({
    role: "user",
    label: "Project Goal",
    content: projectGoal
  });

  if (spec.actors) {
    blocks.push({
      role: "user",
      label: "Actors / Users",
      content: asJson(spec.actors)
    });
  }

  if (spec.flows) {
    blocks.push({
      role: "user",
      label: "Key User Flows",
      content: asJson(spec.flows)
    });
  }

  if (spec.requirements) {
    blocks.push({
      role: "user",
      label: "Functional Requirements",
      content: asJson(spec.requirements)
    });
  }

  if (spec.data) {
    blocks.push({
      role: "user",
      label: "Data & Models",
      content: asJson(spec.data)
    });
  }

  if (spec.constraints) {
    blocks.push({
      role: "user",
      label: "Constraints",
      content: asJson(spec.constraints)
    });
  }

  if (spec.evaluation_criteria) {
    blocks.push({
      role: "user",
      label: "What 'Good' Looks Like",
      content: asJson(spec.evaluation_criteria)
    });
  }

  if (spec.ui_ux) {
    blocks.push({
      role: "user",
      label: "UI / UX Notes",
      content: asJson(spec.ui_ux)
    });
  }

  if (spec.architecture) {
    blocks.push({
      role: "user",
      label: "Architecture",
      content: asJson(spec.architecture)
    });
  }

  blocks.push({
    role: "user",
    label: "Output Format",
    content:
      "Output code in a single response with clear file boundaries. " +
      "For each file, start with a comment line like: `// FILE: path/to/file.ext`."
  });

  blocks.push({
    role: "user",
    label: "Validation & Determinism",
    content:
      "Before you answer, mentally check that:\n" +
      "- All required files are present\n" +
      "- There are no unresolved imports\n" +
      "- The code is internally consistent\n" +
      "- You did not invent technologies or APIs absent from the spec"
  });

  const explanation =
    "Prompt blocks were compiled from the spec with a fixed ordering: " +
    "system role, project goal, actors, flows, requirements, data, constraints, evaluation, ui_ux, architecture, output rules, validation hints.";

  return {
    id: `prompt_${Date.now()}`,
    blocks,
    explanation
  };
}
