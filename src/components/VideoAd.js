'use strict';

import EventBus from '../components/EventBus';

import {
    extendDefaults,
    getRatioHeight,
} from '../modules/common';
import {dankLog} from '../modules/dankLog';

let instance = null;

/**
 * VideoAd
 */
class VideoAd {
    /**
     * Constructor of VideoAd.
     * @param {Object} container
     * @param {Object} options
     * @return {*}
     */
    constructor(container, options) {
        // Make this a singleton.
        if (instance) {
            return instance;
        } else {
            instance = this;
        }

        const defaults = {
            debug: false,
            prefix: 'idoutstream__',
            locale: 'en',
            domain: '',
            tag: '',
            targeting: {},
        };

        if (options) {
            this.options = extendDefaults(defaults, options);
        } else {
            this.options = defaults;
        }

        this.adsLoader = null;
        this.adsManager = null;
        this.adDisplayContainer = null;
        this.adContainerInner = null;
        this.eventBus = new EventBus();
        this.safetyTimer = null;
        this.containerTransitionSpeed = 500;
        this.requestRunning = false;
        this.container = container;
        this.eventCategory = 'AD';
        this.floating = false;

        // Setup a simple promise to resolve if the IMA loader is ready.
        // We mainly do this because showBanner() can be called before we've
        // even setup our advertisement instance.
        this.adsLoaderPromise = new Promise((resolve, reject) => {
            this.eventBus.subscribe('AD_SDK_LOADER_READY', () => {
                // Preload the advertisement.
                this._requestAd()
                    .then(vastUrl => resolve(vastUrl))
                    .catch(error => this.onError(error));
            });
            this.eventBus.subscribe('AD_CANCELED', () => reject(
                new Error('Initial adsLoaderPromise failed to load.')));
        });

        // Load Google IMA HTML5 SDK.
        this._loadScripts().then(() => {
            this._createPlayer();
            this._setUpIMA();
        }).catch(error => this.onError(error));

        // Prebid.
        window.idhbgd = window.idhbgd || {};
        window.idhbgd.que = window.idhbgd.que || [];
    }

    /**
     * start
     * Start the VideoAd instance by first checking if we
     * have auto play capabilities. By calling start() we start the
     * creation of the adsLoader, needed to request ads. This is also
     * the time where we can change other options based on context as well.
     * @public
     */
    start() {
        // Start ticking our safety timer. If the whole advertisement
        // thing doesn't resolve within our set time, then screw this.
        this._startSafetyTimer(12000, 'start()');

        // Subscribe to the AD_SDK_LOADER_READY event and clear the
        // initial safety timer set within the start of our start() method.
        this.eventBus.subscribe('AD_SDK_LOADER_READY', () => {
            this._clearSafetyTimer('AD_SDK_LOADER_READY');
        });

        // Subscribe to AD_SDK_MANAGER_READY, which is a custom event.
        // We will want to start and clear a timer when requestAds()
        // is called until the ads manager has been resolved.
        // As it can happen that an ad request stays on pending.
        // This will cause the IMA SDK adsmanager to do nothing.
        this.eventBus.subscribe('AD_SDK_MANAGER_READY', () => {
            this._clearSafetyTimer('AD_SDK_MANAGER_READY');
        });

        // Subscribe to the LOADED event as we will want to clear our initial
        // safety timer, but also start a new one, as sometimes advertisements
        // can have trouble starting.
        this.eventBus.subscribe('LOADED', () => {
            // Start our safety timer every time an ad is loaded.
            // It can happen that an ad loads and starts, but has an error
            // within itself, so we never get an error event from IMA.
            this._clearSafetyTimer('LOADED');
            this._startSafetyTimer(8000, 'LOADED');
        });

        // Show the advertisement container.
        this.eventBus.subscribe('CONTENT_PAUSE_REQUESTED', () => {
            this._show();
        });

        // Subscribe to the STARTED event, so we can clear the safety timer
        // started from the LOADED event. This is to avoid any problems within
        // an advertisement itself, like when it doesn't start or has
        // a javascript error, which is common with VPAID.
        this.eventBus.subscribe('STARTED', () => {
            this._clearSafetyTimer('STARTED');
        });
    }

