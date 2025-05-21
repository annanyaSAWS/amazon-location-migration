// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createBoundsFromPositions } from "../src/common";
import { LngLat } from "maplibre-gl";

describe("createBoundsFromPositions", () => {
  test("should return correct bounds for multiple positions", () => {
    const positions: LngLat[] = [
      new LngLat(-122.4194, 37.7749), // San Francisco
      new LngLat(-74.006, 40.7128), // New York
      new LngLat(-87.6298, 41.8781), // Chicago
    ];

    const result = createBoundsFromPositions(positions);

    expect(result).toEqual([-122.4194, 37.7749, -74.006, 41.8781]);
  });

  test("should handle single position", () => {
    const positions: LngLat[] = [
      new LngLat(-122.4194, 37.7749), // San Francisco
    ];

    const result = createBoundsFromPositions(positions);

    expect(result).toEqual([-122.4194, 37.7749, -122.4194, 37.7749]);
  });

  test("should handle positions in different quadrants", () => {
    const positions: LngLat[] = [
      new LngLat(-122.4194, 37.7749), // San Francisco (Northwest)
      new LngLat(151.2093, -33.8688), // Sydney (Southeast)
      new LngLat(139.6917, 35.6895), // Tokyo (Northeast)
      new LngLat(-58.3816, -34.6037), // Buenos Aires (Southwest)
    ];

    const result = createBoundsFromPositions(positions);

    expect(result).toEqual([-122.4194, -34.6037, 151.2093, 37.7749]);
  });

  test("should throw error for empty array", () => {
    expect(() => createBoundsFromPositions([])).toThrow();
  });
});
