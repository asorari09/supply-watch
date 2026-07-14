import {
  delayDaysFor,
  MAX_LEAD_TIME_DELTA,
} from "@/lib/agents/assessment-engine/delay-map";
import type { Signal, Shipment, Sku, Supplier } from "@/lib/domain";

export interface SupplierExposure {
  signal: Signal;
  delayDays: number;
}
export interface ShipmentExposure {
  signal: Signal;
  shipment: Shipment;
  delayDays: number;
  newEta: string;
}
export interface SkuCorrelation {
  sku: Sku;
  leadTimeBase: number;
  leadTimeStdDays?: number;
  leadTimePrime: number;
  supplierExposures: SupplierExposure[];
  shipmentExposures: ShipmentExposure[];
}
export interface CorrelationResult {
  skus: SkuCorrelation[];
  shipmentExposures: ShipmentExposure[];
}

const overlaps = (left: readonly string[], right: readonly string[]): boolean =>
  left.some((value) => right.includes(value));
const daysInMonth = (year: number, month: number): number =>
  month === 2
    ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(month)
      ? 30
      : 31;
const addDays = (iso: string, days: number): string => {
  const [datePart, timePart] = iso.split("T");
  if (datePart === undefined || timePart === undefined) return iso;
  const [yearText, monthText, dayText] = datePart.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  let day = Number(dayText) + days;
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  )
    return iso;
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${timePart}`;
};

export const correlate = (input: {
  signals: readonly Signal[];
  suppliers: readonly Supplier[];
  shipments: readonly Shipment[];
  skus: readonly Sku[];
  maxLeadTimeDelta?: number;
}): CorrelationResult => {
  const active = input.signals.filter((signal) => signal.status === "active");
  const limit = input.maxLeadTimeDelta ?? MAX_LEAD_TIME_DELTA;
  const supplierById = new Map(
    input.suppliers.map((supplier) => [supplier.id, supplier]),
  );
  const shipmentExposures = active.flatMap((signal) =>
    input.shipments
      .filter((shipment) =>
        overlaps(signal.affectedRegions, shipment.routeRegions),
      )
      .map((shipment) => {
        const delayDays = delayDaysFor(signal.disruptionType, signal.severity);
        return {
          signal,
          shipment,
          delayDays,
          newEta: addDays(shipment.eta, delayDays),
        };
      }),
  );
  return {
    shipmentExposures,
    skus: input.skus.map((sku) => {
      const supplier = supplierById.get(sku.supplierId);
      if (supplier === undefined)
        return {
          sku,
          leadTimeBase: 0,
          leadTimePrime: 0,
          supplierExposures: [],
          shipmentExposures: [],
        };
      const supplierExposures = active
        .filter((signal) =>
          overlaps(signal.affectedRegions, [supplier.regionCode]),
        )
        .map((signal) => ({
          signal,
          delayDays: delayDaysFor(signal.disruptionType, signal.severity),
        }));
      const delay = Math.min(
        limit,
        supplierExposures.reduce(
          (sum, exposure) => sum + exposure.delayDays,
          0,
        ),
      );
      return {
        sku,
        leadTimeBase: supplier.leadTimeDaysBase,
        ...(supplier.leadTimeStdDays === undefined
          ? {}
          : { leadTimeStdDays: supplier.leadTimeStdDays }),
        leadTimePrime: supplier.leadTimeDaysBase + delay,
        supplierExposures,
        shipmentExposures: shipmentExposures.filter(
          (exposure) => exposure.shipment.skuId === sku.id,
        ),
      };
    }),
  };
};
