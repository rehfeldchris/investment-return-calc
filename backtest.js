function dateToDaysSince1970(date) {
    return daysDiff('1970-01-01', date);
}

function daysSince1970ToDate(days) {
    return addDays('1970-01-01', days);
}

/**
 * @param {Date} dateObj
 * @returns {string}
 */
function dateToYmdStr(dateObj) {
    return dateObj.getFullYear() + '-' + pad(dateObj.getMonth() + 1) + '-' + pad(dateObj.getDate());
}

function pad(val) {
    return _.repeat('0', 2 - String(val).length) + val;
}

function daysDiff(start, end) {
    const d1 = new Date(start);
    const d2 = new Date(end);

    const diffMillis = d2.getTime() - d1.getTime();
    return diffMillis / (86400 * 1000);
}

/**
 * @param {string} date
 * @return {{month: string, year: string, day: string}}
 */
function strToDatePieces(date) {
    const parts = date.split('-', 3);
    return {year: parts[0], month: parts[1], day: parts[2]};
}

/**
 * @param {string} date
 * @returns {Date}
 */
function strToDate(date) {
    const parts = strToDatePieces(date);
    return new Date(Number(parts.year), parts.month - 1, Number(parts.day), 12, 0, 0);
}

function addDays(date, days) {
    const d = strToDate(date);
    d.setMilliseconds(d.getMilliseconds() + (86400 * 1000 * days));
    return dateToYmdStr(d);
}

function addWeekdays(date, days) {
    const d = strToDate(date);

    d.setMilliseconds(d.getMilliseconds() + (86400 * 1000 * days));
    return dateToYmdStr(d);
}

function getDayName(date) {
    return ['Sun', 'Mon', 'Tu', 'Wed', 'Th', 'Fri', 'Sat'][strToDate(date).getDay()];
}

