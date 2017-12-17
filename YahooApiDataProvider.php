<?php


class YahooApiDataProvider extends BasicCurlDataProvider implements DataProvider
{
    /**
     * @var string
     */
    private $ticker;

    /**
     * @var DateTimeInterface
     */
    private $start;
    /**
     * @var DateTimeInterface
     */
    private $end;

    private $crumb;

    private $ch;

    private $dataEventTypes = [
        'dividends' => 'div',
        'stockSplits' => 'split',
        'closingPrices' => 'history',
    ];

    public function __construct($ticker, DateTimeInterface $start, DateTimeInterface $end)
    {
        $this->ticker = $ticker;
        $this->start = $start;
        $this->end = $end;
    }

    function getDividendData()
    {
        return $this->getData($this->dataEventTypes['dividends']);
    }

    function getClosingPriceData()
    {
        return $this->getData($this->dataEventTypes['closingPrices']);
    }

    function getStockSplitData()
    {
        return $this->getData($this->dataEventTypes['stockSplits']);
    }

    function getMetaData()
    {
        $metaData = $this->fetchMetaDataFromCacheOrApi();
        return $metaData;
    }

    private function getData($eventType)
    {
        $csvData = $this->fetchCsvDataFromCacheOrApi($eventType);
        $rows = $this->parseAsCsv($csvData);
        $processedRows = $this->processRows($rows);
        usort($processedRows, function($a, $b) {
            return strcmp($a['Date'], $b['Date']);
        });
        return $processedRows;
    }

    private function processRows($csvRows)
    {
        // Ensure numeric columns are numbers, not strings.
        $numericColNames = ['Close', 'Adj Close', 'High', 'Low', 'Open', 'Volume', 'Dividends'];
        foreach ($csvRows as &$row) {
            foreach ($numericColNames as $colName) {
                if (isset($row[$colName])) {
                    setType($row[$colName], 'float');
                }
            }
        }

        // Rename columns.
        $columnNameMappings = ['Adj Close' => 'AdjClose'];
        foreach ($csvRows as &$row) {
            foreach ($columnNameMappings as $oldColName => $newColName) {
                if (isset($row[$oldColName])) {
                    $row[$newColName] = $row[$oldColName];
                    unset($row[$oldColName]);
                }
            }
        }

        return $csvRows;
    }

    private function fetchCsvDataFromCacheOrApi($eventType)
    {
        $cacheFileName = $this->buildCsvDataCacheFileName($eventType);
        $path = '/tmp/' . $cacheFileName;
        if (!file_exists($path)) {
            $this->ensureConnected();
            $url = $this->buildCsvDataUrl($eventType);
            $csvData = $this->fetch($this->ch, $url);
            file_put_contents($path, $csvData);
        }

        return file_get_contents($path);
    }

    private function fetchMetaDataFromCacheOrApi()
    {
        $cacheFileName = $this->buildMetaDataCacheFileName();
        $path = '/tmp/' . $cacheFileName;
        // Cache for 10 days.
        if (!file_exists($path) ) {
//        if (!file_exists($path) || filemtime($path) < time() - 864000) {
            $metaData = $this->fetchMetaDataFromApi();
            file_put_contents($path, $metaData);
        }

        $metaData =  json_decode(file_get_contents($path), true);
        $meta = $metaData['context']['dispatcher']['stores']['QuoteSummaryStore']['price'];
        return $meta;
    }

    private function fetchMetaDataFromApi()
    {
        $this->ensureConnected();
        $url = $this->buildMetaDataUrl();
        $html = $this->fetch($this->ch, $url);
        if (!preg_match('#root.App.main = (\{.+\});#i', $html, $matches)) {
            throw new Exception("failed to extract meta data");
        }

        return $matches[1];
    }

    private function buildCsvDataUrl($eventType)
    {
        // https://query1.finance.yahoo.com/v7/finance/download/CHD?period1=1472367600&period2=1475046000&interval=1d&events=history&crumb=2kzXllI.kGq
        return sprintf(
            "https://query1.finance.yahoo.com/v7/finance/download/%s?period1=%s&period2=%s&interval=1d&events=%s&crumb=%s",
            rawurlencode($this->ticker),
            rawurlencode($this->start->getTimestamp()),
            rawurlencode($this->end->getTimestamp()),
            rawurlencode($eventType),
            rawurlencode($this->crumb)
        );
    }

    private function buildMetaDataUrl()
    {
        // https://finance.yahoo.com/quote/CHD?p=CHD
        return sprintf(
            "https://finance.yahoo.com/quote/%s?p=%s",
            rawurlencode($this->ticker),
            rawurlencode($this->ticker)
        );
    }

    private function buildCsvDataCacheFileName($eventType)
    {
        return sprintf(
            "%s-%s-from-%s-to-%s.csv",
            rawurlencode($this->ticker),
            rawurlencode($eventType),
            rawurlencode($this->start->format('Y-m-d')),
            rawurlencode($this->end->format('Y-m-d'))
        );
    }

    private function buildMetaDataCacheFileName()
    {
        return sprintf(
            "%s-meta.json",
            rawurlencode($this->ticker)
        );
    }

    private function getInitUrl()
    {
        return sprintf(
            "https://finance.yahoo.com/quote/CHD/history?p=%s",
            rawurldecode($this->ticker)
        );
    }

    private function scrapeCrumbAndGetCookied()
    {
        // Yahoo tries to protect us from screen scraping. haha ya right...
        // They embed a url param named "crumb" into their urls, and associate it with your cookies/session on their server side code.
        // So, we need to request a relevant web page so they cookie us, and then scrape the crumb from the html they server in the response.
        // The crumb value is defined in some inline javascript/json, and they use js to later build all their urls using it.
        $html = $this->fetch($this->ch, $this->getInitUrl());
        if (!preg_match('/"crumb"\s*:\s*("[^"{]+")/i', $html, $matches)) {
            throw new RuntimeException('failed to extract crumb');
        }
        $this->crumb = json_decode($matches[1]);
    }

    private function ensureConnected()
    {
        if (!$this->ch) {
            $this->ch = $this->getCurlHandle();
            $this->scrapeCrumbAndGetCookied();
        }
    }

    public function cleanCache() {
        echo `find /tmp -type f -name '*.csv' -mtime +2 -exec rm {} \;`;
        echo `find /tmp -type f -name 'php-curl-cookies-*' -mtime +2 -exec rm {} \;`;
        echo `find /tmp -type f -name '*-meta.json' -mtime +2 -exec rm {} \;`;
    }
}