/**
 * Helps show an animated line to indicate loading in progress. Often, you might want to show the indicator
 * while any async operation is running, and you may have multiple running at the same time, so this class helps you track
 * how many operations are in progress so that the indicator can be hidden once all of the operations are complete.
 *
 * Eg, if you have 3 ajax calls, make sure to call indicator.addLevel() right before each one starts (so, call it 3 times).
 * Likewise, once each ajax call completes, have each call indicator.subtractLevel(). Once the 3rd call is made, the
 * indicator will be hidden.
 *
 * Multiple instances per window are supported in case you need more than one indicator on the page. Also, named instances are tracked
 * via a global static map for convenience, but you don't need to use this functionality if you'd rather pass the
 * instance around yourself. Eg, to use it do:
 *
 * var main = SlidingLoadIndicatorLine.createInstance('main', domNode);
 *
 * @param {HTMLElement} domNode - the element with the class name 'sliding-load-indicator-line', which will be used to house the indicator.
 * @constructor
 */
function SlidingLoadIndicatorLine(domNode) {
    var numLevels = 0;
    var that = this;

    if (!domNode || !domNode.style) {
        throw new Error('domNode not a dom node');
    }

    this.addLevel = function() {
        // If we were at 0, we show the indicator because this method call will take us to 1.
        if (numLevels === 0) {
            // domNode.style.visibility = 'visible';
            domNode.classList.remove('sliding-load-indicator-line-off');

        }
        numLevels++;
    };

    this.subtractLevel = function() {
        // Don't go negative.
        if (numLevels === 0) {
            return;
        }

        numLevels--;

        // Once we reach zero, we hide it.
        if (numLevels === 0) {
            that.deactivate();
        }
    };

    /**
     * Same as addLevel()
     */
    this.activate = function() {
        that.addLevel();
    };

    /**
     * Hides the indicator, regardless of how many levels might be active.
     */
    this.deactivate = function() {
        numLevels = 0;
        // domNode.style.visibility = 'hidden';
        domNode.classList.add('sliding-load-indicator-line-off');
    };
}

/**
 * A global static convenience map for storing instances.
 *
 * @type {Object.<string, SlidingLoadIndicatorLine>}
 */
SlidingLoadIndicatorLine.instances = {};

/**
 * Gets an existing instance by name.
 *
 * @param {string} name - the name you supplied to createInstance()
 * @returns {SlidingLoadIndicatorLine|undefined}
 */
SlidingLoadIndicatorLine.getInstance = function(name) {
    if (SlidingLoadIndicatorLine.instances.hasOwnProperty(name)) {
        return SlidingLoadIndicatorLine.instances[name];
    }
};

/**
 * Gets an existing instance by name from the global map.
 *
 * @param {string} name - any string that you want. Use this same string later when calling getInstance()
 * @param {HTMLElement} domNode - the element with the class name 'sliding-load-indicator-line', which will be used to house the indicator.
 * @returns {SlidingLoadIndicatorLine}
 */
SlidingLoadIndicatorLine.createInstance = function(name, domNode) {
    if (SlidingLoadIndicatorLine.instances.hasOwnProperty(name)) {
        throw new Error('Instance already exists with name: ' + name);
    }
    return SlidingLoadIndicatorLine.instances[name] = new SlidingLoadIndicatorLine(domNode);
};
