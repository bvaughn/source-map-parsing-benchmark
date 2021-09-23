import { isBrowser, isNode } from "browser-or-node";
import { Suite } from "./benchmark.mjs";

import SOURCES from "./sources.mjs";
import sourceMapJSON from "./source-map.json";

const sourceMapText = JSON.stringify(sourceMapJSON);

async function runTests() {
  const LIBRARIES = {
    "Chrome DevTools parser": chromeDevTools(),
    "source-map": sourceMap(),
    "source-map-js": sourceMapJS(),
    "sourcemap-codec": sourceMapCodec(),
    "sourcemap-codec-streaming": sourceMapCodecStreaming(),
  };

  if (isNode) {
    LIBRARIES["fast-source-map"] = fastSourceMap();
  }

  const parseSuite = new Suite("Parse");
  const findSourcesSuite = new Suite("Find sources");
  const parseAndFindSourcesSuite = new Suite("Parse and find sources");

  for (let name in LIBRARIES) {
    const { parse, findSources, parseAndFindSources } = LIBRARIES[name];
    parseSuite.add(name, parse);
    findSourcesSuite.add(name, findSources);
    parseAndFindSourcesSuite.add(name, parseAndFindSources);
  }

  await parseSuite.run();
  await findSourcesSuite.run();
  await parseAndFindSourcesSuite.run();
}

runTests();

// GoogleChrome Developer Tools source-map parsing
function chromeDevTools() {
  function noop() {}

  let textSourceMap = null;

  async function init() {
    const ChromeDevToolsSourceMap = await import("./lib/ChromeSourceMap.mjs");
    const TextSourceMap = ChromeDevToolsSourceMap.TextSourceMap;

    textSourceMap = new TextSourceMap(
      "compiled.js",
      "compiled.js.map",
      sourceMapJSON
    );
  }

  async function findSources() {
    SOURCES.forEach(({ lineNumber, columnNumber }) => {
      const result = textSourceMap.findEntry(lineNumber, columnNumber);
      const sourceContent = textSourceMap.embeddedContentByURL(
        result.sourceURL
      );
    });
  }

  async function teardown() {
    textSourceMap.dispose();
    textSourceMap = null;
  }

  return {
    parse: {
      init: noop,
      run: async () => {
        await init();
        await teardown();
      },
      teardown: noop,
    },
    findSources: {
      init,
      run: findSources,
      teardown,
    },
    parseAndFindSources: {
      init: noop,
      run: async () => {
        await init();
        await findSources();
        await teardown();
      },
      teardown: noop,
    },
  };
}

// https://www.npmjs.com/package/source-map
function sourceMap() {
  function noop() {}

  let sourceMapConsumer = null;

  async function init() {
    const SourceMap = await import("source-map");
    const SourceMapConsumer = SourceMap.SourceMapConsumer;
    if (isBrowser) {
      SourceMapConsumer.initialize({
        "lib/mappings.wasm":
          "https://unpkg.com/source-map@0.7.3/lib/mappings.wasm",
      });
    }

    sourceMapConsumer = await new SourceMapConsumer(sourceMapJSON);
  }

  async function findSources() {
    SOURCES.forEach(({ lineNumber, columnNumber }) => {
      const { column, line, source } = sourceMapConsumer.originalPositionFor({
        line: lineNumber,

        // Column numbers are represented differently between tools/engines.
        // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
        column: columnNumber - 1,
      });
      const sourceContent = sourceMapConsumer.sourceContentFor(source, true);
    });
  }

  async function teardown() {
    sourceMapConsumer.destroy();
    sourceMapConsumer = null;
  }

  return {
    parse: {
      init: noop,
      run: async () => {
        await init();
        await teardown();
      },
      teardown: noop,
    },
    findSources: {
      init,
      run: findSources,
      teardown,
    },
    parseAndFindSources: {
      init: noop,
      run: async () => {
        await init();
        await findSources();
        await teardown();
      },
      teardown: noop,
    },
  };
}

// https://www.npmjs.com/package/source-map-js
function sourceMapJS() {
  function noop() {}

  let sourceMapConsumer = null;

  async function init() {
    const SourceMapJS = await import("source-map-js");
    const SourceMapConsumer = SourceMapJS.SourceMapConsumer;

    sourceMapConsumer = new SourceMapConsumer(sourceMapJSON);
  }

  async function findSources() {
    SOURCES.forEach(({ lineNumber, columnNumber }) => {
      const { column, line, source } = sourceMapConsumer.originalPositionFor({
        line: lineNumber,

        // Column numbers are represented differently between tools/engines.
        // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
        column: columnNumber - 1,
      });
      const sourceContent = sourceMapConsumer.sourceContentFor(source, true);
    });
  }

  return {
    parse: {
      init: noop,
      run: init,
      teardown: noop,
    },
    findSources: {
      init,
      run: findSources,
      teardown: noop,
    },
    parseAndFindSources: {
      init: noop,
      run: async () => {
        await init();
        await findSources();
      },
      teardown: noop,
    },
  };
}

