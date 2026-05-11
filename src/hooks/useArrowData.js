import {useState, useEffect, useRef} from 'react';
import {tableFromIPC} from 'apache-arrow';

/**
 * Stream an Apache Arrow IPC file and return the parsed Table.
 *
 * deck.gl accepts Arrow Tables directly as the `data` prop — the layer
 * reads column buffers without copying them into JS objects, giving
 * zero-copy GPU upload for millions of rows.
 *
 * @param {string|null} url  Public URL to the .arrow file
 * @returns {{ table: import('apache-arrow').Table|null, loading: boolean, error: Error|null }}
 */
export function useArrowData(url) {
  const [table, setTable]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const abortRef              = useRef(null);

  useEffect(() => {
    if (!url) {
      setTable(null);
      return;
    }

    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    setLoading(true);
    setError(null);

    fetch(url, {signal: controller.signal})
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
        return res.arrayBuffer();
      })
      .then(buffer => tableFromIPC(new Uint8Array(buffer)))
      .then(t => {
        setTable(t);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [url]);

  return {table, loading, error};
}
