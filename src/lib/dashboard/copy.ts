const REGION_LABELS: Record<string, string> = {
  US: "United States",
  "US-TX": "Texas, USA",
  "US-IL": "Illinois, USA",
  "US-CA": "California, USA",
  "US-NY": "New York, USA",
  "US-FL": "Florida, USA",
  "US-WA": "Washington, USA",
  "US-GA": "Georgia, USA",
  MX: "Mexico",
  CN: "China",
  JP: "Japan",
  DE: "Germany",
  GB: "United Kingdom",
  KR: "South Korea",
  IN: "India",
  SG: "Singapore",
  NL: "Netherlands",
  FR: "France",
  IT: "Italy",
  BR: "Brazil",
  AU: "Australia",
};

export const formatRegionLabel = (code: string): string =>
  REGION_LABELS[code] ?? code;

export const formatRegionList = (codes: readonly string[]): string => {
  if (codes.length === 0) return "Location not specified";
  return codes.map(formatRegionLabel).join(" · ");
};

export const formatSeverityLabel = (
  severity: "low" | "med" | "high" | "unknown",
): string => {
  if (severity === "med") return "Medium";
  if (severity === "unknown") return "Unknown";
  return severity.charAt(0).toUpperCase() + severity.slice(1);
};

export const formatAlertLevel = (
  level: "info" | "warning" | "critical",
): string => {
  if (level === "info") return "Info";
  if (level === "warning") return "Warning";
  return "Critical";
};

export const formatDisruptionType = (type: string): string =>
  type
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatExposureType = (
  exposure: "supplier_region" | "shipment_route",
): string =>
  exposure === "supplier_region"
    ? "Supplier location affected"
    : "Shipping route affected";

export const formatSignalStatus = (
  status: "active" | "stale" | "degraded" | "resolved",
): string => {
  if (status === "active") return "Ongoing";
  if (status === "resolved") return "Cleared";
  if (status === "stale") return "Out of date";
  return "Incomplete data";
};

export const formatSignalSource = (source: "weather" | "news"): string =>
  source === "weather" ? "Weather" : "News";

export const formatModeLabel = (mode: "live" | "replay"): string =>
  mode === "live" ? "Live" : "Demo";

/** Inventory position (on-hand + on-order − backorders). Negative → shortfall phrasing. */
export const formatProjectedStock = (
  inventoryPosition: number | null,
): string => {
  if (inventoryPosition === null) return "Projected stock unavailable";
  if (inventoryPosition < 0)
    return `Stock shortfall: ${Math.abs(inventoryPosition)} units`;
  return `Projected stock: ${inventoryPosition}`;
};

export const formatProjectedStockShort = (
  inventoryPosition: number | null,
): string => {
  if (inventoryPosition === null) return "—";
  if (inventoryPosition < 0) return `Shortfall ${Math.abs(inventoryPosition)}`;
  return String(inventoryPosition);
};

export const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(Date.parse(value));

export const formatTimeOnly = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
  }).format(Date.parse(value));

export const formatAlertMessage = (input: {
  level: "info" | "warning" | "critical";
  sku: string | null;
}): string => {
  const product = input.sku ?? "this product";
  if (input.level === "critical")
    return `Critical — stock may run short for ${product}`;
  if (input.level === "warning")
    return `Warning — stock is tight for ${product}`;
  return `Watch — reorder threshold crossed for ${product}`;
};

export const formatActionHeadline = (input: {
  sku: string;
  recommendedQty: number | null;
  severity: "low" | "med" | "high" | "unknown";
}): string => {
  const qty = input.recommendedQty ?? "—";
  const warn =
    input.severity === "high" || input.severity === "med" ? "⚠ " : "";
  return `${warn}Order ${qty} units of ${input.sku}`;
};

/** Dense row title — qty only; SKU lives in its own column. */
export const formatActionOrderTitle = (recommendedQty: number | null): string =>
  `Order ${recommendedQty ?? "—"} units`;

export const formatActionSupport = (input: {
  disruptionTypes: readonly string[];
  leadTimeBase: number | null;
  leadTimeDelta: number;
  inventoryPosition: number | null;
  rop: number | null;
}): string => {
  const disruption =
    input.disruptionTypes.length === 0
      ? "A disruption"
      : formatDisruptionType(input.disruptionTypes[0] ?? "disruption");
  const leadTimeAfter =
    input.leadTimeBase === null
      ? null
      : input.leadTimeBase + input.leadTimeDelta;
  const lead =
    input.leadTimeBase === null || leadTimeAfter === null
      ? "Lead time increased due to disruption."
      : `${disruption} extended lead time from ${input.leadTimeBase} to ${leadTimeAfter} days.`;
  const stock = formatProjectedStock(input.inventoryPosition);
  const rop =
    input.rop === null
      ? "the reorder point"
      : `the reorder point (${input.rop})`;
  if (input.inventoryPosition === null || input.rop === null)
    return `${lead} ${stock}.`;
  if (input.inventoryPosition < 0) return `${lead} ${stock}, below ${rop}.`;
  return `${lead} ${stock} is below ${rop}.`;
};

/**
 * Compact one-line reason for dense action rows.
 * Same fields as formatActionSupport — numbers always rendered, prose condensed.
 */
export const formatActionSupportCompact = (input: {
  disruptionTypes: readonly string[];
  leadTimeBase: number | null;
  leadTimeDelta: number;
  inventoryPosition: number | null;
  rop: number | null;
}): string => {
  const disruption =
    input.disruptionTypes.length === 0
      ? "Disruption"
      : formatDisruptionType(input.disruptionTypes[0] ?? "disruption");
  const lead =
    input.leadTimeBase === null
      ? `lead time +${input.leadTimeDelta}d`
      : `lead time ${input.leadTimeBase}→${input.leadTimeBase + input.leadTimeDelta}d`;
  const stock =
    input.inventoryPosition === null
      ? "stock —"
      : input.inventoryPosition < 0
        ? `stock shortfall ${Math.abs(input.inventoryPosition)}`
        : `stock ${input.inventoryPosition}`;
  const reorder = input.rop === null ? "reorder —" : `reorder ${input.rop}`;
  return `${disruption} · ${lead} · ${stock} vs ${reorder}`;
};

export const formatActionMetricsInline = (input: {
  ss: number | null;
  rop: number | null;
  inventoryPosition: number | null;
}): string =>
  `SS ${input.ss ?? "—"} · ROP ${input.rop ?? "—"} · Stock ${formatProjectedStockShort(input.inventoryPosition)}`;

export const formatMonitoringLine = (input: {
  sku: string;
  disruptionTypes: readonly string[];
}): string => {
  const disruption =
    input.disruptionTypes.length === 0
      ? "a disruption"
      : formatDisruptionType(
          input.disruptionTypes[0] ?? "disruption",
        ).toLowerCase();
  return `${input.sku} — Exposed to ${disruption}, but current stock covers the reorder point. No action needed.`;
};

export const severityRank = (
  severity: "low" | "med" | "high" | "unknown",
): number => {
  if (severity === "high") return 3;
  if (severity === "med") return 2;
  if (severity === "low") return 1;
  return 0;
};
