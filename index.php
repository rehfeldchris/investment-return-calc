<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Stock DRIP CAGR Calculator</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/css/bootstrap.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/9.8.0/css/bootstrap-slider.css">
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
            margin: auto;
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

    <p>This tool helps you calculate trailing total returns (<abbr title="Compound Annual Growth Rate aka Geometric Returns">CAGR</abbr>) for a stock-like investment.
        It will consider the change in the price of the stock, dividends / distributions received over the time period, and splits. It assumes you start by purchasing 1 share of the
        stock, and will reinvest the dividends from that point on.</p>

    <p class="note">
        <strong>Note</strong>: This tool is in Beta.
    </p>

    <p class="note">This tool computes returns using market prices, not <abbr title="Net Asset Value">NAV</abbr>. This is in contrast
        to <a href="https://admainnew.morningstar.com/webhelp/glossary_definitions/closed_end/glossary_ce_nav_total_return.html">Morningstar, whose trailing total returns are NAV based</a>.
        I prefer calculating returns based on market prices, because you &amp; I pay market prices when we buy and sell the stocks. But, if you wonder why
        the returns listed in this tool don't always exactly match up with Morningstar's Trailing Total Returns, that's probably the reason.
    </p>

    <p class="note"><b>A note on accuracy</b>: this tool uses free data from Yahoo Finance. Free data (and even commercial data) has a history of being flawed,
        especially when complicated stuff happens, like buying/selling off part of the company in exchange for another company. This isn't a problem unique to this
        tool. If you look carefully - like I have - at other calculators found on the web, many of them give different results, and sometimes wildly so.
        While I pledge to disclose any known accuracy flaws in this tool, being shrewd and doing your own due diligence is still your responsibility, not mine.
    </p>
<!---->
<!--    <p>todo, allow date input via picker or slider. grey out dates w/out data in picker.</p>-->
<!--    <p>todo, add each year returns like morningstar. eg, 2014, 2015, 2016. will help me see differences in returns.</p>-->

    <form class="form-horizontal ticker-form" method="get" action="">
        <div class="form-group">
            <label class="control-label col-sm-2" for="tickerInput">Yahoo Finance Ticker</label>
            <div class="col-sm-2">
                <input type="text" class="form-control" id="tickerInput" name="ticker" placeholder="Enter ticker" required autofocus value="<?= isset($_GET['ticker']) ? $_GET['ticker'] : '' ?>">
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


    <h3 class="error-message text-danger"></h3>

    <div class="result-pane" style="display: none">



        <div>
            <p>Date Range Slider:</p>
            <div><input class="date-range-slider span2"></div>
        </div>


        <hr>

        <div class="alert alert-danger data-error-message" style="display:none;">
            <h2>Warning</h2>
            <p>We detected anomalies in the data <small>(prices / dividends / splits)</small> that we got from Yahoo Finance for this stock. The resulting calculations
            should not be trusted.</p>
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
                <td title="The date range to analyze the performance of this stock over." data-toggle="popover">Date Range</td>
                <td><span class="actual-start-date"></span> <small>to</small> <span class="actual-end-date"></span> <small>(<span class="elapsed-years"></span> yrs)</small></td>
            </tr>
            <tr>
                <td title="The price of the stock at the start and end dates you selected using the date range slider." data-toggle="popover">Share Price Start - End</td>
                <td><span class="start-price"></span> - <span class="end-price"></span></td>
            </tr>
            <tr>
                <td title="How many shares you ended up with at the end of the date range. The simulation assumes you had 1 share on the start date, and purchased more shares via dividend reinvestment." data-toggle="popover">Num Ending Shares</td>
                <td class="num-end-shares"></td>
            </tr>
<!--            <tr>-->
<!--                <td title="How much of you gains were due to a change in stock price. Defined as: ((StockEndPrice * NumEndingShares) - StockStartPrice) - DividendGain." data-toggle="popover">Stock Value Gain</td>-->
<!--                <td><span class="stock-gain"></span> (<span class="stock-gain-percent"></span>%)</td>-->
<!--            </tr>-->
            <tr>
                <td title="How much in dividends you received, although, keep in mind that this money was reinvested, buying more shares." data-toggle="popover">Dividends Received</td>
                <td><span class="dividend-gain"></span></td>
            </tr>
            <tr>
                <td title="Your total gains, as a result of reinvesting dividend over the date range to buy more shares. Defined as: ((StockEndPrice * NumEndingShares) - StockStartPrice)" data-toggle="popover">Total Gain</td>
                <td><span class="total-gain"></span> (<span class="total-gain-percent"></span>%)</td>
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
                <td title="Assumes your dividends were reduced by 15% before you use the money to reinvest in more shares. Note that none of the other stats shown in this tool assume this 15% tax, just this number." data-toggle="popover">Total Gain CAGR w/ 15% taxed dividend Reinvestment %</td>
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
                            <td class="trailing-50"></td>
                        </tr>
                        <tr>
                            <td>40yr</td>
                            <td class="trailing-40"></td>
                        </tr>
                        <tr>
                            <td>35yr</td>
                            <td class="trailing-35"></td>
                        </tr>
                        <tr>
                            <td>30yr</td>
                            <td class="trailing-30"></td>
                        </tr>
                        <tr>
                            <td>25yr</td>
                            <td class="trailing-25"></td>
                        </tr>
                        <tr>
                            <td>20yr</td>
                            <td class="trailing-20"></td>
                        </tr>
                        <tr>
                            <td>15yr</td>
                            <td class="trailing-15"></td>
                        </tr>
                        <tr>
                            <td>10yr</td>
                            <td class="trailing-10"></td>
                        </tr>
                        <tr>
                            <td>5yr</td>
                            <td class="trailing-5"></td>
                        </tr>
                        <tr>
                            <td>3yr</td>
                            <td class="trailing-3"></td>
                        </tr>
                        <tr>
                            <td>2yr</td>
                            <td class="trailing-2"></td>
                        </tr>
                        <tr>
                            <td>1yr</td>
                            <td class="trailing-1"></td>
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
            <tr class="found-split-adjusted danger" style="display: none" title="If you see this, then the calculations should be considered inaccurate." data-toggle="popover">
                <td>Found Split Adjusted</td>
                <td>true</td>
            </tr>
        </table>

        <div class="growth-chart-wrapper">
            <canvas class="money-growth-chart"></canvas>
        </div>
        <hr style="clear:both">

        <div class="growth-chart-wrapper">
            <canvas class="share-growth-chart"></canvas>
        </div>

        <hr style="clear:both">
        <p>Raw data comes from Yahoo Finance, but this app calculates most of the data displayed.</p>
    </div>
</div>



<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.18.1/moment.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/js/bootstrap.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/9.8.0/bootstrap-slider.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.6.0/Chart.js"></script>
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
</body>
</html>