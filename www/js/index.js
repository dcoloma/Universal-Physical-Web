// Generic BLE scanner - works in FxOS and cordova compatible devices
// via the ble plugin

var app = {
    
  // *** Configuration Parameters ***
  
  FIREBASE_URL: 'https://phyweb.firebaseio.com/Beacons/', // Firebase URL
  showClosestDevice: true, // If true Shows directly the URL of the closest device
                           // If not, it shows a landing page with all the found devices
  showDeviceURL: true,
  reporting: false,
  
  // *** End of Configuration Parameters ***
    
  // *** Global attributes ***
    
  closestDevice: null,
  closestDeviceData: null,
  knownDevices: {}, // Array with all the known devices
  knownDevicesData: {}, // Array with all the devices metadata
  
  topBeacon: null, // list element where nodes are appended
  
  // *** End of Global attributes ***
    
  // Triggered when page loads, in case of FxOS we directly launch the scan
  // process. Otherwise we are using cordova and hence we launch all the
  // cordova machinery
  onLoad: function() {
    topBeacon = document.getElementById("beacon-list");
    if (navigator.mozBluetooth){
      app.lookForBeacons();
    } else {
      document.addEventListener("deviceready", app.onDeviceReady(), false);
    }
  },
    
  // *** Cordova initialization ***** //
    
  onDeviceReady: function() {
    app.receivedEvent('deviceready');
  },
    
  receivedEvent: function(id) {
    this.lookForBeacons(); // ready to start scanning
  },
    
  // *** End of Cordova initialization ***** //
  
  // Triggers the scanning process
  lookForBeacons: function(){
    easyble.reportDeviceOnce(true); // So that devices are reported continuously
    easyble.init(
      function(device) { // Success callback invoked when a device is found or RSSI changes
        // Check if it's a PhyWeb device. If the device URL is not null it means
        // it is a physical Web device.
        if (device.url != null) {
          // Nasty hack, in case the URL has been shortened (the phyweb app does that)
          // let's ensure it uses https so redirects to Firebase works properly
          // i.e. we cannot go from http (goog.gl) to https (firebase).
          device.url = device.url.replace("http\:\/\/goo.gl", "https\:\/\/goo.gl");
                 
          // In this case we just load the Web Page of the closest device
          if (app.showClosestDevice){
            if (app.showDeviceURL) {
              // That can be directly the one stored in the beacon
              app.knownDevices[device.address] = device;
              app.showClosestDeviceURL(device);
            } else {
              // Or one extracted from a Firebase node (that is the one stored in the beacon)
              // Need to connect to Firebase via XHR
              app.sendRequest(device.url, app.makeXHRCallback(device), null);
            }
          }
          else { // In this case we just add the device to the list of devices shown
            if (app.showDeviceURL){
              // The URL is the one directly stored in the beacon
              app.addDeviceItem(device);
            } else {
              // The URL in the beacon is a Firebase node pointer. Let's connect
              // and get the real info
              app.sendRequest(device.url, app.makeXHRCallback(device), null);
            }
          }
        }
      },
      function(errorCode) {
        console.log('Scan failed ' + errorCode);
      }
    );
  },
   
  // Closure to receive callbacks from Firebase requests, we just add
  // a metadata field to the device that will be processed later on
  makeXHRCallback: function(device) {
    return function(req){
      app.knownDevices[device.address] = device;
            
      device.metadata = req.responseText;
      app.knownDevices[device.address].metadata = device.metadata;
      
      // In this case we just load the Web Page of the closest device
      if (app.showClosestDevice){
        app.showClosestDeviceURL(device)
      } else { // otherwise we add the device to the list
        app.addDeviceItem(device);
      }
    }
  },
  
  // This function process the detected device and decides whether it's
  // the closest or not in order to show it as the closest one. This
  // function should be only called if the showClosestDevice config
  // parameter is true
  showClosestDeviceURL: function(device) {
    var previousDevice = app.closestDevice || "";
    
    // The closest is the one we have just detected, let's update it
    if ((app.closestDevice == null) ||
        (app.knownDevices[device.address].rssi >= app.closestDevice.rssi)) {
      app.closestDevice = app.knownDevices[device.address];
      app.closestDevice.metadata = device.metadata || "";
    }
    
    // There has been a change in the closest, need to udpate it
    // This is to avoid continuously refreshing the view if the same
    // device is reported continuously as the closest
    if (previousDevice.address != app.closestDevice.address) {
      if (app.showClosestDevice) { // Otherwise we should not be here
        if (app.showDeviceURL) { // we use the device url
          app.openUrl(app.closestDevice.url, app.closestDevice.address);
        } else { // we use the one retrieved via Firebase
          data = JSON.parse(app.closestDevice.metadata);
          app.openUrl(data.url, app.closestDevice.address);
        }
      }
    }
  },
  
  // Updates the list of devices with the detected one. This
  // function should be only called if the showClosestDevice config
  // parameter is false
  addDeviceItem: function(device) {
    deviceItem = document.getElementById(device.address);
    
    // If the device was not painted before, let's add it, otherwise
    // let's udpate its power (RSSI)
    if (deviceItem == null){
      topBeacon.innerHTML += app.getBeaconListItem(device);
    } else {
      deviceItem.getElementsByClassName("list-power")[0].innerHTML = "(" +device.rssi + ")";
    }
  },
    
  // Create the list item with the beacon configuration
  getBeaconListItem: function(device){
    var url = device.url;
    var label = device.name;
    var image = "img/ScanError.png";
    
    if (device.metadata != null){
      config = JSON.parse(device.metadata);
      url = config.url || device.url;
      label = config.label || device.name;
      image = config.image || image;
    }
    
    item = '<a href="javascript:app.openUrl(\'' + url + '\')"><div class="list-item" id="' + device.address + '" >' +
      '<div class="list-id">' +
      '<img class="list-icon" src="' + image +'" alt="">' +
      '<span class="list-header-light">ID: </span>' +
      url +
      '</div>' +
      '<div class="list-name">' +
      '<span class="list-header-light">Name: </span>'+ label +
      '<div class="list-power">(' + device.rssi + ' dB)</div>' +
      '</div></div></a>';
    return item;
  },
    
  // Opens a URL
  openUrl: function(url, deviceId){
    // Apart from opening the URL we are going to store some stats
    app.updateVisitCount(deviceId);
    window.open(url, '_blank', 'location=yes');
  },
  
  // **** Report number of clicks via Firebase Database *** //
  
  // Adds a new record for the 'click' event on the URL and increases total visits
  updateVisitCount: function(deviceId) {
    if (app.reporting) {
      app.addVisitRecord(deviceId);
      app.increaseVisitCount(deviceId);
    }
  },
    
  addVisitRecord: function(deviceId) {
    if (app.reporting) {
      var firebase = new Firebase(app.FIREBASE_URL + deviceId + "/visits/");
      firebase.push({ // We add one registry per visit
        //visitor: window.device.uuid,
        date: new Date().getTime()
      });
    }
  },
    
  increaseVisitCount: function(deviceId) {
    if (app.reporting) {
      var totalVisits = new Firebase(app.FIREBASE_URL + deviceId + "/totalVisits");
      totalVisits.transaction(function (current_value) {
        return (current_value || 0) + 1;
      });
    }
  },
  // **** End of Report number of clicks via Firebase Database *** //

  // *** XHR super simplified functions ***
  
  // used to connect to Firebase data schema in case the URL stored in
  // the beacon is just a pointer to a Firebase node with all the information
  sendRequest: function(url, callback, postData) {
    var req = app.createXMLHTTPObject();
    if (!req) return;
    req.open("GET", url, true);
    req.setRequestHeader('User-Agent','XMLHTTP/1.0');

    req.onreadystatechange = function () {
      if (req.readyState != 4) return;
      if (req.status != 200 && req.status != 304) {
        return;
      }
      callback(req);
    }
    if (req.readyState == 4) return;
    req.send(null);
  },
    
  createXMLHTTPObject: function() {
    var xmlhttp = false;
    for (var i=0;i<app.XMLHttpFactories.length;i++) {
      try {
        xmlhttp = app.XMLHttpFactories[i]();
      }
      catch (e) {
        continue;
      }
      break;
    }
    return xmlhttp;
  },
    
  XMLHttpFactories : [
    function () {return new XMLHttpRequest({mozSystem: true})},
    function () {return new ActiveXObject("Msxml2.XMLHTTP")},
    function () {return new ActiveXObject("Msxml3.XMLHTTP")},
    function () {return new ActiveXObject("Microsoft.XMLHTTP")}
  ]
    
  // *** End of XHR libraries ***
};

