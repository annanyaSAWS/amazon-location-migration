// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MigrationPlacesService } from "../src/places";
import { MigrationGeocoder } from "../src/geocoder";
import { GeocoderStatus, MigrationLatLngBounds } from "../src/common";

// Spy on console.error so we can verify it gets called in error cases
jest.spyOn(console, "error").mockImplementation(() => {});

// Austin, TX :)
const testPlaceWithAddressLabel = "1337 Cool Place Road, Austin, TX, USA";
const testLat = 30.268193;
const testLng = -97.7457518;

const clientErrorQuery = "THIS_WILL_CAUSE_A_CLIENT_ERROR";

const mockedClientSend = jest.fn((command) => {
  return new Promise((resolve, reject) => {
    if (command instanceof GetPlaceCommand) {
      if (command.input.PlaceId === undefined || command.input.PlaceId === clientErrorQuery) {
        // Return an empty object that will throw an error
        resolve({});
      } else {
        resolve({
          Address: {
            Label: testPlaceWithAddressLabel,
            Country: {
              Code2: "US",
              Code3: "USA",
              Name: "United States",
            },
            Region: {
              Code: "TX",
              Name: "Texas",
            },
            SubRegion: {
              Name: "Cool SubRegion",
            },
            Locality: "Austin",
            District: "Cool District",
            PostalCode: "78704",
            Street: "Cool Place Road",
            AddressNumber: "1337",
          },
          Contacts: {
            Phones: [
              {
                Value: "+15121234567",
              },
            ],
            Websites: [
              {
                Value: "https://coolwebsite.com",
              },
            ],
          },

          OpeningHours: [
            {
              Display: ["Mon-Sun: 00:00 - 24:00"],
              OpenNow: true,
              Components: [
                {
                  OpenTime: "T000000",
                  OpenDuration: "PT24H00M",
                  Recurrence: "FREQ:DAILY;BYDAY:MO,TU,WE,TH,FR,SA,SU",
                },
              ],
            },
          ],
          PlaceId: "KEEP_AUSTIN_WEIRD",
          PlaceType: "PointOfInterest",
          Position: [testLng, testLat],
          TimeZone: {
            Name: "America/Chicago",
            Offset: "-05:00",
            OffsetSeconds: -18000,
          },
          Title: "1337 Cool Place Road",
        });
      }
    } else if (command instanceof ReverseGeocodeCommand) {
      if (command.input.QueryPosition && command.input.QueryPosition[0] == -1 && command.input.QueryPosition[1] == -1) {
        // Return an empty object that will throw an error
        resolve({});
      } else {
        resolve({
          ResultItems: [
            {
              Address: {
                Label: testPlaceWithAddressLabel,
                Country: {
                  Code2: "US",
                  Code3: "USA",
                  Name: "United States",
                },
                Region: {
                  Code: "TX",
                  Name: "Texas",
                },
                SubRegion: {
                  Name: "Cool SubRegion",
                },
                Locality: "Austin",
                District: "Cool District",
                PostalCode: "78704",
                Street: "Cool Place Road",
                AddressNumber: "1337",
              },
              Categories: [
                {
                  Name: "Cool Place",
                  LocalizedName: "Cool Place",
                  Id: "cool_place",
                  Primary: true,
                },
              ],
              MapView: [0, 1, 2, 3],
              PlaceId: "KEEP_AUSTIN_WEIRD",
              PlaceType: "PointOfInterest",
              Position: [testLng, testLat],
              TimeZone: {
                Name: "America/Chicago",
                Offset: "-05:00",
                OffsetSeconds: -18000,
              },
              Title: "1337 Cool Place Road",
            },
          ],
        });
      }
    } else if (command instanceof GeocodeCommand) {
      if (command.input.QueryText == clientErrorQuery) {
        // Return an empty object that will throw an error
        resolve({});
      } else {
        resolve({
          ResultItems: [
            {
              Address: {
                Label: testPlaceWithAddressLabel,
                Country: {
                  Code2: "US",
                  Code3: "USA",
                  Name: "United States",
                },
                Region: {
                  Code: "TX",
                  Name: "Texas",
                },
                SubRegion: {
                  Name: "Cool SubRegion",
                },
                Locality: "Austin",
                District: "Cool District",
                PostalCode: "78704",
                Street: "Cool Place Road",
                AddressNumber: "1337",
              },
              Categories: [
                {
                  Name: "Cool Place",
                  LocalizedName: "Cool Place",
                  Id: "cool_place",
                  Primary: true,
                },
              ],
              MapView: [0, 1, 2, 3],
              PlaceId: "KEEP_AUSTIN_WEIRD",
              PlaceType: "PointOfInterest",
              Position: [testLng, testLat],
              TimeZone: {
                Name: "America/Chicago",
                Offset: "-05:00",
                OffsetSeconds: -18000,
              },
              Title: "1337 Cool Place Road",
            },
          ],
        });
      }
    } else {
      reject();
    }
  });
});

