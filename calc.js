$(function () {
    let $form = $('form');
    let $t = $('.testt');
    const $tickerName = $('[name=ticker]');
    const loadIndicator = SlidingLoadIndicatorLine.createInstance('global', $('.sliding-load-indicator-line')[0]);
    let slider;
    const stockSplitParsingRegex = /^(\d+)[/:-](\d+)$/i;

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
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    let dollarFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    let percentFormatter = new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    function setTextValue(selector, textValue) {
        $(selector).text(textValue);
    }

    function formatNumber(num) {
        return numberFormatter.format(num);
    }

    function formatMoney(num) {
        return dollarFormatter.format(num);
    }

    function formatPercent(num) {
        // return (100 * (end - start) / start).toFixed(2);
        // return (100 * (end - start) / start).toFixed(2);
        return percentFormatter.format(num / 100);
    }

    function percentGain(start, end) {
        return 100 * (end - start) / start;
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

    function getDayName(date) {
        return ['Sun', 'Mon', 'Tu', 'Wed', 'Th', 'Fri', 'Sat'][strToDate(date).getDay()];
    }

    function addYears(date, years) {
        return addDays(date, years * 365);
    }

    /**
     * @param {string} date
     * @param {Object.<string, ClosingPriceDataEntry>} pricesByDate
     * @param {boolean} goForwardsIfNotFound
     * @param {number} maxDaysToSeekWhenNotFound
     * @return {ClosingPriceDataEntry}
     */
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
                    //console.log(`Stock Split on ${curr.Date}`, {prev, curr, next});
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

    function calcYearBoundarySliderTickInfo(minDate, maxDate) {
        let min = dateToDaysSince1970(minDate);
        let max = dateToDaysSince1970(maxDate);

        const minDatePieces = strToDatePieces(minDate);
        const maxDatePieces = strToDatePieces(maxDate);
        const tickLabels = [];
        const yearStartDates = [];
        for (let y = Number(minDatePieces.year) + 1; y <= Number(maxDatePieces.year); y++) {
            tickLabels.push(y);
            yearStartDates.push(`${y}-01-01`);// todo find first day w/ data?
        }


        const range = max - min;
        const ticks = yearStartDates.map(dateToDaysSince1970);
        const tickPositions = ticks.map(daysSince1970 => {
            const val = daysSince1970 - min;
            const pct = val / range;
            return pct * 100;
        });



        return {ticks, tickPositions, tickLabels};
    }

    function calcYearBoundarySliderRangeHighlightInfo(minDate, maxDate) {
        let min = dateToDaysSince1970(minDate);
        let max = dateToDaysSince1970(maxDate);

        const minDatePieces = strToDatePieces(minDate);
        const maxDatePieces = strToDatePieces(maxDate);
        const years = [];
        const yearStartDates = [];
        for (let y = Number(minDatePieces.year) + 1; y <= Number(maxDatePieces.year); y++) {
            years.push(y);
            yearStartDates.push(`${y}-01-01`);// todo find first day w/ data?
        }

        const rangeHighlights = yearStartDates.map(ymd => {
            const days = dateToDaysSince1970(ymd);
            return {start: days, end: days + 14, class: 'slider-year-start-marker'};
        });

        return {rangeHighlights};
    }

    function initSliderAndDateInputBoxes(minDate, maxDate) {
        let min = dateToDaysSince1970(minDate);
        let max = dateToDaysSince1970(maxDate);
        let $startDate = $('[name=startDate]');
        let $endDate =  $('[name=endDate]');
        let $lockStartEndSliders =  $('[name=lockStartEndSliders]');
        let $lockStartEndSliderDays =  $('[name=lockStartEndSliderDays]');

        $startDate.attr('min', minDate);
        $startDate.attr('max', maxDate);
        $endDate.attr('min', minDate);
        $endDate.attr('max', maxDate);
        $startDate.val(minDate);
        $endDate.val(maxDate);

        // const tickInfo = calcYearBoundarySliderTickInfo(minDate, maxDate);
        // const rangeHighlightInfo = calcYearBoundarySliderRangeHighlightInfo(minDate, maxDate);

        slider = new Slider("input.date-range-slider", {
            min,
            max,
            step: 1,
            value: [min, max],
            // ticks: tickInfo.ticks,
            // ticks_positions: tickInfo.tickPositions,
            // ticks_labels: tickInfo.tickLabels,
            // ticks_snap_bounds: 100,
            // rangeHighlights: rangeHighlightInfo.rangeHighlights,
            tooltip: 'hide',
            formatter: watchEx(function(values) {
                if (Array.isArray(values)) {
                    const dates = values.map(daysSince1970ToDate);
                    return `${dates[0]} to ${dates[1]}`;
                } else {
                    const dates = [values].map(daysSince1970ToDate);
                    return dates[0];
                }
            })
        });

        // We track the shift key, for use by the slider.
        let shiftKeysActive = false;
        document.addEventListener('keydown', watchEx(evt => shiftKeysActive = evt.shiftKey));
        document.addEventListener('keyup', watchEx(evt => shiftKeysActive = evt.shiftKey));

        let reRender = _.throttle(watchEx((start, end) => {
            calcAndRender(processedApiData, start, end, getStartingMoneyStrategyInfo());
            syncUrlQueryStringToMatchFormState($tickerName.val(), $startDate.val(), $endDate.val());
        }), 300,{leading: true, trailing: true});

        slider.on('change', watchEx(function(data) {
            let startDays = data.newValue[0];
            let endDays = data.newValue[1];

            if (shiftKeysActive) {
                // If they hold shift and drag, we hold the num days between the 2 slider scrubbers constant, so
                // they can drag and see, for example, an 8 yr sliding window.
                const windowWidthDays = data.oldValue[1] - data.oldValue[0];

                // First, we detect which scrubber they're dragging.
                if (data.oldValue[0] !== data.newValue[0]) {
                    startDays = data.newValue[0];
                    endDays = data.newValue[0] + windowWidthDays;
                    console.log('1', {newValue: [startDays, endDays], windowWidthDays});
                    slider.setValue([startDays, endDays], false, false);
                } else if (data.oldValue[1] !== data.newValue[1]) {
                    startDays = data.newValue[1] - windowWidthDays;
                    endDays = data.newValue[1];
                    console.log('2', {newValue: [startDays, endDays], windowWidthDays});
                    slider.setValue([startDays, endDays], false, false);
                } else {
                    console.log('no chg');
                }
            }

            const start = daysSince1970ToDate(startDays);
            const end = daysSince1970ToDate(endDays);

            $startDate.val(start);
            $endDate.val(end);

            reRender(start, end);
        }));

        function getClampedDays(ymdDateStr, defaultVal) {
            let days = dateToDaysSince1970(ymdDateStr);
            if (isNaN(days) || days < min || days > max) {
                days = defaultVal;
            }
            return days;
        }

        function syncSliderWithDateInputBoxes() {
            let start = getClampedDays($startDate.val(), min);
            let end = getClampedDays($endDate.val(), max);
            slider.setValue([start, end], false, true);
        }

        $startDate.on('input', syncSliderWithDateInputBoxes);
        $endDate.on('input', syncSliderWithDateInputBoxes);
        syncSliderWithDateInputBoxes();
        reRender(minDate, maxDate);
    }

    /**
     *
     * @param {EnhancedStockData} data
     * @param {string} minDate
     * @param {string} maxDate
     * @param {StartingMoneyStrategyInfo} startStrategy
     */
    function calc(data, minDate, maxDate, startStrategy) {

        // Filter the entries, excluding stuff outside the GUI slider range.
        const isWithinDateRange = entry => entry.Date >= minDate && entry.Date <= maxDate;
        const joinedDataByDate = _.pickBy(data.joinedDataByDate, isWithinDateRange);

        // Find the min and max data entries by date, within our date range.
        const {min, max} = getMinMaxEntries(_.values(joinedDataByDate));

        // Calculate how many shares to start the calculation with.
        const startingShares = startStrategy.strategyIsShares ? startStrategy.startingShares : startStrategy.startingMoney / min.Close;

        const {shares: numSharesWithoutDividendReinvestment, totalDividendsReceived: totalDividendsReceivedNoDividendReinvestment} = simulateSplitsAndDividendReinvestment(joinedDataByDate, false, 0, startingShares);
        const {shares, totalDividendsReceived, journal} = simulateSplitsAndDividendReinvestment(joinedDataByDate, true, 0, startingShares);
        const {shares: sharesTaxed} = simulateSplitsAndDividendReinvestment(joinedDataByDate, true, 0.25, startingShares);

        const badEntries = countBadDataEntries(data);
        const yearsElapsed = yearsDiff(min.Date, max.Date);
        const dividendGain = totalDividendsReceived;
        const startingStockValue = startingShares * min.Close;
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
            startingShares,
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
            ['.elapsed-years', formatNumber(d.yearsElapsed)],
            ['.start-price', formatMoney(d.min.Close)],
            ['.end-price', formatMoney(d.max.Close)],
            // ['.stock-gain', formatNum(d.stockGain)],
            ['.dividend-gain', formatMoney(d.dividendGain)],
            ['.total-gain', formatMoney(d.totalGain)],
            ['.stock-gain-percent', formatPercent(percentGain(d.startingStockValue, d.endingStockValue))],
            ['.total-gain-percent', formatPercent(percentGain(d.startingValue, d.endingValue))],
            ['.total-gain-cagr', formatPercent(calcCompoundAnnualGrowthRate(d.startingValue, d.endingValueNoDividendReinvestment, d.yearsElapsed))],
            ['.total-gain-cagr-reinvest', formatPercent(calcCompoundAnnualGrowthRate(d.startingValue, d.endingValue, d.yearsElapsed))],
            ['.total-gain-cagr-reinvest-taxed', formatPercent(calcCompoundAnnualGrowthRate(d.startingValue, d.endingValueTaxed, d.yearsElapsed))],
            ['.num-start-shares', formatNumber(d.startingShares)],
            ['.num-end-shares', formatNumber(d.shares)],
            ['.num-bad-closing-price-entries', `${d.badEntries.numBadClosingPriceDataEntries} (${formatPercent(d.badEntries.badClosingPriceDataEntriesPercent)})`],
            ['.num-bad-dividend-entries', `${d.badEntries.numBadDividendDataEntries} (${formatPercent(d.badEntries.badDividendDataPercent)})`],
            ['.num-bad-stock-split-entries', `${d.badEntries.numBadStockSplitDataEntries} (${formatPercent(d.badEntries.badStockSplitDataPercent)})`]
        ].forEach(pair => setTextValue(...pair));

        const tpl = _.template("<% _.forEach(stockSplitData, function(s) { %><div><%- `${s.Date}: ${s['Stock Splits']}` %></div><% }); %>");
        $('.stock-splits').html(tpl({stockSplitData: d.data.stockSplitData}));
        _.forEach(d.trailingCalculations, (d, periodLabel) => {
            setTextValue(`.trailing-${periodLabel}`, d ? formatNumber(calcCompoundAnnualGrowthRate(d.startingValue, d.endingValue, d.yearsElapsed)) : '');
        });
        $('.result-pane, .date-range-inputs').css('display', 'block');
        if (d.badEntries.hasBadData) {
            $('.data-error-message').css('display', 'block');
            if (d.badEntries.foundSplitAdjusted) {
                $('.found-split-adjusted').css('display', 'table-row');
            }
        }

    }

    function backTest(d, startingShares, minDate, maxDate) {
        const backTest = new BackTestAlgo4Day(0, startingShares, d.data, minDate, maxDate);
        backTest.run();
        console.log('***********************************************************');
        console.log('Algo', dollarFormatter.format(backTest.getCurrentPortfolioValue()));
        console.log('BuyHold', dollarFormatter.format(d.endingValue));
        console.log('journal', backTest.journalEntries);
    }

    function calcAndRender(data, minDate, maxDate, startingMoneyStrategyInfo) {
        // Calc data for full date range.
        const d = calc(data, minDate, maxDate, startingMoneyStrategyInfo);

        d.trailingCalculations = {};

        // Now we also calc some other date ranges automatically.
        // Eg, the trailing 15 yr performance, 10 yr, 5 yr and so on.
        const yearPeriods = [50, 40, 35, 30, 25, 20, 15, 10, 5, 3, 2, 1];
        yearPeriods.forEach(years => {
            const periodStartDate = addYears(maxDate, -years);
            const periodEndDate = maxDate;
            d.trailingCalculations[years + 'yr'] = periodStartDate >= minDate && periodEndDate <= maxDate ? calc(data, periodStartDate, periodEndDate, startingMoneyStrategyInfo) : null;
        });

        // Note, doing small periods like 5 days, 1 day gets tricky because you need to account for business days.
        // When doing 30+ days we dont bother calculating business days, but for shorter time windows you need to.
        // For example, a 1 day window will fail if you try to calc it on a monday or tue, because there's no closing price for the prev day.
        const dayPeriods = [180, 90, 30];
        dayPeriods.forEach(days => {
            const periodStartDate = addDays(maxDate, -days);
            const periodEndDate = maxDate;
            d.trailingCalculations[days + 'd'] = periodStartDate >= minDate && periodEndDate <= maxDate ? calc(data, periodStartDate, periodEndDate, startingMoneyStrategyInfo) : null;
        });

        // Calc ytd. We use the max year, which may not be the current year.
        const periodStartDate = maxDate.slice(0, 4) + "-01-01";
        const periodEndDate = maxDate;
        d.trailingCalculations['ytd'] = periodStartDate >= minDate && periodEndDate <= maxDate ? calc(data, periodStartDate, periodEndDate, startingMoneyStrategyInfo) : null;

        render(d);
        renderShareGrowthChartThrottled(d);
        renderMoneyGrowthChartThrottled(d);
        renderDividendHistoryChartThrottled(d);



        const isWithinDateRange = entry => entry.Date >= minDate && entry.Date <= maxDate;
        const joinedDataByDate = _.pickBy(data.joinedDataByDate, isWithinDateRange);
        // Find the min and max data entries by date, within our date range.
        const {min, max} = getMinMaxEntries(_.values(joinedDataByDate));

        const startingShares = startingMoneyStrategyInfo.strategyIsShares ? startingMoneyStrategyInfo.startingShares : startingMoneyStrategyInfo.startingMoney / min.Close;
        backTest(d, startingShares, min.Date, max.Date);
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
        // First, ensure the numeric array keys order the entries correctly, by the obj Date property.
        d.closingPriceData = d.closingPriceData.sort((a, b) => a === b ? 0 : (a < b ? -1 : 1));
        // Now, we make an obj with date keys, and values that reference the numeric index where that date can be found.
        d.closingPriceIndexesByDate = _(d.closingPriceData).map(priceData => priceData.Date).invert().value();

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
            // Maybe this isnt such a bad thing? We DRIP on the next day that has price data...so not a big deal.
            console.error("found dividends or stock splits on date without closing price data - calculations cant be made correctly", {dividendDateDiff, stockSplitDateDiff});
            //throw new Error("found dividends or stock splits on date without closing price data - calculations cant be made correctly");
        }

        // Calculate dividends by year.
        d.dividendsByYear = {};
        d.dividendData.forEach(entry => {
            const year = entry.Date.slice(0, 4);
            d.dividendsByYear[year] = d.dividendsByYear[year] || 0;
            d.dividendsByYear[year] += entry.Dividends;
        });

        console.log(d.dividendsByYear);

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

    function simulateSplitsAndDividendReinvestment(pricesByDate, reinvestDividends, taxRate, startingShares) {
        const taxRateMultiplier = 1 - taxRate;
        let shares = startingShares;
        const dividendPurchaseLog = [];
        let totalDividendsReceived = 0;
        const journal = {
            shares: {},
            sharesOnAllDates: {},
            dividendsReceived: {},
        };
        _.forEach(pricesByDate, priceData => {
            // Always make an entry. We might overwrite it a few lines down if we do a dividend reinvestment on this date.
            journal.sharesOnAllDates[priceData.Date] = {Date: priceData.Date, shares};

            if (priceData.Dividends) {
                const dividendReceived = priceData.Dividends * shares * taxRateMultiplier;
                totalDividendsReceived += dividendReceived;
                journal.dividendsReceived[priceData.Date] = {Date: priceData.Date, dividendReceived};

                if (reinvestDividends) {
                    const days = 15;
                    const nearestPriceData = getNearestPriceDataLookBothWaysIfNeeded(addDays(priceData.Date, days), pricesByDate, true, days);
                    const numSharesCanBuy = dividendReceived / nearestPriceData.Close;
                    const logMsg = `Got dividend of $${priceData.Dividends.toFixed(3)} * ${shares.toFixed(3)} shares = $${dividendReceived.toFixed(3)} on ${priceData.Date}. Expected payment date is now + 14 days, so using the next day's price on ${nearestPriceData.Date}. Now buying ${numSharesCanBuy.toFixed(3)} shares at that day's price of $${nearestPriceData.Close.toFixed(3)}.`;
                    //console.log(logMsg);
                    dividendPurchaseLog.push(logMsg);
                    shares += numSharesCanBuy;
                    journal.sharesOnAllDates[priceData.Date] = {Date: priceData.Date, shares};
                }

            }

            // if (priceData.stockSplitRatio) {
            //     shares *= priceData.stockSplitRatio;
            //     journal.shares[priceData.Date] = {Date: priceData.Date, shares};
            // }
        });

        // We later use the journal to make charts, but an entry for each day is too much data and slows the page down.
        // So, we will use 1 entry per month, which is sufficient for charting purposes.
        // Since this data is sorted by date, we should end up with the data point for the last day of each month.
        _.forEach(journal.sharesOnAllDates, entry => {
            const yearMonth = entry.Date.slice(0, 7);
            journal.shares[yearMonth] = entry;
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
    const renderDividendHistoryChartThrottled = _.throttle(renderDividendHistoryChart, 1000, {trailing: true});

    let shareChart;
    let dividendHistoryChart;
    let growthChart;

    function round2(val) {
        return val.toFixed(2);
    }

    function renderShareGrowthChart(data) {
        const $canvas = $('.share-growth-chart');
        const ctx = $canvas[0].getContext('2d');
        const points = _.map(data.journal.shares, d => new Point2d(d.Date, round2(d.shares)));

        // Destroy existing chart, if one exists.
        shareChart && shareChart.destroy();

        shareChart = makeChart(ctx, points, 'Share Growth', 'ds', 'Time', 'Num Shares');

        $canvas.siblings('[name=reset]').on('click', evt => shareChart.resetZoom());
    }

    function renderDividendHistoryChart(data) {
        const $canvas = $('.dividend-history-chart');
        const ctx = $canvas[0].getContext('2d');
        const points = _.map(data.data.dividendsByDate, d => new Point2d(d.Date, round2(d.Dividends)));

        // Destroy existing chart, if one exists.
        dividendHistoryChart && dividendHistoryChart.destroy();

        const tooltipCallback = tooltipItem => {
            const closingPriceDataEntry = data.data.closingPricesByDate[tooltipItem.xLabel];
            const dividend = tooltipItem.yLabel;
            const percent = dividend / closingPriceDataEntry.AdjClose;
            const year = closingPriceDataEntry.Date.slice(0, 4);
            const annualDividends = data.data.dividendsByYear[year];
            const annualPercent =  annualDividends / closingPriceDataEntry.AdjClose;
            const msg = (new Date()).getFullYear() === Number(year) ? ' (so far this year)' : '';

            // Each array elem is treated as a line of text.
            return [
                `Current: ${dollarFormatter.format(tooltipItem.yLabel)} ${percentFormatter.format(percent)}`,
                `Annual${msg}: ${dollarFormatter.format(annualDividends)} ${percentFormatter.format(annualPercent)}`
            ];
        };

        dividendHistoryChart = makeChart(ctx, points, 'Dividends', 'ds', 'Time', '$', tooltipCallback);
        $canvas.siblings('[name=reset]').on('click', evt => dividendHistoryChart.resetZoom());
    }

    function renderMoneyGrowthChart(data) {
        const $canvas = $('.money-growth-chart');
        const ctx = $canvas[0].getContext('2d');
        const points = _.map(data.journal.shares, d => new Point2d(d.Date, round2(d.shares * data.joinedDataByDate[d.Date].Close)));

        // Destroy existing chart, if one exists.
        growthChart && growthChart.destroy();

        growthChart = makeChart(ctx, points, 'Value of Shares Owned', 'ds', 'Time', '$');
        $canvas.siblings('[name=reset]').on('click', evt => growthChart.resetZoom());
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

    function makeChart(chartContext2D, data, chartTitle, dataSetTitle, xAxisLabel, yAxisLabel, tooltipLabelCallback) {
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

        scatterChartData.datasets.forEach((dataset, i) => {
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

        const chartConfig = {
            type: 'line',
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
                            parser: timeFormat,
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
                },
                plugins: {
                    zoom: {
                        pan: {
                            // Boolean to enable panning
                            enabled: true,
                            mode: 'xy',
                        },
                        zoom: {
                            // Boolean to enable zooming
                            enabled: true,
                            mode: 'xy',
                        }
                    }
                }
            }
        };

        // Only config the tooltip callback if they passed the arg. This allows the default
        // tooltip to work if the caller didn't customize it.
        if (tooltipLabelCallback) {
            chartConfig.options.tooltips = {callbacks: {label: tooltipLabelCallback}};
        }

        return new Chart(chartContext2D, chartConfig);
    }

    function callApi() {
        renderExternalLinks();
        loadIndicator.addLevel();

        const xhr = fetch('data.php?ticker=' + encodeURIComponent($tickerName.val()));

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
            // initSliderAndDateInputBoxes(addDays(min.Date, -2), addDays(max.Date, 2));
            // initSliderAndDateInputBoxes(addDays(min.Date, -1), addDays(max.Date, 1));
            initSliderAndDateInputBoxes(min.Date, max.Date);
        }

        function getApiDataFail() {
            setTextValue('.error-message', 'Api data call failed. Try again later.');
        }

        xhr
            .then(r => r.json())
            .then(watchEx(getApiDataSuccess), watchEx(getApiDataFail))
            .then(watchEx(() => {
                loadIndicator.subtractLevel();
            }));
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
        })
    }

    function syncUrlQueryStringToMatchFormState(ticker, startDate, endDate) {
        let params = new URLSearchParams();
        params.set('ticker', ticker);
        params.set('startDate', startDate);
        params.set('endDate', endDate);

        // We only put the param needed to fulfill the strategy they selected.
        const strategyInfo = getStartingMoneyStrategyInfo();
        params.set('startStrategy', strategyInfo.strategyIsShares ? 'shares' : 'money');
        if (strategyInfo.strategyIsShares) {
            params.set('startingShares', strategyInfo.startingShares);
        } else {
            params.set('startingMoney', strategyInfo.startingMoney);
        }
        const url = '?' + params;

        // console.log(url, params);
        history.replaceState({}, "", url);
    }

    installKeyListener();
    giveTickerInputBoxFocusAndSelectValue();
    setupInitialMoneyRadios();

    if ($tickerName.val()) {
        callApi();
    }

    // Select the text in the ticker box, making it easy to type over and enter a new value.
    function giveTickerInputBoxFocusAndSelectValue() {
        $tickerName[0].select();
    }

    function setupInitialMoneyRadios() {
        function setActiveRow(strategyIsShares) {
            $(strategyIsShares ? '#startingShares' : '#startingMoney' ).removeAttr('readonly').select();
            $(strategyIsShares ? '#startingMoney ' : '#startingShares').attr('readonly', 'readonly');
        }

        const $ssMoney = $('#startStrategyMoney');
        const $ssShares = $('#startStrategyShares');
        // Clicking on either the label, or the input text box, we make it like you also clicked the radio.
        $('[for=startingMoney],#startingMoney').click(evt => $ssMoney.click());
        $('[for=startingShares],#startingShares').click(evt => $ssShares.click());

        $ssMoney.click(evt => setActiveRow(false));
        $ssShares.click(evt => setActiveRow(true));
    }

    /**
     * @return {StartingMoneyStrategyInfo}
     */
    function getStartingMoneyStrategyInfo() {
        const strategyIsShares = !!$form.find('#startStrategyShares').is(':checked');
        return {
            strategyIsShares,
            startingMoney: Number($form.find('#startingMoney').val()),
            startingShares: Number($form.find('#startingShares').val()),
        };
    }

    function watchEx(fn) {
        return function watchExWrapper() {
            try {
                return fn.apply(this, arguments);
            } catch (ex) {
                console.error(`caught ex for fn with name '${fn.name}' and code: ${fn}`, ex);
                throw ex;
            }
        };
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
     * @property {string} Date this is actually the EX / EFF date, not the payment date.
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


});