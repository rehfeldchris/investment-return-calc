<?php


abstract class BasicCurlDataProvider
{
    protected function fetch($ch, $url)
    {
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
        ]);

        $output = curl_exec($ch);
        $httpStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if (!$output || $httpStatusCode !== 200) {
            throw new RuntimeException('Failed to fetch url: ' . $url);
        }

        return $output;
    }

    protected function getCurlHandle()
    {
        $cookieFile = tempnam(sys_get_temp_dir(), 'php-curl-cookies-');
        $ch = curl_init();
        curl_setopt_array($ch, [
//            CURLOPT_VERBOSE => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
//            CURLOPT_SSL_VERIFYSTATUS => false,
            CURLOPT_COOKIEFILE => $cookieFile
        ]);

        return $ch;
    }

    protected function parseAsCsv($str, $columnNames = [])
    {
        $fp = tmpfile();
        if (!$fp) {
            throw new RuntimeException();
        }
        $len = fwrite($fp, $str);
        if ($len !== strlen($str)) {
            throw new RuntimeException('failed to write all of str to tmp');
        }
        fseek($fp, 0);
        $rows = [];

        if (!$columnNames) {
            $arr = fgetcsv($fp, 20000);
            if (!$arr) {
                throw new RuntimeException('failed to parse str as csv header'. $str);
            }
            $columnNames = array_map('trim', $arr);
            if (!$columnNames) {
                throw new RuntimeException();
            }
        }

        while ($row = fgetcsv($fp, 20000)) {
            if (count($columnNames) !== count($row)) {
                var_dump($columnNames, $row);
                exit;
            }
            $rows[] = array_combine($columnNames, $row);
        }

        return $rows;
    }
}