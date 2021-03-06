// https://raw.githubusercontent.com/GoogleChrome/lighthouse/master/lighthouse-core/lib/cdt/generated/SourceMap.js
// https://github.com/paulirish/source-map-js/compare/patch-0.6.1...cdt

const Common = {
    console,
  };

/**
 * @interface
 */
 class SourceMap {
    /**
     * @return {string}
     */
    compiledURL() {
    }
    /**
     * @return {string}
     */
    url() {
    }
    /**
     * @return {!Array<string>}
     */
    sourceURLs() {
    }
    /**
     * @param {string} sourceURL
     * @return {?string}
     */
    embeddedContentByURL(sourceURL) {
    }
    /**
     * @param {number} lineNumber in compiled resource
     * @param {number} columnNumber in compiled resource
     * @return {?SourceMapEntry}
     */
    findEntry(lineNumber, columnNumber) {
    }
    /**
     * @param {string} sourceURL
     * @param {number} lineNumber
     * @param {number} columnNumber
     * @return {?SourceMapEntry}
     */
    sourceLineMapping(sourceURL, lineNumber, columnNumber) {
    }
    /**
     * @return {!Array<!SourceMapEntry>}
     */
    mappings() {
    }
    dispose() {
    }
}

/**
 * @unrestricted
 */
class SourceMapV3 {
    constructor() {
        /** @type {number} */ this.version;
        /** @type {string|undefined} */ this.file;
        /** @type {!Array.<string>} */ this.sources;
        /** @type {!Array.<!SourceMapV3.Section>|undefined} */ this.sections;
        /** @type {string} */ this.mappings;
        /** @type {string|undefined} */ this.sourceRoot;
        /** @type {!Array.<string>|undefined} */ this.names;
    }
}
/**
 * @unrestricted
 */
SourceMapV3.Section = class {
    constructor() {
        /** @type {!SourceMapV3} */ this.map;
        /** @type {!SourceMapV3.Offset} */ this.offset;
    }
};
/**
 * @unrestricted
 */
SourceMapV3.Offset = class {
    constructor() {
        /** @type {number} */ this.line;
        /** @type {number} */ this.column;
    }
};
/**
 * @unrestricted
 */
class SourceMapEntry {
    /**
     * @param {number} lineNumber
     * @param {number} columnNumber
     * @param {string=} sourceURL
     * @param {number=} sourceLineNumber
     * @param {number=} sourceColumnNumber
     * @param {string=} name
     */
    constructor(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber, name) {
        this.lineNumber = lineNumber;
        this.columnNumber = columnNumber;
        this.sourceURL = sourceURL;
        this.sourceLineNumber = sourceLineNumber;
        this.sourceColumnNumber = sourceColumnNumber;
        this.name = name;
    }
    /**
     * @param {!SourceMapEntry} entry1
     * @param {!SourceMapEntry} entry2
     * @return {number}
     */
    static compare(entry1, entry2) {
        if (entry1.lineNumber !== entry2.lineNumber) {
            return entry1.lineNumber - entry2.lineNumber;
        }
        return entry1.columnNumber - entry2.columnNumber;
    }
}



/**
 * @implements {SourceMap}
 * @unrestricted
 */
