// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GeoRoutesClient,
  RouteMatrixOrigin,
  RouteMatrixDestination,
  CalculateRouteMatrixCommand,
  CalculateRouteMatrixRequest,
  RouteTravelMode,
} from "@aws-sdk/client-geo-routes";

import { MigrationPlacesService } from "../places";

import { DistanceMatrixElementStatus, DistanceMatrixStatus, TravelMode } from "./defines";
import {
  convertKilometersToGoogleDistanceText,
  formatSecondsAsGoogleDurationText,
  parseOrFindLocations,
  populateAvoidOptions,
} from "./helpers";
import { createBoundsFromPositions } from "../common";
import { LngLat } from "maplibre-gl";

// formatted_address needed for originAddresses and destinationAddresses
const DISTANCE_MATRIX_FIND_LOCATION_FIELDS = ["geometry", "formatted_address"];
const KILOMETERS_TO_METERS_CONSTANT = 1000;

export class MigrationDistanceMatrixService {
  _client: GeoRoutesClient;

  // This will be populated by the top level module
  _placesService: MigrationPlacesService;

  getDistanceMatrix(request: google.maps.DistanceMatrixRequest, callback?) {
    return new Promise<google.maps.DistanceMatrixResponse>((resolve, reject) => {
      parseOrFindLocations(request.origins, this._placesService, DISTANCE_MATRIX_FIND_LOCATION_FIELDS)
        .then((originsResponse) => {
          parseOrFindLocations(request.destinations, this._placesService, DISTANCE_MATRIX_FIND_LOCATION_FIELDS)
            .then((destinationsResponse) => {
              // Map origins and destinations
              const origins: RouteMatrixOrigin[] = originsResponse.map((origin) => ({
                Position: origin.position,
              }));

              const destinations: RouteMatrixDestination[] = destinationsResponse.map((destination) => ({
                Position: destination.position,
              }));

              // Combine all positions and convert from [lat,lng] to [lng,lat] using LngLat
              const allPositions: LngLat[] = [
                ...origins.map((origin) => new LngLat(origin.Position[1], origin.Position[0])),
                ...destinations.map((destination) => new LngLat(destination.Position[1], destination.Position[0])),
              ];

              const input: CalculateRouteMatrixRequest = {
                Origins: origins, // required
                Destinations: destinations, // required
                RoutingBoundary: {
                  // required
                  Geometry: {
                    BoundingBox: createBoundsFromPositions(allPositions),
                  },
                  Unbounded: false,
                },
              };

              if ("travelMode" in request) {
                switch (request.travelMode) {
                  case TravelMode.DRIVING: {
                    input.TravelMode = RouteTravelMode.CAR;
                    break;
                  }
                  case TravelMode.WALKING: {
                    input.TravelMode = RouteTravelMode.PEDESTRIAN;
                    break;
                  }
                }
              }

              populateAvoidOptions(request, input);

              // Add departure time if specified
              if (request.drivingOptions?.departureTime) {
                input.DepartureTime = request.drivingOptions.departureTime.toISOString();
              }

              const command = new CalculateRouteMatrixCommand(input);
              this._client
                .send(command)
                .then((response) => {
                  const googleResponse = this._convertAmazonResponseToGoogleResponse(
                    response,
                    originsResponse,
                    destinationsResponse,
                    request,
                  );

                  // if a callback was given, invoke it before resolving the promise
                  if (callback) {
                    callback(googleResponse, DistanceMatrixStatus.OK);
                  }

                  resolve(googleResponse);
                })
                .catch((error) => {
                  console.error(error);

                  reject({
                    status: DistanceMatrixStatus.UNKNOWN_ERROR,
                  });
                });
            })
            .catch((error) => {
              console.error(error);

              reject({
                status: DistanceMatrixStatus.UNKNOWN_ERROR,
              });
            });
        })
        .catch((error) => {
          console.error(error);

          reject({
            status: DistanceMatrixStatus.UNKNOWN_ERROR,
          });
        });
    });
  }

  _convertAmazonResponseToGoogleResponse(
    calculateRouteMatrixResponse,
    originsResponse,
    destinationsResponse,
    request,
  ): google.maps.DistanceMatrixResponse {
    const distanceMatrixResponseRows = [];
    calculateRouteMatrixResponse.RouteMatrix.forEach((row) => {
      const distanceMatrixResponseRow = {
        elements: [],
      };
      row.forEach((cell) => {
        // add element with response data to row
        distanceMatrixResponseRow.elements.push({
          distance: {
            text: convertKilometersToGoogleDistanceText(cell.Distance, request),
            value: cell.Distance * KILOMETERS_TO_METERS_CONSTANT,
          },
          duration: {
            text: formatSecondsAsGoogleDurationText(cell.DurationSeconds),
            value: cell.DurationSeconds,
          },
          status: DistanceMatrixElementStatus.OK,
        });
      });
      distanceMatrixResponseRows.push(distanceMatrixResponseRow);
    });

    // TODO: add destinationAddresses and originAddresses to response using destinationsResponse and originsResponse
    // once PlacesService can reverse geocode (need to retrieve address name for coordinates to add to address arrays)
    const distanceMatrixResponse = {
      originAddresses: [],
      destinationAddresses: [],
      rows: distanceMatrixResponseRows,
    };

    return distanceMatrixResponse;
  }
}