jest.mock("@aws-sdk/client-geo-places", () => ({
  ...jest.requireActual("@aws-sdk/client-geo-places"),
  GeoPlacesClient: jest.fn().mockImplementation(() => {
    return {
      send: mockedClientSend,
    };
  }),
}));
import {
  GeocodeCommand,
  GeocodeCommandInput,
  GeoPlacesClient,
  GetPlaceCommand,
  ReverseGeocodeCommand,
  ReverseGeocodeCommandInput,
} from "@aws-sdk/client-geo-places";

const placesService = new MigrationPlacesService();
placesService._client = new GeoPlacesClient();
MigrationGeocoder.prototype._client = new GeoPlacesClient();
MigrationGeocoder.prototype._placesService = placesService;

afterEach(() => {
  jest.clearAllMocks();
});

test("geocoder should return result when location is specified", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    location: {
      lat: testLat,
      lng: testLng,
    },
  };

  geocoder.geocode(request).then((response) => {
    const results = response.results;

    expect(results.length).toStrictEqual(1);
    const firstResult = results[0];

    expect(mockedClientSend).toHaveBeenCalledTimes(1);
    expect(mockedClientSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));

    expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
    expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
    const returnedLatLng = firstResult.geometry.location;
    expect(returnedLatLng.lat()).toStrictEqual(testLat);
    expect(returnedLatLng.lng()).toStrictEqual(testLng);

    // Signal the unit test is complete
    done();
  });
});

test("geocoder should accept language when specified with location", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    location: {
      lat: testLat,
      lng: testLng,
    },
    language: "en",
  };

  geocoder.geocode(request).then((response) => {
    const results = response.results;

    expect(results.length).toStrictEqual(1);
    const firstResult = results[0];

    expect(mockedClientSend).toHaveBeenCalledTimes(1);
    expect(mockedClientSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));

    const clientInput: ReverseGeocodeCommandInput = mockedClientSend.mock.calls[0][0].input;

    expect(clientInput.Language).toStrictEqual("en");

    expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
    expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
    const returnedLatLng = firstResult.geometry.location;
    expect(returnedLatLng.lat()).toStrictEqual(testLat);
    expect(returnedLatLng.lng()).toStrictEqual(testLng);

    // Signal the unit test is complete
    done();
  });
});

test("geocoder should accept language when specified with address", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    address: testPlaceWithAddressLabel,
    language: "en",
  };

  geocoder.geocode(request).then((response) => {
    const results = response.results;

    expect(results.length).toStrictEqual(1);
    const firstResult = results[0];

    expect(mockedClientSend).toHaveBeenCalledTimes(1);
    expect(mockedClientSend).toHaveBeenCalledWith(expect.any(GeocodeCommand));

    const clientInput: GeocodeCommandInput = mockedClientSend.mock.calls[0][0].input;

    expect(clientInput.Language).toStrictEqual("en");

    expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
    expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
    const returnedLatLng = firstResult.geometry.location;
    expect(returnedLatLng.lat()).toStrictEqual(testLat);
    expect(returnedLatLng.lng()).toStrictEqual(testLng);

    // Signal the unit test is complete
    done();
  });
});

