<?php

// this parses a csv file which has monthly inflation data since 1913, from bls.gov
// It produces a js map data structure, indexed by date.

// data in CPIAUCNS.csv from bls
// https://fred.stlouisfed.org/series/CPIAUCNS

$lines = file('data/CPIAUCNS.csv');
$fullData = [];
$monthlyData = [];
foreach ($lines as $i => $line) {
    // Skip csv header.
    if ($i === 0) continue;

    $line = trim($line);

    // Skip empty line.
    if (!$line) continue;

    if (!preg_match('#(\d{4}-\d{2}-\d{2}),(\d+(\.\d+)?)#', $line, $matches)) {
        echo "error on line $i of csv\n";
        echo "line: '$line'\n";
        exit;
    }

    // date => cpi
    // like "2020-06-01": 257.797,
    $fullData[ $matches[1] ] = (float) $matches[2];

    // We also store it like this
    // "2020-06": 257.797,
    $monthlyData[ substr($matches[1], 0, 7) ] = (float) $matches[2];
}


$json = json_encode($monthlyData, JSON_PRETTY_PRINT);

$js = sprintf("const inflationData = %s;", $json);
echo $js;

file_put_contents('inflation-data.js', $js);