    /**
     * _requestAd
     * Request advertisements.
     * @return {Promise} Promise that returns DFP vast url like
     *     https://pubads.g.doubleclick.net/...
     * @private
     */
    _requestAd() {
        return new Promise((resolve, reject) => {
            dankLog('AD_REQUEST', 'Preloading VAST URL...', 'info');

            try {
                // Now create the VAST URL based on environments.
                // Either use a test URL, header bidding or Tunnl.
                if (localStorage.getItem('idoutstream_debug') &&
                    localStorage.getItem('idoutstream_tag')) {
                    const vastUrl = localStorage.getItem('idoutstream_tag');
                    // We're done with the current request.
                    this.requestRunning = false;

                    // Some logging.
                    dankLog('AD_REQUEST', vastUrl, 'success');

                    // Return the VAST URL.
                    resolve(vastUrl);
                } else {
                    if (typeof window.idhbgd.requestAds === 'undefined') {
                        reject(
                            'Prebid.js wrapper script hit an error or didn\'t exist!');
                    }

                    // Make the request for a VAST tag from the Prebid.js
                    // wrapper. Get logging from the wrapper using:
                    // ?idhbgd_debug=true To get a copy of the current config:
                    // copy(idhbgd.getConfig());
                    window.idhbgd.que.push(() => {
                        window.idhbgd.setAdserverTargeting(
                            this.options.targeting);
                        window.idhbgd.setDfpAdUnitCode(this.options.tag);
                        window.idhbgd.requestAds({
                            callback: vastUrl => {
                                // We're done with the current request.
                                this.requestRunning = false;

                                // Some logging.
                                dankLog('AD_REQUEST', vastUrl, 'success');

                                // Return the VAST URL.
                                resolve(vastUrl);
                            },
                        });
                    });
                }
            } catch (error) {
                // We're done with the current request.
                this.requestRunning = false;

                // Return an error.
                reject(error);
            }
        });
    }

    /**
     * _loadAd
     * Load and run the advertisement.
     * @param {String} vastUrl
     * @public
     */
    loadAd(vastUrl) {
        if (typeof google === 'undefined') {
            this.onError('Unable to load ad, google IMA SDK not defined.');
            return;
        }

        if (this.requestRunning) {
            dankLog('AD_SDK_LOAD_AD', 'An advertisement is already running',
                'warning');
            return;
        }

        this.requestRunning = true;

        try {
            // Request video new ads.
            const adsRequest = new google.ima.AdsRequest();

            // Set the VAST tag.
            adsRequest.adTagUrl = vastUrl;

            // Specify the linear and nonlinear slot sizes. This helps
            // the SDK to select the correct creative if multiple are returned.
            const containerHeight =
                getRatioHeight(this.container.offsetWidth, 9, 16);
            adsRequest.linearAdSlotWidth = this.container.offsetWidth;
            adsRequest.linearAdSlotHeight = containerHeight;
            adsRequest.nonLinearAdSlotWidth = this.container.offsetWidth;
            adsRequest.nonLinearAdSlotHeight = containerHeight;

            // We don't want overlays as we do not have
            // a video player as underlying content!
            // Non-linear ads usually do not invoke the ALL_ADS_COMPLETED.
            // That would cause lots of problems of course...
            adsRequest.forceNonLinearFullSlot = true;

            // Enable auto play of ads.
            // Todo: Setup logic concerning auto play capabilities of IMA.
            // https://developers.google.com/interactive-media-ads/docs/sdks/html5/autoplay
            adsRequest.setAdWillAutoPlay(true);
            adsRequest.setAdWillPlayMuted(true);

            // Get us some ads!
            this.adsLoader.requestAds(adsRequest);
        } catch (e) {
            this._onAdError(e);
        }
    }

    /**
     * cancel
     * Makes it possible to stop an advertisement while its
     * loading or playing. This will clear out the adsManager, stop any
     * ad playing and allowing new ads to be called.
     * @public
     */
    cancel() {
        // Destroy the adsManager so we can grab new ads after this.
        // If we don't then we're not allowed to call new ads based
        // on google policies, as they interpret this as an accidental
        // video requests. https://developers.google.com/interactive-
        // media-ads/docs/sdks/android/faq#8
        this.adsLoaderPromise = new Promise((resolve, reject) => {
            if (this.adsLoader) this.adsLoader.contentComplete();
            if (this.adsManager) this.adsManager.destroy();

            // Hide the advertisement.
            this._hide();

            // Reset styles.
            this.floatReset();

            // Send event to tell that the whole advertisement
            // thing is finished.
            let eventName = 'AD_CANCELED';
            let eventMessage = 'Advertisement has been canceled.';
            this.eventBus.broadcast(eventName, {
                name: eventName,
                message: eventMessage,
                status: 'warning',
                analytics: {
                    category: this.eventCategory,
                    action: eventName,
                    label: this.options.domain,
                },
            });

            // Preload the advertisement.
            this._requestAd().
                then(vastUrl => resolve(vastUrl)).
                catch(error => reject(error));
        });
    }

