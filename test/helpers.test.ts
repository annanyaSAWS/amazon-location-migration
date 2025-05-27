// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createBoundsFromPositions } from "../src/common";
import { LngLat } from "maplibre-gl";
import {
  formatDistanceBasedOnUnitSystem,
  getUnitSystemFromLatLong,
  largeNumberFormatter,
  numberFormatter,
} from "../src/directions/helpers";
import { UnitSystem } from "../src/directions";
import { GeoPlacesClient, ReverseGeocodeCommand } from "@aws-sdk/client-geo-places";
import { getReverseGeocodedAddresses } from "../src/directions/helpers";

const mockedPlacesClientSend = jest.fn((command) => {
  return new Promise((resolve, reject) => {
    if (command instanceof ReverseGeocodeCommand) {
      resolve({
        ResultItems: [
          {
            Address: {
              Label: "Test Address",
            },
          },
        ],
      });
    } else {
      reject();
    }
  });
});

jest.mock("@aws-sdk/client-geo-places", () => ({
  ...jest.requireActual("@aws-sdk/client-geo-places"),
  GeoPlacesClient: jest.fn().mockImplementation(() => {
    return {
      send: mockedPlacesClientSend,
    };
  }),
}));

const geoPlacesClient = new GeoPlacesClient();
const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

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

describe("getReverseGeocodedAddresses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /*
  getDistanceMatrix's response has many origins and destinations which may or may not have
  addresses. This is represented by the following matrix:
  Expected Geocode Address Response Matrix
  +------------+-------------+------------+-------------+------------------+
  | Origin1    | Dest1      | Origin2    | Dest2       | Expected Result |
  +------------+-------------+------------+-------------+------------------+
  | correct    | correct    | correct    | correct     | All addresses   |
  | correct    | incorrect  | correct    | correct     | D1 empty        |
  | correct    | correct    | incorrect  | correct     | O2 empty        |
  | correct    | correct    | correct    | incorrect   | D2 empty        |
  | correct    | correct    | incorrect  | incorrect   | O2,D2 empty     |
  | correct    | incorrect  | incorrect  | incorrect   | All empty except O1|
  | incorrect  | incorrect  | incorrect  | incorrect   | All empty       |
  +------------+-------------+------------+-------------+------------------+

  where:
  - correct   = returns valid address
  - incorrect = returns empty string
  - O1,O2     = Origin addresses
  - D1,D2     = Destination addresses
  */

  test("should handle empty positions array", (done) => {
    const mockCallback = jest.fn();

    getReverseGeocodedAddresses(geoPlacesClient, [], mockCallback);

    expect(mockCallback).toHaveBeenCalledWith([]);
    expect(mockedPlacesClientSend).not.toHaveBeenCalled();
    done();
  });

  test("should handle successful reverse geocoding", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() =>
        Promise.resolve({
          ResultItems: [{ Address: { Label: "Test Address 1" } }],
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ResultItems: [{ Address: { Label: "Test Address 2" } }],
        }),
      );

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual(["Test Address 1", "Test Address 2"]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(2);
      done();
    });
  });

  test("should handle missing address in response", (done) => {
    const positions = [[1, 2]];

    mockedPlacesClientSend.mockImplementationOnce(() =>
      Promise.resolve({
        ResultItems: [{}], // No Address object
      }),
    );

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual([""]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(1);
      done();
    });
  });

  test("should handle missing ResultItems in response", (done) => {
    const positions = [[1, 2]];

    mockedPlacesClientSend.mockImplementationOnce(
      () => Promise.resolve({}), // Empty response
    );

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual([""]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(1);
      done();
    });
  });

  test("should handle individual geocoding failures", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() =>
        Promise.resolve({
          ResultItems: [{ Address: { Label: "Test Address" } }],
        }),
      )
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed")));

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual(["Test Address", ""]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error reverse geocoding position:", expect.any(Error));
      done();
    });
  });

  test("should verify ReverseGeocodeCommand parameters", (done) => {
    const positions = [[1, 2]];

    getReverseGeocodedAddresses(geoPlacesClient, positions, () => {
      expect(mockedPlacesClientSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueryPosition: [1, 2],
          },
        }),
      );
      done();
    });
  });

  test("should handle all geocoding requests failing", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
    ];
    // mock all requests to fail
    mockedPlacesClientSend.mockImplementation(() => Promise.reject(new Error("All geocoding failed")));

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      // should get empty strings for all positions
      expect(addresses).toEqual(["", ""]);

      // should have attempted to geocode all positions
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(2);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error reverse geocoding position:", expect.any(Error));
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error in reverse geocoding:", expect.any(Error));

      done();
    });
  });

  test("should handle mixed success and failure with Promise.all", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() =>
        Promise.resolve({
          ResultItems: [{ Address: { Label: "Success Address" } }],
        }),
      )
      .mockImplementation(() => Promise.reject(new Error("Geocoding failed")));

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      // should get one success and two empty strings
      expect(addresses).toEqual(["Success Address", "", ""]);

      // should have attempted all three geocoding requests
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(3);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error reverse geocoding position:", expect.any(Error));

      expect(consoleErrorSpy).not.toHaveBeenCalledWith("Error in reverse geocoding:", expect.any(Error));

      done();
    });
  });

  test("should handle two origins and two destinations - all correct", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin1" } }] }))
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Destination1" } }] }))
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin2" } }] }))
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Destination2" } }] }));

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual(["Origin1", "Destination1", "Origin2", "Destination2"]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(4);
      done();
    });
  });

  test("should handle correct origins with one incorrect destination", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin1" } }] }))
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed"))) // Destination1 fails
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin2" } }] }))
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Destination2" } }] }));

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual(["Origin1", "", "Origin2", "Destination2"]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(4);
      done();
    });
  });

  test("should handle one incorrect origin with correct destinations", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin1" } }] }))
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Destination1" } }] }))
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed"))) // Origin2 fails
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Destination2" } }] }));

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual(["Origin1", "Destination1", "", "Destination2"]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(4);
      done();
    });
  });

  test("should handle correct origins with both destinations incorrect", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin1" } }] }))
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed"))) // Destination1 fails
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin2" } }] }))
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed"))); // Destination2 fails

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual(["Origin1", "", "Origin2", ""]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(4);
      done();
    });
  });

  test("should handle one correct origin with all others incorrect", (done) => {
    const positions = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ];

    mockedPlacesClientSend
      .mockImplementationOnce(() => Promise.resolve({ ResultItems: [{ Address: { Label: "Origin1" } }] }))
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed"))) // Destination1 fails
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed"))) // Origin2 fails
      .mockImplementationOnce(() => Promise.reject(new Error("Geocoding failed"))); // Destination2 fails

    getReverseGeocodedAddresses(geoPlacesClient, positions, (addresses) => {
      expect(addresses).toEqual(["Origin1", "", "", ""]);
      expect(mockedPlacesClientSend).toHaveBeenCalledTimes(4);
      done();
    });
  });
});

