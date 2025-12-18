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

  // Target users / audience
  const targetUsers = spec.target_users || spec.actors;
  if (targetUsers) {
    blocks.push({
      role: "user",
      label: "Target Users",
      content: asJson(targetUsers)
    });
  }

  // Platform
  if (spec.platform) {
    blocks.push({
      role: "user",
      label: "Platform",
      content: asJson(spec.platform)
    });
  }

  // Objectives or key user flows
  const objectives = spec.objectives || spec.flows;
  if (objectives) {
    blocks.push({
      role: "user",
      label: "Objectives",
      content: asJson(objectives)
    });
  }

  // Key features or requirements
  const features = spec.key_features || spec.requirements;
  if (features) {
    blocks.push({
      role: "user",
      label: "Key Features",
      content: asJson(features)
    });
  }

  // Technical stack / architecture
  const techStack = spec.technical_stack || spec.tech_stack || spec.architecture;
  if (techStack) {
    blocks.push({
      role: "user",
      label: "Technical Stack",
      content: asJson(techStack)
    });
  }

  // Data model
  const dataModel = spec.data_model || spec.data;
  if (dataModel) {
    blocks.push({
      role: "user",
      label: "Data Model",
      content: asJson(dataModel)
    });
  }

  // Constraints
  if (spec.constraints) {
    blocks.push({
      role: "user",
      label: "Constraints",
      content: asJson(spec.constraints)
    });
  }

  // Security
  if (spec.security) {
    blocks.push({
      role: "user",
      label: "Security Requirements",
      content: asJson(spec.security)
    });
  }

  // UI/UX
  if (spec.ui_ux) {
    blocks.push({
      role: "user",
      label: "UI / UX Notes",
      content: asJson(spec.ui_ux)
    });
  }

  // Evaluation criteria
  if (spec.evaluation_criteria) {
    blocks.push({
      role: "user",
      label: "What 'Good' Looks Like",
      content: asJson(spec.evaluation_criteria)
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
    "system role, project goal, target users, platform, objectives, key features, technical stack, " +
    "data model, constraints, security, ui/ux, evaluation criteria, output rules, validation hints.";

  return {
    id: `prompt_${Date.now()}`,
    blocks,
    explanation
  };
}
