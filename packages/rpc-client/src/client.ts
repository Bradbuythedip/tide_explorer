/**
 * Tidecoin JSON-RPC client.
 *
 * Design:
 *  - One HTTP call per RPC request (Tidecoin 0.18.3 does not support the
 *    modern multi-call batch format we'd want anyway).
 *  - Fixed connection pool via undici.
 *  - Bounded retries (3) with exponential backoff on transport/5xx errors
 *    ONLY. JSON-RPC application errors (well-formed `error` field) never
 *    retry.
 *  - Every response validated by a Zod schema at the boundary. Shape drift
 *    surfaces as a thrown ZodError, not a silent type lie.
 *  - Amounts are returned in the node's native shape (decimal TDC numbers).
 *    Callers convert with parseTdcAmount() from @prevblock/shared. This
 *    keeps the client 1:1 with docs/sample-responses/.
 *
 * NON-goals for this package:
 *  - No caching. Redis lives in the backend.
 *  - No persistence. That's the indexer.
 *  - No business logic (fee estimation heuristics, script reclassification,
 *    etc.). Those belong upstream of this layer.
 */

import { Agent, request } from "undici";
import { z } from "zod";
import {
  GetBlockVerbose2Schema,
  GetBlockchainInfoSchema,
  GetMempoolInfoSchema,
  GetMiningInfoSchema,
  GetNetworkInfoSchema,
  GetTxOutSetInfoSchema,
  DecodedTxSchema,
  RpcEnvelopeSchema,
} from "./schemas.js";

export interface RpcClientConfig {
  url: string;
  user: string;
  password: string;
  /** Per-request wall-clock timeout. Default 30 s. */
  timeoutMs?: number;
  /** Max retry attempts on transport failure. Default 3. */
  maxRetries?: number;
  /** Initial backoff in ms; doubles each attempt. Default 250. */
  backoffBaseMs?: number;
}

export class TidecoinRpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly method: string,
  ) {
    super(`RPC ${method} failed (${code}): ${message}`);
    this.name = "TidecoinRpcError";
  }
}

export class TidecoinRpcClient {
  private readonly url: string;
  private readonly authHeader: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly dispatcher: Agent;
  private idCounter = 0;

