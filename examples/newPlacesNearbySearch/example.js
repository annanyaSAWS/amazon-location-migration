// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// This example showcases the New Place nearbySearch API, as well as drawing a circle on a Google Map.
// The example draws a circle on the map, for which the radius can be scaled dynamically.
// The user can choose from different place type categories, and then perform a nearbySearch,
// which will return any places matching the specified type within the circle radius.
// This example also makes use of dynamic imports and advanced markers support.
//
// This is meant to be showcased as the client logic that is able to remain untouched
// and retain the same functionality when using the Amazon Location Migration SDK.

let map;
let markers = [];
let searchCircle;

function initMap() {
  const austinCoords = new google.maps.LatLng(30.268193, -97.7457518); // Austin, TX :)

  map = new google.maps.Map(document.getElementById("map"), {
    center: austinCoords,
    zoom: 13,
    mapId: "DEMO_MAP_ID",
  });

  // Initialize the circle
  searchCircle = new google.maps.Circle({
    strokeColor: "#146eb4",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#146eb4",
    fillOpacity: 0.15,
    map,
    center: austinCoords,
    radius: 1500,
  });

  // Add radius slider listener
  const radiusSlider = document.getElementById("radius");
  const radiusValue = document.getElementById("radius-value");

  radiusSlider.addEventListener("input", () => {
    const radius = parseInt(radiusSlider.value);
    radiusValue.textContent = `${radius}m`;
    if (searchCircle) {
      searchCircle.setRadius(radius);
    }
  });

  // Move the circle to stay on the center of the map
  map.addListener("center_changed", () => {
    if (searchCircle) {
      searchCircle.setCenter(map.getCenter());
    }
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setCenter(userLocation);
        if (searchCircle) {
          searchCircle.setCenter(userLocation);
        }
      },
      () => {
        console.log("Error: The Geolocation service failed.");
      },
    );
  }
}

async function searchNearbyPlaces() {
  const { Circle } = await google.maps.importLibrary("maps");
  const { Place } = await google.maps.importLibrary("places");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  // Clear any existing markers
  markers.forEach((marker) => marker.setMap(null));
  markers = [];

  const radius = parseInt(document.getElementById("radius").value);
  const center = map.getCenter();

  const circle = new Circle({
    center: center,
    radius: radius,
  });

  const request = {
    locationRestriction: circle,
    fields: ["*"],
    includedTypes: [document.getElementById("place-type").value],
  };

  const { places } = await Place.searchNearby(request);

  if (places.length) {
    places.forEach((place) => {
      if (place.location) {
        const marker = new AdvancedMarkerElement({
          map,
          position: place.location,
          title: place.displayName,
        });

        markers.push(marker);

        // Add click listener for info window
        marker.addListener("click", () => {
          const infowindow = new google.maps.InfoWindow({
            content: `<strong>${place.displayName}</strong><br>
                      Address: ${place.formattedAddress || "N/A"}<br>
                      Website: ${
                        place.websiteURI
                          ? `<a href="${place.websiteURI}" target="_blank">${place.websiteURI}</a>`
                          : "N/A"
                      }<br>
                      Phone Number: ${place.nationalPhoneNumber || "N/A"}
                      `,
          });
          infowindow.open(map, marker);
        });
      }
    });
  }
}
