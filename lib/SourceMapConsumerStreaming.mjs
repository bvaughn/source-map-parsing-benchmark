export default function SourceMapConsumer(sourceMapText, sourceMapJSON) {
  const streamingDecoder = createStreamingDecoder();

  const chunkSize = 10000;
  const length = sourceMapText.length;

  // Mimic streaming reader chunks
  for (let startIndex = 0; startIndex < length; startIndex += chunkSize) {
    const stopIndex = Math.min(startIndex + chunkSize, length);
    const chunk = sourceMapText.substring(startIndex, stopIndex);

    streamingDecoder.processChunk(chunk);
  }

  streamingDecoder.complete();

  function originalPositionFor({
    columnNumber,
    lineNumber,
  }) {
    // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
    const targetColumnNumber = columnNumber - 1;

    const lineMappings = streamingDecoder.decodedMappings[lineNumber - 1];

    let nearestEntry = null;

    let startIndex = 0;
    let stopIndex = lineMappings.length - 1;
    let index = -1;

    // Column metadata is sorted, so we can do a binary search for it.
    while (startIndex <= stopIndex) {
      index = Math.floor((stopIndex + startIndex) / 2);
      nearestEntry = lineMappings[index];

      const currentColumn = nearestEntry[0];
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
      const currentColumn = previousEntry[0];
      if (currentColumn !== targetColumnNumber) {
        break;
      }
      index--;
    }

    if (nearestEntry == null) {
      // TODO maybe fall back to the runtime source instead of throwing?
      throw Error(
        `Could not find runtime location for line:${lineNumber} and column:${columnNumber}`,
      );
    }

    const sourceIndex = nearestEntry[1];
    const sourceContent =
      sourceMapJSON.sourcesContent != null
        ? sourceMapJSON.sourcesContent[sourceIndex]
        : null;
    const sourceURL = sourceMapJSON.sources[sourceIndex] ?? null;
    const line = nearestEntry[2] + 1;
    const column = nearestEntry[3];

    if (sourceContent === null || sourceURL === null) {
      // TODO maybe fall back to the runtime source instead of throwing?
      throw Error(
        `Could not find original source for line:${lineNumber} and column:${columnNumber}`,
      );
    }

    return {
      column,
      line,
      sourceContent: sourceContent,
      sourceURL: sourceURL,
    };
  }

  return {
    decodedMappings: streamingDecoder.decodedMappings,
    originalPositionFor,
  };
}

const CHAR_CODE_QUOTATION_MARK = 34;

const MAPPINGS_STRING = '"mappings"';
const MAPPINGS_LENGTH = MAPPINGS_STRING.length;
const MAPPINGS = new Array(MAPPINGS_LENGTH);
for (let i = 0; i < MAPPINGS_LENGTH; i++) {
  MAPPINGS[i] = MAPPINGS_STRING.charCodeAt(i);
}

const SECTIONS_STRING = '"sections"';
const SECTIONS_LENGTH = SECTIONS_STRING.length;
const SECTIONS = new Array(SECTIONS_LENGTH);
for (let i = 0; i < SECTIONS_LENGTH; i++) {
  SECTIONS[i] = SECTIONS_STRING.charCodeAt(i);
}

