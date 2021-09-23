import { linearRegression } from "simple-statistics";

export function Suite(suiteName) {
  const tests = new Map();

  function add(testName, test) {
    tests.set(testName, test);
  }

  async function run({ minRuns = 5, maxRuns = 50 } = {}) {
    let longestTestNameLength = 0;
    for (let [testName] of tests) {
      longestTestNameLength = Math.max(longestTestNameLength, testName.length);
    }

    const maxRunsStringLength = ("" + maxRuns).length;

    console.group(suiteName);

    for (let [testName, test] of tests) {
      await test.init();

      const samples = [];
      for (let i = 0; i < maxRuns; i++) {
        const startTime = Date.now();
        await test.run();
        const stopTime = Date.now();
        const duration = stopTime - startTime;

        samples.push([i, duration]);

        if (i >= minRuns) {
          const confidence = linearRegression(samples).m >= 0;
          if (confidence) {
            break;
          }
        }
      }

      await test.teardown();

      const average =
        samples.reduce((reduced, current) => current[1] + reduced, 0) /
        samples.length;

      let samplesString = `${samples.length}`;
      samplesString = `${samplesString}${" ".repeat(
        maxRunsStringLength - samplesString.length
      )}`;

      console.log(
        `${testName}  ${" ".repeat(
          longestTestNameLength - testName.length
        )}  ${samplesString} samples    ${format(average)}ms`
      );
    }

    console.groupEnd();
  }

  return {
    add,
    run,
  };
}

function format(number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
}
