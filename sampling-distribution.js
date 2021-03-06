function getUserInputNumber(id) {
	return parseInt(document.getElementById(id).value, 10);
}

function sample(distribution, sampleSize) {
	const sample = [];
	for (let i = 0; i < sampleSize; i ++) {
		sample.push(distribution[Math.floor(Math.random() * distribution.length)]);
	}
	return sample;
}

/**
 * Mean. Valid for population or sample.
 * μ(X) = Σx / n 
 */
function mean(distribution) {
	const total = distribution.reduce((acc, x) => acc + x);

	return total / distribution.length;
}

/**
 * Population standard deviation.
 * σ(X) = sqrt(Σ(x - μ)^2 / n)
 */
function standardDeviation(distribution, mean) {
	const numerator = distribution.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0);

	return Math.sqrt(numerator / distribution.length);
}

/**
 * Probability density function for Normal distribution.
 * Normal(x) = e^(-(x - μ)^2/2σ^2) / (σ * sqrt(2π))
 */
function normalPdf(x, mu, sigma) {
	const exponent = - Math.pow((x - mu) / sigma, 2) / 2;

	return Math.pow(Math.E, exponent) / (sigma * Math.sqrt(2 * Math.PI));
}

function computeAlignment(sampling, theoreticalMean, theoreticalStdDev, SAMPLING_DISTRIBUTION_SAMPLE_SIZE) {
	const binWidth = sampling[0].end - sampling[0].start;

	const mu = theoreticalMean;
	const sigma = theoreticalStdDev;

	const [intersection, union] = sampling.map(({center, count}) => {

		const idealFrequency = normalPdf(center, mu, sigma) * binWidth;
		const actualFrequency = count / SAMPLING_DISTRIBUTION_SAMPLE_SIZE;
		
		return [
			Math.min(actualFrequency, idealFrequency),
			Math.max(actualFrequency, idealFrequency)
		];
	}).reduce((acc, ratio) => {
		return [acc[0] + ratio[0], acc[1] + ratio[1]];
	}, [0, 0]);

	return intersection / union;
}

function binData(dataArray) {
	const NUMBER_OF_BINS = 25;
	const min = dataArray.reduce((acc, x) => Math.min(acc, x));
	const max = dataArray.reduce((acc, x) => Math.max(acc, x));
	const bins = new Array(NUMBER_OF_BINS).fill(0);
	const binWidth = Math.ceil((max - min + 1) / NUMBER_OF_BINS);

	dataArray.forEach(x => {
		const binIndex = Math.floor((x - min) / binWidth);
		bins[binIndex] ++;
	});

	return [binWidth, bins.map((x, i) => ({
		start: i * binWidth + min,
		center: (i + 0.5) * binWidth + min,
		end: (i + 1) * binWidth + min,
		count: x
	}))];
}

function getHistogramPlotSpec([binWidth, histogramData]) {
	return {
		"data": {
			"values": histogramData
		},
		"mark": "bar",
		"encoding": {
			"x": {
				"field": "start",
				"bin": {"binned": true, "step": binWidth},
				"type": "quantitative",
				"axis": {"title": null}
			},
			"x2": {"field": "end"},
			"y": {"field": "count", "type": "quantitative"}
		}
	};
}

function getLinePlotSpec(lineData) {
	return {
		"data": {
			"values": lineData
		},
		"mark": {"type": "line", "stroke": "#85A9C5"},
		"encoding": {
			"x": {"field": "center", "type": "quantitative"},
			"y": {"field": "count", "type": "quantitative"}
		}
	};
}

function compileGuppyFunction(guppy) {
	try {
		return guppy.func({var: ([variableName]) => function (valueMap) {
			if (variableName in valueMap) {
				return valueMap[variableName];
			}

			const err = new Error();
			err.cause = "guppy-undefined-symbol";
			err.data = variableName;
			throw err;
		}});
	} catch (err) {
		err.cause = "guppy-invalid-syntax";
		throw err;
	}
}

function generatePopulationDistribution() {
	const {guppy} = window.globalData;
	const ORIGINAL_DISTRIBUTION_POPULATION_SIZE = getUserInputNumber("population-size");

	// Generate population distribution by interpreting Guppy function.
	const populationFunction = compileGuppyFunction(guppy);

	const originalDistribution = [];
	for (let x = 0; x < ORIGINAL_DISTRIBUTION_POPULATION_SIZE; x ++) {
		const y = populationFunction({x});
		originalDistribution.push(y);
	}

	// Compute stats.
	const originalMean = mean(originalDistribution);
	const originalStdDev = standardDeviation(originalDistribution, originalMean);

	// Plot population distribution.
	const subtitle = [
		`μ = ${originalMean.toFixed(2)}, σ = ${originalStdDev.toFixed(2)}, n = ${originalDistribution.length}`
	];

	vegaEmbed("#population-distribution", {
		"title": {
			"text": "Population Distribution",
			"fontSize": 24,
			"subtitle": subtitle,
			"subtitleColor": "#555",
			"subtitleFontSize": 14
		},
		"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
		"layer": [getHistogramPlotSpec(binData(originalDistribution))],
		"width": 700
	});

	window.globalData = {
		...window.globalData,
		originalDistribution,
		originalMean,
		originalStdDev
	};
}

function generateSamplingDistribution() {
	const {originalDistribution, originalMean, originalStdDev} = window.globalData;
	const numberOfPopulationDraws = getUserInputNumber("population-draws");
	const drawSize = getUserInputNumber("draw-size");

	// Generate sampling distribution.
	const samplingDistribution = [];
	for (let i = 0; i < numberOfPopulationDraws; i ++) {
		const sampleMean = mean(sample(originalDistribution, drawSize));
		samplingDistribution.push(sampleMean);
	}

	const samplingMean = mean(samplingDistribution);
	const samplingStdDev = standardDeviation(samplingDistribution, samplingMean);
	const theoreticalMean = originalMean;
	const theoreticalStdDev = originalStdDev / Math.sqrt(drawSize);

	const [binWidth, samplingFrequencies] = binData(samplingDistribution);

	// Compute alignment with ideal Normal curve.
	const alignment = computeAlignment(samplingFrequencies, theoreticalMean, theoreticalStdDev, numberOfPopulationDraws);
	const alignmentPercentage = (alignment * 100).toFixed(2);

	// Plot sampling distribution.
	const subtitle = [
		`μ = ${samplingMean.toFixed(2)}, σ = ${samplingStdDev.toFixed(2)}, n = ${samplingDistribution.length}`,
		`σ / √(nMeans) = ${theoreticalStdDev.toFixed(2)}`,
		`normalcy = ${alignmentPercentage}%`
	];

	vegaEmbed("#sampling-distribution", {
		"title": {
			"text": "Sampling Distribution",
			"fontSize": 24,
			"subtitle": subtitle,
			"subtitleColor": "#555",
			"subtitleFontSize": 14
		},
		"$schema": "https://vega.github.io/schema/vega-lite/v4.json",
		"layer": [
			getHistogramPlotSpec([binWidth, samplingFrequencies]),
			getLinePlotSpec(samplingFrequencies)
		],
		"width": 700
	});

}