function addYears(date, years) {
    return addDays(date, years * 365);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function percentChange(startPrice, endPrice) {
    return 100 * ((endPrice - startPrice) / startPrice);
}

function round(num, digitsPrecision=2) {
    const pow = 10 ** digitsPrecision;
    return Math.round(num * pow) / pow;
}

class BackTest {

    journalEntries = [];
    capital = 0;
    shares = 0;
    /** @var {EnhancedStockData} enhancedStockData */
    enhancedStockData;

    currentDate = '';
    startDate = '';
    endDate = '';

    constructor(startingCapital = 0, startingShares = 0, enhancedStockData, startDate, endDate) {
        this.capital = startingCapital;
        this.shares = startingShares;
        this.enhancedStockData = enhancedStockData;
        this.currentDate = startDate;
        this.startDate = startDate;
        this.endDate = endDate;
        this.journal('Init.');
    }

    run() {

    }

    buyPercentShares(percentShares = undefined) {
        const price = this.getCurrentSharePrice();
        if (percentShares === undefined) {
            percentShares = this.capital / price;
        }
        this.shares += percentShares;
        this.capital -= percentShares * price;

        this.journal(`Bought ${round(percentShares)} shares`);
    }

    setPercentEquity(desiredPercent) {
        desiredPercent = clamp(desiredPercent, 0, 100);
        const targetEquityValue = (desiredPercent / 100) * this.getCurrentPortfolioValue();
        const targetShares = targetEquityValue / this.getCurrentSharePrice();
        const sharesToAdjust = targetShares - this.shares;
        this.adjustShares(sharesToAdjust);
    }

    setShares(targetShares) {
        const adjustmentShares = targetShares - this.shares;
        this.adjustShares(adjustmentShares);
    }

    adjustShares(numShares) {
        const currentSharePrice = this.getCurrentSharePrice();

        if (numShares >= 0) {
            // If they're buying, make sure they can afford it.
            const maxAffordable = this.capital / currentSharePrice;
            numShares = Math.min(numShares, maxAffordable);
        } else {
            // If selling, make sure they have enough shares (numShares will be a negative number)
            numShares = -Math.min(-numShares, this.shares);
        }

        const transactionValue = numShares * currentSharePrice;
        this.shares += numShares;
        this.capital -= transactionValue;
        this.journal(`${numShares >= 0 ? 'Bought' : 'Sold'} ${round(numShares)} shares valued at ${round(transactionValue)}`);
    }

    sellShares(shares = undefined) {
        const price = this.getCurrentSharePrice();
        if (shares === undefined) {
            shares = this.shares;
        }
        this.shares -= shares;
        this.capital += shares * price;

        this.journal(`Sold ${round(shares)} shares`);
    }

    getCurrentSharePrice() {
        let ee = this.getCurrentSharePriceEntry();
        if (!ee) {
            return null;
        }
        return ee.AdjClose;
    }

    /**
     * @return {ClosingPriceDataEntry}
     */
    getCurrentSharePriceEntry() {
        return this.enhancedStockData.closingPricesByDate[this.currentDate];
    }

    /**
     * Get an entry for a day relative to the current day. i.e. -5 is 5 business days ago.
     *
     * @param {number} daysOffset +- to go forward or backwards. This is business days, determined by which days we have data for.
     * @return {ClosingPriceDataEntry|null}
     */
    getSharePriceEntry(daysOffset = 0) {
        const idx = Number(this.enhancedStockData.closingPriceIndexesByDate[this.currentDate]);
        const desiredIdx = idx + daysOffset;
        return this.enhancedStockData.closingPriceData[desiredIdx];
    }

    /**
     * Gets ClosingPriceDataEntry for a range of days, relative to the current date.
     *
     * @example Data for yesterday, and today: getPriceEntriesRelative(-1, 0)
     * @example Data for the day before yesterday and yesterday: getPriceEntriesRelative(-2, -1)
     * @example Data today and the next 2 days: getPriceEntriesRelative(0, 2)
     *
     * @param {number} startDayOffset must be numerically less than the endDayOffset
     * @param {number} endDayOffset
     * @return {ClosingPriceDataEntry[]}
     */
    getPriceEntriesRelative(startDayOffset, endDayOffset) {
        // index 0 is for the oldest date, and the last elem is for the current date.
        // So, they're order oldest to newest.
        const priceDataEntries = [];
        for (let i = startDayOffset; i < endDayOffset; i++) {
            const entry = this.getSharePriceEntry(i);
            if (!entry) {
                throw new OutOfBoundsError(`No entry for offset ${i}.`, i);
            }
            priceDataEntries.push(entry);
        }

        return priceDataEntries;
    }

    getCurrentPortfolioValue() {
        return this.capital + this.getEquityValue();
    }

    getEquityValue() {
        return this.shares * this.getCurrentSharePrice();
    }

    getPercentCapital() {
        return 100 * (this.capital / this.getCurrentPortfolioValue());
    }

    getPercentEquity() {
        return 100 * (this.getEquityValue() / this.getCurrentPortfolioValue());
    }

    currentDayValid() {
        return this.currentDate <= this.endDate;
    }

    nextDay2() {
        if (this.currentDate < this.endDate) {
            this.currentDate = addDays(this.currentDate, 1);
            return true;
        } else {
            return false;
        }
    }


    nextDay() {
        while (this.currentDate < this.endDate) {
            this.currentDate = addDays(this.currentDate, 1);
            if (this.getCurrentSharePriceEntry()) {
                return true;
            }
        }

        return false;
    }


    log(str) {
        console.log(str);
    }

    journal(msg, extra) {
        this.journalEntries.push({
            msg,
            snapshot: {
                capital: round(this.capital),
                shares: round(this.shares),
                currentDate: this.currentDate,
                currentPrice: round(this.getCurrentSharePrice()),
                percentCapital: round(this.getPercentCapital()),
            },
            extra
        });
    }
}


class OutOfBoundsError extends Error {
    index;
    constructor(message, index) {
        super(message);
        this.index = index;
    }
}


class BackTestAlgo4Day extends BackTest {



    /**
     * @param {number} startDayOffset
     * @param {number} endDayOffset
     * @param {function(ClosingPriceDataEntry,ClosingPriceDataEntry):boolean} dailyChangeCallback
     * @param {function(ClosingPriceDataEntry,ClosingPriceDataEntry):boolean} totalChangeCallback
     * @return {boolean|*}
     */
    changesMatch(startDayOffset, endDayOffset, dailyChangeCallback, totalChangeCallback) {
        try {
            const priceDataEntries = this.getPriceEntriesRelative(startDayOffset, endDayOffset);

            // Check daily price changes.
            for (let i = 1; i < priceDataEntries.length; i++) {
                if (!dailyChangeCallback(priceDataEntries[i - 1], priceDataEntries[i])) {
                    return false;
                }
            }

            // Check total price change.
            return totalChangeCallback(priceDataEntries[0], priceDataEntries[priceDataEntries.length - 1]);
        } catch (e) {
            return false;
        }
    }

    changesFuzzyMatch(startDayOffset, endDayOffset, dailyPredicateCallback, minDailyPercentCorrect, totalPredicateCallback) {
        try {
            const priceDataEntries = this.getPriceEntriesRelative(startDayOffset, endDayOffset);

            // Check daily price changes.
            let numSuccess = 0;
            for (let i = 1; i < priceDataEntries.length; i++) {
                if (dailyPredicateCallback(priceDataEntries[i - 1], priceDataEntries[i])) {
                    numSuccess++;
                }
            }

            const pct = 100 * (numSuccess / priceDataEntries.length);
            if (pct < minDailyPercentCorrect) {
                return false;
            }

            // Check total price change.
            return totalPredicateCallback(priceDataEntries[0], priceDataEntries[priceDataEntries.length - 1]);
        } catch (e) {
            return false;
        }
    }

    isDownLastNDays(days, minDailyDipPercent, minTotalDipPercent) {
        // Add an extra day to go back, so we have a starting price to compare to.
        days++;

        const dailyPredicate = (priceDataA, priceDataB) => percentChange(priceDataA.AdjClose, priceDataB.AdjClose) < -minDailyDipPercent;
        const totalPredicate = (priceDataA, priceDataB) => percentChange(priceDataA.AdjClose, priceDataB.AdjClose) < -minTotalDipPercent;

        return this.changesFuzzyMatch(-days, 0, dailyPredicate, 60, totalPredicate);
        // return this.changesMatch(-days, 0, dailyChange, totalChange);
    }

    cooldowns = {
        buy: 0,
        sell: 0,
        trade: 0,
        downLastN: 0,
    };

    /**
     * @param {'buy'|'sell'|'trade'|'downLastN'} name
     */
    cooldown(name) {
        return this.cooldowns[name] >= 0;
    }

    /**
     * @param {'buy'|'sell'|'trade'|'downLastN'} name
     * @param days
     */
    setCooldown(name, days) {
        this.cooldowns[name] = days;
    }

    reduceCooldowns(days=1) {
        Object.keys(this.cooldowns).forEach(key => this.cooldowns[key] -= days);
    }

    run() {
        let t = 0;
        let i = 0;
        for (; this.currentDayValid(); this.reduceCooldowns()) {
            const percentEquity = this.getPercentEquity();
            if (percentEquity < 10 && !this.cooldown('buy')) {
                this.setPercentEquity(percentEquity + 1);
                this.setCooldown('buy', 5);
            } else if (percentEquity < 20 && !this.cooldown('buy')) {
                this.setPercentEquity(percentEquity + 0.5);
                this.setCooldown('buy', 5);
            } else if (percentEquity > 80 && !this.cooldown('sell')) {
                this.setPercentEquity(percentEquity - 0.5);
                this.setCooldown('sell', 5);
            } else if (percentEquity > 90 && !this.cooldown('sell')) {
                this.setPercentEquity(percentEquity - 1);
                this.setCooldown('sell', 5);
            }

            const minDaysLookback = 11;
            if (!this.cooldown('downLastN') && this.isDownLastNDays(minDaysLookback, 0.1, 8)) {
                const entries = this.getPriceEntriesRelative(-minDaysLookback, 0);
                this.journal(`Trigger ${minDaysLookback} day down buy.`, entries);
                this.setPercentEquity(percentEquity + 40);
                t++;
                this.setCooldown('downLastN', 10);
                this.setCooldown('sell', 90);
            }

            if (!this.nextDay()) {
                break;
            }
        }
        console.log('t=' + t);
    }
}














/**
 * @typedef {Object} StockData
 * @property {ApiRequestInfo} request
 * @property {Array<ClosingPriceDataEntry>} closingPriceData
 * @property {Array<DividendDataEntry>} dividendData
 * @property {Array<StockSplitDataEntry>} stockSplitData
 * @property {StockMetaData} stockMetaData
 */

/**
 * @typedef {Object} StockMetaData
 * @property {string} name
 * @property {string} shortName
 * @property {string} longName
 * @property {string} symbol
 */

/**
 * @typedef {StockData} EnhancedStockData
 * @augments StockData
 * @property {Object.<string, ClosingPriceDataEntry>} closingPricesByDate
 * @property {Object.<string, DividendDataEntry>} dividendByDate
 * @property {Object.<string, EnhancedStockSplitDataEntry>} stockSplitsByDate
 * @property {Object.<string, ClosingPriceDataEntry>} joinedDataByDate
 * @property {Object.<string, number>} closingPriceIndexesByDate
 */

/**
 * @typedef {Object} ApiRequestInfo
 * @property {string} ticker
 * @property {string} startDate
 * @property {string} endDate
 */

/**
 * @typedef {Object} DividendDataEntry
 * @property {string} Date
 * @property {number} Dividends
 */

/**
 * @typedef {Object} ClosingPriceDataEntry
 * @property {string} Date
 * @property {number} AdjClose
 * @property {number} Close
 * @property {number} High
 * @property {number} Low
 * @property {number} Open
 * @property {number} Volume
 */

/**
 * @typedef {Object} StockSplitDataEntry
 * @property {string} Date
 * @property {string} "Stock Splits"
 */

/**
 * @typedef {StockSplitDataEntry} EnhancedStockSplitDataEntry
 * @augments StockSplitDataEntry
 * @property {number} stockSplitDivisor
 * @property {number} stockSplitMultiplier
 * @property {number} stockSplitRatio
 */

/**
 * @typedef {Object} StartingMoneyStrategyInfo
 * @property {boolean} strategyIsShares
 * @property {number} startingMoney
 * @property {number} startingShares
 */
