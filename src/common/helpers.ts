// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ControlPosition, LngLat, LngLatBounds } from "maplibre-gl";

import { GoogleToMaplibreControlPosition } from "./defines";

export const convertGoogleControlPositionToMapLibre = (controlPosition: number | null): ControlPosition | null => {
  if (!controlPosition) {
    return null;
  }

  if (controlPosition in GoogleToMaplibreControlPosition) {
    return GoogleToMaplibreControlPosition[controlPosition];
  }

  // If we reach here, we don't have a mapping for this control position
  console.warn("Unsupported controlPosition:", controlPosition);
  return null;
};

export function createBoundsFromPositions(positions: LngLat[]): [number, number, number, number] {
  const bounds = new LngLatBounds();

  positions.forEach((position) => {
    bounds.extend(position);
  });

  return [
    bounds.getWest(), // southwest longitude
    bounds.getSouth(), // southwest latitude
    bounds.getEast(), // northeast longitude
    bounds.getNorth(), // northeast latitude
  ];
}
