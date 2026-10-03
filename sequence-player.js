/* Local image-sequence loader. Does not fetch a manifest or change the DOM.
 *
 * const player = new LCSequence(manifest, {
 *   baseURL: document.baseURI,
 *   assetRoot: 'assets/',
 *   onFrame({ frame, index, image, requestedAngle, fallback }) { ... }
 * });
 * player.seek(135); // Degrees; nearest frame wins, with lower-angle ties.
 * player.retryFailed();
 * player.destroy();
 *
 * Manifest: { frames: [{ src, angle, view, primary? }, ...] }
 * Relative/root-relative URLs under assetRoot only; no remote/data/blob URLs.
 * A repeated opening URL at 360 degrees shares its decoded Image with 0.
 */
(function (global) {
  'use strict';

  const localPath = value => typeof value === 'string' && value.length > 0 &&
    value === value.trim() && !/^(?:[a-z][a-z\d+.-]*:|[\\/]{2})/i.test(value) &&
    !/[\\\u0000-\u001f\u007f]/.test(value);
  const limit = (value, fallback, min, max) =>
    value === undefined ? fallback : Math.max(min, Math.min(max, Math.floor(Number(value)) || fallback));

  class LCSequence {
    constructor(manifest, options = {}) {
      if (!Array.isArray(manifest?.frames) || !manifest.frames.length) {
        throw new TypeError('A nonempty frames manifest is required.');
      }
      const base = new URL(options.baseURL || global.document?.baseURI || global.location?.href);
      if (!['http:', 'https:', 'file:'].includes(base.protocol)) {
        throw new TypeError('The sequence needs a local page base URL.');
      }
      const assetRoot = options.assetRoot ?? 'assets/';
      if (!localPath(assetRoot)) throw new TypeError('assetRoot must be a local path.');
      const root = new URL(assetRoot.endsWith('/') ? assetRoot : assetRoot + '/', base);
      this.frames = Object.freeze(manifest.frames.map(frame => {
        if (!frame || !localPath(frame.src) || !Number.isFinite(frame.angle) ||
            frame.angle < 0 || frame.angle > 360) {
          throw new TypeError('Every frame needs a local src and an angle from 0 to 360.');
        }
        const url = new URL(frame.src, base);
        if (url.origin !== root.origin || url.protocol !== root.protocol ||
            !url.pathname.startsWith(root.pathname) || url.hash ||
            /%(?:2e|2f|5c)/i.test(url.pathname)) {
          throw new TypeError('Frame URL is outside the configured local asset directory: ' + frame.src);
        }
        return Object.freeze({ ...frame, url: url.href });
      }).sort((a, b) => a.angle - b.angle));
      if (this.frames.some((frame, index) => index && frame.angle === this.frames[index - 1].angle)) {
        throw new TypeError('Frame angles must be unique.');
      }
      this.maxConcurrent = limit(options.maxConcurrent, 4, 1, 4);
      this.maxDecoded = limit(options.maxDecoded, 16, 2, 16);
      this.onFrame = typeof options.onFrame === 'function' ? options.onFrame : () => {};
      this.onError = typeof options.onError === 'function' ? options.onError : () => {};
      this.current = null;
      this._cache = new Map();
      this._inflight = new Map();
      this._failed = new Set();
      this._tick = 0;
      this._destroyed = false;
      this._pumping = false;
      this.seek(options.initialAngle ?? this.frames[0].angle);
    }

    static nearestIndex(frames, angle) {
      let low = 0, high = frames.length - 1;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (frames[middle].angle < angle) low = middle + 1;
        else high = middle;
      }
      return low > 0 && angle - frames[low - 1].angle <= frames[low].angle - angle ? low - 1 : low;
    }

    seek(angle) {
      if (this._destroyed) return -1;
      if (!Number.isFinite(angle)) throw new TypeError('Seek angle must be finite.');
      this.requestedAngle = Math.max(0, Math.min(360, angle));
      this._desiredIndex = LCSequence.nearestIndex(this.frames, this.requestedAngle);
      try { this._maybeCommit(); }
      finally { this._trim(); this._pump(); }
      return this._desiredIndex;
    }

    // Rebuilt on every seek/completion, so obsolete queued work never takes priority.
    _candidates() {
      const ordered = this.frames.map((frame, index) => ({ frame, index }))
        .sort((a, b) => Math.abs(a.frame.angle - this.requestedAngle) -
          Math.abs(b.frame.angle - this.requestedAngle) || a.index - b.index);
      const seen = new Set();
      const result = ordered.filter(({ frame }) => {
        if (seen.has(frame.url) || this._failed.has(frame.url)) return false;
        seen.add(frame.url);
        return true;
      }).slice(0, this.maxDecoded);
      // Reserve room for the visible frame until its replacement is decoded.
      if (this.current && result.length === this.maxDecoded &&
          !result.some(({ frame }) => frame.url === this.current.frame.url)) result.pop();
      return result;
    }

    _pump() {
      if (this._destroyed || this._pumping) return;
      this._pumping = true;
      try {
        while (this._inflight.size < this.maxConcurrent) {
          const next = this._candidates().find(({ frame }) =>
            !this._cache.has(frame.url) && !this._inflight.has(frame.url));
          if (!next) break;
          this._load(next.frame);
        }
      } finally { this._pumping = false; }
    }

    _load(frame) {
      const image = new global.Image();
      image.decoding = 'async';
      this._inflight.set(frame.url, image);
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        image.onload = image.onerror = null;
        this._inflight.delete(frame.url);
        if (this._destroyed) return;
        if (error) this._failed.add(frame.url);
        else this._cache.set(frame.url, { image, used: ++this._tick });
        try {
          // Consult the latest desired index, never the one that started this load.
          this._maybeCommit();
          if (error) this.onError(error, frame);
        } finally { this._trim(); this._pump(); }
      };
      image.onload = () => {
        image.onload = image.onerror = null;
        Promise.resolve().then(() => typeof image.decode === 'function' ? image.decode() : undefined)
          .then(() => finish(null), error => finish(error));
      };
      image.onerror = () => finish(new Error('Could not load sequence frame: ' + frame.src));
      try { image.src = frame.url; }
      catch (error) { finish(error); }
    }

    _maybeCommit() {
      if (this._destroyed) return;
      let index = this._desiredIndex;
      let entry = this._cache.get(this.frames[index].url);
      let fallback = false;
      if (!entry) {
        // Failed targets preserve the last good frame. For a failed first frame,
        // show the closest decoded neighbor so the viewer can still start.
        if (this.current || !this._failed.has(this.frames[index].url)) return;
        const alternative = this._candidates().find(({ frame }) => this._cache.has(frame.url));
        if (!alternative) return;
        index = alternative.index;
        entry = this._cache.get(alternative.frame.url);
        fallback = true;
      }
      entry.used = ++this._tick;
      if (this.current?.index === index && this.current.image === entry.image) return;
      const update = { frame: this.frames[index], index, image: entry.image,
        requestedAngle: this.requestedAngle, fallback };
      this.current = update;
      this.onFrame(update);
    }

    _trim() {
      const wanted = new Set(this._candidates().map(({ frame }) => frame.url));
      const removable = [...this._cache.entries()]
        .filter(([url]) => url !== this.current?.frame.url)
        .sort((a, b) => Number(wanted.has(a[0])) - Number(wanted.has(b[0])) || a[1].used - b[1].used);
      while (this._cache.size > this.maxDecoded && removable.length) {
        this._cache.delete(removable.shift()[0]);
      }
    }

    retryFailed() {
      if (this._destroyed) return;
      this._failed.clear();
      this._pump();
    }

    destroy() {
      this._destroyed = true;
      for (const image of this._inflight.values()) image.onload = image.onerror = null;
      this._inflight.clear();
      this._cache.clear();
      this._failed.clear();
      this.current = null;
      this.onFrame = this.onError = () => {};
    }
  }

  global.LCSequence = LCSequence;
})(window);
