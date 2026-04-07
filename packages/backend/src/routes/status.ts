import type { FastifyInstance } from "fastify";
import {
  parseTdcAmount,
  formatTdcAmount,
  TIDECOIN_MAINNET,
} from "@prevblock/shared";

/**
 * GET /api/v1/status
 *
 * Returns a single snapshot that fuses getblockchaininfo, getnetworkinfo,
 * getmempoolinfo, getmininginfo, and gettxoutsetinfo. This is what the
 * dashboard header polls every few seconds.
 *
 * Amounts are returned as both:
 *   - *_sats: stringified bigint satoshis (canonical, used for arithmetic)
 *   - *_tdc:  fixed-8-decimal TDC string (canonical for display)
 *
 * We never return a JS float TDC amount on the API boundary. See
 * packages/shared/src/amount.ts for rationale.
 */
export async function registerStatusRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/status", async () => {
    // Two tiers: the header fast-path (chain/network/mempool/mining)
    // is cached 2 s, and gettxoutsetinfo — which is expensive on the
    // node — is cached 30 s. The UI renders both values with a
    // "last updated N s ago" label driven by meta.generatedAt so a
    // skeptical user can see the freshness, not guess it.
    const [chain, network, mempool, mining, utxo] = await Promise.all([
      app.cache.remember("status:blockchaininfo", "status-2s", () =>
        app.rpc.getBlockchainInfo(),
      ),
      app.cache.remember("status:networkinfo", "status-2s", () =>
        app.rpc.getNetworkInfo(),
      ),
      app.cache.remember("status:mempoolinfo", "mempool-stats-2s", () =>
        app.rpc.getMempoolInfo(),
      ),
      app.cache.remember("status:mininginfo", "status-2s", () =>
        app.rpc.getMiningInfo(),
      ),
      app.cache.remember("status:txoutsetinfo", "txoutset-30s", () =>
        app.rpc.getTxOutSetInfo(),
      ),
    ]);

    const supplySats = parseTdcAmount(utxo.total_amount);

    return {
      chain: {
        name: chain.chain,
        tipHeight: chain.blocks,
        tipHash: chain.bestblockhash,
        headers: chain.headers,
        mediantime: chain.mediantime,
        verificationProgress: chain.verificationprogress,
        initialBlockDownload: chain.initialblockdownload,
        difficulty: chain.difficulty,
        chainwork: chain.chainwork,
        sizeOnDiskBytes: chain.size_on_disk,
        pruned: chain.pruned,
        targetSpacingSeconds: TIDECOIN_MAINNET.powTargetSpacingSeconds,
      },
      network: {
        subversion: network.subversion,
        protocolVersion: network.protocolversion,
        connections: network.connections,
        relayFee: network.relayfee,
        warnings: network.warnings || null,
      },
      mining: {
        networkHashPs: mining.networkhashps,
        difficulty: mining.difficulty,
      },
      mempool: {
        txCount: mempool.size,
        bytes: mempool.bytes,
        usage: mempool.usage,
        maxMempoolBytes: mempool.maxmempool,
        minFeeTdcPerKb: mempool.mempoolminfee,
      },
      supply: {
        utxoCount: utxo.txouts,
        txCount: utxo.transactions,
        totalSats: supplySats.toString(),
        totalTdc: formatTdcAmount(supplySats),
        capTdc: "21000000.00000000",
      },
      meta: {
        generatedAt: new Date().toISOString(),
      },
    };
  });
}
