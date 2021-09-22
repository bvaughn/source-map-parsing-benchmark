import {isBrowser, isNode} from 'browser-or-node';
import {Suite} from './benchmark.mjs';

import SOURCES from './sources.mjs';
import sourceMapJSON from './source-map.json';

async function test() {
  const LIBRARIES = {
    'Chrome DevTools parser': chromeDevTools(),
    'source-map': sourceMap(),
    'source-map-js': sourceMapJS(),
    'sourcemap-codec': sourceMapCodec(),
  };

  if (isNode) {
    LIBRARIES['fast-source-map'] = fastSourceMap();
  }

  const parseSuite = new Suite('Parse');
  const parseAndUseSuite = new Suite('Parse and use');

  for (let name in LIBRARIES) {
    const {parse, parseAndUse} = LIBRARIES[name];
    parseSuite.add(name, () => parse(sourceMapJSON));
    parseAndUseSuite.add(name, () => parseAndUse(sourceMapJSON, SOURCES));
  }

  await parseSuite.run();
  await parseAndUseSuite.run();
}

test();

// https://www.npmjs.com/package/source-map
function sourceMap() {
  async function initSourceMapConsumer() {
    const SourceMap = await import('source-map');
    const SourceMapConsumer = SourceMap.SourceMapConsumer;
    if (isBrowser) {
      SourceMapConsumer.initialize({
        'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm',
      });
    }
    return SourceMapConsumer;
  }

  async function parse(sourceMapJSON) {
    const SourceMapConsumer = await initSourceMapConsumer();
    const sourceConsumer = await new SourceMapConsumer(sourceMapJSON);

    sourceConsumer.destroy();
  }

  async function parseAndUse(sourceMapJSON, sources) {
    const SourceMapConsumer = await initSourceMapConsumer();
    const sourceConsumer = await new SourceMapConsumer(sourceMapJSON);

    sources.forEach(({ lineNumber, columnNumber }) => {
      const {column, line, source} = sourceConsumer.originalPositionFor({
        line: lineNumber,

        // Column numbers are represented differently between tools/engines.
        // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
        column: columnNumber - 1,
      });
      const sourceContent = sourceConsumer.sourceContentFor(source, true);
    });

    sourceConsumer.destroy();
  }

  return {
    parse,
    parseAndUse,
  };
}

// https://www.npmjs.com/package/source-map-js
function sourceMapJS() {
  async function initSourceMapConsumer() {
    const SourceMapJS = await import('source-map-js');
    const SourceMapConsumer = SourceMapJS.SourceMapConsumer;
    return SourceMapConsumer;
  }

  async function parse(sourceMapJSON) {
    const SourceMapConsumer = await initSourceMapConsumer();
    const sourceConsumer = new SourceMapConsumer(sourceMapJSON);
  }

  async function parseAndUse(sourceMapJSON, sources) {
    const SourceMapConsumer = await initSourceMapConsumer();
    const sourceConsumer = new SourceMapConsumer(sourceMapJSON);

    sources.forEach(({ lineNumber, columnNumber }) => {
      const {column, line, source} = sourceConsumer.originalPositionFor({
        line: lineNumber,

        // Column numbers are represented differently between tools/engines.
        // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
        column: columnNumber - 1,
      });
      const sourceContent = sourceConsumer.sourceContentFor(source, true);
    });
  }

  return {
    parse,
    parseAndUse,
  };
}

// GoogleChrome Developer Tools source-map parsing
function chromeDevTools() {
  async function initTextSourceMap() {
    const ChromeDevToolsSourceMap = await import('./lib/ChromeSourceMap.mjs');
    const TextSourceMap = ChromeDevToolsSourceMap.TextSourceMap;
    return TextSourceMap;
  }

  async function parse(sourceMapJSON) {
    const TextSourceMap = await initTextSourceMap();
    const textSourceMap = new TextSourceMap('compiled.js', 'compiled.js.map', sourceMapJSON);

    textSourceMap.dispose();
  }

  async function parseAndUse(sourceMapJSON, sources) {
    const TextSourceMap = await initTextSourceMap();
    const textSourceMap = new TextSourceMap('compiled.js', 'compiled.js.map', sourceMapJSON);

    sources.forEach(({ lineNumber, columnNumber }) => {
      const result = textSourceMap.findEntry(lineNumber, columnNumber);
      const sourceContent = textSourceMap.embeddedContentByURL(result.sourceURL);
    });

    textSourceMap.dispose();
  }

  return {
    parse,
    parseAndUse,
  };
}