test("geocoder with location will also invoke the callback if specified", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    location: {
      lat: testLat,
      lng: testLng,
    },
  };

  geocoder
    .geocode(request, (results, status) => {
      expect(results.length).toStrictEqual(1);
      const firstResult = results[0];

      expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
      expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
      const returnedLatLng = firstResult.geometry.location;
      expect(returnedLatLng.lat()).toStrictEqual(testLat);
      expect(returnedLatLng.lng()).toStrictEqual(testLng);

      expect(status).toStrictEqual(GeocoderStatus.OK);
    })
    .then((response) => {
      const results = response.results;

      expect(results.length).toStrictEqual(1);
      const firstResult = results[0];

      expect(mockedClientSend).toHaveBeenCalledTimes(1);
      expect(mockedClientSend).toHaveBeenCalledWith(expect.any(ReverseGeocodeCommand));

      expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
      expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
      const returnedLatLng = firstResult.geometry.location;
      expect(returnedLatLng.lat()).toStrictEqual(testLat);
      expect(returnedLatLng.lng()).toStrictEqual(testLng);

      // Signal the unit test is complete
      done();
    });
});

test("geocoder with location should handle client error", (done) => {
  const geocoder = new MigrationGeocoder();

  // [-1, -1] is mocked to cause a client error
  const request: google.maps.GeocoderRequest = {
    location: {
      lat: -1,
      lng: -1,
    },
  };

  geocoder
    .geocode(request, (results, status) => {
      expect(results).toBeNull();
      expect(status).toStrictEqual(GeocoderStatus.UNKNOWN_ERROR);
    })
    .then(() => {})
    .catch((error) => {
      expect(error.status).toStrictEqual(GeocoderStatus.UNKNOWN_ERROR);
      expect(console.error).toHaveBeenCalledTimes(1);

      // Signal the unit test is complete
      done();
    });
});

test("geocoder should return result when placeId is specified", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    placeId: "KEEP_AUSTIN_WEIRD",
  };

  geocoder.geocode(request).then((response) => {
    const results = response.results;

    expect(results.length).toStrictEqual(1);
    const firstResult = results[0];

    expect(mockedClientSend).toHaveBeenCalledTimes(1);
    expect(mockedClientSend).toHaveBeenCalledWith(expect.any(GetPlaceCommand));

    expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
    expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
    const returnedLatLng = firstResult.geometry.location;
    expect(returnedLatLng.lat()).toStrictEqual(testLat);
    expect(returnedLatLng.lng()).toStrictEqual(testLng);

    // Signal the unit test is complete
    done();
  });
});

test("geocoder with placeId will also invoke the callback if specified", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    placeId: "KEEP_AUSTIN_WEIRD",
  };

  geocoder
    .geocode(request, (results, status) => {
      expect(results.length).toStrictEqual(1);
      const firstResult = results[0];

      expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
      expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
      const returnedLatLng = firstResult.geometry.location;
      expect(returnedLatLng.lat()).toStrictEqual(testLat);
      expect(returnedLatLng.lng()).toStrictEqual(testLng);

      expect(status).toStrictEqual(GeocoderStatus.OK);
    })
    .then((response) => {
      const results = response.results;

      expect(results.length).toStrictEqual(1);
      const firstResult = results[0];

      expect(mockedClientSend).toHaveBeenCalledTimes(1);
      expect(mockedClientSend).toHaveBeenCalledWith(expect.any(GetPlaceCommand));

      expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
      expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
      const returnedLatLng = firstResult.geometry.location;
      expect(returnedLatLng.lat()).toStrictEqual(testLat);
      expect(returnedLatLng.lng()).toStrictEqual(testLng);

      // Signal the unit test is complete
      done();
    });
});