class TextSourceMap {
    /**
     * Implements Source Map V3 model. See https://github.com/google/closure-compiler/wiki/Source-Maps
     * for format description.
     * @param {string} compiledURL
     * @param {string} sourceMappingURL
     * @param {!SourceMapV3} payload
     */
    constructor(compiledURL, sourceMappingURL, payload) {
        if (!TextSourceMap._base64Map) {
            const base64Digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            TextSourceMap._base64Map = {};
            for (let i = 0; i < base64Digits.length; ++i) {
                TextSourceMap._base64Map[base64Digits.charAt(i)] = i;
            }
        }
        this._json = payload;
        this._compiledURL = compiledURL;
        this._sourceMappingURL = sourceMappingURL;
        this._baseURL = sourceMappingURL.startsWith('data:') ? compiledURL : sourceMappingURL;
        /** @type {?Array<!SourceMapEntry>} */
        this._mappings = null;
        /** @type {!Map<string, !TextSourceMap.SourceInfo>} */
        this._sourceInfos = new Map();
        if (this._json.sections) {
            const sectionWithURL = !!this._json.sections.find(section => !!section.url);
            if (sectionWithURL) {
                Common.console.warn(`SourceMap "${sourceMappingURL}" contains unsupported "URL" field in one of its sections.`);
            }
        }
        this._eachSection(this._parseSources.bind(this));
    }
    /**
     * @override
     * @return {string}
     */
    compiledURL() {
        return this._compiledURL;
    }
    /**
     * @override
     * @return {string}
     */
    url() {
        return this._sourceMappingURL;
    }
    /**
     * @override
     * @return {!Array.<string>}
     */
    sourceURLs() {
        return this._sourceInfos.keysArray();
    }
    /**
     * @override
     * @param {string} sourceURL
     * @return {?string}
     */
    embeddedContentByURL(sourceURL) {
        if (!this._sourceInfos.has(sourceURL)) {
            return null;
        }
        return this._sourceInfos.get(sourceURL).content;
    }
    /**
     * @override
     * @param {number} lineNumber in compiled resource
     * @param {number} columnNumber in compiled resource
     * @return {?SourceMapEntry}
     */
    findEntry(lineNumber, columnNumber) {
        const mappings = this.mappings();
        const index = mappings.upperBound(undefined, (unused, entry) => lineNumber - entry.lineNumber || columnNumber - entry.columnNumber);
        return index ? mappings[index - 1] : null;
    }
    /**
     * @override
     * @param {string} sourceURL
     * @param {number} lineNumber
     * @param {number} columnNumber
     * @return {?SourceMapEntry}
     */
    sourceLineMapping(sourceURL, lineNumber, columnNumber) {
        const mappings = this._reversedMappings(sourceURL);
        const first = mappings.lowerBound(lineNumber, lineComparator);
        const last = mappings.upperBound(lineNumber, lineComparator);
        if (first >= mappings.length || mappings[first].sourceLineNumber !== lineNumber) {
            return null;
        }
        const columnMappings = mappings.slice(first, last);
        if (!columnMappings.length) {
            return null;
        }
        const index = columnMappings.lowerBound(columnNumber, (columnNumber, mapping) => columnNumber - mapping.sourceColumnNumber);
        return index >= columnMappings.length ? columnMappings[columnMappings.length - 1] : columnMappings[index];
        /**
         * @param {number} lineNumber
         * @param {!SourceMapEntry} mapping
         * @return {number}
         */
        function lineComparator(lineNumber, mapping) {
            return lineNumber - mapping.sourceLineNumber;
        }
    }
    /**
     * @param {string} sourceURL
     * @param {number} lineNumber
     * @param {number} columnNumber
     * @return {!Array<!SourceMapEntry>}
     */
    findReverseEntries(sourceURL, lineNumber, columnNumber) {
        const mappings = this._reversedMappings(sourceURL);
        const endIndex = mappings.upperBound(undefined, (unused, entry) => lineNumber - entry.sourceLineNumber || columnNumber - entry.sourceColumnNumber);
        let startIndex = endIndex;
        while (startIndex > 0 && mappings[startIndex - 1].sourceLineNumber === mappings[endIndex - 1].sourceLineNumber &&
            mappings[startIndex - 1].sourceColumnNumber === mappings[endIndex - 1].sourceColumnNumber) {
            --startIndex;
        }
        return mappings.slice(startIndex, endIndex);
    }
    /**
     * @override
     * @return {!Array<!SourceMapEntry>}
     */
    mappings() {
        if (this._mappings === null) {
            this._mappings = [];
            this._eachSection(this._parseMap.bind(this));
            this._json = null;
        }
        return /** @type {!Array<!SourceMapEntry>} */ (this._mappings);
    }
    /**
     * @param {string} sourceURL
     * @return {!Array.<!SourceMapEntry>}
     */
    _reversedMappings(sourceURL) {
        if (!this._sourceInfos.has(sourceURL)) {
            return [];
        }
        const mappings = this.mappings();
        const info = this._sourceInfos.get(sourceURL);
        if (info.reverseMappings === null) {
            info.reverseMappings = mappings.filter(mapping => mapping.sourceURL === sourceURL).sort(sourceMappingComparator);
        }
        return info.reverseMappings;
        /**
         * @param {!SourceMapEntry} a
         * @param {!SourceMapEntry} b
         * @return {number}
         */
        function sourceMappingComparator(a, b) {
            if (a.sourceLineNumber !== b.sourceLineNumber) {
                return a.sourceLineNumber - b.sourceLineNumber;
            }
            if (a.sourceColumnNumber !== b.sourceColumnNumber) {
                return a.sourceColumnNumber - b.sourceColumnNumber;
            }
            if (a.lineNumber !== b.lineNumber) {
                return a.lineNumber - b.lineNumber;
            }
            return a.columnNumber - b.columnNumber;
        }
    }
    /**
     * @param {function(!SourceMapV3, number, number)} callback
     */
    _eachSection(callback) {
        if (!this._json.sections) {
            callback(this._json, 0, 0);
            return;
        }
        for (const section of this._json.sections) {
            callback(section.map, section.offset.line, section.offset.column);
        }
    }
    /**
     * @param {!SourceMapV3} sourceMap
     */
    _parseSources(sourceMap) {
        const sourcesList = [];
        let sourceRoot = sourceMap.sourceRoot || '';
        if (sourceRoot && !sourceRoot.endsWith('/')) {
            sourceRoot += '/';
        }
        for (let i = 0; i < sourceMap.sources.length; ++i) {
            const href = sourceRoot + sourceMap.sources[i];
            let url = '' || href;
            const source = sourceMap.sourcesContent && sourceMap.sourcesContent[i];
            if (url === this._compiledURL && source) {
            }
            this._sourceInfos.set(url, new TextSourceMap.SourceInfo(source, null));
            sourcesList.push(url);
        }
        sourceMap[TextSourceMap._sourcesListSymbol] = sourcesList;
    }
    /**
     * @param {!SourceMapV3} map
     * @param {number} lineNumber
     * @param {number} columnNumber
     */
    _parseMap(map, lineNumber, columnNumber) {
        let sourceIndex = 0;
        let sourceLineNumber = 0;
        let sourceColumnNumber = 0;
        let nameIndex = 0;
        const sources = map[TextSourceMap._sourcesListSymbol];
        const names = map.names || [];
        const stringCharIterator = new TextSourceMap.StringCharIterator(map.mappings);
        let sourceURL = sources[sourceIndex];
        while (true) {
            if (stringCharIterator.peek() === ',') {
                stringCharIterator.next();
            }
            else {
                while (stringCharIterator.peek() === ';') {
                    lineNumber += 1;
                    columnNumber = 0;
                    stringCharIterator.next();
                }
                if (!stringCharIterator.hasNext()) {
                    break;
                }
            }
            columnNumber += this._decodeVLQ(stringCharIterator);
            if (!stringCharIterator.hasNext() || this._isSeparator(stringCharIterator.peek())) {
                this._mappings.push(new SourceMapEntry(lineNumber, columnNumber));
                continue;
            }
            const sourceIndexDelta = this._decodeVLQ(stringCharIterator);
            if (sourceIndexDelta) {
                sourceIndex += sourceIndexDelta;
                sourceURL = sources[sourceIndex];
            }
            sourceLineNumber += this._decodeVLQ(stringCharIterator);
            sourceColumnNumber += this._decodeVLQ(stringCharIterator);
            if (!stringCharIterator.hasNext() || this._isSeparator(stringCharIterator.peek())) {
                this._mappings.push(new SourceMapEntry(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber));
                continue;
            }
            nameIndex += this._decodeVLQ(stringCharIterator);
            this._mappings.push(new SourceMapEntry(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber, names[nameIndex]));
        }
        // As per spec, mappings are not necessarily sorted.
        this._mappings.sort(SourceMapEntry.compare);
    }
    /**
     * @param {string} char
     * @return {boolean}
     */
    _isSeparator(char) {
        return char === ',' || char === ';';
    }
    /**
     * @param {!TextSourceMap.StringCharIterator} stringCharIterator
     * @return {number}
     */
    _decodeVLQ(stringCharIterator) {
        // Read unsigned value.
        let result = 0;
        let shift = 0;
        let digit;
        do {
            digit = TextSourceMap._base64Map[stringCharIterator.next()];
            result += (digit & TextSourceMap._VLQ_BASE_MASK) << shift;
            shift += TextSourceMap._VLQ_BASE_SHIFT;
        } while (digit & TextSourceMap._VLQ_CONTINUATION_MASK);
        // Fix the sign.
        const negative = result & 1;
        result >>= 1;
        return negative ? -result : result;
    }
    /**
     * @param {string} url
     * @param {!TextUtils.TextRange} textRange
     * @return {!TextUtils.TextRange}
     */
    reverseMapTextRange(url, textRange) {
        /**
         * @param {!{lineNumber: number, columnNumber: number}} position
         * @param {!SourceMapEntry} mapping
         * @return {number}
         */
        function comparator(position, mapping) {
            if (position.lineNumber !== mapping.sourceLineNumber) {
                return position.lineNumber - mapping.sourceLineNumber;
            }
            return position.columnNumber - mapping.sourceColumnNumber;
        }
        const mappings = this._reversedMappings(url);
        const startIndex = mappings.lowerBound({ lineNumber: textRange.startLine, columnNumber: textRange.startColumn }, comparator);
        const endIndex = mappings.upperBound({ lineNumber: textRange.endLine, columnNumber: textRange.endColumn }, comparator);
        const startMapping = mappings[startIndex];
        const endMapping = mappings[endIndex];
        return new TextUtils.TextRange(startMapping.lineNumber, startMapping.columnNumber, endMapping.lineNumber, endMapping.columnNumber);
    }
    /**
     * @override
     */
    dispose() {
    }
}

