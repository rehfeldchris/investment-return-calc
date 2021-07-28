class YearSnapShot {
    year;
    dollars;
    annualReturns;
    annualContribution;
}

class InvestmentScenario {
    years;
    startingDollars;
    annualContributionDollars;
    contributeFirstYear;
    annualReturnRate;

    constructor(years, startingDollars, annualContributionDollars, annualReturnRate, contributeFirstYear) {
        this.contributeFirstYear = contributeFirstYear;
        this.years = years;
        this.startingDollars = startingDollars;
        this.annualContributionDollars = annualContributionDollars;
        this.annualReturnRate = annualReturnRate;
    }

    /**
     * @returns YearSnapShot[]
     */
    calc() {
        const rows = [];
        let dollars = this.startingDollars;

        for (let i = 0; i < this.years; i++) {
            let annualContribution;
            if (this.contributeFirstYear && i === 0) {
                annualContribution = 0;
            } else {
                annualContribution = this.annualContributionDollars;
            }

            dollars += annualContribution;

            let annualReturns = dollars * this.annualReturnRate;
            dollars += annualReturns;

            rows.push({
                year: i,
                dollars,
                annualReturns,
                annualContribution
            });
        }

        return rows;
    }

}

class InvestmentComparisonCalc {
    $form;

    setup() {
        this.$form = $(".investment-comparison-form");
        // $("input").on("input", evt => {
        //     this.calcAndRender();
        // });
        this.$form.on("submit", evt => {
            evt.preventDefault();
            this.calcAndRender();
        });
    }

    getFormVal(name) {
        return Number(this.$form.find('#' + name).val());
    }

    calcAndRender() {
        const calc1 = new InvestmentScenario(
            this.getFormVal('numYears'),
            this.getFormVal('lumpStart1'),
            this.getFormVal('extraContrib1'),
            this.getFormVal('growthRate1') / 100,
            this.getFormVal('contribOnFirstYear1')
        );
        const calc2 = new InvestmentScenario(
            this.getFormVal('numYears'),
            this.getFormVal('lumpStart2'),
            this.getFormVal('extraContrib2'),
            this.getFormVal('growthRate2') / 100,
            this.getFormVal('contribOnFirstYear2')
        );

        const rows1 = calc1.calc();
        const rows2 = calc2.calc();

        this.renderTableToHtml(rows1, rows2);
        $(".result-pane").slideDown();
        console.log(rows1, rows2);
    }

    renderTableToHtml(rows1, rows2) {
        const trs = [
            `
<tr>
    <th>Year</th>
    <th>Dollars 1</th>
    <th>Dollars 2</th>
    <th>Annual Growth 1</th>
    <th>Annual Growth 2</th>
</tr>
`
        ];

        const formatter = new Intl.NumberFormat('en-US',  {style: 'currency', currency: 'USD'});

        let rows1StartedSmaller = rows1[0].dollars < rows2[0].dollars;
        let alreadyHighlightedRowOvertake = false;
        for (let i = 0; i < rows1.length; i++) {

            // We want to show which row where one of the investments overtakes the other.
            let highlightRow = false;
            if (!alreadyHighlightedRowOvertake) {
                if (rows1StartedSmaller) {
                    highlightRow = rows1[i].dollars > rows2[i].dollars;
                } else {
                    highlightRow = rows1[i].dollars < rows2[i].dollars;
                }
                if (highlightRow) {
                    alreadyHighlightedRowOvertake = true;
                }
            }

            const html = `
<tr ${highlightRow ? 'class=row-overtake' : ''}>
    <td>${rows1[i].year + 1}</td>
    <td>${formatter.format(rows1[i].dollars)}</td>
    <td>${formatter.format(rows2[i].dollars)}</td>
    <td>${formatter.format(rows1[i].annualReturns)}</td>
    <td>${formatter.format(rows2[i].annualReturns)}</td>
</tr>
`;
            trs.push(html);
        }

        const body = trs.join("\n");
        $(".result-table").html(trs.join("\n"));
    }
}