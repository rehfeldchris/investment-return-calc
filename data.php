<?php
spl_autoload_register(function ($class) {
    include './' . $class . '.php';
});
error_reporting(-1);
ini_set('display_errors', 1);
ini_set('memory_limit', '128M');
ob_start('ob_gzhandler');

$ticker = trim(isset($_GET['ticker']) ? $_GET['ticker'] : '');
if ($ticker === 'mock') {
    header('content-type: application/json; charset=utf-8');
    readfile('mock.json');
    exit;
}

if (!$ticker) {
    http_response_code(400);
    exit;
}

// The client now uses startDate and endDate, putting them into the url.
// We do not want to filter the data server-side using those
// dates - we need to give the client all the data so the slider can work.
//$startDate = !empty($_GET['startDate']) ? $_GET['startDate'] : '1970-01-01';
//$endDate = !empty($_GET['endDate']) ? $_GET['endDate'] : date('Y-m-d');

$startDate = '1970-01-01';
$endDate = date('Y-m-d');
$start = new DateTimeImmutable($startDate . ' 00:00:00');
$end = new DateTimeImmutable($endDate . ' 00:00:00');
$provider = new YahooApiDataProvider($ticker, $start, $end);
$provider->cleanCache();

$closingPriceData = $provider->getClosingPriceData();
$dividendData = $provider->getDividendData();
$stockSplitData = $provider->getStockSplitData();
$stockMetaData = $provider->getMetaData();
$request = compact('ticker', 'startDate', 'endDate');
$data = compact( 'request', 'stockMetaData', 'closingPriceData', 'dividendData', 'stockSplitData');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=3600');
header(sprintf('ETag: W/"%s"', "$ticker-$startDate-$endDate"));
echo json_encode($data, JSON_PRETTY_PRINT);