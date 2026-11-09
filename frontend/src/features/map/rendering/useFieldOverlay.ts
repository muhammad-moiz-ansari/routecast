import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map as GLMap } from "maplibre-gl";
import type { MapProps } from "../components/RouteMap";
import type { Tile, GeometryCache } from "./field";
type ImageTile = { coordinates: any; url: string };
export function useFieldOverlay(
  map: RefObject<GLMap | null>,
  props: MapProps,
  epoch: number,
) {
  const support = useRef<{ key: string; value: GeometryCache } | null>(null);
  const [status, setStatus] = useState("");
  const sequence = useRef(0),
    cache = useRef(new Map<string, ImageTile[]>()),
    installed = useRef<string[]>([]);
  useEffect(() => {
    const m = map.current;
    if (!m || !epoch) return;
    const id = ++sequence.current;
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      for (const name of installed.current) {
        if (m.getLayer(name)) m.removeLayer(name);
        if (m.getSource(name)) m.removeSource(name);
      }
      installed.current = [];
    };
    clear(); // Never leave an old image under a newly selected timestamp, including Risk.
    if (!props.showForecast || !props.corridor) {
      setStatus("");
      return;
    }
    const key = JSON.stringify([
      props.corridor.dataset_id,
      props.corridor.fetched_at,
      props.routes.map((r) => r.geometry),
      props.forecastLayer,
      props.forecastFrame,
    ]);
    const supportKey = JSON.stringify([
      props.corridor.grid,
      props.routes.map((r) => r.geometry),
    ]);
    const publish = (tiles: ImageTile[]) => {
      if (id !== sequence.current || !m.getLayer("route-casing")) return;
      clear();
      tiles.forEach((tile, i) => {
        const name = `weather-raster-${i}`;
        m.addSource(name, {
          type: "image",
          url: tile.url,
          coordinates: tile.coordinates,
        });
        installed.current.push(name);
        m.addLayer(
          {
            id: name,
            type: "raster",
            source: name,
            paint: {
              "raster-opacity": 1,
              "raster-fade-duration": 0,
              "raster-resampling": "linear",
            },
          },
          "route-casing",
        );
      });
      setStatus("");
    };
    const cached = cache.current.get(key);
    if (cached) {
      cache.current.delete(key);
      cache.current.set(key, cached);
      publish(cached);
      return;
    }
    setStatus("Updating forecast view…");
    timer = setTimeout(() => {
      try {
        worker = new Worker(new URL("./field.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onmessage = ({
          data,
        }: {
          data: {
            id: number;
            error?: string;
            tiles: Tile[];
            geometry?: GeometryCache;
          };
        }) => {
          if (data.id !== sequence.current) return;
          try {
            if (data.error) throw Error(data.error);
            if (data.geometry)
              support.current = { key: supportKey, value: data.geometry };
            const images = data.tiles.map((tile) => {
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 128;
              const context = canvas.getContext("2d");
              if (!context) throw Error("Canvas unavailable");
              context.putImageData(
                new ImageData(new Uint8ClampedArray(tile.pixels), 128, 128),
                0,
                0,
              );
              return { url: canvas.toDataURL(), coordinates: tile.coordinates };
            });
            cache.current.set(key, images);
            while (cache.current.size > 6)
              cache.current.delete(cache.current.keys().next().value!);
            publish(images);
          } catch (e) {
            clear();
            setStatus(
              `Overlay unavailable: ${String(e)} Use forecast sample values.`,
            );
          } finally {
            worker?.terminate();
          }
        };
        worker.onerror = () => {
          if (id === sequence.current) {
            clear();
            setStatus("Overlay unavailable. Use forecast sample values.");
          }
          worker?.terminate();
        };
        worker.postMessage({
          id,
          geometry:
            support.current?.key === supportKey ? support.current.value : {},
          dataset: props.corridor,
          routes: props.routes,
          layer: props.forecastLayer ?? "wind_mph",
          frame: props.forecastFrame ?? 0,
        });
      } catch (e) {
        setStatus(`Overlay unavailable: ${String(e)}`);
      }
    }, 40);
    return () => {
      ++sequence.current;
      if (timer) clearTimeout(timer);
      worker?.terminate();
      clear();
    };
  }, [
    props.corridor,
    props.routes,
    props.forecastFrame,
    props.forecastLayer,
    props.showForecast,
    epoch,
  ]);
  useEffect(
    () => () => {
      cache.current.clear();
      support.current = null;
    },
    [],
  );
  return status;
}