describe("getUnitSystemFromLatLong", () => {
  const mockSend = jest.fn();
  const mockClient = {
    send: mockSend,
  } as unknown as GeoPlacesClient;

  beforeEach(() => {
    mockSend.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return IMPERIAL for US coordinates", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [
          {
            Address: {
              Country: {
                Code3: "USA",
              },
            },
          },
        ],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [37.7749, -122.4194], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.IMPERIAL);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return IMPERIAL for Myanmar coordinates", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [
          {
            Address: {
              Country: {
                Code3: "MMR",
              },
            },
          },
        ],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [16.8661, 96.1951], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.IMPERIAL);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return IMPERIAL for Liberia coordinates", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [
          {
            Address: {
              Country: {
                Code3: "LBR",
              },
            },
          },
        ],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [6.328, -10.7969], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.IMPERIAL);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC for UK coordinates", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [
          {
            Address: {
              Country: {
                Code3: "GBR",
              },
            },
          },
        ],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [51.5074, -0.1278], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when country code is missing", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [
          {
            Address: {
              Country: {},
            },
          },
        ],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when address is missing", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [
          {
            Address: {},
          },
        ],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when Address in first ResultItem is null", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [{ Address: null }],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when Country in Address is null", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [{ Address: { Country: null } }],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when ResultItems is empty", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when ResultItems is undefined", (done) => {
    mockSend.mockImplementation(() => Promise.resolve({}));

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when first ResultItem is null", (done) => {
    mockSend.mockImplementation(() =>
      Promise.resolve({
        ResultItems: [null],
      }),
    );

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when Response is empty", (done) => {
    mockSend.mockImplementation(() => Promise.resolve({}));

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when response is null", (done) => {
    mockSend.mockImplementation(() => Promise.resolve(null));

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when response is undefined", (done) => {
    mockSend.mockImplementation(() => Promise.resolve(undefined));

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });

  test("should return METRIC when reverse geocoding fails", (done) => {
    mockSend.mockImplementation(() => Promise.reject(new Error("Geocoding failed")));

    getUnitSystemFromLatLong(mockClient, [0, 0], (unitSystem) => {
      expect(unitSystem).toBe(UnitSystem.METRIC);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));
      done();
    });
  });
});