    /**
     * onError
     * Any error handling comes through here.
     * @param {String} message
     * @public
     */
    onError(message) {
        let eventName = 'AD_SDK_ERROR';
        this.eventBus.broadcast(eventName, {
            name: eventName,
            message: message,
            status: 'error',
            analytics: {
                category: this.eventCategory,
                action: eventName,
                label: message,
            },
        });
        this.cancel();
        this._clearSafetyTimer('AD_SDK_ERROR');
    }

    /**
     * _hide
     * Show the advertisement container.
     * @private
     */
    _hide() {
        this.adContainer.style.margin = '0';
        this.adContainer.style.padding = '0';
        this.adContainer.style.opacity = '0';
        setTimeout(() => {
            this.adContainer.style.display = 'none';
        }, this.containerTransitionSpeed);
    }

    /**
     * _show
     * Hide the advertisement container
     * @private
     */
    _show() {
        this.adContainer.style.display = 'block';
        setTimeout(() => {
            this.adContainer.style.margin = '0 0 1rem 0';
            this.adContainer.style.padding = '0 0 56.25% 0'; // 16:9
            this.adContainer.style.opacity = '1';
        }, 10);
    }

    /**
     * floatStart
     * @public
     */
    floatStart() {
        // Todo: Add float animation to position.
        if (this.floating) return;
        if (!this.adContainerInner) return;

        this.floating = true;

        this.adContainerInner.style.position = 'fixed';
        this.adContainerInner.style.top = 'auto';
        this.adContainerInner.style.left = 'auto';
        this.adContainerInner.style.width = '300px';
        this.adContainerInner.style.height = `${getRatioHeight(300, 9, 16)}px`;
        this.adContainerInner.style.margin = '1rem';
        this.adContainerInner.style.boxShadow = '0 8px 8px rgba(0, 0, 0, 0.3)';

        // Todo: Ignore resize on resizing viewport.
        // Resize the advertisement itself.
        if (this.adsManager) {
            this.adsManager.resize(
                this.adContainerInner.offsetWidth,
                getRatioHeight(300, 9, 16),
                google.ima.ViewMode.NORMAL,
            );
        }
    }

    /**
     * floatReset
     * @public
     */
    floatReset() {
        if (!this.floating) return;
        if (!this.adContainerInner) return;

        this.floating = false;

        this.adContainerInner.style.position = 'absolute';
        this.adContainerInner.style.top = '0';
        this.adContainerInner.style.right = '0';
        this.adContainerInner.style.bottom = '0';
        this.adContainerInner.style.left = '0';
        this.adContainerInner.style.width = 'inherit';
        this.adContainerInner.style.height = 'inherit';
        this.adContainerInner.style.margin = '0';
        this.adContainerInner.style.boxShadow = '0 0 0 transparent';

        // Resize the advertisement itself.
        if (this.adsManager) {
            this.adsManager.resize(
                this.container.offsetWidth,
                getRatioHeight(this.container.offsetWidth, 9, 16),
                google.ima.ViewMode.NORMAL,
            );
        }
    }

