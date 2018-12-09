[![npm](https://img.shields.io/npm/v/npm.svg)](https://nodejs.org/)
[![GitHub version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/gamedistribution/improve-out-stream/)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/gamedistribution/improve-out-stream/blob/master/LICENSE)


# Improve Digital out-stream SDK
This is the documentation of the "Improve out-stream SDK" project.

## Implementation
...

## Debugging
Web pages including the SDK can be easily debugged by calling the following from within a browser developer console:
```
idoutstream.openConsole();
```
The `idoutstream` namespace is set when creating the SDK instance.

## Repository
The SDK is maintained on a public github repository.
<a href="https://github.com/gamedistribution/improve-out-stream" target="_blank">https://github.com/gamedistribution/improve-out-stream</a>

## Deployment
Deployment of the SDK to production environments is done through TeamCity.

## Installation for development
Install the following programs:
* [NodeJS LTS](https://nodejs.org/).
* [Grunt](http://gruntjs.com/).

Pull in the rest of the requirements using npm:
```
npm install
```

Setup a local node server, watch changes and update your browser view automatically:
```
grunt
```

Make a production build:
```
grunt build
```

Make a production build of the promotion script. This script is loaded through advertisement slots to support for cross promotions:
```
grunt promo
```

## Events
### SDK EVENTS
All SDK events, which can be hooked into, are described below.

| Event | Description |
| --- | --- |
| SDK_READY | When the SDK is ready. |
| SDK_ERROR | When the SDK has hit a critical error. |

### IMA SDK EVENTS
The SDK events are custom ads for handling any thing related to the IMA SDK itself.

| Event | Description |
| --- | --- |
| AD_SDK_LOADER_READY | When the adsLoader instance is ready to create an adsManager instance |
| AD_SDK_MANAGER_READY | When the adsManager instance is ready with ads. |
| AD_SDK_REQUEST_ADS | When new ads are requested. |
| AD_SDK_ERROR | When the SDK hits a critical error. |
| AD_SDK_FINISHED | When the SDK is finished running the ad. |
| AD_CANCELED | When the ad is cancelled or stopped because its done running an ad. |
| AD_SAFETY_TIMER | When the safety timer is cleared. |

### AD EVENTS
The SDK uses the Google IMA SDK for loading ads. All events of this SDK are also available to the publisher.
https://developers.google.com/interactive-media-ads/docs/sdks/html5/

| Event | Description |
| --- | --- |
| AD_ERROR | When the ad it self has an error. | 
| AD_BREAK_READY | Fired when an ad rule or a VMAP ad break would have played if autoPlayAdBreaks is false. |
| AD_METADATA | Fired when an ads list is loaded. |
| ALL_ADS_COMPLETED | Fired when the ads manager is done playing all the ads. |
| CLICK | Fired when the ad is clicked. |
| COMPLETE | Fired when the ad completes playing. |
| CONTENT_PAUSE_REQUESTED | Fired when content should be paused. This usually happens right before an ad is about to cover the content. |
| CONTENT_RESUME_REQUESTED | Fired when content should be resumed. This usually happens when an ad finishes or collapses. |
| DURATION_CHANGE | Fired when the ad's duration changes. |
| FIRST_QUARTILE | Fired when the ad playhead crosses first quartile. |
| IMPRESSION | Fired when the impression URL has been pinged. |
| INTERACTION | Fired when an ad triggers the interaction callback. Ad interactions contain an interaction ID string in the ad data. |
| LINEAR_CHANGED | Fired when the displayed ad changes from linear to nonlinear, or vice versa. |
| LOADED | Fired when ad data is available. |
| LOG | Fired when a non-fatal error is encountered. The user need not take any action since the SDK will continue with the same or next ad playback depending on the error situation. |
| MIDPOINT | Fired when the ad playhead crosses midpoint. |
| PAUSED | Fired when the ad is paused. |
| RESUMED | Fired when the ad is resumed. |
| SKIPPABLE_STATE_CHANGED | Fired when the displayed ads skippable state is changed. |
| SKIPPED | Fired when the ad is skipped by the user. |
| STARTED | Fired when the ad starts playing. |
| THIRD_QUARTILE | Fired when the ad playhead crosses third quartile. |
| USER_CLOSE | Fired when the ad is closed by the user. |
| VOLUME_CHANGED | Fired when the ad volume has changed. |
| VOLUME_MUTED | Fired when the ad volume has been muted. |
