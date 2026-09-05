/**
 * Per-request cost from PymtHouse signed-ticket history
 * (`GET /api/v1/user/usage/requests`). Matches PymtHouse
 * `requestFeeLabel`: Wei × ETH/USD first, then exact ingest micros
 * (which may be fractional, e.g. `"0.932"`).
 */

const USD_MICROS_PER_DOLLAR = BigInt(1_000_000);
const USD_MICROS_DISPLAY_FLOOR = BigInt(100);

export type RequestFeeFields = {
  networkFeeUsdMicros: string;
  feeWei?: string;
  ethUsdPrice?: string;
};

function isIntegerMicrosString(value: string): boolean {
  if (value.length === 0) return false;
  let i = 0;
  if (value.startsWith("-")) {
    if (value.length === 1) return false;
    i = 1;
  }
  for (; i < value.length; i++) {
    const code = value.codePointAt(i);
    if (code == null || code < 48 || code > 57) return false;
  }
  return true;
}

function trimFracDigitZeros(fracDigits: string): string {
  let end = fracDigits.length;
  while (end > 0 && fracDigits[end - 1] === "0") end -= 1;
  return fracDigits.slice(0, end);
}

function parseUsdMicrosString(raw: string | null | undefined): bigint | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!isIntegerMicrosString(t)) return null;
  try {
    return BigInt(t);
  } catch {
    return null;
  }
}

function formatUsdMicrosString(
  microsStr: string | undefined | null
): string | null {
  if (microsStr == null || microsStr === "") return null;
  const amount = parseUsdMicrosString(microsStr);
  if (amount == null) return null;
  const negative = amount < BigInt(0);
  const abs = negative ? -amount : amount;
  if (abs === BigInt(0)) return null;
  if (abs < USD_MICROS_DISPLAY_FLOOR) {
    return negative ? "> -$0.0001" : "< $0.0001";
  }
  const whole = abs / USD_MICROS_PER_DOLLAR;
  const frac = abs % USD_MICROS_PER_DOLLAR;
  const fracStr = trimFracDigitZeros(frac.toString().padStart(6, "0"));
  const sign = negative ? "-" : "";
  if (fracStr.length === 0) {
    return `${sign}$${whole.toString()}`;
  }
  return `${sign}$${whole.toString()}.${fracStr}`;
}

function formatDollarParts(whole: bigint, fracDigits: string): string {
  const frac = trimFracDigitZeros(
    fracDigits.length > 12 ? fracDigits.slice(0, 12) : fracDigits
  );
  if (frac.length === 0) {
    return `$${whole.toString()}`;
  }
  return `$${whole.toString()}.${frac}`;
}

function parseWeiString(raw: string): bigint | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    try {
      const wei = BigInt(t);
      return wei > BigInt(0) ? wei : null;
    } catch {
      return null;
    }
  }
  if (/^\d+\.0+$/.test(t)) {
    try {
      const wei = BigInt(t.slice(0, t.indexOf(".")));
      return wei > BigInt(0) ? wei : null;
    } catch {
      return null;
    }
  }
  if (!/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return null;
  const asNumber = Number(t);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
  if (asNumber > Number.MAX_SAFE_INTEGER) return null;
  const wei = BigInt(Math.trunc(asNumber));
  return wei > BigInt(0) ? wei : null;
}

/** usd = fee_wei * eth_usd / 1e18 */
export function formatUsdFromWei(
  feeWei: string | null | undefined,
  ethUsdPrice: string | null | undefined
): string | null {
  if (feeWei == null || ethUsdPrice == null) return null;
  const priceTrim = ethUsdPrice.trim();
  if (!priceTrim) return null;
  const price = Number(priceTrim);
  if (!Number.isFinite(price) || price <= 0) return null;
  try {
    const wei = parseWeiString(feeWei);
    if (wei == null) return null;
    const ethUsdMicros = BigInt(Math.floor(price * 1_000_000));
    const product = wei * ethUsdMicros;
    const dollarDiv = BigInt(10) ** BigInt(24);
    const dollarWhole = product / dollarDiv;
    const dollarRem = product % dollarDiv;
    if (dollarWhole === BigInt(0) && dollarRem === BigInt(0)) return null;
    return formatDollarParts(
      dollarWhole,
      dollarRem.toString().padStart(24, "0")
    );
  } catch {
    return null;
  }
}

export function formatExactUsdMicrosString(
  microsStr: string | null | undefined
): string | null {
  if (microsStr == null || microsStr === "") return null;
  const t = microsStr.trim();
  if (isIntegerMicrosString(t)) {
    return formatUsdMicrosString(t);
  }
  if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return null;
  const micros = Number(t);
  if (!Number.isFinite(micros) || micros === 0) return null;
  const negative = micros < 0;
  const dollars = Math.abs(micros) / 1_000_000;
  let fixed = dollars.toFixed(12);
  if (fixed.includes(".")) {
    const [whole, frac = ""] = fixed.split(".");
    const trimmedFrac = trimFracDigitZeros(frac);
    fixed = trimmedFrac ? `${whole}.${trimmedFrac}` : whole;
  }
  if (fixed === "0") return null;
  return `${negative ? "-" : ""}$${fixed}`;
}

/** History cells: four fraction digits (`$0.0100`). */
const HISTORY_USD_DIGITS = 4;

function roundUsdLabel(label: string): string {
  if (label === "$0" || label.startsWith("<") || label.startsWith(">")) {
    return label;
  }
  const negative = label.startsWith("-");
  const body = label.replace(/^-?\$/, "");
  const n = Number(body);
  if (!Number.isFinite(n)) return label;
  const rounded = n.toFixed(HISTORY_USD_DIGITS);
  if (Number(rounded) === 0) {
    return negative ? "> -$0.0001" : "<$0.0001";
  }
  return `${negative ? "-" : ""}$${rounded}`;
}

function exactFeeLabel(row: RequestFeeFields): string {
  const fromWei = formatUsdFromWei(row.feeWei, row.ethUsdPrice);
  return fromWei ?? formatExactUsdMicrosString(row.networkFeeUsdMicros) ?? "$0";
}

export function requestFeeDisplay(row: RequestFeeFields): {
  display: string;
  exact: string;
} {
  const exact = exactFeeLabel(row);
  return { display: roundUsdLabel(exact), exact };
}