function createStreamingDecoder() {
  const decodedMappings = [];

  let line = [];

  let didFindMappingsKey = false;
  let didFindSectionKey = false;

  let isProcessingMappingsKey = false;

  let mappingsCharIndex = 0;
  let sectionsCharIndex = 0;

  let mappingsStartIndex = -1;
  let mappingsString = null;

  let decodingHasStarted = false;
  let decodingIsFinished = false;

  function processChunk(chunk) {
    if (decodingIsFinished || didFindSectionKey) {
      // If we've finished decoding the "mappings" array,
      // or we found a "sections" key (indicating an unsupport index map type),
      // then we have no other work to do.
      return;
    }

    const length = chunk.length;

    for (let index = 0; index < length; index++) {
      // If "chunk" comes from a readable stream
      // const charCode = parseInt(chunk[index]);
      const charCode = chunk.charCodeAt(index);

      // The streaming parser does not support index maps.
      // That means until we've found a "mappings" key, we should look for a "sections" key.
      // If we find one, we should fall back to the non-streaming parser.
      if (!didFindMappingsKey) {
        if (charCode === SECTIONS[sectionsCharIndex]) {
          // We've matched another character in a possible "sections" key.
          sectionsCharIndex++;

          if (sectionsCharIndex === SECTIONS_LENGTH) {
            // We've found the "sections" key.
            didFindSectionKey = true;
          }
        } else {
          sectionsCharIndex = 0;
        }
      }

      if (!decodingIsFinished) {
        if (isProcessingMappingsKey) {
          // We've found the "mappings" key and now we are looking for the start of the value.
          // This check is meant to handle white space differences.
          if (charCode === CHAR_CODE_QUOTATION_MARK) {
            isProcessingMappingsKey = false;

            // If the current character is a quotation mark,
            // we have found the start of the mappings value string.
            mappingsStartIndex = index + 1;
            mappingsCharIndex = 0;
          }
        } else {
          if (mappingsStartIndex < 0) {
            if (charCode === MAPPINGS[mappingsCharIndex]) {
              // We've matched another character in a possible "mappings" key.
              mappingsCharIndex++;

              if (mappingsCharIndex === MAPPINGS_LENGTH) {
                // We've found the "mappings" key.
                // In order to handle white space differences,
                // now we need to look for the opening quotation mark for the value string.
                didFindMappingsKey = true;
                isProcessingMappingsKey = true;
              }
            } else {
              // This is not a match; reset the check.
              mappingsCharIndex = 0;
            }
          } else {
            // If we are currently reading the mappings value string,
            // a quotation mark indicates that we've reached the end.
            if (charCode === CHAR_CODE_QUOTATION_MARK) {
              const mappingsStopIndex = index - 1;

              if (!decodingHasStarted) {
                decodingHasStarted = true;

                // Edge case: The current chunk contains the entire mappings string.
                decodeChunk(chunk.substring(mappingsStartIndex, mappingsStopIndex));
              } else {
                // The current chunk contains the end of the mappings value.
                decodeChunk(chunk.substring(0, mappingsStopIndex));
              }

              // The streaming parser does not support index maps.
              // This means there will only ever be one top-level "mappings" field
              // and once we've processed it, we can stop looking.
              decodingIsFinished = true;
            }
          }
        }
      }
    }

    if (!decodingIsFinished) {
      if (mappingsStartIndex >= 0) {
        // The current chunk contains (at least) part of the "mappings" value string.
        if (!decodingHasStarted) {
          decodingHasStarted = true;

          // If we haven't started decoding mappings yet,
          // that means we found the start of the value inside of the current chunk,
          // and we should only process the substring that contains it.
          decodeChunk(chunk.substring(mappingsStartIndex));
        } else {
          // We haven't found the end of the mappings value string yet,
          // so we should process all of the curent chunk.
          decodeChunk(chunk);
        }
      }
    }
  }

  const CHAR_TO_CHAR_CODE = {};
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  for (let index = 0; index < CHARS.length; index++) {
    CHAR_TO_CHAR_CODE[CHARS.charCodeAt(index)] = index;
  }

  const segment = [
    0, // generated code column
    0, // source file index
    0, // source code line
    0, // source code column
    0, // name index
  ];

  let segmentIndex = 0;
  let shift = 0;
  let value = 0;

  // Forked from github.com/Rich-Harris/sourcemap-codec
  function decodeChunk(mappingsChunk) {
    for (let charIndex = 0; charIndex < mappingsChunk.length; charIndex++) {
      const charCode = mappingsChunk.charCodeAt(charIndex);

      if (charCode === 44) { // ","
        segmentify(line, segment, segmentIndex);
        segmentIndex = 0;

      } else if (charCode === 59) { // ";"
        segmentify(line, segment, segmentIndex);
        segmentIndex = 0;
        decodedMappings.push(line);
        line = [];
        segment[0] = 0;

      } else {
        let integer = CHAR_TO_CHAR_CODE[charCode];
        if (integer === undefined) {
          throw new Error('Invalid character (' + String.fromCharCode(charCode) + ')');
        }

        const hasContinuationBit = integer & 32;

        integer &= 31;
        value += integer << shift;

        if (hasContinuationBit) {
          shift += 5;
        } else {
          const shouldNegate = value & 1;
          value >>>= 1;

          if (shouldNegate) {
            value = value === 0 ? -0x80000000 : -value;
          }

          segment[segmentIndex] += value;
          segmentIndex++;
          value = shift = 0; // reset
        }
      }
    }
  }

  function complete() {
    segmentify(line, segment, segmentIndex);

    decodedMappings.push(line);
  }

  function segmentify(line, segment) {
    // This looks ugly, but we're creating specialized arrays with a specific
    // length. This is much faster than creating a new array (which v8 expands to
    // a capacity of 17 after pushing the first item), or slicing out a subarray
    // (which is slow). Length 4 is assumed to be the most frequent, followed by
    // length 5 (since not everything will have an associated name), followed by
    // length 1 (it's probably rare for a source substring to not have an
    // associated segment data).
    if (segmentIndex === 4) line.push([segment[0], segment[1], segment[2], segment[3]]);
    else if (segmentIndex === 5) line.push([segment[0], segment[1], segment[2], segment[3], segment[4]]);
    else if (segmentIndex === 1) line.push([segment[0]]);
  }

  return {
    complete,
    decodedMappings,
    processChunk,
  };
}