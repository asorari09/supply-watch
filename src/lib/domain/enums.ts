import { z } from "zod";

const signalSourceValues = ["weather", "news"] as const;
export const SignalSource = {
  weather: signalSourceValues[0],
  news: signalSourceValues[1],
} as const;
export const signalSourceSchema = z.enum(signalSourceValues);
export type SignalSource = z.infer<typeof signalSourceSchema>;

const signalStatusValues = ["active", "stale", "degraded", "resolved"] as const;
export const SignalStatus = {
  active: signalStatusValues[0],
  stale: signalStatusValues[1],
  degraded: signalStatusValues[2],
  resolved: signalStatusValues[3],
} as const;
export const signalStatusSchema = z.enum(signalStatusValues);
export type SignalStatus = z.infer<typeof signalStatusSchema>;

const severityValues = ["low", "med", "high", "unknown"] as const;
export const Severity = {
  low: severityValues[0],
  med: severityValues[1],
  high: severityValues[2],
  unknown: severityValues[3],
} as const;
export const severitySchema = z.enum(severityValues);
export type Severity = z.infer<typeof severitySchema>;

const shipmentStatusValues = ["in_transit", "delivered", "delayed"] as const;
export const ShipmentStatus = {
  inTransit: shipmentStatusValues[0],
  delivered: shipmentStatusValues[1],
  delayed: shipmentStatusValues[2],
} as const;
export const shipmentStatusSchema = z.enum(shipmentStatusValues);
export type ShipmentStatus = z.infer<typeof shipmentStatusSchema>;

const riskFlagStatusValues = ["open", "ack", "resolved"] as const;
export const RiskFlagStatus = {
  open: riskFlagStatusValues[0],
  ack: riskFlagStatusValues[1],
  resolved: riskFlagStatusValues[2],
} as const;
export const riskFlagStatusSchema = z.enum(riskFlagStatusValues);
export type RiskFlagStatus = z.infer<typeof riskFlagStatusSchema>;

const exposureTypeValues = ["supplier_region", "shipment_route"] as const;
export const ExposureType = {
  supplierRegion: exposureTypeValues[0],
  shipmentRoute: exposureTypeValues[1],
} as const;
export const exposureTypeSchema = z.enum(exposureTypeValues);
export type ExposureType = z.infer<typeof exposureTypeSchema>;

const commsDraftStatusValues = [
  "pending_approval",
  "approved",
  "rejected",
  "sent",
] as const;
export const CommsDraftStatus = {
  pendingApproval: commsDraftStatusValues[0],
  approved: commsDraftStatusValues[1],
  rejected: commsDraftStatusValues[2],
  sent: commsDraftStatusValues[3],
} as const;
export const commsDraftStatusSchema = z.enum(commsDraftStatusValues);
export type CommsDraftStatus = z.infer<typeof commsDraftStatusSchema>;

const alertLevelValues = ["info", "warning", "critical"] as const;
export const AlertLevel = {
  info: alertLevelValues[0],
  warning: alertLevelValues[1],
  critical: alertLevelValues[2],
} as const;
export const alertLevelSchema = z.enum(alertLevelValues);
export type AlertLevel = z.infer<typeof alertLevelSchema>;

const alertDeliveryViaValues = ["dashboard", "webhook"] as const;
export const AlertDeliveryVia = {
  dashboard: alertDeliveryViaValues[0],
  webhook: alertDeliveryViaValues[1],
} as const;
export const alertDeliveryViaSchema = z.enum(alertDeliveryViaValues);
export type AlertDeliveryVia = z.infer<typeof alertDeliveryViaSchema>;

const tickTriggerSourceValues = ["cron", "manual", "inject", "replay"] as const;
export const TickTriggerSource = {
  cron: tickTriggerSourceValues[0],
  manual: tickTriggerSourceValues[1],
  inject: tickTriggerSourceValues[2],
  replay: tickTriggerSourceValues[3],
} as const;
export const tickTriggerSourceSchema = z.enum(tickTriggerSourceValues);
export type TickTriggerSource = z.infer<typeof tickTriggerSourceSchema>;

const tickModeValues = ["live", "replay"] as const;
export const TickMode = {
  live: tickModeValues[0],
  replay: tickModeValues[1],
} as const;
export const tickModeSchema = z.enum(tickModeValues);
export type TickMode = z.infer<typeof tickModeSchema>;

const approvalDecisionValues = ["approved", "rejected"] as const;
export const ApprovalDecision = {
  approved: approvalDecisionValues[0],
  rejected: approvalDecisionValues[1],
} as const;
export const approvalDecisionSchema = z.enum(approvalDecisionValues);
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
