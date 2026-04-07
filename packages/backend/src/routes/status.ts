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
    // gettxoutsetinfo is expensive (tens of ms even warm); we still call
    // it every status hit until Phase 1.6 introduces Redis caching. The
    // cache TTL there will be the single source of freshness for this
    // number. No silent staleness.
    const [chain, network, mempool, mining, utxo] = await Promise.all([
      app.rpc.getBlockchainInfo(),
      app.rpc.getNetworkInfo(),
      app.rpc.getMempoolInfo(),
      app.rpc.getMiningInfo(),
      app.rpc.getTxOutSetInfo(),
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
