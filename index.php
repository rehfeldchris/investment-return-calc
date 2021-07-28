<?php
$escape = function($str) {
    return htmlspecialchars($str, ENT_QUOTES);
};

$checkedIf = function($key, $val, $defaultCheckedIfNotSet) {
    if (!isset($_GET[$key])) {
        return $defaultCheckedIfNotSet ? 'checked' : '';
    }
    return $_GET[$key] === $val ? 'checked' : '';
};


$strategyActive = function($strategy) {
    if (!isset($_GET['startStrategy'])) {
        return $strategy === 'money';
    }
    return $_GET['startStrategy'] === $strategy;
};

?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Stock DRIP CAGR Calculator</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/css/bootstrap.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/11.0.2/css/bootstrap-slider.css">
    <link rel="stylesheet" href="SlidingLoadIndicatorLine.css">
    <style>
        input.date-range-slider {
            width: 100% !important;
        }
        .slider {
            width: 100% !important;
        }

        .loader {
            height: 4px;
            width: 100%;
            position: relative;
            overflow: hidden;
            background-color: #ddd;
        }
        .loader:before{
            display: block;
            position: absolute;
            content: "";
            left: -200px;
            width: 200px;
            height: 4px;
            background-color: #2980b9;
            animation: loading 2s linear infinite;
        }

        @keyframes loading {
            from {left: -200px; width: 30%;}
            50% {width: 30%;}
            70% {width: 70%;}
            80% { left: 50%;}
            95% {left: 120%;}
            to {left: 100%;}
        }

        .ticker-form {
            margin: 3em;
        }

        .slider-handle {
            cursor: pointer;
        }

        .result-table>tbody td:first-child {
            text-align: right;
        }

        table.trailing-gains > tbody > tr > td, table.trailing-gains > thead > tr > th {
            padding: 2px 5px;
        }
        .result-table.table, .trailing-gains.table {
            width: auto;
            margin: 1em;
            float: left;
        }
        .stock-splits {
            font-size: x-small;
        }
        .growth-chart-wrapper {
            width: 1200px;
            /*height: 800px;*/
        }
        .note {
            color: #aaa;
        }
        abbr[title] {
            border-bottom: none !important;
        }
        .start-date {
            float: left;
        }
        .end-date {
            float: right;
        }
        .date-range-inputs:after {
            content: "";
            clear: both;
        }
        .slider-year-start-marker {
            background: orange;
        }

    </style>
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=UA-109525922-1"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'UA-109525922-1');
    </script>

</head>
<body>
<div class="sliding-load-indicator-line sliding-load-indicator-line-off"></div>
<div class="container-fluid">
    <h1 class="text-center">Stock Investment Return Calculator</h1>
    <h3 class="text-center">Calc <a href="cagr.html">CAGR</a> after Reinvesting Dividends, over any time window</h3>

    <details>
        <summary>Information</summary>

        <p>This tool helps you calculate trailing total returns (<abbr title="Compound Annual Growth Rate aka Geometric Returns">CAGR</abbr>) for a stock-like investment.
            It will consider the change in the price of the stock, dividends received over the time period, and splits. It assumes you start by purchasing 1 share of the
            stock, and it will reinvest the dividends from that point on.</p>

        <p>This tool makes it easy to answer questions that involve calculating returns over arbitrary time windows like:</p>
        <ul>
            <li>"What would my returns have been if I bought GOOG in Jan 2007 and sold in Oct 2013?"</li>
            <li>"Were there any 10 year periods where I would have lost money in APPL stock?"</li>
        </ul>

        <p class="note">
            <strong>Note</strong>: This tool is in Beta.
        </p>

        <p class="note">This tool computes returns using market prices, not <abbr title="Net Asset Value">NAV</abbr>. This is in contrast
            to <a href="https://admainnew.morningstar.com/webhelp/glossary_definitions/closed_end/glossary_ce_nav_total_return.html">Morningstar, whose trailing total returns are NAV based</a>.
            I prefer calculating returns based on market prices, because you &amp; I pay market prices when we buy and sell the stocks. But, if you wonder why
            the returns listed in this tool don't always exactly match up with Morningstar's Trailing Total Returns, that's probably the reason.
        </p>

        <p class="note"><b>A note on accuracy</b>: this tool uses free data from Yahoo Finance. Free data (and even commercial data) has a history of being flawed,
            especially when complicated stuff happens, like buying/selling off part of the company in exchange for part of another company. This isn't a problem unique to this
            tool. If you look carefully - like I have - at other calculators found on the web, many of them give different results, and sometimes wildly so.
            I added code which analyzes the data, looking for obvious flaws, so that the tool can report them to you - making you aware that
            the accuracy of the data and results are suspect. But, many data anomalies are hard or impossible to auto detect, so don't rely too heavily on this feature.
            While I pledge to disclose any known accuracy flaws in this tool, being shrewd and doing your own due diligence is still your responsibility, not mine.
        </p>

        <p class="note"><b>I encourage you to compare the results of this tool to others like it.</b>
            Pay attention to the calculation date ranges when comparing to other tools!
            I think you'll find this tool tends to be more accurate, but more importantly, comparisons may reveal differences you may want to know
            about. While this tool (and many others on the web) uses Yahoo Finance data, some use other sources, and so comparing
            with other tools might be revealing if there's a significant difference in the data which leads to different calculations.</p>

        <p class="note"><b>Next feature:</b> I plan to add a log that makes it easy for you to inspect the calculations. It will be a journal-style log,
            which will show an entry for each event. e.g.
        </p>
        <div>
        <textarea disabled readonly style="width: 100%; height: 3em; font-family: monospace; overflow: hidden;">
