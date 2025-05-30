// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Position } from "geojson";

export type CountryGeoJSON = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: {
      coordinates: Position[][] | Position[][][];
      type: "Polygon" | "MultiPolygon";
    };
  }>;
};
