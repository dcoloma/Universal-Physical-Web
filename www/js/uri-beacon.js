/** 
  Contains a set of utilities for decoding BLE devices and in
  particular Physical Web ones
 */
var uribeacon = {
    
   PHYWEBKEY: "FED8",
    
  /**
   * If device already has advertisementData, does nothing.
   * If device instead has scanRecord, creates advertisementData.
   * See ble.js for AdvertisementData reference.
   * @param device - Device object.
   * @private
   */
  ensureAdvertisementData: function(device) {
    // If device object already has advertisementData we
    // do not need to parse the scanRecord.
    if (device.advertisementData) { return; }
  
    // Must have scanRecord yo continue.
    if (!device.scanRecord) { return; }
  
    // Here we parse BLE/GAP Scan Response Data.
    // See the Bluetooth Specification, v4.0, Volume 3, Part C, Section 11,
    // for details.
  
    // In FirefoxOS the scanRecord is ArrayBuffer whereas in cordova the
    // scanRecord is a base64 String, so we need to parse it in different
    // ways
    if (easyble.manager != null) // if there is Bluetooth API, this is FxOS
      var byteArray = new Uint8Array(device.scanRecord);
    else // otherwise this is cordova
      var byteArray = evothings.util.base64DecToArr(device.scanRecord);
  
    var pos = 0;
    var advertisementData = {};
    var serviceUUIDs;
    var serviceData;
  
    // The scan record is a list of structures.
    // Each structure has a length byte, a type byte, and (length-1) data bytes.
    // The format of the data bytes depends on the type.
    // Malformed scanRecords will likely cause an exception in this function.
    while (pos < byteArray.length) {
      var length = byteArray[pos++];
      if (length == 0) {
        break;
      }
      length -= 1;
      var type = byteArray[pos++];
    
      // Parse types we know and care about.
      // Skip other types.
      
      // Convert 16-byte Uint8Array to RFC-4122-formatted UUID.
      function arrayToUUID(array, offset) {
        var k=0;
        var string = '';
        var UUID_format = [4, 2, 2, 2, 6];
        for (var l=0; l<UUID_format.length; l++) {
          if (l != 0) {
            string += '-';
          }
          for (var j=0; j<UUID_format[l]; j++, k++) {
            string += evothings.util.toHexString(array[offset+k], 1);
          }
        }
        return string;
      }
    
      if (type == 0x02 || type == 0x03) {// 16-bit Service Class UUIDs.
        serviceUUIDs = serviceUUIDs ? serviceUUIDs : [];
        for(var i=0; i<length; i+=2) {
          serviceUUIDs.push(evothings.util.toHexString(
            evothings.util.littleEndianToUint16(byteArray, pos + i), 2));
        }
      }
      if (type == 0x04 || type == 0x05) { // 32-bit Service Class UUIDs.
        serviceUUIDs = serviceUUIDs ? serviceUUIDs : [];
        for (var i=0; i<length; i+=4) {
          serviceUUIDs.push(evothings.util.toHexString(
            evothings.util.littleEndianToUint32(byteArray, pos + i), 4));
        }
      }
      if (type == 0x06 || type == 0x07) { // 128-bit Service Class UUIDs.
        serviceUUIDs = serviceUUIDs ? serviceUUIDs : [];
        for (var i=0; i<length; i+=16) {
          serviceUUIDs.push(arrayToUUID(byteArray, pos + i));
        }
      }
    
      if (type == 0x08 || type == 0x09) { // Local Name.
        advertisementData.kCBAdvDataLocalName =
          evothings.ble.fromUtf8(new Uint8Array(byteArray.buffer, pos, length));
      }
      if (type == 0x0a) { // TX Power Level.
        advertisementData.kCBAdvDataTxPowerLevel = 
          evothings.util.littleEndianToInt8(byteArray, pos);
      }
      if (type == 0x16) { // Service Data, 16-bit UUID.
        serviceData = serviceData ? serviceData : {};
        var uuid = evothings.util.toHexString(
                     evothings.util.littleEndianToUint16(byteArray, pos),2);
        var data = new Uint8Array(byteArray.buffer, pos+2, length-2);
        serviceData[uuid] =  evothings.util.base64fromArrayBuffer(data);
      }
      if (type == 0x20) { // Service Data, 32-bit UUID.
        serviceData = serviceData ? serviceData : {};
        var uuid = evothings.util.toHexString(
                   evothings.util.littleEndianToUint32(byteArray, pos),4);
        var data = new Uint8Array(byteArray.buffer, pos+4, length-4);
        serviceData[uuid] = evothings.util.base64fromArrayBuffer(data);
      }
      if (type == 0x21) { // Service Data, 128-bit UUID.
        serviceData = serviceData ? serviceData : {};
        var uuid = arrayToUUID(byteArray, pos);
        var data = new Uint8Array(byteArray.buffer, pos+16, length-16);
        serviceData[uuid] = evothings.util.base64fromArrayBuffer(data);
      }
      if (type == 0xff) { // Manufacturer-specific Data.
        // Annoying to have to transform base64 back and forth,
        // but it has to be done in order to maintain the API.
        advertisementData.kCBAdvDataManufacturerData =
        evothings.util.base64fromArrayBuffer(new Uint8Array(byteArray.buffer,
                                                           pos, length));
      }
    
      pos += length;
    }
    advertisementData.kCBAdvDataServiceUUIDs = serviceUUIDs;
    advertisementData.kCBAdvDataServiceData = serviceData;
    device.advertisementData = advertisementData;
  
    // Log raw data for debugging purposes.
    console.log("scanRecord: "+evothings.util.typedArrayToHexString(byteArray));
    console.log(JSON.stringify(advertisementData));
  },

  // Parse the advertisement Data to check if the device is a physical web
  // device or not (using the Code FED8). If so, gets the URL via the 
  // decodeUri method. In any other case (device not physical web), URL
  // not decoded, etc.. it will return null
  getPhysicalWebUrl: function(advertisementData) {
    if ((advertisementData.kCBAdvDataServiceUUIDs) &&
        (advertisementData.kCBAdvDataServiceUUIDs.toString().toUpperCase() == uribeacon.PHYWEBKEY)) {
      for (var key in advertisementData) {
        if (advertisementData.hasOwnProperty(key)) {
          for (var key2 in advertisementData[key]) {
            if (key2.toString().toUpperCase() == uribeacon.PHYWEBKEY) {
              return uribeacon.decodeUri((advertisementData[key][key2]).replace(/\s/g, ''));
            }
          }
        }
      }
    }
    return null;
  },
    
  // Used in Physical Web decoding as the URLs are not stored as plain
  // strings but following a particular encoding based on the content
  // of the AdvertisementData
  decodeUri: function(uriBase64) {
    var expansion = "";
    var protocol = "";
    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
    ac = 0,
    dec = '',
    tmp_arr = [];
    
    if (!uriBase64) {
      return uriBase64;
    }
    
    uriBase64 += '';
    
    do {
      h1 = b64.indexOf(uriBase64[i++]);
      h2 = b64.indexOf(uriBase64[i++]);
      h3 = b64.indexOf(uriBase64[i++]);
      h4 = b64.indexOf(uriBase64[i++]);
      
      // In the first set of B64 (i==4) the last octect
      // contains the URI Beacon scheme prefix
      // https://github.com/google/uribeacon/blob/master/specification/AdvertisingMode.md#uribeacon-uri-scheme-prefix
      if (i == 4) {
        protocol = uribeacon.getProtocol(h4);
      }
      
      bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
      o1 = bits >> 16 & 0xff;
      o2 = bits >> 8 & 0xff;
      o3 = bits & 0xff;
      
      // This is tricky, if the last member of the trio is a possible
      // expansion char (between 0 and 14) is not part of the URL string
      // but a expansion (e.g. .com). In that case we discard it, get
      // the string for the other ones and calculate the expansion
      // See https://github.com/google/uribeacon/blob/master/specification/AdvertisingMode.md#uribeacon-http-url-encoding
      if (h3 == 64) {
        if ((o1 >= 0) && (o1 < 14) && (i != 4)) {
          expansion = uribeacon.getExpansion(o1);
        }
        else {
          tmp_arr[ac++] = String.fromCharCode(o1);
        }
      } else if (h4 == 64) {
        if ((o2 >= 0) && (o2<14) && (i != 4)) {
          expansion = uribeacon.getExpansion(o2);
          tmp_arr[ac++] = String.fromCharCode(o1);
        }
        else {
          tmp_arr[ac++] = String.fromCharCode(o1, o2);
        }
      } else {
        if ((o3 >= 0) && (o3<14) && (i != 4)) {
          expansion = uribeacon.getExpansion(o3);
          tmp_arr[ac++] = String.fromCharCode(o1, o2);
        }
        else {
          tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
        }
      }
    } while (i < uriBase64.length);
    
    dec = protocol + tmp_arr.slice(1).join('') + expansion;
    return dec;
  },

  // Get expansion used for URLs Protocol Handlesrs by PhyWeb URLs
  // See https://github.com/google/uribeacon/blob/master/specification/AdvertisingMode.md#uribeacon-http-url-encoding
  getProtocol: function(char) {
    var protocol = "http://"
    switch (char){
      case 0:
        protocol = "http://www.";
        break;
      case 1:
        protocol = "https://www.";
        break;
      case 2:
        protocol = "http://";
        break;
      case 3:
        protocol = "https://";
        break;
      default:
        protocol = "http://";
        break;
    }
    return protocol;
  },
    
  // Get expansion used for URLs by PhyWeb URLs
  // See https://github.com/google/uribeacon/blob/master/specification/AdvertisingMode.md#uribeacon-http-url-encoding
  getExpansion: function(char) {
    var expansion = "";
    switch (char){
      case 0:
        expansion = ".com/";
        break;
      case 1:
        expansion = ".org/";
        break;
      case 2:
        expansion = ".edu/";
        break;
      case 3:
        expansion = ".net/";
        break;
      case 4:
        expansion = ".info/";
        break;
      case 5:
        expansion = ".biz/";
        break;
      case 6:
        expansion = ".gov/";
        break;
      case 7:
        expansion = ".com";
        break;
      case 8:
        expansion = ".org";
        break;
      case 9:
        expansion = ".edu";
        break;
      case 10:
        expansion = ".net";
        break;
      case 11:
        expansion = ".info";
        break;
      case 12:
        expansion = ".biz";
        break;
      case 13:
        expansion = ".gov";
        break;
      default:
        break;
    }
    return expansion;
  }
};
