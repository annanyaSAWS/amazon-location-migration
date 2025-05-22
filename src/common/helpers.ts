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

/**
 * Creates a bounding box that encompasses all provided positions. Returns coordinates in the format
 * [southwest_longitude, southwest_latitude, northeast_longitude, northeast_latitude] suitable for use with Amazon
 * Location Service.
 *
 * @example Const positions = [ new LngLat(-122.4194, 37.7749), // San Francisco new LngLat(-74.0060, 40.7128) // New
 * York ]; const bounds = createBoundsFromPositions(positions); // returns [-122.4194, 37.7749, -74.0060, 40.7128]
 *
 * @param positions - Array of positions in [longitude, latitude] format
 * @returns Four numbers representing the bounding box corners: [southwest_longitude, southwest_latitude,
 *   northeast_longitude, northeast_latitude]
 */
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
