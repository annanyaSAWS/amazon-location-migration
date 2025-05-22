// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createBoundsFromPositions } from "../src/common";
import { LngLat } from "maplibre-gl";
import { getUnitSystemFromLatLong } from "../src/directions/helpers";
import { UnitSystem } from "../src/directions";
import { GeoPlacesClient, ReverseGeocodeCommand } from "@aws-sdk/client-geo-places";

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


describe('getUnitSystemFromLatLong', () => {
  const mockSend = jest.fn();
  const mockClient = {
    send: mockSend
  } as unknown as GeoPlacesClient;

  beforeEach(() => {
    mockSend.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return IMPERIAL for US coordinates', (done) => {
    mockSend.mockImplementation(() => Promise.resolve({
      ResultItems: [{
        Address: {
          Country: {
            Code3: 'USA'
          }
        }
      }]
    }));

    getUnitSystemFromLatLong(mockClient, [37.7749, -122.4194], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.IMPERIAL);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(ReverseGeocodeCommand)
      );
      done();
    });
  });

  test('should return IMPERIAL for Myanmar coordinates', (done) => {
    mockSend.mockImplementation(() => Promise.resolve({
      ResultItems: [{
        Address: {
          Country: {
            Code3: 'MMR'
          }
        }
      }]
    }));

    getUnitSystemFromLatLong(mockClient, [16.8661, 96.1951], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.IMPERIAL);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(ReverseGeocodeCommand)
      );
      done();
    });
  });

  test('should return IMPERIAL for Liberia coordinates', (done) => {
    mockSend.mockImplementation(() => Promise.resolve({
      ResultItems: [{
        Address: {
          Country: {
            Code3: 'LBR'
          }
        }
      }]
    }));

    getUnitSystemFromLatLong(mockClient, [6.3280, -10.7969], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.IMPERIAL);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(ReverseGeocodeCommand)
      );
      done();
    });
  });

  test('should return METRIC for UK coordinates', (done) => {
    mockSend.mockImplementation(() => Promise.resolve({
      ResultItems: [{
        Address: {
          Country: {
            Code3: 'GBR'
          }
        }
      }]
    }));

    getUnitSystemFromLatLong(mockClient, [51.5074, -0.1278], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(ReverseGeocodeCommand)
      );
      done();
    });
  });

  test('should return METRIC when country code is missing', (done) => {
    mockSend.mockImplementation(() => Promise.resolve({
      ResultItems: [{
        Address: {
          Country: {}
        }
      }]
    }));

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(ReverseGeocodeCommand)
      );
      done();
    });
  });

  test('should return METRIC when reverse geocoding fails', (done) => {
    mockSend.mockImplementation(() => Promise.reject(new Error('Geocoding failed')));

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(ReverseGeocodeCommand)
      );
      expect(console.error).toHaveBeenCalled();
      done();
    });
  });
});