// https://www.npmjs.com/package/@bloomberg/pasta-sourcemaps
function sourceMapCodec() {
  function noop() {}

  let sourceMapConsumer = null;

  async function init() {
    const SourceMapConsumerModule = await import("./lib/SourceMapConsumer.mjs");
    const SourceMapConsumer = SourceMapConsumerModule.default;

    sourceMapConsumer = new SourceMapConsumer(sourceMapJSON);
  }

  async function findSources() {
    SOURCES.forEach(({ lineNumber, columnNumber }) => {
      const { column, line, sourceContent } =
        sourceMapConsumer.originalPositionFor({ columnNumber, lineNumber });
      //console.log(line, column);
    });
  }

  return {
    parse: {
      init: noop,
      run: init,
      teardown: noop,
    },
    findSources: {
      init,
      run: findSources,
      teardown: noop,
    },
    parseAndFindSources: {
      init: noop,
      run: async () => {
        await init();
        await findSources();
      },
      teardown: noop,
    },
  };
}

// https://www.npmjs.com/package/@bloomberg/pasta-sourcemaps
function sourceMapCodecStreaming() {
  function noop() {}

  let sourceMapConsumer = null;

  async function init() {
    const SourceMapConsumerModule = await import(
      "./lib/SourceMapConsumerStreaming.mjs"
    );
    const SourceMapConsumer = SourceMapConsumerModule.default;

    sourceMapConsumer = new SourceMapConsumer(sourceMapText, sourceMapJSON);
  }

  async function findSources() {
    SOURCES.forEach(({ lineNumber, columnNumber }) => {
      const { column, line, sourceContent } =
        sourceMapConsumer.originalPositionFor({ columnNumber, lineNumber });
      //console.log(line, column);
    });
  }

  return {
    parse: {
      init: noop,
      run: init,
      teardown: noop,
    },
    findSources: {
      init,
      run: findSources,
      teardown: noop,
    },
    parseAndFindSources: {
      init: noop,
      run: async () => {
        await init();
        await findSources();
      },
      teardown: noop,
    },
  };
}

// https://www.npmjs.com/package/fast-source-map
function fastSourceMap() {
  function noop() {}

  let decodedMappings = null;

  async function init() {
    const mappings = sourceMapJSON.mappings;

    const byteArray = new Uint8Array(mappings.length);
    const buffer = Buffer.from(byteArray.buffer);
    buffer.write(mappings, 0, "ascii");

    // The actual 'fast-source-map' NPM module is really outdated.
    // This fork is a little newer.
    const { Decoder, IntBufferReader, MappingsDecoder } = await import(
      "@elsassph/fast-source-map"
    );

    const reader = new IntBufferReader(byteArray, 0, byteArray.length);
    const decoder = new Decoder();
    const mappingsDecoder = new MappingsDecoder(decoder);

    mappingsDecoder.decode(reader);

    decodedMappings = decoder.mappings;
  }

  async function findSources() {
    SOURCES.forEach(({ lineNumber, columnNumber }) => {
      // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
      const targetColumnNumber = columnNumber - 1;

      const lineMappings = decodedMappings[lineNumber - 1];

      let nearestEntry = null;

      let startIndex = 0;
      let stopIndex = lineMappings.length - 1;
      let index = -1;
      while (startIndex <= stopIndex) {
        index = Math.floor((stopIndex + startIndex) / 2);
        nearestEntry = lineMappings[index];

        const currentColumn = nearestEntry.srcCol;
        if (currentColumn === targetColumnNumber) {
          break;
        } else {
          if (currentColumn > targetColumnNumber) {
            if (stopIndex - index > 0) {
              stopIndex = index;
            } else {
              index = stopIndex;
              break;
            }
          } else {
            if (index - startIndex > 0) {
              startIndex = index;
            } else {
              index = startIndex;
              break;
            }
          }
        }
      }

      // We have found either the exact element, or the next-closest element.
      // However there may be more than one such element.
      // Make sure we always return the smallest of these.
      while (index > 0) {
        const previousEntry = lineMappings[index - 1];
        const currentColumn = previousEntry.srcCol;
        if (currentColumn !== targetColumnNumber) {
          break;
        }
        index--;
      }

      if (nearestEntry !== null) {
        const sourceIndex = nearestEntry.src;
        const line = nearestEntry.srcLine + 1;
        const column = nearestEntry.srcCol;

        const sourceContent = sourceMapJSON.sourcesContent[sourceIndex];
      }
    });
  }

  return {
    parse: {
      init: noop,
      run: init,
      teardown: noop,
    },
    findSources: {
      init,
      run: findSources,
      teardown: noop,
    },
    parseAndFindSources: {
      init: noop,
      run: async () => {
        await init();
        await findSources();
      },
      teardown: noop,
    },
  };
}