describe("Number Formatters", () => {
  describe("numberFormatter", () => {
    test("formats one decimal place for numbers < 10", () => {
      expect(numberFormatter.format(1)).toBe("1.0");
      expect(numberFormatter.format(1.23)).toBe("1.2");
      expect(numberFormatter.format(9.874)).toBe("9.9");
    });

    test("formats one decimal place for whole numbers", () => {
      expect(numberFormatter.format(5)).toBe("5.0");
      expect(numberFormatter.format(5.0)).toBe("5.0");
    });

    test("formats one decimal place for zero and negative numbers", () => {
      expect(numberFormatter.format(0)).toBe("0.0");
      expect(numberFormatter.format(-1.23)).toBe("-1.2");
    });
  });

  describe("largeNumberFormatter", () => {
    test("formats large numbers with thousand separators", () => {
      expect(largeNumberFormatter.format(1234)).toBe("1,234");
      expect(largeNumberFormatter.format(1000000)).toBe("1,000,000");
    });

    test("rounds decimals to whole numbers", () => {
      expect(largeNumberFormatter.format(1234.56)).toBe("1,235");
      expect(largeNumberFormatter.format(9999.1)).toBe("9,999");
    });
  });
});

describe("formatDistanceBasedOnUnitSystem", () => {
  describe("metric formatting", () => {
    test("formats distances under 1 km in meters", () => {
      expect(formatDistanceBasedOnUnitSystem(500, { unitSystem: UnitSystem.METRIC })).toBe("500 m");
      expect(formatDistanceBasedOnUnitSystem(950, { unitSystem: UnitSystem.METRIC })).toBe("950 m");
    });

    test("formats distances between 1-10 km with one decimal", () => {
      expect(formatDistanceBasedOnUnitSystem(1500, { unitSystem: UnitSystem.METRIC })).toBe("1.5 km");
      expect(formatDistanceBasedOnUnitSystem(9500, { unitSystem: UnitSystem.METRIC })).toBe("9.5 km");
    });

    test("formats distances between 10-999 km whole numbers with one decimal", () => {
      expect(formatDistanceBasedOnUnitSystem(15000, { unitSystem: UnitSystem.METRIC })).toBe("15.0 km");
      expect(formatDistanceBasedOnUnitSystem(999000, { unitSystem: UnitSystem.METRIC })).toBe("999.0 km");
    });

    test("formats distances 1000 km and above with separators without decimal", () => {
      expect(formatDistanceBasedOnUnitSystem(1500000, { unitSystem: UnitSystem.METRIC })).toBe("1,500 km");
    });
  });

  describe("imperial formatting", () => {
    test("formats distances under 10 miles with one decimal", () => {
      expect(formatDistanceBasedOnUnitSystem(1609.34, { unitSystem: UnitSystem.IMPERIAL })).toBe("1.0 mi");
      expect(formatDistanceBasedOnUnitSystem(12874.72, { unitSystem: UnitSystem.IMPERIAL })).toBe("8.0 mi");
    });

    test("formats distances between 10-999 miles with one decimal", () => {
      expect(formatDistanceBasedOnUnitSystem(16093.4, { unitSystem: UnitSystem.IMPERIAL })).toBe("10.0 mi");
      expect(formatDistanceBasedOnUnitSystem(1207008, { unitSystem: UnitSystem.IMPERIAL })).toBe("750.0 mi");
    });

    test("formats distances 1000 miles and above with separators", () => {
      // 1609344 meters = 1000.000621 miles
      expect(formatDistanceBasedOnUnitSystem(1609345, { unitSystem: UnitSystem.IMPERIAL })).toBe("1,000 mi");
    });
  });
});