  constructor(config: RpcClientConfig) {
    this.url = config.url.replace(/\/+$/, "") + "/";
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.user}:${config.password}`, "utf8").toString(
        "base64",
      );
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.backoffBaseMs = config.backoffBaseMs ?? 250;
    this.dispatcher = new Agent({
      connections: 16,
      pipelining: 1,
      keepAliveTimeout: 30_000,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });
  }

  /** Close the underlying HTTP pool. Call on shutdown. */
  async close(): Promise<void> {
    await this.dispatcher.close();
  }

  // -------- typed, high-level methods (the only ones callers use) --------

  getBlockchainInfo() {
    return this.call("getblockchaininfo", [], GetBlockchainInfoSchema);
  }

  getNetworkInfo() {
    return this.call("getnetworkinfo", [], GetNetworkInfoSchema);
  }

  getMempoolInfo() {
    return this.call("getmempoolinfo", [], GetMempoolInfoSchema);
  }

  getMiningInfo() {
    return this.call("getmininginfo", [], GetMiningInfoSchema);
  }

  getTxOutSetInfo() {
    return this.call("gettxoutsetinfo", [], GetTxOutSetInfoSchema);
  }

  getBlockCount() {
    return this.call("getblockcount", [], z.number().int().nonnegative());
  }

  getBestBlockHash() {
    return this.call(
      "getbestblockhash",
      [],
      z.string().regex(/^[0-9a-f]{64}$/),
    );
  }

  getBlockHash(height: number) {
    return this.call(
      "getblockhash",
      [height],
      z.string().regex(/^[0-9a-f]{64}$/),
    );
  }

  /** Verbosity 2: full block with decoded txs inlined. */
  getBlockVerbose2(hash: string) {
    return this.call("getblock", [hash, 2], GetBlockVerbose2Schema);
  }

  /** Verbosity 0: raw hex string. */
  getBlockHex(hash: string) {
    return this.call("getblock", [hash, 0], z.string().regex(/^[0-9a-fA-F]+$/));
  }

  /** Decoded tx. Requires txindex=1 OR a known blockhash. */
  getRawTransactionDecoded(txid: string, blockhash?: string) {
    const params: (string | boolean)[] =
      blockhash !== undefined ? [txid, true, blockhash] : [txid, true];
    return this.call("getrawtransaction", params, DecodedTxSchema);
  }

  getRawTransactionHex(txid: string, blockhash?: string) {
    const params: (string | boolean)[] =
      blockhash !== undefined ? [txid, false, blockhash] : [txid, false];
    return this.call(
      "getrawtransaction",
      params,
      z.string().regex(/^[0-9a-fA-F]+$/),
    );
  }

  getRawMempool(verbose: boolean) {
    const schema = verbose
      ? z.record(
          z.object({
            size: z.number().int(),
            fee: z.number(),
            modifiedfee: z.number(),
            time: z.number().int(),
            height: z.number().int(),
            descendantcount: z.number().int(),
            descendantsize: z.number().int(),
            descendantfees: z.number(),
            ancestorcount: z.number().int(),
            ancestorsize: z.number().int(),
            ancestorfees: z.number(),
            wtxid: z.string(),
            depends: z.array(z.string()),
            spentby: z.array(z.string()),
          }),
        )
      : z.array(z.string());
    return this.call("getrawmempool", [verbose], schema);
  }

  // -------- escape hatch for one-off calls --------

  /**
   * Call an arbitrary RPC method. Prefer the typed helpers above — they
   * come with a verified-against-sample schema. Use this only for
   * methods we haven't explicitly modelled yet.
   */
  async callRaw(method: string, params: unknown[] = []): Promise<unknown> {
    const envelope = await this.transport(method, params);
    if (envelope.error !== null) {
      throw new TidecoinRpcError(
        envelope.error.code,
        envelope.error.message,
        method,
      );
    }
    return envelope.result;
  }

  // -------- internals --------

  private async call<T>(
    method: string,
    params: unknown[],
    schema: z.ZodType<T>,
  ): Promise<T> {
    const envelope = await this.transport(method, params);
    if (envelope.error !== null) {
      throw new TidecoinRpcError(
        envelope.error.code,
        envelope.error.message,
        method,
      );
    }
    const parsed = schema.safeParse(envelope.result);
    if (!parsed.success) {
      throw new Error(
        `RPC ${method} response failed schema validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  private async transport(
    method: string,
    params: unknown[],
  ): Promise<z.infer<typeof RpcEnvelopeSchema>> {
    const body = JSON.stringify({
      jsonrpc: "1.0",
      id: ++this.idCounter,
      method,
      params,
    });

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await request(this.url, {
          method: "POST",
          dispatcher: this.dispatcher,
          headers: {
            "content-type": "application/json",
            authorization: this.authHeader,
          },
          body,
        });

        // Tidecoin returns 200 on success and 500 for application errors
        // (with the error body still well-formed JSON-RPC). We read the
        // body in both cases and let the envelope decide.
        const text = await res.body.text();

        if (res.statusCode >= 500 && !text.startsWith("{")) {
          // Transport-level 5xx, not a JSON-RPC error — retry.
          throw new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`);
        }

        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            `RPC ${method} returned non-JSON (HTTP ${res.statusCode}): ${text.slice(0, 200)}`,
          );
        }

        return RpcEnvelopeSchema.parse(json);
      } catch (err) {
        lastErr = err;
        // Don't retry application-layer errors.
        if (err instanceof TidecoinRpcError) throw err;
        if (attempt === this.maxRetries) break;
        const delay = this.backoffBaseMs * 2 ** attempt;
        await sleep(delay);
      }
    }
    throw new Error(
      `RPC ${method} failed after ${this.maxRetries + 1} attempts: ${String(lastErr)}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
