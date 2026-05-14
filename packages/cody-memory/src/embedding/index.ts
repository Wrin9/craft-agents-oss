/**
 * Local Embedding Provider — all-MiniLM-L6-v2 via Transformers.js v4.
 *
 * 22MB model, 384-dim vectors, fully offline after first download.
 * Uses ONNX Runtime for CPU inference (WebGPU optional).
 *
 * Fallback: HashEmbeddingProvider (deterministic but not semantically meaningful).
 */

import type { EmbeddingProvider } from '../types.ts';

const EMBEDDING_DIM = 384;
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'; // sentence-transformers compatible

let _pipeline: any = null;
let _initPromise: Promise<any> | null = null;

/**
 * Get or initialize the Transformers.js feature-extraction pipeline.
 * Singleton — model is loaded once and reused across calls.
 */
async function getPipeline(): Promise<any> {
  if (_pipeline) return _pipeline;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      _pipeline = await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'fp32',
        // Model is cached after first download in ~/.cache/huggingface/
      });
      return _pipeline;
    } catch (err) {
      console.warn('[CodyMemory] Failed to load Transformers.js, falling back to hash embeddings:', err);
      _pipeline = null;
      _initPromise = null;
      return null;
    }
  })();

  return _initPromise;
}

/**
 * LocalEmbeddingProvider — real semantic embeddings via Transformers.js.
 *
 * Uses all-MiniLM-L6-v2 (22MB):
 * - 384 dimensions
 * - 14.7ms per 1K tokens on CPU
 * - 78.1% Top-5 accuracy (MTEB)
 * - Fully offline after first download
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = EMBEDDING_DIM;
  private _ready = false;

  /** Check if the model is loaded and ready */
  get ready(): boolean {
    return this._ready;
  }

  /** Initialize the model (called automatically on first embed) */
  async initialize(): Promise<boolean> {
    const pipeline = await getPipeline();
    this._ready = pipeline !== null;
    return this._ready;
  }

  async embed(text: string): Promise<number[]> {
    const pipeline = await getPipeline();
    if (!pipeline) {
      return fallbackHashEmbed(text, EMBEDDING_DIM);
    }

    try {
      const output = await pipeline(text, { pooling: 'mean', normalize: true });
      // output.data is a Float32Array
      return Array.from(output.data as Float32Array);
    } catch (err) {
      console.warn('[CodyMemory] Embedding error, using fallback:', err);
      return fallbackHashEmbed(text, EMBEDDING_DIM);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const pipeline = await getPipeline();
    if (!pipeline) {
      return texts.map(t => fallbackHashEmbed(t, EMBEDDING_DIM));
    }

    try {
      // Process in batches to avoid memory issues
      const batchSize = 8;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const output = await pipeline(batch, { pooling: 'mean', normalize: true });
        const data = output.data as Float32Array;
        const dim = output.dims[output.dims.length - 1];

        for (let j = 0; j < batch.length; j++) {
          results.push(Array.from(data.slice(j * dim, (j + 1) * dim)));
        }
      }

      return results;
    } catch (err) {
      console.warn('[CodyMemory] Batch embedding error, using fallback:', err);
      return texts.map(t => fallbackHashEmbed(t, EMBEDDING_DIM));
    }
  }
}

/**
 * Fallback hash-based embedding.
 * Deterministic but NOT semantically meaningful.
 * Used when Transformers.js fails to load.
 */
function fallbackHashEmbed(text: string, dimension: number): number[] {
  const vec = new Array(dimension).fill(0);
  const normalized = text.toLowerCase().trim();
  if (normalized.length === 0) return vec;

  // Character n-grams
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i <= normalized.length - n; i++) {
      const gram = normalized.substring(i, i + n);
      let hash = 0;
      for (let j = 0; j < gram.length; j++) {
        hash = ((hash << 5) - hash + gram.charCodeAt(j)) | 0;
      }
      const idx = Math.abs(hash) % dimension;
      vec[idx] += 1.0 / n;
    }
  }

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vec : vec.map(v => v / norm);
}