Jun 3, 2018: Received Dividend of $1.15 per share * 477 shares on this date = $548.55
Jun 3, 2018: DRIP reinvestment. $548.55 to spend, today's closing share price is $40.88 = 13.418 shares purchased.</textarea>
        </div>
    </details>
    <br>

    <div>
        <a href="/returns/">Self</a>
    </div>
    <br>

    <div class="panel panel-default">
        <div class="panel-heading">Inputs</div>
        <div class="panel-body">
            <form class="form-horizontal ticker-form" method="get" action="">
                <div class="form-group">
                    <label class="control-label col-sm-2" for="tickerInput"><a href="https://finance.yahoo.com" target="_blank" title="Go to finance.yahoo.com">Yahoo Finance</a> Ticker</label>
                    <div class="col-sm-2">
                        <input type="text" class="form-control" id="tickerInput" name="ticker" placeholder="Enter ticker" required autofocus value="<?= isset($_GET['ticker']) ? $escape($_GET['ticker']) : '' ?>">
                    </div>
                </div>
                <div class="form-group">
                    <label class="control-label col-sm-2" for="startingMoney">Initial Money</label>
                    <div class="col-sm-1">
                        <input type="radio" class="form-check-input" id="startStrategyMoney" name="startStrategy" value="money" <?= $strategyActive('money') ? 'checked' : '' ?>>
                    </div>
                    <div class="col-sm-2">
                        <input type="text" class="form-control" id="startingMoney" name="startingMoney" placeholder="Enter $ to start with" required value="<?= isset($_GET['startingMoney']) ? $escape($_GET['startingMoney']) : '10000' ?>" <?= $strategyActive('money') ? '' : 'readonly' ?>>
                    </div>
                </div>
                <div class="form-group">
                    <label class="control-label col-sm-2" for="startingShares">Initial Shares</label>
                    <div class="col-sm-1">
                        <input type="radio" class="form-check-input" id="startStrategyShares" name="startStrategy" value="shares" <?= $strategyActive('shares') ? 'checked' : '' ?>>
                    </div>
                    <div class="col-sm-2">
                        <input type="text" class="form-control" id="startingShares" name="startingShares" placeholder="Enter num shares to start with" required value="<?= isset($_GET['startingShares']) ? $escape($_GET['startingShares']) : '1' ?>" <?= $strategyActive('shares') ? '' : 'readonly' ?>>
                    </div>
                </div>
                <div class="form-group" hidden>
                    <label class="control-label col-sm-2" for="backTestAlgo">Back Test</label>
                    <div class="col-sm-1">
                        <textarea id="backTestAlgo" name="backTestAlgo">function(enhancedStockData){}</textarea>
