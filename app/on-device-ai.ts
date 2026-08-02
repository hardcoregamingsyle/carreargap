let extractorPromise: Promise<any> | null = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(async ({ env, pipeline }) => {
      env.allowLocalModels = false;
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
    });
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