// https://www.npmjs.com/package/@bloomberg/pasta-sourcemaps
function sourceMapCodec() {
  async function initDecoder() {
    const SourceMapCodec = await import('sourcemap-codec');
    const decode = SourceMapCodec.decode;
    return decode;
  }

  async function parse(sourceMapJSON) {
    const decode = await initDecoder();
    const decodedMappings = new decode(sourceMapJSON.mappings);
  }

  async function parseAndUse(sourceMapJSON, sources) {
    const decode = await initDecoder();
    const decodedMappings = new decode(sourceMapJSON.mappings);

    sources.forEach(({ lineNumber, columnNumber }) => {
      // Parse and extract the AST from the source map.
      // Now that the source map has been loaded, extract the original source for later.
      const lineMappings = decodedMappings[lineNumber - 1];

      // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
      const targetColumnNumber = columnNumber - 1;

      let startIndex = 0;
      let stopIndex = lineMappings.length - 1;
      let nearestEntry = null;
      let nearestIndex = -1;
      while (startIndex <= stopIndex) {
        nearestIndex = Math.floor((stopIndex + startIndex) / 2);
        nearestEntry = lineMappings[nearestIndex];

        const currentColumn = nearestEntry[0];
        if (currentColumn === targetColumnNumber) {
          break;
        } else {
          if (currentColumn > targetColumnNumber) {
            if (stopIndex - nearestIndex > 0) {
              stopIndex = nearestIndex;
            } else {
              nearestIndex = stopIndex;
              nearestEntry = lineMappings[nearestIndex];
              break;
            }
          } else {
            if (nearestIndex - startIndex > 0) {
              startIndex = nearestIndex;
            } else {
              nearestIndex = startIndex;
              nearestEntry = lineMappings[nearestIndex];
              break;
            }
          }
        }
      }

      // We have found either the exact element, or the next-closest element than
      // the one we are searching for. However, there may be more than one such
      // element. Make sure we always return the smallest of these.
      while (nearestIndex > 0) {
        const previousEntry = lineMappings[nearestIndex - 1];
        const currentColumn = previousEntry[0];
        if (currentColumn !== targetColumnNumber) {
          break;
        }
        nearestIndex--;
      }

      if (nearestEntry !== null) {
        const sourceIndex = nearestEntry[1];
        const line = nearestEntry[2] + 1;
        const column = nearestEntry[3];

        const sourceContent = sourceMapJSON.sourcesContent[sourceIndex];
      }
    });
  }

  return {
    parse,
    parseAndUse,
  };
}

// https://www.npmjs.com/package/fast-source-map
function fastSourceMap() {
  async function initDecoder(sourceMapJSON) {
    const mappings = sourceMapJSON.mappings;

    const byteArray = new Uint8Array(mappings.length);
    const buffer = Buffer.from(byteArray.buffer);
    buffer.write(mappings, 0, 'ascii');

    // The actual 'fast-source-map' NPM module is really outdated.
    // This fork is a little newer.
    const {
      Decoder,
      IntBufferReader,
      MappingsDecoder,
    } = await import('@elsassph/fast-source-map');

    const reader = new IntBufferReader(byteArray, 0, byteArray.length);
    const decoder = new Decoder();
    const mappingsDecoder = new MappingsDecoder(decoder);

    mappingsDecoder.decode(reader);

    return decoder.mappings;
  }

  async function parse(sourceMapJSON) {
    const decodedMappings = await initDecoder(sourceMapJSON);
  }

  async function parseAndUse(sourceMapJSON, sources) {
    const decodedMappings = await initDecoder(sourceMapJSON);

    sources.forEach(({ lineNumber, columnNumber }) => {
      // Parse and extract the AST from the source map.
      // Now that the source map has been loaded, extract the original source for later.
      const lineMappings = decodedMappings[lineNumber - 1];

      // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
      const targetColumnNumber = columnNumber - 1;

      let startIndex = 0;
      let stopIndex = lineMappings.length - 1;
      let nearestEntry = null;
      let nearestIndex = -1;
      while (startIndex <= stopIndex) {
        nearestIndex = Math.floor((stopIndex + startIndex) / 2);
        nearestEntry = lineMappings[nearestIndex];

        const currentColumn = nearestEntry[0];
        if (currentColumn === targetColumnNumber) {
          break;
        } else {
          if (currentColumn > targetColumnNumber) {
            if (stopIndex - nearestIndex > 0) {
              stopIndex = nearestIndex;
            } else {
              nearestIndex = stopIndex;
              nearestEntry = lineMappings[nearestIndex];
              break;
            }
          } else {
            if (nearestIndex - startIndex > 0) {
              startIndex = nearestIndex;
            } else {
              nearestIndex = startIndex;
              nearestEntry = lineMappings[nearestIndex];
              break;
            }
          }
        }
      }

      // We have found either the exact element, or the next-closest element than
      // the one we are searching for. However, there may be more than one such
      // element. Make sure we always return the smallest of these.
      while (nearestIndex > 0) {
        const previousEntry = lineMappings[nearestIndex - 1];
        const currentColumn = previousEntry[0];
        if (currentColumn !== targetColumnNumber) {
          break;
        }
        nearestIndex--;
      }

      if (nearestEntry !== null) {
        const sourceIndex = nearestEntry[1];
        const line = nearestEntry[2] + 1;
        const column = nearestEntry[3];

        const sourceContent = sourceMapJSON.sourcesContent[sourceIndex];
      }
    });
  }

  return {
    parse,
    parseAndUse,
  };
}

// https://www.npmjs.com/package/@bloomberg/pasta-sourcemaps
// Pasta can only work with its own "enriched" source-map format so we can't use it.
// function pastaSourceMaps() {
//   async function initSourceMapDecoder() {
//     const PastaSourceMaps = await import('@bloomberg/pasta-sourcemaps');
//     const SourceMapDecoder = PastaSourceMaps.SourceMapDecoder;
//     return SourceMapDecoder;
//   }

//   async function parse(sourceMapJSON) {
//     const SourceMapDecoder = await initSourceMapDecoder();
//     const sourceMapDecoder = new SourceMapDecoder(sourceMapJSON);
//   }

//   async function parseAndUse(sourceMapJSON, sources) {
//     const SourceMapDecoder = await initSourceMapDecoder();
//     const sourceMapDecoder = new SourceMapDecoder(sourceMapJSON);

//     sources.forEach(({ lineNumber, columnNumber }) => {
//       const result = sourceMapDecoder.decode('compiled.js', lineNumber, columnNumber);
//     });
//   }

//   return {
//     parse,
//     parseAndUse,
//   };
// }