/**
 * Inspired in easy-ble.js this has been simplied and make a bit more 
 * specific to work in the Physical Web world:
 * https://github.com/evothings/evothings-examples/blob/master/resources/libs/evothings/easyble/easyble.js
 */

if (!Uint8Array.prototype.slice && 'subarray' in Uint8Array.prototype)
  Uint8Array.prototype.slice = Uint8Array.prototype.subarray;

// Object that holds BLE data and functions.
var easyble = {
    
  /**
   * Set to true to report found devices only once,
   * set to false to report continuously.
   */
  reportDeviceOnce: false,
    
  /** Table of discovered devices. */
  knownDevices: {},
    
  /** For FxOS, API manager and BLE adapter */
  manager: navigator.mozBluetooth,
  fxosAdapter: null,
  bleHandle: null,
    
  // Initializes the library either for FirefoxOS or Cordova
  init: function(win, fail) {
    if (easyble.manager != null) { // FirefoxOS
      // Sometimes the adapter is null until the onattributechanged method
      // is invoked. This HACK is required to be sure it is not null:
      // try to use it and if not, wait for the event to arrive. When the
      // adapter is ready invoke the startScan method
      if (easyble.manager.defaultAdapter != null) {
        easyble.fxosAdapter = easyble.manager.defaultAdapter;
        easyble.startScan(win, fail);
      }
      easyble.manager.onattributechanged = function onManagerAttributeChanged(evt) {
        for (var i in evt.attrs) {
          switch (evt.attrs[i]) {
            case 'defaultAdapter':
              console.log("defaultAdapter changed. address:", easyble.manager.defaultAdapter);
              easyble.fxosAdapter = easyble.manager.defaultAdapter;
              easyble.startScan(win ,fail);
              break;
           default:
             break;
          }
        }
      }
    } else { // Cordova
      easyble.startScan(win ,fail);
    }
  },
    
  /**
   * Set to true to report found devices only once,
   * set to false to report continuously.
   */
  reportDeviceOnce: function(reportOnce) {
    reportDeviceOnce = reportOnce;
  },
    
  /** 
   Starts scanning for devices. The win function is invoked when a
   device is detected successfully
   */
  startScan: function(win, fail) {
    easyble.stopScan();
    easyble.knownDevices = {};
    
    if (easyble.manager == null) { // Cordova
      evothings.ble.startScan(function(device) // invokes the ble cordova plugin
      {
        // In the case of Android, we only have the scanRecord, so we need to invoke
        // the ensureAdvertisementData to be sure we always have a valid
        // advertismentData structure (it generates it if it doesn't exist)
        // advertisementData structure is something like:
        // {"kCBAdvDataServiceUUIDs":["fed8"],
        //  "kCBAdvDataServiceData":{"fed8":"AOoCZ29vLmdsLzJienFTUQ=="}}
        uribeacon.ensureAdvertisementData(device);
        device.url = uribeacon.getPhysicalWebUrl(device.advertisementData);
                              
        // We have the device details, let's process it
        easyble.processDevice(win, device);
      },
      function(errorCode) {
        fail(errorCode);
      });
    }
    else { // FirefoxOS
      easyble.fxosAdapter.startLeScan([]).then(function(handle) {
        easyble.bleHandle = handle;
        handle.ondevicefound = function(e) {
                                               
          var device = e.device;
          device.rssi = e.rssi;
          device.scanRecord = e.scanRecord;
          device.address = e.device.address;
                                               
          // As in the case of Android, we only have the scanRecord, so we need to invoke
          // the ensureAdvertisementData to generate the advertismentData structure
          uribeacon.ensureAdvertisementData(device);
          device.url = uribeacon.getPhysicalWebUrl(device.advertisementData);
                                               
          easyble.processDevice(win, device);
        },
        function(errorCode) {
          console.log("Scan operation failed")
          fail(errorCode);
        }
      });
    }
  },
  
  /*
   * Once a device has been detected and it results to be a physical Web device
   * we process its data to refresh an entry if an existing one, ignoring it in case
   * it's configured so or record it in case it's a new device
   */
  processDevice: function(win, device) {
    if (device.url == null) {return;} // No URL = No physical web device
      
    var existingDevice = easyble.knownDevices[device.address];
      
    if (existingDevice) {
      // Do not report device again if flag is set.
      if (easyble.reportDeviceOnce()) { return; }
          
      // Flag not set, report device again.
      existingDevice.rssi = device.rssi;
      //console.log("\n ****** Refresh Device ****************");
      
      win(existingDevice);
      return;
    }
      
    // New device, add to known devices.
    easyble.knownDevices[device.address] = device;

    console.log("\n ****** New Device ****************");
    easyble.logDevice(device);
    
    // Call callback function with device info.
    win(easyble.knownDevices[device.address]);
  },
    
  /** Stop scanning for devices. */
  stopScan: function() {
    if ((easyble.fxosAdapter != null) && (easyble.bleHandle != null)) {
      easyble.fxosAdapter.stopLeScan(easyble.bleHandle);
    }
    else if (easyble.manager == null){
      evothings.ble.stopScan();
    }
  },
  
  /** Logs Device information **/
  logDevice: function(device){
    console.log("\n ****** Device Details ***********" +
                "\n         RSSI: " + device.rssi +
                "\n      Address: " + device.address +
                "\n          URL: " + device.url);
  }
}