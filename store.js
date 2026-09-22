/* 双层本地存储：localStorage（主） + IndexedDB（备）
   目的：某些手机浏览器 / App 内嵌 WebView 会清掉 localStorage 但保留 IndexedDB，
   双写后可在下次打开时自动找回数据。 */
(function () {
  'use strict';

  var DB_NAME = 'cet6-coach';
  var STORE = 'kv';
  var KEY = 'db';

  function open() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no-idb')); return; }
      var r;
      try { r = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error || new Error('idb-open-failed')); };
    });
  }

  function idbGet() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var rq = tx.objectStore(STORE).get(KEY);
        rq.onsuccess = function () { resolve(rq.result || null); };
        rq.onerror = function () { reject(rq.error); };
      });
    });
  }

  function idbPut(obj) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(obj, KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbDel() {
    return open().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    });
  }

  window.CETStore = {
    get: function () {
      if (!window.indexedDB) return Promise.resolve(null);
      return idbGet().catch(function () { return null; });
    },
    put: function (obj) {
      if (!window.indexedDB) return Promise.resolve(false);
      return idbPut(obj).catch(function () { return false; });
    },
    del: function () {
      if (!window.indexedDB) return Promise.resolve(false);
      return idbDel().catch(function () { return false; });
    }
  };
})();
