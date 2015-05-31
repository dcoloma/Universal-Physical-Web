# Universal-Physical-Web
Physical Web Scanner for FxOS (using native implementation) and Cordova (using <a href='https://github.com/evothings/cordova-ble'>evothings plugin</a>)

# About the app
The idea is having an app that can work in any mobile device that scans BLE Physical Web Devices and that can be used in different ways:

<ul>
<li>
As a device scanner in which the devices are listed (parameter <code>showClosestDevice</code> configured to <code>false</code> in index.js)
</li>
<li>
As an URL opener, that opens the URL of the closest Physical Web Device (parameter <code>showClosestDevice</code> configured to <code>true</code> in index.js)
</li>
</ul>

The URL to be used for every Physical Web Device again can be of 2 types:

<ul>
<li>The URL directly stored in the device. (parameter <code>showDeviceUrl</code> in index.js is configured to <code>true</code>)</li>
<li>A URL stored in Firebase (together with some extra information), the URL in the device is just a pointer to the Firebase URL (kind of proxy). This is the configuration used when parameter <code>showDeviceUrl</code> in index.js is <code>false</code>.</li>
</ul>

# Supported Platforms

## FirefoxOS

For doing so, you need to generate a build with the patches available in <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=933357">Bug 933357</a>

Once you have a build with the proper BLE support you can just install the app available at the www folder that already includes everything that is required: manifest, icons, code, etc...

## Android and iOS

The code of the WebApp is exactly the same, but it relies in Cordova in order to make it a native app (this is required until Android or iPHone include a WebAPI for Bluetooth). Apart from Cordova a BLE pluging is required as well as some other plugins describe below.

### Making it work in Android and iOS

Clone the repo and install the target platform(s)

```
$ cordova platform add ios
$ cordova platform add android
```

After that you need to install the required plugins:

```
$ cordova plugin add org.apache.cordova.inappbrowser
$ cordova plugin add https://github.com/evothings/cordova-ble.git
$ cordova plugin add org.apache.cordova.console
```

And build it for the target platforms:

```
$ cordova build ios
$ cordova build android
```

After that you can install the apps in your Android or iOS devices. 

For instance, in the case of Android:

```
$ adb install platforms/android/ant-build/CordovaApp-debug.apk
```

