$(function () {
    let $form = $('form');
    let $t = $('.testt');
    const $tickerName = $('[name=ticker]');
    const loadIndicator = SlidingLoadIndicatorLine.createInstance('global', $('.sliding-load-indicator-line')[0]);
    let slider;
    const stockSplitParsingRegex = /^(\d+)\/(\d+)$/i;

    $t.click(() => {
        loadIndicator.addLevel();
        setTimeout(() => {
            loadIndicator.deactivate();
        }, 2000);
    });

    /** @type {StockData} */
    let apiData;

    /** @type {EnhancedStockData} */
    let processedApiData;

    function getMinMaxEntries(closingPrices) {
        let min = _.minBy(closingPrices, 'Date');
        let max = _.maxBy(closingPrices, 'Date');
        return {min, max};
    }

    let numberFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    });

    function setTextValue(selector, textValue) {
        $(selector).text(textValue);
    }

    function formatNum(num) {
        return numberFormatter.format(num);
    }

    function percentGainFormat(start, end) {
        return (100 * (end - start) / start).toFixed(2);
    }

    function calcCompoundAnnualGrowthRate(startValue, endValue, years) {
        return (Math.pow(endValue / startValue, 1.0 / years) - 1.0) * 100;
    }

    function yearsDiff(start, end) {
        return daysDiff(start, end) / 365;
    }

    function daysDiff(start, end) {
        const d1 = new Date(start);
        const d2 = new Date(end);

        const diffMillis = d2.getTime() - d1.getTime();
        return diffMillis / (86400 * 1000);
    }

    function reinvestDividends(pricesByDate, dividends, taxRate) {
        const taxRateMultiplier = 1 - taxRate;
        let shares = 1.0;

        dividends.forEach(dividend => {
            let priceData = getNearestPriceDataOnOrAfter(dividend.Date, pricesByDate);
            const dividendReceived = dividend.Dividends * shares * taxRateMultiplier;
            const numSharesCanBuy = dividendReceived / priceData.AdjClose;
            shares += numSharesCanBuy;
            dividend.priceData = priceData;
        });

        return {shares, dividends};
    }

    function getNextDateAfter(date) {
        return addDays(date, 1);
    }

    /**
     *
     * @param {string} date
     * @returns {Date}
     */
    function strToDate(date) {
        const parts = date.split('-', 3);
        return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }

    function addDays(date, days) {
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

    function getNearestPriceDataOnOrAfter(date, pricesByDate) {
        let dateAfter = date;
        const max = 10;
        let i = 0;
        // Todo, maybe we should test the entry to make sure it's a good one. Eg, has Close price data.
        while (!pricesByDate[dateAfter]) {
            dateAfter = getNextDateAfter(date);
            if (++i > max) {
                throw new Error("tried too many times to find a price on or after " + date);
            }
        }

        return pricesByDate[dateAfter];
    }

    function getNearestPriceData(date, pricesByDate, goForwardsIfNotFound, maxDaysToSeekWhenNotFound = 6) {
        let dateCursor = date;
        let i = 0;
        // Todo, maybe we should test the entry to make sure it's a good one. Eg, has Close price data.
        while (!pricesByDate[dateCursor]) {
            dateCursor = addDays(dateCursor, goForwardsIfNotFound ? 1 : -1);
            if (++i > maxDaysToSeekWhenNotFound) {
                throw new Error("tried too many times to find a price near date " + date);
            }
        }

        return pricesByDate[dateCursor];
    }

    function getNearestPriceDataLookBothWaysIfNeeded(date, pricesByDate, goForwardsFirstIfNotFound, maxDaysToSeekWhenNotFound = 6) {
        try {
            const priceData = getNearestPriceData(date, pricesByDate, goForwardsFirstIfNotFound, maxDaysToSeekWhenNotFound);
            if (priceData) {
                return priceData;
            }
        } catch (ex) {

        }

        return getNearestPriceData(date, pricesByDate, !goForwardsFirstIfNotFound, maxDaysToSeekWhenNotFound);
    }

    function isBadClosingPriceDataEntry(priceData) {
        // Right now, we only use one field, so we just check that.
        return !priceData.Close;
    }

    function isBadDividendDataEntry(dividendData) {
        // Right now, we only use one field, so we just check that.
        return !dividendData.Dividends;
    }

    function isBadStockSplitDataEntry(stockSplitData) {
        // Right now, we only use one field, so we just check that.
        return !stockSplitData['Stock Splits'].match(stockSplitParsingRegex);
    }

    function countBadDataEntries(data) {
        const badClosingPriceDataEntries = data.closingPriceData.filter(isBadClosingPriceDataEntry);
        const numBadClosingPriceDataEntries = badClosingPriceDataEntries.length;
        const badDividendDataEntries = data.dividendData.filter(isBadDividendDataEntry);
        const numBadDividendDataEntries = badDividendDataEntries.length;
        const badStockSplitDataEntries = data.stockSplitData.filter(isBadStockSplitDataEntry);
        const numBadStockSplitDataEntries = badStockSplitDataEntries.length;

        let foundSplitAdjusted = false;
        _.forEach(data.joinedDataByDate, curr => {
            if (curr.stockSplitMultiplier) {
                try {
                    const prev = getNearestPriceData(addDays(curr.Date, -1), data.joinedDataByDate, false, 4);
                    const next = getNearestPriceData(addDays(curr.Date, 1), data.joinedDataByDate, false, 4);
                    console.log(`Stock Split on ${curr.Date}`, {prev, curr, next});
                    if (looksLikeAdjustedForSplit(prev.Close, next.Close, curr.stockSplitRatio, 0.2)) {
                        foundSplitAdjusted = true;
                        console.log(`Stock Split on ${curr.Date} was adjusted. Close`);
                    }
                    if (looksLikeAdjustedForSplit(prev.AdjClose, next.AdjClose, curr.stockSplitRatio, 0.2)) {
                        foundSplitAdjusted = true;
                        console.log(`Stock Split on ${curr.Date} was adjusted. AdjClose`);
                    }
                } catch (ex) {
                    console.log(`failed to find prev/next data entry for split on date ${curr.Date}`);
                }
            }
        });

        const badEntryData = {
            foundSplitAdjusted,
            badClosingPriceDataEntries,
            numBadClosingPriceDataEntries,
            badClosingPriceDataEntriesPercent: 100 * numBadClosingPriceDataEntries / (data.closingPriceData.length || 1),
            badDividendDataEntries,
            numBadDividendDataEntries,
            badDividendDataPercent: 100 * numBadDividendDataEntries / (data.dividendData.length || 1),
            badStockSplitDataEntries,
            numBadStockSplitDataEntries,
            badStockSplitDataPercent: 100 * numBadStockSplitDataEntries / (data.stockSplitData.length || 1),
            hasBadData: false
        };

        if (numBadClosingPriceDataEntries || numBadDividendDataEntries || numBadStockSplitDataEntries || foundSplitAdjusted) {
            console.log("bad data", badEntryData);
            badEntryData.hasBadData = true;
        }

        return badEntryData;
    }

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

    function makeLink(url, text) {
        let el = document.createElement('a');
        el.textContent = text;
        el.setAttribute('href', url);
        el.setAttribute('target', '_blank');
        return el;
    }

    function renderExternalLinks() {
        let ticker = $tickerName.val();
        $('.link-google').append(makeLink('https://www.google.com/finance?q=' + encodeURIComponent(ticker), 'Google Finance'));
        $('.link-yahoo').append(makeLink('https://finance.yahoo.com/quote/' + encodeURIComponent(ticker), 'Yahoo Finance'));
        $('.link-morningstar').append(makeLink('http://performance.morningstar.com/stock/performance-return.action?region=USA&culture=en_US&t=' + encodeURIComponent(ticker), 'Morningstar'));
    }

    function initSlider(minDate, maxDate) {
        let min = dateToDaysSince1970(minDate);
        let max = dateToDaysSince1970(maxDate);
        slider = new Slider("input.date-range-slider", {
            min: min,
            max: max,
            step: 1,
            value: [min, max],
            tooltip: 'always',
            formatter: function(values) {
                if ($.isArray(values)) {
                    const dates = values.map(daysSince1970ToDate);
                    return `${dates[0]} to ${dates[1]}`;
                } else {
                    const dates = [values].map(daysSince1970ToDate);
                    return dates[0];
                }
            }
        });

        slider.on('change', _.throttle(function() {
            let values = slider.getValue();
            calcAndRender(processedApiData, daysSince1970ToDate(values[0]), daysSince1970ToDate(values[1]));
        }, 100));
    }

    function renderOld(data, minDate, maxDate) {
        // Filter the entries, excluding stuff outside the GUI slider range.
        let priceData = data.closingPriceData.filter(entry => entry.Date >= minDate && entry.Date <= maxDate);
        let dividendData = data.dividendData.filter(entry => entry.Date >= minDate && entry.Date <= maxDate);

        const pricesByDate = _.keyBy(priceData, 'Date');
        console.log(pricesByDate);
        let {shares} = reinvestDividends(pricesByDate, dividendData, 0);
        let {shares: sharesTaxed} = reinvestDividends(pricesByDate, dividendData, 0.15);
        let {min, max} = getMinMaxEntries(priceData);
        let badEntries = countBadDataEntries(data);

        const yearsElapsed = yearsDiff(min.Date, max.Date);
        let dividendGain = _.sumBy(dividendData, 'Dividends');
        let stockGain = max.AdjClose - min.AdjClose;
        let totalGain = stockGain + dividendGain;
        setTextValue('.actual-start-date', min.Date);
        setTextValue('.actual-end-date', max.Date);
        setTextValue('.start-price', formatNum(min.AdjClose));
        setTextValue('.end-price', formatNum(max.AdjClose));
        setTextValue('.stock-gain', formatNum(stockGain));
        setTextValue('.dividend-gain', formatNum(dividendGain));
        setTextValue('.total-gain', formatNum(totalGain));
        setTextValue('.stock-gain-percent', percentGainFormat(min.AdjClose, max.AdjClose));
        setTextValue('.total-gain-percent', percentGainFormat(min.AdjClose, min.AdjClose + totalGain));
        setTextValue('.total-gain-cagr', calcCompoundAnnualGrowthRate(min.AdjClose, min.AdjClose + totalGain, yearsElapsed).toFixed(2));
        setTextValue('.total-gain-cagr-reinvest', calcCompoundAnnualGrowthRate(min.AdjClose, shares * max.AdjClose, yearsElapsed).toFixed(2));
        setTextValue('.total-gain-cagr-reinvest-taxed', calcCompoundAnnualGrowthRate(min.AdjClose, sharesTaxed * max.AdjClose, yearsElapsed).toFixed(2));
        setTextValue('.num-end-shares', shares.toFixed(2));
        setTextValue('.num-bad-closing-price-entries', `${badEntries.numBadClosingPriceDataEntries} (${badEntries.badClosingPriceDataEntriesPercent.toFixed(2)}%)`);
        setTextValue('.num-bad-dividend-entries', `${badEntries.numBadDividendDataEntries} (${badEntries.badDividendDataPercent.toFixed(2)}%)`);
        $('.result-pane').css('display', 'block');
    }

    /**
     *
     * @param {EnhancedStockData} data
     * @param {string} minDate
     * @param {string} maxDate
     */
    function calc(data, minDate, maxDate) {

        // Filter the entries, excluding stuff outside the GUI slider range.
        const isWithinDateRange = entry => entry.Date >= minDate && entry.Date <= maxDate;
        const joinedDataByDate = _.pickBy(data.joinedDataByDate, isWithinDateRange);

        const {shares: numSharesWithoutDividendReinvestment, totalDividendsReceived: totalDividendsReceivedNoDividendReinvestment} = simulateSplitsAndDividendReinvestment(joinedDataByDate, false, 0);
        const {shares, totalDividendsReceived, journal} = simulateSplitsAndDividendReinvestment(joinedDataByDate, true, 0);
        const {shares: sharesTaxed} = simulateSplitsAndDividendReinvestment(joinedDataByDate, true, 0.15);
        const {min, max} = getMinMaxEntries(_.values(joinedDataByDate));
        const badEntries = countBadDataEntries(data);

        const yearsElapsed = yearsDiff(min.Date, max.Date);
        const dividendGain = totalDividendsReceived;
        const startingStockValue = min.Close;
        const endingStockValue = shares * max.Close;
        const endingStockValueNoDividendReinvestment = numSharesWithoutDividendReinvestment * max.Close;
        const endingStockValueTaxed = sharesTaxed * max.Close;
        const stockGain = endingStockValue - startingStockValue;
        const totalGain = stockGain;
        // const totalGain = stockGain + dividendGain;
        const startingValue = startingStockValue;
        const endingValue = endingStockValue;
        const endingValueTaxed = endingStockValueTaxed;
        const endingValueNoDividendReinvestment = endingStockValueNoDividendReinvestment + totalDividendsReceivedNoDividendReinvestment;

        return {
            data,
            journal,
            joinedDataByDate,
            numSharesWithoutDividendReinvestment,
            totalDividendsReceivedNoDividendReinvestment,
            shares,
            totalDividendsReceived,
            sharesTaxed,
            min,
            max,
            badEntries,
            yearsElapsed,
            dividendGain,
            startingStockValue,
            endingStockValue,
            endingStockValueNoDividendReinvestment,
            endingStockValueTaxed,
            stockGain,
            totalGain,
            startingValue,
            endingValue,
            endingValueTaxed,
            endingValueNoDividendReinvestment,
        };
    }

    function render(d) {
        // Format: [selector, value]
        // Each row is translated into: $(selector).text(value)
        [
            ['.meta-stock-ticker', d.data.stockMetaData.symbol],
            ['.meta-stock-name', d.data.stockMetaData.shortName],
            ['.actual-start-date', d.min.Date],
            ['.actual-end-date', d.max.Date],
            ['.elapsed-years', d.yearsElapsed.toFixed(2)],
            ['.start-price', formatNum(d.min.Close)],
            ['.end-price', formatNum(d.max.Close)],
            // ['.stock-gain', formatNum(d.stockGain)],
            ['.dividend-gain', formatNum(d.dividendGain)],
            ['.total-gain', formatNum(d.totalGain)],
            ['.stock-gain-percent', percentGainFormat(d.startingStockValue, d.endingStockValue)],
            ['.total-gain-percent', percentGainFormat(d.startingValue, d.endingValue)],
            ['.total-gain-cagr', calcCompoundAnnualGrowthRate(d.startingValue, d.endingValueNoDividendReinvestment, d.yearsElapsed).toFixed(2)],
            ['.total-gain-cagr-reinvest', calcCompoundAnnualGrowthRate(d.startingValue, d.endingValue, d.yearsElapsed).toFixed(2) + '%'],
            ['.total-gain-cagr-reinvest-taxed', calcCompoundAnnualGrowthRate(d.startingValue, d.endingValueTaxed, d.yearsElapsed).toFixed(2) + '%'],
            ['.num-end-shares', d.shares.toFixed(2)],
            ['.num-bad-closing-price-entries', `${d.badEntries.numBadClosingPriceDataEntries} (${d.badEntries.badClosingPriceDataEntriesPercent.toFixed(2)}%)`],
            ['.num-bad-dividend-entries', `${d.badEntries.numBadDividendDataEntries} (${d.badEntries.badDividendDataPercent.toFixed(2)}%)`],
            ['.num-bad-stock-split-entries', `${d.badEntries.numBadStockSplitDataEntries} (${d.badEntries.badStockSplitDataPercent.toFixed(2)}%)`]
        ].forEach(pair => setTextValue(...pair));

        const tpl = _.template("<% _.forEach(stockSplitData, function(s) { %><div><%- `${s.Date}: ${s['Stock Splits']}` %></div><% }); %>");
        $('.stock-splits').html(tpl({stockSplitData: d.data.stockSplitData}));
        _.forEach(d.trailingCalculations, (d, yr) => {
            setTextValue(`.trailing-${yr}`, d ? calcCompoundAnnualGrowthRate(d.startingValue, d.endingValue, d.yearsElapsed).toFixed(2) : '');
        });
        $('.result-pane').css('display', 'block');
        if (d.badEntries.hasBadData) {
            $('.data-error-message').css('display', 'block');
            if (d.badEntries.foundSplitAdjusted) {
                $('.found-split-adjusted').css('display', 'table-row');
            }
        }

    }

    function calcAndRender(data, minDate, maxDate) {
        // Cal data for full date range.
        const d = calc(data, minDate, maxDate);

        // Now we also calc some other date ranges automatically.
        // Eg, the trailing 15 yr performance, 10 yr, 5 yr and so on.
        const availableYears = yearsDiff(minDate, maxDate);
        const periods = [50, 40, 35, 30, 25, 20, 15, 10, 5, 3, 2, 1];
        d.trailingCalculations = {};
        periods.forEach(period => {
            d.trailingCalculations[period] = availableYears >= period ? calc(data, addYears(maxDate, -period), maxDate) : null;
        });

        render(d);
        renderShareGrowthChartThrottled(d);
        renderMoneyGrowthChartThrottled(d);
    }

    function sortByKey(obj) {
        return _(obj).toPairs().sortBy(0).fromPairs().value();
    }

    /**
     *
     * @param {StockData} data
     * @returns {EnhancedStockData}
     */
    function processData(data) {
        const d = _.clone(data);
        d.closingPricesByDate = sortByKey(_.keyBy(d.closingPriceData, 'Date'));
        d.dividendsByDate = sortByKey(_.keyBy(d.dividendData, 'Date'));
        d.stockSplitsByDate = sortByKey(_.keyBy(d.stockSplitData.map(parseStockSplit), 'Date'));
        d.joinedDataByDate = _.mapValues(d.closingPricesByDate, (priceData, date) => {
            return Object.assign(
                {},
                {Day: getDayName(date)},
                priceData,
                d.dividendsByDate[date] || {},
                d.stockSplitsByDate[date] || {}
            );
        });

        // Check that no dividend or split occurred on a day w/out price data.
        const dividendDateDiff = _.difference(Object.keys(d.dividendsByDate), Object.keys(d.closingPricesByDate));
        const stockSplitDateDiff = _.difference(Object.keys(d.stockSplitsByDate), Object.keys(d.closingPricesByDate));
        if (dividendDateDiff.length || stockSplitDateDiff.length) {
            console.log({dividendDateDiff, stockSplitDateDiff});
            throw new Error("found dividends or stock splits on date without closing price data - calculations cant be made correctly");
        }

        return d;
    }

    function parseStockSplit(splitRecord) {
        const match = splitRecord['Stock Splits'].match(stockSplitParsingRegex);

        // Check for match, and make sure neither piece is 0.
        if (!match || !match[1] || !match[2]) {
            throw new Error("bad stock split data: " + splitRecord['Stock Splits']);
        }

        splitRecord.stockSplitMultiplier = Number(match[1]);
        splitRecord.stockSplitDivisor = Number(match[2]);
        splitRecord.stockSplitRatio = splitRecord.stockSplitMultiplier / splitRecord.stockSplitDivisor;

        return splitRecord;
    }

    function simulateSplitsAndDividendReinvestmentOld(pricesByDate, reinvestDividends, taxRate) {
        const taxRateMultiplier = 1 - taxRate;
        let shares = 1.0;

        let totalDividendsReceived = 0;
        _.forEach(pricesByDate, priceData => {
            if (priceData.Dividends) {
                const dividendReceived = priceData.Dividends * shares * taxRateMultiplier;
                totalDividendsReceived += dividendReceived;
                const numSharesCanBuy = dividendReceived / priceData.Close;
                if (reinvestDividends) {
                    shares += numSharesCanBuy;
                }
            }

            if (priceData.stockSplitRatio) {
                shares *= priceData.stockSplitRatio;
            }
        });

        return {shares, totalDividendsReceived};
    }

    function simulateSplitsAndDividendReinvestment(pricesByDate, reinvestDividends, taxRate) {
        const taxRateMultiplier = 1 - taxRate;
        let shares = 1.0;
        const dividendPurchaseLog = [];
        let totalDividendsReceived = 0;
        const journal = {
            shares: {}
        };
        _.forEach(pricesByDate, priceData => {
            if (priceData.Dividends) {
                const dividendReceived = priceData.Dividends * shares * taxRateMultiplier;
                totalDividendsReceived += dividendReceived;

                if (reinvestDividends) {
                    const days = 15;
                    const nearestPriceData = getNearestPriceDataLookBothWaysIfNeeded(addDays(priceData.Date, days), pricesByDate, true, days);
                    const numSharesCanBuy = dividendReceived / nearestPriceData.Close;
                    const logMsg = `Got dividend of $${priceData.Dividends.toFixed(3)} * ${shares.toFixed(3)} shares = $${dividendReceived.toFixed(3)} on ${priceData.Date}. Expected payment date is now + 14 days, so using the next day's price on ${nearestPriceData.Date}. Now buying ${numSharesCanBuy.toFixed(3)} shares at that day's price of $${nearestPriceData.Close.toFixed(3)}.`;
                    //console.log(logMsg);
                    dividendPurchaseLog.push(logMsg);
                    shares += numSharesCanBuy;
                    journal.shares[priceData.Date] = {Date: priceData.Date, shares};
                }

            }

            // if (priceData.stockSplitRatio) {
            //     shares *= priceData.stockSplitRatio;
            //     journal.shares[priceData.Date] = {Date: priceData.Date, shares};
            // }
        });

        return {shares, totalDividendsReceived, dividendPurchaseLog, journal};
    }

    function looksLikeAdjustedForSplit(prev, next, splitRatio, marginOfErrorPercent) {
        const pctChange = Math.abs(percentChange(prev / splitRatio, next));
        return pctChange < marginOfErrorPercent;
    }

    function percentChange(before, after) {
        return (after - before) / before;
    }

    function Point2d(x, y) {
        this.x = x;
        this.y = y;
    }

    const renderShareGrowthChartThrottled = _.throttle(renderShareGrowthChart, 1000, {trailing: true});
    const renderMoneyGrowthChartThrottled = _.throttle(renderMoneyGrowthChart, 1000, {trailing: true});

    let shareChart;
    let growthChart;

    function renderShareGrowthChart(data) {
        const $canvas = $('.share-growth-chart');
        const ctx = $canvas[0].getContext('2d');
        const points = _.map(data.journal.shares, d => new Point2d(d.Date, round2(d.shares)));

        // Destroy existing chart, if one exists.
        shareChart && shareChart.destroy();

        shareChart = makeChart(ctx, points, 'Share Growth', 'ds', 'Time', 'Num Shares');
    }

    function round2(val) {
        return val.toFixed(2);
    }

    function renderMoneyGrowthChart(data) {
        const $canvas = $('.money-growth-chart');
        const ctx = $canvas[0].getContext('2d');
        const points = _.map(data.journal.shares, d => new Point2d(d.Date, round2(d.shares * data.joinedDataByDate[d.Date].Close)));

        // Destroy existing chart, if one exists.
        growthChart && growthChart.destroy();

        growthChart = makeChart(ctx, points, 'Money', 'ds', 'Time', '$');
    }

    function checkStockSplitData(data) {
        _.forEach(data.joinedDataByDate, curr => {
            if (curr.stockSplitMultiplier) {
                try {
                    const prev = getNearestPriceData(addDays(curr.Date, -1), data.joinedDataByDate, false, 4);
                    const next = getNearestPriceData(addDays(curr.Date, 1), data.joinedDataByDate, false, 4);
                    console.log(`Stock Split on ${curr.Date}`, {prev, curr, next});
                    if (looksLikeAdjustedForSplit(prev.Close, next.Close, curr.stockSplitRatio, 0.2)) {
                        $('.found-split-adjusted').css('display', 'table-row');
                        console.log(`Stock Split on ${curr.Date} was adjusted. Close`);
                    }
                    if (looksLikeAdjustedForSplit(prev.AdjClose, next.AdjClose, curr.stockSplitRatio, 0.2)) {
                        $('.found-split-adjusted').css('display', 'table-row');
                        console.log(`Stock Split on ${curr.Date} was adjusted. AdjClose`);
                    }
                } catch (ex) {
                    console.log(`failed to find prev/next data entry for split on date ${curr.Date}`);
                }
            }
        });
    }

    function makeChart(chartContext2D, data, chartTitle, dataSetTitle, xAxisLabel, yAxisLabel) {
        const timeFormat = 'YYYY-MM-DD';
        const randomScalingFactor = function() {
            return Math.round(Math.random() * 10);
        };
        const randomColor = function(opacity) {
            return 'rgba(' + Math.round(Math.random() * 255) + ',' + Math.round(Math.random() * 255) + ',' + Math.round(Math.random() * 255) + ',' + (opacity || '.3') + ')';
        };

        const scatterChartData = {
            datasets: [{
                label: dataSetTitle,
                data: data
            }]
        };

        $.each(scatterChartData.datasets, function(i, dataset) {
            dataset.borderColor = randomColor(0.4);
            dataset.backgroundColor = randomColor(0.1);
            dataset.pointBorderColor = randomColor(0.7);
            dataset.pointBackgroundColor = randomColor(0.5);
            dataset.pointBorderWidth = 1;
        });

        // Logarithmic scale charts default to using scientific notation axis labels, which sucks.
        // Set it back to human readable numbers.
        Chart.scaleService.updateScaleDefaults('logarithmic', {
            ticks: {
                callback: function(tick, index, ticks) {
                    return tick.toLocaleString();
                }
            }
        });

        const chart = Chart.Scatter(chartContext2D, {
            data: scatterChartData,
            options: {
                title: {
                    display: true,
                    text: chartTitle
                },
                scales: {
                    // xAxes: [{
                    //     position: 'bottom',
                    //     gridLines: {
                    //         zeroLineColor: "rgba(0,255,0,1)"
                    //     },
                    //     scaleLabel: {
                    //         display: true,
                    //         labelString: xAxisLabel
                    //     }
                    // }],
                    xAxes: [{
                        type: "time",
                        time: {
                            format: timeFormat,
                            // round: 'day'
                            tooltipFormat: 'YYYY-MM-DD'
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Date'
                        }
                    }],
                    yAxes: [{
                        position: 'left',
                        type: 'logarithmic',
                        gridLines: {
                            zeroLineColor: "rgba(0,255,0,1)"
                        },
                        scaleLabel: {
                            display: true,
                            labelString: yAxisLabel
                        }
                    }]
                }
            }
        });

        return chart;
    }

    function callApi() {
        renderExternalLinks();
        loadIndicator.addLevel();

        let xhr = $.get({
            url: 'data.php',
            data: $form.serialize(),
            dataType: 'json'
        });

        /**
         * @param {StockData} data
         */
        function getApiDataSuccess(data) {
            apiData = data;
            processedApiData = processData(data);
            console.log(processedApiData);
            let {min, max} = getMinMaxEntries(processedApiData.closingPriceData);
            // The date arithmetic is a bit off, so we increase the slider boundaries a tiny bit to make sure
            // we can access all the data.
            initSlider(addDays(min.Date, -2), addDays(max.Date, 2));
            calcAndRender(processedApiData, min.Date, max.Date);
        }

        function getApiDataFail() {
            setTextValue('.error-message', 'Api data call failed. Try again later.');
        }

        xhr
            .done(getApiDataSuccess)
            .fail(getApiDataFail)
            .always(() => {
                loadIndicator.subtractLevel();
            });
    }

    /**
     * listens for ctrl kep presses, and if 3 in a row happen, we select the text in
     * the ticker input box. This is more convenient than using the mouse or
     * tab key when you want to enter a new ticker.
     */
    function installKeyListener() {
        // We want to detect 3 ctrl key presses in a row.
        let numCtrlKeyPressesInARow = 0;
        $(document).keydown(evt => {
            if (evt.ctrlKey && evt.key === 'Control') {
                numCtrlKeyPressesInARow++;
                if (numCtrlKeyPressesInARow === 3) {
                    numCtrlKeyPressesInARow = 0;
                    giveTickerInputBoxFocusAndSelectValue();
                }
            } else {
                // Wasn't a ctrl key, so clear the history.
                numCtrlKeyPressesInARow = 0;
            }
            console.log(evt);
        })
    }

    installKeyListener();
    giveTickerInputBoxFocusAndSelectValue();

    if ($tickerName.val()) {
        callApi();
    }

    // Select the text in the ticker box, making it easy to type over and enter a new value.
    function giveTickerInputBoxFocusAndSelectValue() {
        $tickerName[0].select();
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


});