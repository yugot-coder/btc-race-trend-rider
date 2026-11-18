// Trend-rider bot for the make.fun BTC race (agent-fun/bars-replay/v1).
//
// Strategy, in one paragraph: cbBTC's pool price trends in multi-hour legs,
// but most minutes are chop, and a round trip costs roughly 30 bps in fees,
// slippage and price impact, so the bot trades rarely and only with the
// trend. It goes long (85% of equity) when the close sits above its 120-bar
// EMA and the last 90 bars gained at least +20 bps. It exits on a -120 bps
// stop under the fill price, a -90 bps trailing stop under the best close
// since entry, or after 360 bars in the trade, and then cools down for 20
// bars before re-entering. One safeguard sits behind the main rules: the
// race ranks every entry that traded above every entry that never did, so
// if the bot reaches the last quarter of the window with no fill at all it
// relaxes in two steps (a weaker momentum trigger at 40% size, then a bare
// uptrend check at 30% size) to take part with bounded risk. On any window
// where the main rules trade, the safeguard never arms. Every decision
// reads only the bars and the account the harness sends, so the two graded
// executions agree byte for byte: no clock, no environment, no randomness.
//
// vendor/makefun-bars.ts is a byte-identical copy of the kit's SDK shim.

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Trend filter: trade only above this EMA of closes. */
const EMA_N = 120;
/** Momentum lookback in bars. */
const MOM_N = 90;
/** Entry needs at least this 90-bar gain, in bps. */
const MOM_MIN_BPS = 20;
/** Spend 85% of equity per entry. */
const SIZE_NUM = 85n;
const SIZE_DEN = 100n;
/** Hard stop under the entry fill price, in bps. */
const STOP_BPS = 120;
/** Trailing stop under the best close since entry, in bps. */
const TRAIL_BPS = 90;
/** Bars; leave a trade that has gone nowhere by then. */
const MAX_HOLD = 360;
/** Bars to sit out after an exit fill. */
const COOLDOWN = 20;
/** max_slippage_bps sent with every order. */
const SLIP_BPS = 250;
/** 1 USDC in quote units: the smallest buy the market takes. */
const MIN_NOTIONAL = 1_000_000n;
/** Participation safeguard, step 1: from this scored bar, with no fill yet,
 * the momentum trigger relaxes to this many bps at 40% size. */
const LATE1_BAR = 1080;
const LATE1_MOM_BPS = 8;
const LATE1_NUM = 40n;
/** Step 2: from this scored bar, with no fill yet, a close no worse than
 * this many bps under the EMA is enough, at 30% size. */
const LATE2_BAR = 1290;
const LATE2_DIP_BPS = 30;
const LATE2_NUM = 30n;

/** Every close seen, as numbers (raw integer prices). */
const closes: number[] = [];
/** EMA_N of the closes, seeded on the first close. */
let ema: number | null = null;
/** Fill price of the open position (raw integer price). */
let entryPx = 0;
/** Best close since entry (raw integer price). */
let peak = 0;
/** Seq of the batch that reported the entry fill. */
let entryBar = -1;
/** Seq of the batch that reported the last exit fill. */
let lastExit = -1_000_000_000;
/** Filled orders so far; the participation safeguard arms only at zero. */
let fills = 0;

await runBars({
  onBatch(state, batch) {
    // Learn from the fills this batch reports: the entry price the stops
    // hang off, and the exit time the cooldown counts from.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      fills += 1;
      if (fill.side === 'buy') {
        entryPx = Number(fill.price);
        peak = entryPx;
        entryBar = state.seq;
      } else {
        lastExit = state.seq;
      }
    }
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c);
    closes.push(close);
    ema = ema === null ? close : ema + (2 / (EMA_N + 1)) * (close - ema);
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && held.qty > 0n) {
      if (close > peak) peak = close;
      if (
        close * 10000 <= entryPx * (10000 - STOP_BPS) ||
        close * 10000 <= peak * (10000 - TRAIL_BPS) ||
        state.seq - entryBar >= MAX_HOLD
      ) {
        const order: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: SLIP_BPS };
        return [order];
      }
      return [];
    }

    // Flat: look for an entry, once the cooldown has run out and the EMA
    // and the momentum lookback both have their history.
    if (state.seq - lastExit < COOLDOWN) return [];
    if (closes.length <= MOM_N) return [];
    const past = closes[closes.length - MOM_N - 1];
    const momentumBps = Math.floor(((close - past) * 10000) / past);
    let sizeNum: bigint | null = null;
    if (close > ema && momentumBps >= MOM_MIN_BPS) {
      sizeNum = SIZE_NUM;
    } else if (fills === 0) {
      // The participation safeguard: still no trade late in the window.
      const scoredBar = state.seq - state.warmupBars;
      if (scoredBar >= LATE1_BAR && close > ema && momentumBps >= LATE1_MOM_BPS) {
        sizeNum = LATE1_NUM;
      } else if (scoredBar >= LATE2_BAR && close * 10000 >= ema * (10000 - LATE2_DIP_BPS)) {
        sizeNum = LATE2_NUM;
      }
    }
    if (sizeNum !== null) {
      let notional = (state.equity * sizeNum) / SIZE_DEN;
      if (state.cash < notional) notional = state.cash;
      if (notional >= MIN_NOTIONAL) {
        const order: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: SLIP_BPS };
        return [order];
      }
    }
    return [];
  },
});