    /**
     * _loadScripts
     * Loads the Google IMA script using a <script> tag.
     * @return {Promise<any[]>}
     * @private
     */
    _loadScripts() {
        const IMA = new Promise((resolve, reject) => {
            const src = (this.options.debug)
                ? '//imasdk.googleapis.com/js/sdkloader/ima3_debug.js'
                : '//imasdk.googleapis.com/js/sdkloader/ima3.js';
            const script = document.getElementsByTagName('script')[0];
            const ima = document.createElement('script');
            ima.type = 'text/javascript';
            ima.async = true;
            ima.src = src;
            ima.onload = () => {
                resolve();
            };
            ima.onerror = () => {
                reject(
                    'IMA script failed to load! Probably due to an ADBLOCKER!');
            };
            script.parentNode.insertBefore(ima, script);
        });

        const prebidJS = new Promise((resolve, reject) => {
            const src = (this.options.debug)
                ? 'https://test-hb.improvedigital.com/pbw/gameDistribution.min.js'
                : 'https://hb.improvedigital.com/pbw/gameDistribution.min.js';
            const script = document.getElementsByTagName('script')[0];
            const ima = document.createElement('script');
            ima.type = 'text/javascript';
            ima.id = 'idhbgd';
            ima.async = true;
            ima.src = src;
            ima.onload = () => {
                resolve();
            };
            ima.onerror = () => {
                reject(
                    'Prebid.js failed to load! Probably due to an ADBLOCKER!');
            };
            script.parentNode.insertBefore(ima, script);
        });

        return Promise.all([IMA, prebidJS]);
    }

    /**
     * _createPlayer
     * Creates our staging/ markup for the advertisement.
     * @private
     */
    _createPlayer() {
        this.adContainer = document.createElement('div');
        this.adContainer.id = this.options.prefix + 'advertisement';
        this.adContainer.style.display = 'none';
        this.adContainer.style.position = 'relative';
        this.adContainer.style.height = '0';
        this.adContainer.style.margin = '0';
        this.adContainer.style.padding = '0';
        this.adContainer.style.opacity = '0';
        this.adContainer.style.overflow = 'hidden';
        this.adContainer.style.backgroundColor = '#000';
        this.adContainer.style.borderRadius = '2px';
        this.adContainer.style.transition = `
            padding ${this.containerTransitionSpeed}ms cubic-bezier(0.55, 0, 0.1, 1),
            opacity ${this.containerTransitionSpeed / 2}ms cubic-bezier(0.55, 0, 0.1, 1)
            `;

        // This is the container where the actual ad will be embedded in.
        this.adContainerInner = document.createElement('div');
        this.adContainerInner.id = this.options.prefix + 'advertisement_slot';
        this.adContainerInner.style.position = 'absolute';
        this.adContainerInner.style.top = '0';
        this.adContainerInner.style.right = '0';
        this.adContainerInner.style.bottom = '0';
        this.adContainerInner.style.left = '0';
        this.adContainerInner.style.backgroundColor = '#000';
        this.adContainerInner.style.borderRadius = '2px';

        this.adContainer.appendChild(this.adContainerInner);
        this.container.appendChild(this.adContainer);
    }

    /**
     * _setUpIMA
     * Create the adsLoader object.
     * @private
     */
    _setUpIMA() {
        // In order for the SDK to display ads on our page, we need to tell
        // it where to put them. In the html above, we defined a div with
        // the id "adContainer". This div is set up to render on top of
        // the video player. Using the code below, we tell the SDK to render
        // ads in that div. Also provide a handle to the content video
        // player - the SDK will poll the current time of our player to
        // properly place mid-rolls. After we create the ad display
        // container, initialize it. On mobile devices, this initialization
        // must be done as the result of a user action! Which is done
        // at play().

        // So we can run VPAID2.
        google.ima.settings.setVpaidMode(
            google.ima.ImaSdkSettings.VpaidMode.INSECURE);

        // Set language.
        google.ima.settings.setLocale(this.options.locale);

        // https://developers.google.com/interactive-media-ads/docs/sdks/html5/skippable-ads
        google.ima.settings.setDisableCustomPlaybackForIOS10Plus(true);

        // We assume the adContainer is the DOM id of the element that
        // will house the ads.
        this.adDisplayContainer = new google.ima.AdDisplayContainer(
            document.getElementById(this.options.prefix
                + 'advertisement_slot'),
        );

        // Here we create an AdsLoader and define some event listeners.
        // Then create an AdsRequest object to pass to this AdsLoader.
        // We'll then wire up the 'Play' button to
        // call our requestAd function.

        // We will maintain only one instance of AdsLoader for the entire
        // lifecycle of the page. To make additional ad requests, create a
        // new AdsRequest object but re-use the same AdsLoader.

        // Re-use this AdsLoader instance for the entire lifecycle of the page.
        this.adsLoader = new google.ima.AdsLoader(this.adDisplayContainer);

        // Add adsLoader event listeners.
        this.adsLoader.addEventListener(
            google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
            this._onAdsManagerLoaded, false, this);
        this.adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR,
            this._onAdError, false, this);