test("geocoder with placeId should handle client error", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    placeId: clientErrorQuery,
  };

  geocoder
    .geocode(request, (results, status) => {
      expect(results).toBeNull();
      expect(status).toStrictEqual(GeocoderStatus.UNKNOWN_ERROR);
    })
    .then(() => {})
    .catch((error) => {
      expect(error.status).toStrictEqual(GeocoderStatus.UNKNOWN_ERROR);
      expect(console.error).toHaveBeenCalledTimes(1);

      // Signal the unit test is complete
      done();
    });
});

test("geocoder should return result when address is specified", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    address: testPlaceWithAddressLabel,
  };

  geocoder.geocode(request).then((response) => {
    const results = response.results;

    expect(results.length).toStrictEqual(1);
    const firstResult = results[0];

    expect(mockedClientSend).toHaveBeenCalledTimes(1);
    expect(mockedClientSend).toHaveBeenCalledWith(expect.any(GeocodeCommand));

    expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
    expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
    const returnedLatLng = firstResult.geometry.location;
    expect(returnedLatLng.lat()).toStrictEqual(testLat);
    expect(returnedLatLng.lng()).toStrictEqual(testLng);

    // Signal the unit test is complete
    done();
  });
});

test("geocoder with address will also invoke the callback if specified", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    address: testPlaceWithAddressLabel,
  };

  geocoder
    .geocode(request, (results, status) => {
      expect(results.length).toStrictEqual(1);
      const firstResult = results[0];

      expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
      expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
      const returnedLatLng = firstResult.geometry.location;
      expect(returnedLatLng.lat()).toStrictEqual(testLat);
      expect(returnedLatLng.lng()).toStrictEqual(testLng);

      expect(status).toStrictEqual(GeocoderStatus.OK);
    })
    .then((response) => {
      const results = response.results;

      expect(results.length).toStrictEqual(1);
      const firstResult = results[0];

      expect(mockedClientSend).toHaveBeenCalledTimes(1);
      expect(mockedClientSend).toHaveBeenCalledWith(expect.any(GeocodeCommand));

      expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
      expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
      const returnedLatLng = firstResult.geometry.location;
      expect(returnedLatLng.lat()).toStrictEqual(testLat);
      expect(returnedLatLng.lng()).toStrictEqual(testLng);

      // Signal the unit test is complete
      done();
    });
});

test("geocoder with address should accept bounds when specified", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    address: testPlaceWithAddressLabel,
    bounds: new MigrationLatLngBounds({ east: 0, north: 0, south: 4, west: 4 }),
  };

  geocoder.geocode(request).then((response) => {
    const results = response.results;

    expect(results.length).toStrictEqual(1);
    const firstResult = results[0];

    expect(mockedClientSend).toHaveBeenCalledTimes(1);
    expect(mockedClientSend).toHaveBeenCalledWith(expect.any(GeocodeCommand));

    const clientInput = mockedClientSend.mock.calls[0][0].input;

    expect(clientInput.BiasPosition).toStrictEqual([2, 2]);

    expect(firstResult.formatted_address).toStrictEqual(testPlaceWithAddressLabel);
    expect(firstResult.place_id).toStrictEqual("KEEP_AUSTIN_WEIRD");
    const returnedLatLng = firstResult.geometry.location;
    expect(returnedLatLng.lat()).toStrictEqual(testLat);
    expect(returnedLatLng.lng()).toStrictEqual(testLng);

    // Signal the unit test is complete
    done();
  });
});

test("geocoder with address should handle client error", (done) => {
  const geocoder = new MigrationGeocoder();

  const request: google.maps.GeocoderRequest = {
    address: clientErrorQuery,
  };

  geocoder
    .geocode(request, (results, status) => {
      expect(results).toBeNull();
      expect(status).toStrictEqual(GeocoderStatus.UNKNOWN_ERROR);
    })
    .then(() => {})
    .catch((error) => {
      expect(error.status).toStrictEqual(GeocoderStatus.UNKNOWN_ERROR);
      expect(console.error).toHaveBeenCalledTimes(1);

      // Signal the unit test is complete
      done();
    });
});