TextSourceMap._VLQ_BASE_SHIFT = 5;
TextSourceMap._VLQ_BASE_MASK = (1 << 5) - 1;
TextSourceMap._VLQ_CONTINUATION_MASK = 1 << 5;
/**
 * @unrestricted
 */
TextSourceMap.StringCharIterator = class {
    /**
     * @param {string} string
     */
    constructor(string) {
        this._string = string;
        this._position = 0;
    }
    /**
     * @return {string}
     */
    next() {
        return this._string.charAt(this._position++);
    }
    /**
     * @return {string}
     */
    peek() {
        return this._string.charAt(this._position);
    }
    /**
     * @return {boolean}
     */
    hasNext() {
        return this._position < this._string.length;
    }
};
/**
 * @unrestricted
 */
TextSourceMap.SourceInfo = class {
    /**
     * @param {?string} content
     * @param {?Array<!SourceMapEntry>} reverseMappings
     */
    constructor(content, reverseMappings) {
        this.content = content;
        this.reverseMappings = reverseMappings;
    }
};
TextSourceMap._sourcesListSymbol = Symbol('sourcesList');












const SDK = {
    TextSourceMap,
  };

/**
 * CDT pollutes Array.prototype w/ `lowerBound/upperBound`. SourceMap
 * relies on this, but only for a couple method return values. To avoid global pollution,
 * we explicitly set the extension functions on the return values.
 *
 * @param {unknown[]} array
 */
