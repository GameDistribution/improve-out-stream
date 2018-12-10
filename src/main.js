'use strict';

import 'es6-promise/auto';
import 'whatwg-fetch';
import PackageJSON from '../package.json';
import VideoAd from './components/VideoAd';
import EventBus from './components/EventBus';
import ImplementationTest from './components/ImplementationTest';

import {dankLog} from './modules/dankLog';
import {
    extendDefaults,
    getParentDomain,
    onVisibilityChange,
    debounce,
} from './modules/common';

let instance = null;

/**
 * SDK
 */
class SDK {
    /**
     * Constructor of SDK.
     * @param {Object} options
     * @return {*}
     */
    constructor(options) {
        // Make this a singleton.
        if (instance) {
            return instance;
        } else {
            instance = this;
        }

        // Set some defaults. We replace them with real given
        // values further down.
        const defaults = {
            debug: false,
            testing: false,
            prefix: 'idoutstream__',
            containerId: 'outstream',
            onEvent: function(event) {
                // ...
            },
        };

        if (options) {
            this.options = extendDefaults(defaults, options);
        } else {
            this.options = defaults;
        }

        // Set a version banner within the developer console.
        const version = PackageJSON.version;
        const banner = console.log(
            '%c %c %c improvedigital.com out-stream SDK | Version: ' +
            version + ' %c %c %c', 'background: #278CEB',
            'background: #006db6', 'color: #fff; background: #001c4a;',
            'background: #006db6', 'background: #278CEB',
            'background: #ffffff');
        /* eslint-disable */
        console.log.apply(console, banner);
        /* eslint-enable */

        // First make sure we have an element set for ad displaying.
        const container = document.getElementById(this.options.containerId);
        if (!container) {
            dankLog('SDK',
                'Container element is missing within the document!', 'error');
            return;
        }

        // Get referrer domain data.
        const parentDomain = getParentDomain();

        // Test domains.
        const testDomains = [];
        this.options.testing = this.options.testing ||
            testDomains.indexOf(parentDomain) > -1;
        if (this.options.testing) {
            dankLog('SDK_TESTING_ENABLED',
                this.options.testing, 'info');
        }

        // Open the debug console when debugging is enabled.
        try {
            if (localStorage.getItem('idoutstream_debug')) {
                this.openConsole();
            }
        } catch (error) {
            console.log(error);
        }

        // GDPR (General Data Protection Regulation).
        // Todo: Read out EuConsent and check if tracking is allowed.
        const consent = document.cookie.indexOf('EuConsent') > 0;

        // Load analytics solutions based on tracking consent.
        this._analytics(consent);

        // Setup all event listeners.
        // We also send a Google Analytics event for each one of our events.
        this.eventBus = new EventBus();

        // SDK events
        this.eventBus.subscribe('SDK_READY', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SDK_ERROR', (arg) => this._onEvent(arg));

        // IMA HTML5 SDK events
        this.eventBus.subscribe('AD_SDK_LOADER_READY',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_MANAGER_READY',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_REQUEST_ADS',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_ERROR', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SDK_FINISHED', (arg) => this._onEvent(arg));

        // Ad events
        this.eventBus.subscribe('AD_CANCELED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_ERROR', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_SAFETY_TIMER', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_BREAK_READY', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('AD_METADATA', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('ALL_ADS_COMPLETED',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('CLICK', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('COMPLETE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('CONTENT_PAUSE_REQUESTED',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('CONTENT_RESUME_REQUESTED',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('DURATION_CHANGE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('FIRST_QUARTILE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('IMPRESSION', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('INTERACTION', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('LINEAR_CHANGED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('LOADED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('LOG', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('MIDPOINT', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('PAUSED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('RESUMED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SKIPPABLE_STATE_CHANGED',
            (arg) => this._onEvent(arg));
        this.eventBus.subscribe('SKIPPED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('STARTED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('THIRD_QUARTILE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('USER_CLOSE', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('VOLUME_CHANGED', (arg) => this._onEvent(arg));
        this.eventBus.subscribe('VOLUME_MUTED', (arg) => this._onEvent(arg));

        // Only allow ads after a certain amount of time.
        this.adRequestInterval = 60000;
        this.adRequestTimer = (new Date(new Date().getTime() -
            this.adRequestInterval)).valueOf();

        // Start our advertisement instance. Setting up the
        // adsLoader should resolve the adsLoader promise.
        this.videoAdInstance = new VideoAd(container, {
            debug: false, // this.options.debug,
            domain: parentDomain,
            // Todo: add proper tag and targeting.
            // tag: '',
            // targeting: {},
        });

        // Enable some debugging perks.
        try {
            if (localStorage.getItem('idoutstream_debug')) {
                // So we can set a custom tag.
                if (localStorage.getItem('idoutstream_tag')) {
                    this.videoAdInstance.tag =
                        localStorage.getItem('idoutstream_tag');
                }
                // So we can call ads quickly.
                if (localStorage.getItem('idoutstream_interval')) {
                    this.adRequestInterval =
                        localStorage.getItem('idoutstream_interval');
                }
            }
        } catch (error) {
            console.log(error);
        }

        // Here we set events to track if the out-stream solution is in view.
        //
        // If someone modifies DOM, it can affect the element's visibility.
        // You should take control over that and call handler() manually.
        // Unfortunately, we have no cross browser onrepaint event. On the
        // other hand that allows us to make optimizations and perform
        // re-check only on DOM modifications that can change element's
        // visibility. After DOMContentLoaded is fired, styles are applied,
        // but the images are not loaded yet. So, we add onload
        // event listener. We can't catch zoom/pinch event yet.
        // Todo: Pause ad when out of view for >50%, resume if in view again.
        const inViewHandler = onVisibilityChange(container, () => {
            this.showAdvertisement();
        });

        addEventListener('DOMContentLoaded', debounce(inViewHandler, 100), false);
        addEventListener('load', debounce(inViewHandler, 100), false);
        addEventListener('scroll', debounce(inViewHandler, 100), false);
        addEventListener('resize', debounce(inViewHandler, 100), false);

        // Start video advertisement instance.
        this.videoAdInstance.start();
    }

    /**
     * _onEvent
     * Gives us a nice console log message for all our events going
     * through the EventBus.
     * @param {Object} event
     * @private
     */
    _onEvent(event) {
        // Show the event in the log.
        dankLog(event.name, event.message, event.status);
        // Push out a Google event for each event. Makes our
        // life easier. I think.
        try {
            /* eslint-disable */
            if (typeof window['ga'] !== 'undefined' && event.analytics) {
                window['ga']('gd.send', {
                    hitType: 'event',
                    eventCategory: (event.analytics.category)
                        ? event.analytics.category
                        : '',
                    eventAction: (event.analytics.action)
                        ? event.analytics.action
                        : '',
                    eventLabel: (event.analytics.label)
                        ? event.analytics.label
                        : '',
                });
            }
            /* eslint-enable */
        } catch (error) {
            console.log(error);
        }
        // Now send the event to the developer.
        this.options.onEvent(event);
    }

    /**
     * _analytics
     * @param {Boolean} consent
     * @private
     */
    _analytics(consent) {
        /* eslint-disable */
        // Load Google Analytics so we can push out a Google event for each of
        // our events.
        if (typeof window['ga'] === 'undefined') {
            (function(i, s, o, g, r, a, m) {
                i['GoogleAnalyticsObject'] = r;
                i[r] = i[r] || function() {
                    (i[r].q = i[r].q || []).push(arguments);
                }, i[r].l = 1 * new Date();
                a = s.createElement(o),
                    m = s.getElementsByTagName(o)[0];
                a.async = 1;
                a.src = g;
                m.parentNode.insertBefore(a, m);
            })(window, document, 'script',
                'https://www.google-analytics.com/analytics.js', 'ga');
        }

        // Todo: Add correct analytics id.
        window['ga']('create', 'UA-102601800-1', {
            'name': 'idoutstream',
            'cookieExpires': 90 * 86400,
        }, 'auto');

        // Anonymize IP and opt out of Google Analytics.
        if (!consent) {
            // Todo: double check if opting out works as well. Never used it...
            window['ga-disable-UA-102601800-1'] = true;
            window['ga']('set', 'anonymizeIp', true);
        }

        window['ga']('idoutstream.send', 'pageview');
    }

    /**
     * showAdvertisement
     * Invoke a video advertisement.
     * @public
     */
    showAdvertisement() {
        this.videoAdInstance.adsLoaderPromise.then(() => {
            const elapsed =
                (new Date()).valueOf() - this.adRequestTimer.valueOf();

            // Make sure ads can't be requested too often.
            if (elapsed < this.adRequestInterval) {
                dankLog('SDK_SHOW_ADVERTISEMENT',
                    'The advertisement was requested too soon after ' +
                    'the previous advertisement was finished.',
                    'warning');
            } else {
                dankLog('SDK_SHOW_ADVERTISEMENT',
                    'Requested the advertisement.',
                    'success');

                this.adRequestTimer = new Date();

                // Todo: Preload vastUrl so user doesnt have to wait for hb.
                this.videoAdInstance.requestAd().
                    then(vastUrl => this.videoAdInstance.loadAd(vastUrl)).
                    catch(error => {
                        this.videoAdInstance.onError(error);
                    });
            }
        }).catch((error) => {
            dankLog('SDK_SHOW_ADVERTISEMENT', error, 'error');
        });
    }

    /**
     * openConsole
     * Enable debugging, we also set a value in localStorage,
     * so we can also enable debugging without setting the property.
     * @public
     */
    openConsole() {
        try {
            const implementation = new ImplementationTest(this.options.testing);
            implementation.start();
            localStorage.setItem('idoutstream_debug', 'true');
        } catch (error) {
            console.log(error);
        }
    }
}

export default SDK;
