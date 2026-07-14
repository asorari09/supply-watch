"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
  Sphere,
  ZoomableGroup,
} from "react-simple-maps";

import type { DashboardNetwork, Severity } from "@/lib/dashboard/map-model";

import styles from "./page.module.css";

const GEO_URL = "/world-countries-110m.json";
const WIDTH = 880;
const HEIGHT = 340;
const DEFAULT_CENTER: [number, number] = [12, 18];
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.35;

const SEVERITY_FILL: Record<Severity, string> = {
  high: "#E5484D",
  med: "#F5A623",
  low: "#7B75E8",
  unknown: "#8A90A2",
};

const pinFill = (severity: Severity | null): string =>
  severity === null ? "#8B93A5" : SEVERITY_FILL[severity];

const routeStroke = (severity: Severity | null, atRisk: boolean): string => {
  if (!atRisk || severity === null) return "#C4C9D4";
  return SEVERITY_FILL[severity];
};

type MapPosition = {
  coordinates: [number, number];
  zoom: number;
};

export const RegionRiskMap = ({ network }: { network: DashboardNetwork }) => {
  const dest = network.destination;
  const [position, setPosition] = useState<MapPosition>({
    coordinates: DEFAULT_CENTER,
    zoom: MIN_ZOOM,
  });

  const zoomIn = () => {
    setPosition((current) => ({
      ...current,
      zoom: Math.min(MAX_ZOOM, Number((current.zoom * ZOOM_STEP).toFixed(2))),
    }));
  };

  const zoomOut = () => {
    setPosition((current) => ({
      ...current,
      zoom: Math.max(MIN_ZOOM, Number((current.zoom / ZOOM_STEP).toFixed(2))),
    }));
  };

  const resetView = () => {
    setPosition({ coordinates: DEFAULT_CENTER, zoom: MIN_ZOOM });
  };

  return (
    <figure className={styles.mapFigure}>
      <div className={styles.mapOverlay}>
        Network status: {network.networkHealthPercent}% healthy
      </div>
      <div
        className={styles.mapZoomControls}
        role="group"
        aria-label="Map zoom"
      >
        <button
          aria-label="Zoom in"
          className={styles.mapZoomButton}
          disabled={position.zoom >= MAX_ZOOM}
          onClick={zoomIn}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          className={styles.mapZoomButton}
          disabled={position.zoom <= MIN_ZOOM}
          onClick={zoomOut}
          type="button"
        >
          -
        </button>
        <button
          aria-label="Reset map view"
          className={styles.mapZoomButton}
          onClick={resetView}
          type="button"
        >
          Reset
        </button>
      </div>
      <ComposableMap
        className={styles.mapSvg ?? "mapSvg"}
        height={HEIGHT}
        projection="geoNaturalEarth1"
        projectionConfig={{
          scale: 155,
          center: DEFAULT_CENTER,
        }}
        width={WIDTH}
      >
        <ZoomableGroup
          center={position.coordinates}
          maxZoom={MAX_ZOOM}
          minZoom={MIN_ZOOM}
          onMoveEnd={(next) => {
            setPosition({
              coordinates: next.coordinates,
              zoom: next.zoom,
            });
          }}
          zoom={position.zoom}
        >
          <Sphere
            fill="#F7F8FA"
            id="ocean"
            stroke="#E6E8EC"
            strokeWidth={0.5}
          />
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  geography={geo}
                  key={geo.rsmKey}
                  style={{
                    default: {
                      fill: "#E8EBF0",
                      stroke: "#FFFFFF",
                      strokeWidth: 0.45,
                      outline: "none",
                    },
                    hover: {
                      fill: "#E8EBF0",
                      stroke: "#FFFFFF",
                      strokeWidth: 0.45,
                      outline: "none",
                    },
                    pressed: {
                      fill: "#E8EBF0",
                      stroke: "#FFFFFF",
                      strokeWidth: 0.45,
                      outline: "none",
                    },
                  }}
                />
              ))
            }
          </Geographies>

          {network.routes.map((route) => (
            <Line
              from={[route.fromLon, route.fromLat]}
              key={route.id}
              stroke={routeStroke(route.activeSeverity, route.atRisk)}
              strokeLinecap="round"
              strokeOpacity={route.atRisk ? 0.85 : 0.55}
              strokeWidth={1.5}
              to={[route.toLon, route.toLat]}
            />
          ))}

          {dest === null ? null : (
            <Marker coordinates={[dest.lon, dest.lat]}>
              <g>
                <rect
                  fill="#7B75E8"
                  height={12}
                  rx={1.5}
                  stroke="#FFFFFF"
                  strokeWidth={1.25}
                  transform="rotate(45)"
                  width={12}
                  x={-6}
                  y={-6}
                />
                <text
                  className={styles.mapLabel}
                  dominantBaseline="hanging"
                  textAnchor="middle"
                  y={14}
                >
                  Destination
                </text>
              </g>
            </Marker>
          )}

          {network.regions.map((region) => (
            <Marker
              coordinates={[region.lon, region.lat]}
              key={region.regionCode}
            >
              <g>
                {region.activeSeverity === null ? null : (
                  <circle
                    cx={0}
                    cy={0}
                    fill={pinFill(region.activeSeverity)}
                    fillOpacity={0.22}
                    r={11}
                  />
                )}
                <circle
                  cx={0}
                  cy={0}
                  fill={pinFill(region.activeSeverity)}
                  r={5}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
                <text className={styles.mapLabel} textAnchor="middle" y={-12}>
                  {region.label}
                </text>
              </g>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
      <div className={styles.mapLegend}>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinHigh}`} /> High
        </span>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinMed}`} /> Medium
        </span>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinLow}`} /> Low
        </span>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinHealthy}`} />{" "}
          Clear
        </span>
      </div>
      {network.totalRegionCount === 0 ? (
        <figcaption className={styles.mapEmpty}>
          No supplier locations available to map.
        </figcaption>
      ) : (
        <figcaption className={styles.mapCaption}>
          {network.regions.filter((r) => r.activeSeverity !== null).length} of{" "}
          {network.totalRegionCount} supplier regions disrupted ·{" "}
          {network.disruptedRouteCount} routes at risk
        </figcaption>
      )}
    </figure>
  );
};
