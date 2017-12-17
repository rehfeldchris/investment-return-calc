<?php


interface DataProvider
{
    function getDividendData();
    function getClosingPriceData();
    function getStockSplitData();
}