function extendArray(array) {
// @ts-expect-error
if (array.lowerBound) return;

// @ts-expect-error
array.lowerBound = lowerBound.bind(array);
// @ts-expect-error
array.upperBound = upperBound.bind(array);

array.slice = function(start, end) {
    const retVal = Array.prototype.slice.call(array, start, end);
    extendArray(retVal);
    return retVal;
};
// @ts-expect-error
array.filter = function(fn) {
    const retVal = Array.prototype.filter.call(array, fn);
    extendArray(retVal);
    return retVal;
};
}

const originalMappings = SDK.TextSourceMap.prototype.mappings;
SDK.TextSourceMap.prototype.mappings = function() {
const mappings = originalMappings.call(this);
extendArray(mappings);
return mappings;
};

const originalReversedMappings = SDK.TextSourceMap.prototype._reversedMappings;
/** @param {string} sourceURL */
SDK.TextSourceMap.prototype._reversedMappings = function(sourceURL) {
const mappings = originalReversedMappings.call(this, sourceURL);
extendArray(mappings);
return mappings;
};


/**
 * `upperBound` and `lowerBound` are copied from CDT utilities.js.
 * These are the only methods needed from that file.
 */

/**
 * Return index of the leftmost element that is greater
 * than the specimen object. If there's no such element (i.e. all
 * elements are smaller or equal to the specimen) returns right bound.
 * The function works for sorted array.
 * When specified, |left| (inclusive) and |right| (exclusive) indices
 * define the search window.
 *
 * @param {!T} object
 * @param {function(!T,!S):number=} comparator
 * @param {number=} left
 * @param {number=} right
 * @return {number}
 * @this {Array.<!S>}
 * @template T,S
 */
 function upperBound(object, comparator, left, right) {
    // @ts-expect-error
    function defaultComparator(a, b) {
      return a < b ? -1 : (a > b ? 1 : 0);
    }
    comparator = comparator || defaultComparator;
    let l = left || 0;
    let r = right !== undefined ? right : this.length;
    while (l < r) {
      const m = (l + r) >> 1;
      if (comparator(object, this[m]) >= 0) {
        l = m + 1;
      } else {
        r = m;
      }
    }
    return r;
  }
  
  /**
   * Return index of the leftmost element that is equal or greater
   * than the specimen object. If there's no such element (i.e. all
   * elements are smaller than the specimen) returns right bound.
   * The function works for sorted array.
   * When specified, |left| (inclusive) and |right| (exclusive) indices
   * define the search window.
   *
   * @param {!T} object
   * @param {function(!T,!S):number=} comparator
   * @param {number=} left
   * @param {number=} right
   * @return {number}
   * @this {Array.<!S>}
   * @template T,S
   */
  function lowerBound(object, comparator, left, right) {
    // @ts-expect-error
    function defaultComparator(a, b) {
      return a < b ? -1 : (a > b ? 1 : 0);
    }
    comparator = comparator || defaultComparator;
    let l = left || 0;
    let r = right !== undefined ? right : this.length;
    while (l < r) {
      const m = (l + r) >> 1;
      if (comparator(object, this[m]) > 0) {
        l = m + 1;
      } else {
        r = m;
      }
    }
    return r;
  }
  
  // Add `lastColumnNumber` to mappings. This will eventually be added to CDT.
  // @ts-expect-error
  SDK.TextSourceMap.prototype.computeLastGeneratedColumns = function() {
    const mappings = this.mappings();
    // @ts-expect-error: `lastColumnNumber` is not on types yet.
    if (mappings.length && typeof mappings[0].lastColumnNumber !== 'undefined') return;
  
    for (let i = 0; i < mappings.length - 1; i++) {
      const mapping = mappings[i];
      const nextMapping = mappings[i + 1];
      if (mapping.lineNumber === nextMapping.lineNumber) {
        // @ts-expect-error: `lastColumnNumber` is not on types yet.
        mapping.lastColumnNumber = nextMapping.columnNumber;
      }
    }
  };

//   if (typeof load !== "function") {
//     var fs = require("fs");
//     var vm = require("vm");
//     load = function(file) {
//       var src = fs.readFileSync(file, "utf8");
//       vm.runInThisContext(src);
//     };
//   }
//   load("./scalajs-runtime-sourcemap.js");
//   const tsm = new SDK.TextSourceMap(`compiled.js`, `compiled.js.map`, testSourceMap);
//   console.log(tsm.mappings().length)

export {TextSourceMap};