        // Send event that our adsLoader is ready.
        const time = new Date();
        const h = time.getHours();
        const d = time.getDate();
        const m = time.getMonth();
        const y = time.getFullYear();
        let eventName = 'AD_SDK_LOADER_READY';
        this.eventBus.broadcast(eventName, {
            name: eventName,
            message: this.options,
            status: 'success',
            analytics: {
                category: eventName,
                action: this.options.domain,
                label: `h${h} d${d} m${m} y${y}`,
            },
        });
    }

    /**
     * _onAdsManagerLoaded
     * This function is called whenever the ads are ready inside
     * the AdDisplayContainer.
     * @param {Event} adsManagerLoadedEvent
     * @private
     */
    _onAdsManagerLoaded(adsManagerLoadedEvent) {
        // Get the ads manager.
        const adsRenderingSettings = new google.ima.AdsRenderingSettings();
        adsRenderingSettings.enablePreloading = true;
        adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
        adsRenderingSettings.uiElements = [
            google.ima.UiElements.AD_ATTRIBUTION,
            google.ima.UiElements.COUNTDOWN,
        ];

        // We don't set videoContent as in the Google IMA example docs,
        // cause we run a game, not an ad.
        this.adsManager = adsManagerLoadedEvent.getAdsManager(
            adsRenderingSettings);

        // Mute the advertisement.
        this.adsManager.setVolume(0);
        // Todo: Try to pause ad using adsManager?

        // Add listeners to the required events.
        // https://developers.google.com/interactive-media-
        // ads/docs/sdks/html5/v3/apis

        // Advertisement error events.
        this.adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR,
            this._onAdError.bind(this), false, this);

        // Advertisement regular events.
        this.adsManager.addEventListener(google.ima.AdEvent.Type.AD_BREAK_READY,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.AD_METADATA,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(
            google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.CLICK,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(
            google.ima.AdEvent.Type.DURATION_CHANGE, this._onAdEvent.bind(this),
            this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.FIRST_QUARTILE,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.IMPRESSION,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.INTERACTION,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.LINEAR_CHANGED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.LOADED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.LOG,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.MIDPOINT,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.PAUSED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.RESUMED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(
            google.ima.AdEvent.Type.SKIPPABLE_STATE_CHANGED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.SKIPPED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.STARTED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.THIRD_QUARTILE,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.USER_CLOSE,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.VOLUME_CHANGED,
            this._onAdEvent.bind(this), this);
        this.adsManager.addEventListener(google.ima.AdEvent.Type.VOLUME_MUTED,
            this._onAdEvent.bind(this), this);

        // We need to resize our adContainer when the view dimensions change.
        window.addEventListener('resize', () => {
            this.adsManager.resize(
                this.container.offsetWidth,
                getRatioHeight(this.container.offsetWidth, 9, 16),
                google.ima.ViewMode.NORMAL,
            );
        });

        // Once the ad display container is ready and ads have been retrieved,
        // we can use the ads manager to display the ads.
        if (this.adsManager && this.adDisplayContainer) {
            // Send an event to tell that our ads manager
            // has successfully loaded the VAST response.
            const time = new Date();
            const h = time.getHours();
            const d = time.getDate();
            const m = time.getMonth();
            const y = time.getFullYear();
            let eventName = 'AD_SDK_MANAGER_READY';
            this.eventBus.broadcast(eventName, {
                name: eventName,
                message: this.adsManager,
                status: 'success',
                analytics: {
                    category: eventName,
                    action: this.options.domain,
                    label: `h${h} d${d} m${m} y${y}`,
                },
            });

            // Start the advertisement.
            // Always initialize the container first.
            this.adDisplayContainer.initialize();

            try {
                // Initialize the ads manager. Ad rules playlist will
                // start at this time.
                this.adsManager.init(
                    this.container.offsetWidth,
                    getRatioHeight(this.container.offsetWidth, 9, 16),
                    google.ima.ViewMode.NORMAL,
                );
                // Call play to start showing the ad. Single video and
                // overlay ads will start at this time; the call will be
                // ignored for ad rules.
                this.adsManager.start();
            } catch (adError) {
                // An error may be thrown if there was a problem with the
                // VAST response.
                this.onError(adError);
            }
        }
    }

    /**
     * _onAdEvent
     * This is where all the event handling takes place. Retrieve the ad from
     * the event. Some events (e.g. ALL_ADS_COMPLETED) don't have ad
     * object associated.
     * @param {Event} adEvent
     * @private
     */
    _onAdEvent(adEvent) {
        // Used for analytics labeling.
        const time = new Date();
        const h = time.getHours();
        const d = time.getDate();
        const m = time.getMonth();
        const y = time.getFullYear();

        // Define all our events.
        let eventName = '';
        let eventMessage = '';
        switch (adEvent.type) {
        case google.ima.AdEvent.Type.AD_BREAK_READY:
            eventName = 'AD_BREAK_READY';
            eventMessage = 'Fired when an ad rule or a VMAP ad break would ' +
                    'have played if autoPlayAdBreaks is false.';
            break;
        case google.ima.AdEvent.Type.AD_METADATA:
            eventName = 'AD_METADATA';
            eventMessage = 'Fired when an ads list is loaded.';
            break;
        case google.ima.AdEvent.Type.ALL_ADS_COMPLETED:
            eventName = 'ALL_ADS_COMPLETED';
            eventMessage = 'Fired when the ads manager is done playing all ' +
                    'the ads.';
            break;
        case google.ima.AdEvent.Type.CLICK:
            eventName = 'CLICK';
            eventMessage = 'Fired when the ad is clicked.';
            break;
        case google.ima.AdEvent.Type.COMPLETE:
            eventName = 'COMPLETE';
            eventMessage = 'Fired when the ad completes playing.';
            break;
        case google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED:
            eventName = 'CONTENT_PAUSE_REQUESTED';
            eventMessage = 'Fired when content should be paused. This ' +
                    'usually happens right before an ad is about to cover ' +
                    'the content.';
            break;
        case google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED:
            eventName = 'CONTENT_RESUME_REQUESTED';
            eventMessage = 'Fired when content should be resumed. This ' +
                    'usually happens when an ad finishes or collapses.';

            // Destroy the adsManager so we can grab new ads after this.
            // If we don't then we're not allowed to call new ads based
            // on google policies, as they interpret this as an accidental
            // video requests. https://developers.google.com/interactive-
            // media-ads/docs/sdks/android/faq#8
            this.adsLoaderPromise = new Promise((resolve, reject) => {
                if (this.adsLoader) this.adsLoader.contentComplete();
                if (this.adsManager) this.adsManager.destroy();

                // Hide the advertisement.
                this._hide();

                // Reset styles.
                this.floatReset();

                // We're done with the current request.
                this.requestRunning = false;

                // Send event to tell that the whole advertisement
                // thing is finished.
                let eventName = 'AD_SDK_FINISHED';
                let eventMessage = 'IMA is ready for new requests.';
                this.eventBus.broadcast(eventName, {
                    name: eventName,
                    message: eventMessage,
                    status: 'success',
                    analytics: {
                        category: eventName,
                        action: this.options.domain,
                        label: `h${h} d${d} m${m} y${y}`,
                    },
                });

                // Preload the advertisement.
                this._requestAd().
                    then(vastUrl => resolve(vastUrl)).
                    catch(error => reject(error));
            });

            break;
        case google.ima.AdEvent.Type.DURATION_CHANGE:
            eventName = 'DURATION_CHANGE';
            eventMessage = 'Fired when the ad\'s duration changes.';
            break;
        case google.ima.AdEvent.Type.FIRST_QUARTILE:
            eventName = 'FIRST_QUARTILE';
            eventMessage = 'Fired when the ad playhead crosses first ' +
                    'quartile.';
            break;
        case google.ima.AdEvent.Type.IMPRESSION:
            eventName = 'IMPRESSION';
            eventMessage = 'Fired when the impression URL has been pinged.';

            // Send out additional impression Google Analytics event.
            try {
                // Check which bidder served us the impression.
                // We can call on a Prebid.js method. If it exists we
                // report it. Our default ad provider is Ad Exchange.
                if (typeof window['pbjsgd'] !== 'undefined') {
                    const winners = window.pbjsgd.getHighestCpmBids();
                    if (this.options.debug) {
                        console.log('Winner(s)', winners);
                    }
                    // Todo: There can be multiple winners...
                    if (winners.length > 0) {
                        winners.forEach((winner) => {
                            /* eslint-disable */
                                if (typeof window['ga'] !== 'undefined' &&
                                    winner.bidder) {
                                    window['ga']('gd.send', {
                                        hitType: 'event',
                                        eventCategory: `IMPRESSION_${winner.bidder.toUpperCase()}`,
                                        eventAction: this.options.domain,
                                        eventLabel: `h${h} d${d} m${m} y${y}`,
                                    });
                                }
                                /* eslint-enable */
                        });
                    } else {
                        /* eslint-disable */
                            if (typeof window['ga'] !== 'undefined') {
                                window['ga']('gd.send', {
                                    hitType: 'event',
                                    eventCategory: 'IMPRESSION_ADEXCHANGE',
                                    eventAction: this.options.domain,
                                    eventLabel: `h${h} d${d} m${m} y${y}`,
                                });
                            }
                            /* eslint-enable */
                    }
                }
            } catch (error) {
                console.log(error);
            }

            break;
        case google.ima.AdEvent.Type.INTERACTION:
            eventName = 'INTERACTION';
            eventMessage = 'Fired when an ad triggers the interaction ' +
                    'callback. Ad interactions contain an interaction ID ' +
                    'string in the ad data.';
            break;
        case google.ima.AdEvent.Type.LINEAR_CHANGED:
            eventName = 'LINEAR_CHANGED';
            eventMessage = 'Fired when the displayed ad changes from ' +
                    'linear to nonlinear, or vice versa.';
            break;
        case google.ima.AdEvent.Type.LOADED:
            eventName = 'LOADED';
            eventMessage = adEvent.getAd().getContentType();
            break;
        case google.ima.AdEvent.Type.LOG:
            const adData = adEvent.getAdData();
            if (adData['adError']) {
                eventName = 'LOG';
                eventMessage = adEvent.getAdData();
            }
            break;
        case google.ima.AdEvent.Type.MIDPOINT:
            eventName = 'MIDPOINT';
            eventMessage = 'Fired when the ad playhead crosses midpoint.';
            break;
        case google.ima.AdEvent.Type.PAUSED:
            eventName = 'PAUSED';
            eventMessage = 'Fired when the ad is paused.';
            break;
        case google.ima.AdEvent.Type.RESUMED:
            eventName = 'RESUMED';
            eventMessage = 'Fired when the ad is resumed.';
            break;
        case google.ima.AdEvent.Type.SKIPPABLE_STATE_CHANGED:
            eventName = 'SKIPPABLE_STATE_CHANGED';
            eventMessage = 'Fired when the displayed ads skippable state ' +
                    'is changed.';
            break;
        case google.ima.AdEvent.Type.SKIPPED:
            eventName = 'SKIPPED';
            eventMessage = 'Fired when the ad is skipped by the user.';
            break;
        case google.ima.AdEvent.Type.STARTED:
            eventName = 'STARTED';
            eventMessage = 'Fired when the ad starts playing.';
            break;
        case google.ima.AdEvent.Type.THIRD_QUARTILE:
            eventName = 'THIRD_QUARTILE';
            eventMessage = 'Fired when the ad playhead crosses third ' +
                    'quartile.';
            break;
        case google.ima.AdEvent.Type.USER_CLOSE:
            eventName = 'USER_CLOSE';
            eventMessage = 'Fired when the ad is closed by the user.';
            break;
        case google.ima.AdEvent.Type.VOLUME_CHANGED:
            eventName = 'VOLUME_CHANGED';
            eventMessage = 'Fired when the ad volume has changed.';
            break;
        case google.ima.AdEvent.Type.VOLUME_MUTED:
            eventName = 'VOLUME_MUTED';
            eventMessage = 'Fired when the ad volume has been muted.';
            break;
        }

        // Send the event to our eventBus.
        if (eventName !== '' && eventMessage !== '') {
            this.eventBus.broadcast(eventName, {
                name: eventName,
                message: eventMessage,
                status: 'success',
                analytics: {
                    category: eventName,
                    action: this.options.domain,
                    label: `h${h} d${d} m${m} y${y}`,
                },
            });
        }
    }

    /**
     * _onAdError
     * Any ad error handling comes through here.
     * @param {Event} event
     * @private
     */
    _onAdError(event) {
        this.cancel();
        this._clearSafetyTimer('AD_ERROR');

        try {
            /* eslint-disable */
            if (typeof window['ga'] !== 'undefined') {
                let eventName = 'AD_ERROR';
                let eventMessage = event.getError().getMessage();
                this.eventBus.broadcast(eventName, {
                    name: eventName,
                    message: eventMessage,
                    status: 'warning',
                    analytics: {
                        category: eventName,
                        action: event.getError().getErrorCode().toString() ||
                        event.getError().getVastErrorCode().toString(),
                        label: eventMessage,
                    },
                });
            }
            /* eslint-enable */

            // Check which bidder served us a possible broken advertisement.
            // We can call on a Prebid.js method. If it exists we report it.
            // If there is no winning bid we assume the problem lies with
            // AdExchange. As our default ad provider is Ad Exchange.
            if (typeof window['pbjsgd'] !== 'undefined') {
                const winners = window.pbjsgd.getHighestCpmBids();
                if (this.options.debug) {
                    console.log('Failed winner(s) ', winners);
                }
                // Todo: There can be multiple winners...
                if (winners.length > 0) {
                    winners.forEach((winner) => {
                        const adId = winner.adId ? winner.adId : null;
                        const creativeId = winner.creativeId
                            ? winner.creativeId
                            : null;

                        /* eslint-disable */
                        if (typeof window['ga'] !== 'undefined' &&
                            winner.bidder) {
                            window['ga']('gd.send', {
                                hitType: 'event',
                                eventCategory: `AD_ERROR_${winner.bidder.toUpperCase()}`,
                                eventAction: event.getError().
                                    getErrorCode().
                                    toString() ||
                                event.getError().getVastErrorCode().toString(),
                                eventLabel: `${adId} | ${creativeId}`,
                            });
                        }
                        /* eslint-enable */
                    });
                } else {
                    /* eslint-disable */
                    if (typeof window['ga'] !== 'undefined') {
                        window['ga']('gd.send', {
                            hitType: 'event',
                            eventCategory: 'AD_ERROR_ADEXCHANGE',
                            eventAction: event.getError().
                                getErrorCode().
                                toString() ||
                            event.getError().getVastErrorCode().toString(),
                            eventLabel: event.getError().getMessage(),
                        });
                    }
                    /* eslint-enable */
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * _startSafetyTimer
     * Setup a safety timer for when the ad network
     * doesn't respond for whatever reason. The advertisement has 12 seconds
     * to get its shit together. We stop this timer when the advertisement
     * is playing, or when a user action is required to start, then we
     * clear the timer on ad ready.
     * @param {Number} time
     * @param {String} from
     * @private
     */
    _startSafetyTimer(time, from) {
        dankLog('AD_SAFETY_TIMER', 'Invoked timer from: ' + from,
            'success');
        this.safetyTimer = window.setTimeout(() => {
            let eventName = 'AD_SAFETY_TIMER';
            let eventMessage = 'Advertisement took too long to load.';
            this.eventBus.broadcast(eventName, {
                name: eventName,
                message: eventMessage,
                status: 'warning',
                analytics: {
                    category: this.eventCategory,
                    action: eventName,
                    label: this.options.domain,
                },
            });
            this.cancel();
            this._clearSafetyTimer(from);
        }, time);
    }

    /**
     * _clearSafetyTimer
     * @param {String} from
     * @private
     */
    _clearSafetyTimer(from) {
        if (typeof this.safetyTimer !== 'undefined' &&
            this.safetyTimer !== null) {
            dankLog('AD_SAFETY_TIMER', 'Cleared timer set at: ' + from,
                'success');
            clearTimeout(this.safetyTimer);
            this.safetyTimer = undefined;

            // Do additional logging, as we need to figure out when
            // for some reason our adsloader listener is not resolving.
            if (from === 'requestAd()') {
                // Send event for Tunnl debugging.
                const time = new Date();
                const h = time.getHours();
                const d = time.getDate();
                const m = time.getMonth();
                const y = time.getFullYear();
                if (typeof window['ga'] !== 'undefined') {
                    window['ga']('gd.send', {
                        hitType: 'event',
                        eventCategory: 'AD_SDK_AD_REQUEST_ERROR',
                        eventAction: `h${h} d${d} m${m} y${y}`,
                    });
                }
            }
        }
    }
}

export default VideoAd;
