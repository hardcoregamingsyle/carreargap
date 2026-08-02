let extractorPromise: ReturnType<typeof createExtractor> | null = null;

function createExtractor() {
  return import("@huggingface/transformers").then(async ({ env, pipeline }) => {
    env.allowLocalModels = false;
    return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
  });
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = createExtractor();
  }
  return extractorPromise;
}

export async function compareMeaning(candidate: string, opportunity: string) {
  const extractor = await getExtractor();
  const output = await extractor([candidate, opportunity], { pooling: "mean", normalize: true });
  const values = Array.from(output.data as Float32Array);
  const dimensions = values.length / 2;
  let similarity = 0;

  for (let index = 0; index < dimensions; index += 1) {
    similarity += values[index] * values[index + dimensions];
  }

  return Math.max(0, Math.min(1, similarity));
}
