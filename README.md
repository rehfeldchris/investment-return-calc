# What  
This is a small web based calculator that helps you analyze the compound annual growth rate, 
and other investment related metrics for stocks and other securities. For example, you can type in the ticker of a 
stock, such as AMZN, and it will calculate metrics and provide you with the trailing CAGR for various time periods.

# Demo
It's hosted at [http://rehfeld.us/returns/](http://rehfeld.us/returns/)

# Details
It works by grabbing historical daily stock prices, dividends, and split data from Yahoo Finance. Then it runs
some additional computations upon the data. If you're familiar with Morningstar, in particular with their 
"Trailing Total Return" metric; this tool provides basically the same number, but with more calculation flexibility.
 This helps you answer the question: "If I bought Microsoft in June 2001, how much would I have today?" or 
"What was GE's average yearly return between 1991 and 1996?". In other words, it helps you study the past performance
of an investment, including the effects of dividend reinvestment.

# Tech  
php7 for the backend / REST api, ES6 Javascript + Bootstrap for the frontend.