// Tag definitions - 50 tags across 5 categories

export const TAG_DEFINITIONS: Record<string, string[]> = {
  language: [
    "typescript",
    "javascript",
    "python",
    "rust",
    "go",
    "java",
    "cpp",
    "ruby",
    "php",
    "swift",
  ],
  domain: [
    "backend",
    "frontend",
    "fullstack",
    "devops",
    "mobile",
    "data-science",
    "machine-learning",
    "blockchain",
    "game-dev",
    "embedded",
  ],
  skill: [
    "api-design",
    "database",
    "ui-design",
    "ux-research",
    "testing",
    "security",
    "performance",
    "accessibility",
    "documentation",
    "architecture",
  ],
  framework: [
    "react",
    "nextjs",
    "vue",
    "angular",
    "svelte",
    "node",
    "django",
    "rails",
    "spring",
    "express",
  ],
  tool: [
    "docker",
    "kubernetes",
    "aws",
    "gcp",
    "terraform",
    "git",
    "ci-cd",
    "monitoring",
    "graphql",
    "rest",
  ],
};

// Flatten all tags for easy lookup
export const ALL_TAG_NAMES = Object.values(TAG_DEFINITIONS).flat();

// Get category for a tag name
export function getTagCategory(tagName: string): string | undefined {
  for (const [category, tags] of Object.entries(TAG_DEFINITIONS)) {
    if (tags.includes(tagName)) {
      return category;
    }
  }
  return undefined;
}