<!--                        <textarea id="backTestAlgo" name="backTestAlgo">--><?//= isset($_GET['backTestAlgo']) ? $escape($_GET['backTestAlgo']) : '' ?><!--</textarea>-->
                    </div>
                </div>

                <!--        <div class="form-group">-->
                <!--            <label class="control-label col-sm-2" for="startDateInput">Start Date</label>-->
                <!--            <div class="col-sm-4">-->
                <!--                <input type="date" class="form-control" id="startDateInput" name="startDate">-->
                <!--            </div>-->
                <!--        </div>-->
                <!---->
                <!--        <div class="form-group">-->
                <!--            <label class="control-label col-sm-2" for="endDateInput">End Date</label>-->
                <!--            <div class="col-sm-4">-->
                <!--                <input type="date" class="form-control" id="endDateInput" name="endDate">-->
                <!--            </div>-->
                <!--        </div>-->

                <div class="form-group">
                    <div class="col-sm-offset-2 col-sm-10">
                        <button type="submit" class="btn btn-default">Submit</button>
                        <!--                <button type="button" class="btn btn-default testt">Test</button>-->
                    </div>
                </div>

            </form>


            <form class="date-range-inputs form-horizontal" style="display: none;">
                <hr>

                <h3>Date Range:</h3>
                <div><input class="date-range-slider span2"></div>
                <div>
                    <!-- placeholder and pattern are for browsers that don't support type=date -->
                    <label class="start-date">
                        Start Date: <input type="date" name="startDate" class="form-control" placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" value="<?= isset($_GET['startDate']) ? $escape($_GET['startDate']) : '' ?>">
                    </label>
                    <label class="end-date">
                        End Date: <input type="date" name="endDate" class="form-control" placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" value="<?= isset($_GET['endDate']) ? $escape($_GET['endDate']) : '' ?>">
                    </label>
                </div>
                <div class="clearfix"></div>
                <p class="note">* Hold shift when dragging to lock both sliders together</p>


                <!--                <div>-->
