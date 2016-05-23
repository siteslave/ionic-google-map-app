'use strict';

angular.module('starter.Map', [])
  .controller('MapCtrl', function ($scope, $rootScope, $log, $cordovaGeolocation, $cordovaLaunchNavigator,
    ConnectivityMonitor, $ionicPlatform, $ionicLoading) {

    $ionicPlatform.ready(function () {
      //GoogleMaps.init();

      $scope.launchNavigator = function () {
        var destination = [$scope.cLat, $scope.cLng];
        var start = [$scope.lat, $scope.lng];
        $cordovaLaunchNavigator.navigate(destination, start).then(function () {
          console.log("Navigator launched");
        }, function (err) {
          console.error(err);
        });
      };

      var apiKey = false;
      $scope.map = null;
      $scope.markers = [];
      $scope.currentLatLng = null;
      $scope.destinationLatLng = null;

      $scope.directionsService = null;
      $scope.directionsDisplay = null;

      $scope.searchBox = null;

      function enableMap() {
        $ionicLoading.hide();
      }

      function disableMap() {
        $ionicLoading.show({
          template: 'กรุณาเชื่อมต่ออินเตอร์เน็ต'
        });
      }

      function loadGoogleMaps() {

        $ionicLoading.show({
          template: '<ion-spinner icon="android"></ion-spinner>'
        });

        //This function will be called once the SDK has been loaded
        window.mapInit = function () {
          initMap();
        };

        //Create a script element to insert into the page
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.id = "googleMaps";

        //Note the callback function in the URL is the one we created above
        if (apiKey) {
          script.src = 'https://maps.google.com/maps/api/js?key=' + apiKey
            + '&language=th&libraries=places&callback=mapInit';
        }
        else {
          script.src = 'https://maps.google.com/maps/api/js?language=th&&libraries=places&callback=mapInit';
        }

        document.body.appendChild(script);

      }

      function checkLoaded() {
        if (typeof google == "undefined" || typeof google.maps == "undefined") {
          loadGoogleMaps();
        } else {
          enableMap();
        }
      }

      function addConnectivityListeners() {

        if (ionic.Platform.isWebView()) {

          // Check if the map is already loaded when the user comes online,
          //if not, load it
          $rootScope.$on('$cordovaNetwork:online', function (event, networkState) {
            checkLoaded();
          });

          // Disable the map when the user goes offline
          $rootScope.$on('$cordovaNetwork:offline', function (event, networkState) {
            disableMap();
          });

        }
        else {

          //Same as above but for when we are not running on a device
          window.addEventListener("online", function (e) {
            checkLoaded();
          }, false);

          window.addEventListener("offline", function (e) {
            disableMap();
          }, false);
        }

      }

      function initMap() {

        var options = { timeout: 10000, enableHighAccuracy: true };

        var input = document.getElementById('search-box');
        $scope.searchBox = new google.maps.places.SearchBox(input);

        $cordovaGeolocation.getCurrentPosition(options)
          .then(function (position) {

            $scope.cLat = position.coords.latitude;
            $scope.cLng = position.coords.longitude;

            $scope.currentLatLng = new google.maps.LatLng(position.coords.latitude,
              position.coords.longitude);

            var mapOptions = {
              center: $scope.currentLatLng,
              zoom: 18,
              mapTypeId: google.maps.MapTypeId.HYBRID
            };

            $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);

            $scope.directionsService = new google.maps.DirectionsService;
            $scope.directionsDisplay = new google.maps.DirectionsRenderer;

            // set search box
            $scope.map.addListener('bounds_changed', function () {
              $scope.searchBox.setBounds($scope.map.getBounds());
            });

            $scope.searchBox.addListener('places_changed', function () {
              var places = $scope.searchBox.getPlaces();

              if (places.length == 0) {
                return;
              }

              var bounds = new google.maps.LatLngBounds();
              places.forEach(function (place) {
                var icon = {
                  url: place.icon,
                  size: new google.maps.Size(71, 71),
                  origin: new google.maps.Point(0, 0),
                  anchor: new google.maps.Point(17, 34),
                  scaledSize: new google.maps.Size(25, 25)
                };

                // Create a marker for each place.
                $scope.markers.push(new google.maps.Marker({
                  map: $scope.map,
                  icon: icon,
                  title: place.name,
                  position: place.geometry.location
                }));

                if (place.geometry.viewport) {
                  // Only geocodes have viewport.
                  bounds.union(place.geometry.viewport);
                } else {
                  bounds.extend(place.geometry.location);
                }
              });
              $scope.map.fitBounds(bounds);
            });

            //Wait until the map is loaded
            google.maps.event.addListenerOnce($scope.map, 'idle', function () {
              //loadMarkers();
              enableMap();

              // Google map click event
              google.maps.event.addListener($scope.map, 'click', function (event) {
                //infoWindow.open($scope.map, marker);

                $scope.clearMarkers();

                var marker = new google.maps.Marker({
                  map: $scope.map,
                  animation: google.maps.Animation.DROP,
                  position: event.latLng
                });

                $scope.destinationLatLng = event.latLng;

                $scope.markers.push(marker);

                var positions = JSON.stringify(event);
                var newPositions = JSON.parse(positions);

                var latLng = newPositions.latLng;
                $scope.lat = latLng.lat;
                $scope.lng = latLng.lng;

                $scope.$apply();

                //$log.info(event.latLng.lng);

              });

            });

          }, function (error) {
            console.log("Could not get location");
          });

      }

      $scope.clearMarkers = function () {
        //clear direction
        $scope.directionsDisplay.setMap(null);
        while($scope.markers.length){
            $scope.markers.pop().setMap(null);
        }
      };

      $scope.routeMap = function () {

        $scope.clearMarkers();

        $scope.directionsDisplay.setMap($scope.map);

        $scope.directionsService.route({
          origin: $scope.currentLatLng,
          destination: $scope.destinationLatLng,
          travelMode: google.maps.TravelMode.DRIVING
        }, function (response, status) {
          if (status === google.maps.DirectionsStatus.OK) {
            $scope.directionsDisplay.setDirections(response);
          } else {
            window.alert('Directions request failed due to ' + status);
          }
        });

      };

      if (typeof google == "undefined" || typeof google.maps == "undefined") {

        console.warn("Google Maps SDK ยังไม่พร้อมใช้งาน");

        disableMap();

        if (ConnectivityMonitor.isOnline()) {
          loadGoogleMaps();
        }
      } else {
        if (ConnectivityMonitor.isOnline()) {
          initMap();
          enableMap();
        } else {
          disableMap();
        }
      }

      addConnectivityListeners();

    });

    $scope.goCurrent = function () {
      $ionicPlatform.ready(function () {
        var options = { timeout: 10000, enableHighAccuracy: true };

        $cordovaGeolocation.getCurrentPosition(options)
          .then(function (position) {

            var currentLatLng = new google.maps.LatLng(position.coords.latitude,
              position.coords.longitude);

            $scope.map.setCenter(currentLatLng);

          });
      });
    };

  })

  .factory('ConnectivityMonitor', function ($rootScope, $cordovaNetwork) {

    return {
      isOnline: function () {

        if (ionic.Platform.isWebView()) {
          return $cordovaNetwork.isOnline();
        } else {
          return navigator.onLine;
        }

      },
      ifOffline: function () {

        if (ionic.Platform.isWebView()) {
          return !$cordovaNetwork.isOnline();
        } else {
          return !navigator.onLine;
        }

      }
    }
  });