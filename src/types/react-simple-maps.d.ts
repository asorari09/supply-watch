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

  export const ComposableMap: (props: ComposableMapProps) => ReactNode;
  export const Geographies: (props: GeographiesProps) => ReactNode;
  export const Geography: (props: GeographyProps) => ReactNode;
  export const Marker: (props: MarkerProps) => ReactNode;
  export const Line: (props: LineProps) => ReactNode;
  export const Sphere: (props: SphereProps) => ReactNode;
}
