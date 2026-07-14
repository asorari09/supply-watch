declare module "react-simple-maps" {
  import type { CSSProperties, ReactNode } from "react";

  export interface ComposableMapProps {
    width?: number;
    height?: number;
    projection?: string;
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      rotate?: [number, number, number];
    };
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  }

  export interface GeographiesChildrenArgs {
    geographies: Array<{ rsmKey: string; svgPath: string }>;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (args: GeographiesChildrenArgs) => ReactNode;
  }

  export interface GeographyProps {
    geography: { rsmKey: string; svgPath: string };
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    className?: string;
  }

  export interface LineProps {
    from?: [number, number];
    to?: [number, number];
    coordinates?: Array<[number, number]>;
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    className?: string;
    strokeOpacity?: number;
    strokeLinecap?: string;
  }

  export interface SphereProps {
    id?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  }

  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    filterZoomEvent?: (event: unknown) => boolean;
    onMoveStart?: (
      position: { coordinates: [number, number]; zoom: number },
      event: unknown,
    ) => void;
    onMove?: (
      position: {
        x: number;
        y: number;
        zoom: number;
        dragging: unknown;
      },
      event: unknown,
    ) => void;
    onMoveEnd?: (
      position: { coordinates: [number, number]; zoom: number },
      event: unknown,
    ) => void;
    className?: string;
    children?: ReactNode;
  }

  export const ComposableMap: (props: ComposableMapProps) => ReactNode;
  export const Geographies: (props: GeographiesProps) => ReactNode;
  export const Geography: (props: GeographyProps) => ReactNode;
  export const Marker: (props: MarkerProps) => ReactNode;
  export const Line: (props: LineProps) => ReactNode;
  export const Sphere: (props: SphereProps) => ReactNode;
  export const ZoomableGroup: (props: ZoomableGroupProps) => ReactNode;
}