<!--                    <label><input type=checkbox name="lockStartEndSliders"> Lock Start &amp; End date sliders a fixed number of days apart?</label>-->
<!--                </div>-->
<!--                <div>-->
<!--                    <label>Days: <input type="number" step="1" min="0" name="lockStartEndSliderDays" class="form-control" size="4" value="3650"></label>-->
<!--                </div>-->
            </form>
        </div>
    </div>

    <h3 class="error-message text-danger"></h3>

    <div class="panel panel-default result-pane" style="display: none">
        <div class="panel-heading">Results</div>
        <div class="panel-body">
            <div class="alert alert-danger data-error-message" style="display:none;">
                <h2>Warning</h2>
                <p>We detected anomalies in the data <small>(prices / dividends / splits)</small> that we got from Yahoo Finance for this stock. The resulting calculations
                    likely have errors (small or large). Be warned.</p>
            </div>

            <table class="table table-bordered table-hover table-striped result-table">
                <tr>
                    <td title="The stock being analyzed." data-toggle="popover">Stock</td>
                    <td>
                        <div class="meta-stock-ticker"></div>
                        <div class="meta-stock-name"></div>
                    </td>
                </tr>
                <tr>
                    <td title="Convenient links to pages on other sites for this stock." data-toggle="popover">Links</td>
                    <td>
                        <div class="link-google"></div>
                        <div class="link-yahoo"></div>
                        <div class="link-morningstar"></div>
                    </td>
                </tr>
                <tr>
                    <td title="The date range actually used to analyze the performance of this stock over. This can be slightly different than what you input, if we didn't have data for the boundary days. Note, this is always displayed in YYYY-MM-DD format." data-toggle="popover">Date Range</td>
                    <td><span class="actual-start-date"></span> <small>to</small> <span class="actual-end-date"></span> <small>(<span class="elapsed-years"></span> yrs)</small></td>
                </tr>
                <tr>
                    <td title="The price of the stock at the start and end dates you selected using the date range slider. If closing stock prices weren't available on the start or end dates, then the nearest date was used while staying within date boundaries. " data-toggle="popover">Share Price Start - End</td>
                    <td><span class="start-price"></span> - <span class="end-price"></span></td>
                </tr>
                <tr>
                    <td title="How many shares you started with. " data-toggle="popover">Num Starting Shares</td>
                    <td class="num-start-shares"></td>
                </tr>
                <tr>
                    <td title="How many shares you ended up with at the end of the date range." data-toggle="popover">Num Ending Shares</td>
                    <td class="num-end-shares"></td>
                </tr>
                <!--            <tr>-->
                <!--                <td title="How much of you gains were due to a change in stock price. Defined as: ((StockEndPrice * NumEndingShares) - StockStartPrice) - DividendGain." data-toggle="popover">Stock Value Gain</td>-->
                <!--                <td><span class="stock-gain"></span> (<span class="stock-gain-percent"></span>%)</td>-->
                <!--            </tr>-->
                <tr>
                    <td title="How much in dividends you received. Keep in mind that this money was reinvested, buying more shares." data-toggle="popover">Dividends Received</td>
                    <td><span class="dividend-gain"></span></td>
                </tr>
                <tr>
                    <td title="Your total gains, as a result of reinvesting dividends over the date range to buy more shares. Defined as: &lt;code&gt;((StockEndPrice * NumEndingShares) - StockStartPrice)&lt;/code&gt;" data-html="true" data-toggle="popover">Total Gain</td>
                    <td><span class="total-gain"></span> (<span class="total-gain-percent"></span>)</td>
                </tr>
                <!--            <tr>-->
                <!--                <td title="Your total gains, expressed geometrically as CAGR" data-toggle="popover">Total Gain CAGR %</td>-->
                <!--                <td class="total-gain-cagr"></td>-->
                <!--            </tr>-->
                <tr>
                    <td title="Your total gains, expressed geometrically as CAGR" data-toggle="popover">Total Gain CAGR%</td>
                    <td class="total-gain-cagr-reinvest"></td>
                </tr>
                <tr>
                    <td title="Assumes your dividends were reduced by 25% before you use the money to reinvest in more shares. Note that none of the other stats shown in this tool assume this 25% tax, just this number. It's meant to give you a very rough idea of how much your CAGR would be reduced if you had to set a bit of your divvy aside for the tax man." data-toggle="popover">Total Gain CAGR w/ 25% taxed dividend Reinvestment %</td>
                    <td class="total-gain-cagr-reinvest-taxed"></td>
                </tr>
            </table>

            <table class="table table-bordered table-hover table-striped result-table">
                <tr>
                    <td title="A bunch of trailing time periods, conveniently showing the CAGR for each period. Note that only time periods that can be completely calculated will have a value; for example, if there's only 9.9 years of data, you will not see a value for the 10yr slot. Tip - It can be interesting to watch these numbers as you adjust the upper boundary of the date range slider." data-toggle="popover">Trailing Total Gain CAGR w/ dividend Reinvestment %</td>
                    <td>
                        <!--                    <table class="table table-bordered table-hover trailing-gains">-->
                        <!--                        <tr>-->
                        <!--                            <td>25yr</td>-->
                        <!--                            <td>20yr</td>-->
                        <!--                            <td>15yr</td>-->
                        <!--                            <td>10yr</td>-->
                        <!--                            <td>5yr</td>-->
                        <!--                            <td>3yr</td>-->
                        <!--                            <td>2yr</td>-->
                        <!--                            <td>1yr</td>-->
                        <!--                        </tr>-->
                        <!--                        <tr>-->
                        <!--                            <td class="trailing-25"></td>-->
                        <!--                            <td class="trailing-20"></td>-->
                        <!--                            <td class="trailing-15"></td>-->
                        <!--                            <td class="trailing-10"></td>-->
                        <!--                            <td class="trailing-5"></td>-->
                        <!--                            <td class="trailing-3"></td>-->
                        <!--                            <td class="trailing-2"></td>-->
                        <!--                            <td class="trailing-1"></td>-->
                        <!--                        </tr>-->
                        <!--                    </table>-->
                        <table class="table table-bordered table-hover trailing-gains">
                            <tr>
                                <td>50yr</td>
                                <td class="trailing-50yr"></td>
                            </tr>
                            <tr>
                                <td>40yr</td>
                                <td class="trailing-40yr"></td>
                            </tr>
                            <tr>
                                <td>35yr</td>
                                <td class="trailing-35yr"></td>
                            </tr>
                            <tr>
                                <td>30yr</td>
                                <td class="trailing-30yr"></td>
                            </tr>
                            <tr>
                                <td>25yr</td>
                                <td class="trailing-25yr"></td>
                            </tr>
                            <tr>
                                <td>20yr</td>
                                <td class="trailing-20yr"></td>
                            </tr>
                            <tr>
                                <td>15yr</td>
                                <td class="trailing-15yr"></td>
                            </tr>
                            <tr>
                                <td>10yr</td>
                                <td class="trailing-10yr"></td>
                            </tr>
                            <tr>
                                <td>5yr</td>
                                <td class="trailing-5yr"></td>
                            </tr>
                            <tr>
                                <td>3yr</td>
                                <td class="trailing-3yr"></td>
                            </tr>
                            <tr>
                                <td>2yr</td>
                                <td class="trailing-2yr"></td>
                            </tr>
                            <tr>
                                <td>1yr</td>
                                <td class="trailing-1yr"></td>
                            </tr>
                            <tr>
                                <td>ytd</td>
                                <td class="trailing-ytd"></td>
                            </tr>
                            <tr>
                                <td>180d</td>
                                <td class="trailing-180d"></td>
                            </tr>
                            <tr>
                                <td>90d</td>
                                <td class="trailing-90d"></td>
                            </tr>
                            <tr>
                                <td>30d</td>
                                <td class="trailing-30d"></td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td title="This number should be 0, but if it's not, then don't trust the numbers this calculator shows for this stock. Sometimes the Yahoo Finance data API's give me bad data, and it's impossible to give good results when your inputs are bad." data-toggle="popover">Bad Closing Price Data Entries</td>
                    <td class="num-bad-closing-price-entries"></td>
                </tr>
                <tr>
                    <td title="This number should be 0, but if it's not, then don't trust the numbers this calculator shows for this stock. Sometimes the Yahoo Finance data API's give me bad data, and it's impossible to give good results when your inputs are bad." data-toggle="popover">Bad Dividend Data Entries</td>
                    <td class="num-bad-dividend-entries"></td>
                </tr>
                <tr>
                    <td title="This number should be 0, but if it's not, then don't trust the numbers this calculator shows for this stock. Sometimes the Yahoo Finance data API's give me bad data, and it's impossible to give good results when your inputs are bad." data-toggle="popover">Bad Stock Split Data Entries</td>
                    <td class="num-bad-stock-split-entries"></td>
                </tr>
                <tr>
                    <td title="Shows how the stock split over time." data-toggle="popover">Stock Splits</td>
                    <td class="stock-splits"></td>
                </tr>
                <tr class="found-split-adjusted danger" style="display: none" title="If you see this, then the calculations should be considered inaccurate. The data from Yahoo was analyzed, and inconsistencies were found regarding the share price adjustments they make when a stock split occurs." data-toggle="popover">
                    <td>Found Split Adjusted</td>
                    <td>true</td>
                </tr>
            </table>

            <div class="growth-chart-wrapper">
                <canvas class="money-growth-chart"></canvas>
                <button name="reset"><small>Reset</small></button>
            </div>
            <hr style="clear:both">

            <div class="growth-chart-wrapper">
                <canvas class="share-growth-chart"></canvas>
                <button name="reset"><small>Reset</small></button>
            </div>
            <hr style="clear:both">

            <div class="growth-chart-wrapper">
                <canvas class="dividend-history-chart"></canvas>
                <button name="reset"><small>Reset</small></button>
            </div>

            <hr style="clear:both">
            <p>Raw data comes from Yahoo Finance, but this app calculates most of the data displayed.</p>


        </div>
    </div>

</div>



<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.18.1/moment.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/js/bootstrap.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/11.0.2/bootstrap-slider.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/0.7.7/chartjs-plugin-zoom.min.js"></script>
<script src="SlidingLoadIndicatorLine.js"></script>
<script src="calc.js"></script>
<script>
    $(() => {
        $('[data-toggle=popover]').each((idx, elem) => {
            $(elem).attr({'data-content': $(elem).attr('title')});
//            elem.dataset['content'] = $(elem).attr('title');
            $(elem).attr({'title': $(elem).text()});
//            elem.title = $(elem).text();
        });
        $('[data-toggle=popover]').popover({
            container: 'body',
            trigger: 'hover click'
        });

        // Auto close all other popovers on click anywhere on screen.
        $('body').on('click', function(event) {
            $('[data-toggle=popover]').filter((idx, elem) => {
                return elem !== event.target && !$.contains(elem, event.target);
            }).popover('hide')
        });
    });
</script>
<script src="backtest.js"></script>
</body>
</html>